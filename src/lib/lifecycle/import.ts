import { and, eq, isNull, sql } from 'drizzle-orm';
import { requireUser } from '../api';
import { isUsgAdmin } from '../authz';
import { now } from '../clock';
import { getConnectors, recordRosterSync } from '../connectors/registry';
import { AppError, type Actor, type AuditEvent, type RosterRow } from '../contracts';
import { getDb } from '../db/client';
import { memberships, orgs, positions, rosterState, users } from '../db/schema';
import { provisionOrg } from '../distribution';
import { audit } from '../gateway/audit';

export interface RosterImportResult {
  readonly orgsCreated: number;
  readonly usersCreated: number;
  readonly positionsCreated: number;
  readonly membershipsStarted: number;
  readonly membershipsEnded: number;
  readonly positionsChanged: number;
  readonly installationsCreated: number;
  readonly clubs: Array<{ orgId: string; orgName: string; created: boolean; positionsChanged: number; installationsCreated: number }>;
}

const invalid = (message: string) => new AppError({ code: 'invalid', message });

export async function requireRosterAdmin(actor: Actor): Promise<void> {
  requireUser(actor);
  if (!(await isUsgAdmin(actor))) throw new AppError({ code: 'forbidden', message: 'Only a USG administrator acting in USG can sync the roster.' });
}

function groupRoster(rows: readonly RosterRow[]) {
  if (!rows.length) throw invalid('The roster is empty. Restore its rows before syncing.');
  const clubs = new Map<string, { name: string; holders: Map<string, Set<string>> }>();
  const people = new Map<string, string>();
  for (const row of rows) {
    let club = clubs.get(row.orgSlug);
    if (club && club.name !== row.orgName) throw invalid(`The roster has conflicting names for ${row.orgSlug}. Correct the source and retry.`);
    if (!club) clubs.set(row.orgSlug, club = { name: row.orgName, holders: new Map() });
    const person = people.get(row.externalUserId);
    if (person && person !== row.userDisplayName) throw invalid('The roster has conflicting names for one user. Correct the source and retry.');
    people.set(row.externalUserId, row.userDisplayName);
    let holders = club.holders.get(row.position);
    if (!holders) club.holders.set(row.position, holders = new Set());
    holders.add(row.externalUserId);
  }
  return { clubs, people };
}

async function reconcileRoster(rows: readonly RosterRow[], event: AuditEvent) {
  const incoming = groupRoster(rows);
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('trojanops.roster.import'))`);
    const timestamp = now();
    const counts = { orgsCreated: 0, orgsUpdated: 0, usersCreated: 0, usersUpdated: 0, positionsCreated: 0, membershipsStarted: 0, membershipsEnded: 0, positionsChanged: 0 };
    const existingOrgs = new Map((await tx.select().from(orgs)).map((o) => [o.slug, o]));
    const existingUsers = new Map((await tx.select().from(users)).map((u) => [u.externalId, u]));
    const baseline = await tx.select().from(rosterState);
    for (const [externalId, displayName] of incoming.people) {
      const user = existingUsers.get(externalId);
      if (user) {
        if (user.displayName !== displayName) {
          await tx.update(users).set({ displayName }).where(eq(users.id, user.id));
          counts.usersUpdated++;
        }
      } else {
        const [created] = await tx.insert(users).values({ externalId, displayName, createdAt: timestamp }).returning();
        if (!created) throw invalid('The roster user could not be created. Retry the sync.');
        existingUsers.set(externalId, created);
        counts.usersCreated++;
      }
    }
    const trackedSlugs = new Set([...incoming.clubs.keys(), ...[...existingOrgs.values()]
      .filter((o) => o.kind === 'rso' && baseline.some((b) => b.orgId === o.id)).map((o) => o.slug)]);
    const clubs: RosterImportResult['clubs'] = [];
    for (const slug of [...trackedSlugs].sort()) {
      const desired = incoming.clubs.get(slug);
      let club = existingOrgs.get(slug);
      const created = !club;
      if (club && (club.kind !== 'rso' || club.status !== 'active')) throw invalid('The club roster cannot modify USG or an inactive organization. Correct the source and retry.');
      if (!club && desired) {
        [club] = await tx.insert(orgs).values({ slug, name: desired.name, kind: 'rso', createdAt: timestamp }).returning();
        counts.orgsCreated++;
      }
      if (!club) throw invalid('The roster club could not be created. Retry the sync.');
      if (desired && club.name !== desired.name) {
        await tx.update(orgs).set({ name: desired.name }).where(eq(orgs.id, club.id));
        counts.orgsUpdated++;
      }
      const clubResult = { orgId: club.id, orgName: desired?.name ?? club.name, created, positionsChanged: 0, installationsCreated: 0 };
      const previousRows = baseline.filter((b) => b.orgId === club.id);
      const positionSlugs = new Set([...(desired?.holders.keys() ?? []), ...previousRows.map((b) => b.positionSlug)]);
      for (const positionSlug of positionSlugs) {
        const desiredHolders = desired?.holders.get(positionSlug) ?? new Set<string>();
        const previousHolders = previousRows.filter((b) => b.positionSlug === positionSlug).map((b) => b.externalUserId);
        const removed = previousHolders.filter((u) => !desiredHolders.has(u));
        const added = [...desiredHolders].filter((u) => !previousHolders.includes(u));
        if (!removed.length && !added.length) continue;
        let [position] = await tx.select().from(positions).where(and(eq(positions.orgId, club.id), eq(positions.slug, positionSlug)));
        if (!position) {
          [position] = await tx.insert(positions).values({ orgId: club.id, slug: positionSlug,
            name: positionSlug.charAt(0).toUpperCase() + positionSlug.slice(1), isOfficer: positionSlug !== 'member', createdAt: timestamp }).returning();
          counts.positionsCreated++;
        }
        if (!position) throw invalid('The roster position could not be created. Retry the sync.');
        const desiredUserIds = [...desiredHolders].map((externalId) => {
          const user = existingUsers.get(externalId);
          if (!user) throw invalid('A roster user is missing. Correct the source and retry.');
          return user.id;
        });
        const active = await tx.select().from(memberships).where(and(eq(memberships.orgId, club.id), eq(memberships.positionId, position.id), isNull(memberships.endedAt)));
        for (const membership of active.filter((m) => !desiredUserIds.includes(m.userId))) {
          await tx.update(memberships).set({ endedAt: timestamp }).where(eq(memberships.id, membership.id));
          counts.membershipsEnded++;
        }
        for (const userId of desiredUserIds.filter((id) => !active.some((m) => m.userId === id))) {
          await tx.insert(memberships).values({ userId, orgId: club.id, positionId: position.id, source: 'roster', startedAt: timestamp, createdAt: timestamp });
          counts.membershipsStarted++;
        }
        for (const [index, externalUserId] of added.entries()) {
          const previous = removed[index];
          if (previous) {
            await tx.update(rosterState).set({ externalUserId, importedAt: timestamp }).where(and(eq(rosterState.orgId, club.id), eq(rosterState.positionSlug, positionSlug), eq(rosterState.externalUserId, previous)));
          } else {
            await tx.insert(rosterState).values({ orgId: club.id, positionSlug, externalUserId, importedAt: timestamp, createdAt: timestamp });
          }
        }
        for (const externalUserId of removed.slice(added.length)) {
          await tx.delete(rosterState).where(and(eq(rosterState.orgId, club.id), eq(rosterState.positionSlug, positionSlug), eq(rosterState.externalUserId, externalUserId)));
        }
        clubResult.positionsChanged++;
        counts.positionsChanged++;
      }
      clubs.push(clubResult);
    }
    // The audit row commits with the roster changes: if it can't be written, nothing changes.
    try {
      await audit('roster.import', { ...event, details: counts }, tx);
    } catch (cause) {
      console.error('roster import: the roster.import audit failed', cause);
      throw new AppError({ code: 'invalid', message: 'The roster sync could not be recorded in the audit log, so no changes were applied. Retry the sync.' });
    }
    return { ...counts, clubs };
  });
}

export async function importRoster(actor: Actor): Promise<RosterImportResult> {
  await requireRosterAdmin(actor);
  const event: AuditEvent = { actorUserId: actor.userId, actingOrgId: actor.activeOrgId, targetType: 'connector', targetId: 'roster', details: {} };
  try {
    const roster = await reconcileRoster(await getConnectors().roster.fetch(), event);
    const { clubs, ...counts } = roster;
    const provisioned: RosterImportResult['clubs'] = [];
    for (const club of clubs) {
      const { installed } = await provisionOrg(club.orgId, actor);
      provisioned.push({ ...club, installationsCreated: installed });
    }
    const result = { ...counts, installationsCreated: provisioned.reduce((sum, c) => sum + c.installationsCreated, 0) };
    await audit('connector.sync', { ...event, details: { ...result, changes: roster.positionsChanged, succeeded: true } });
    await recordRosterSync({ status: 'ok', lastSyncAt: now(), details: result });
    return { ...result, clubs: provisioned };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    const failures: Error[] = [error];
    for (const recordFailure of [
      () => recordRosterSync({ status: 'degraded' }),
      () => audit('connector.sync', { ...event, details: { succeeded: false } }),
    ]) {
      try {
        await recordFailure();
      } catch (recordError) {
        if (!(recordError instanceof Error)) throw recordError;
        failures.push(recordError);
      }
    }
    // An AppError already carries UI copy for route(); secondary recording failures must not hide it behind an opaque 500.
    if (error instanceof AppError) throw error;
    throw failures.length === 1 ? error : new AggregateError(failures, error.message, { cause: error });
  }
}
