// Owner: C (WP-9). Data for the club and USG audit views, /org/[orgId]/audit and /usg/audit (§12,
// §14, demo beat D8). Rows come from A's listAudit, which decides who may read which club. Names are
// resolved here; document titles resolve under the viewer's own RLS, so a document the viewer can't
// read reaches the page with neither title nor id ("Restricted document"). Audit rows hold ids and numbers only
// (I8), and this module never reads run rows or their input and output (I15).
import { asc, eq, inArray } from 'drizzle-orm';
import { auditTime, humanizeTool, ptDate } from '@/components/inspector/format';
import { requireUser } from '../api';
import { isUsgAdmin, isUuid } from '../authz';
import { now } from '../clock';
import { AppError, type Actor, type AuditEntry } from '../contracts';
import { getDb } from '../db/client';
import { agentInstallations, agentTemplates, documents, orgs, positions, rulePacks, sources, users } from '../db/schema';
import { withActor } from '../db/with-actor';
import { listAudit } from '../gateway/audit';
import { ACTION_LABELS, RESTRICTED_DOCUMENT, type AuditRow } from './audit-row';

export { ACTION_LABELS, RESTRICTED_DOCUMENT, type AuditRow } from './audit-row';

/** listAudit's maximum page. A view with this many rows says older rows are not shown. */
export const AUDIT_LIMIT = 1000;

export type AuditScope = { kind: 'club'; orgId: string } | { kind: 'usg'; orgId?: string };

export interface AuditPageData {
  scope: AuditScope;
  /** Club scope: the club. USG scope: the club filter's club, or null for all clubs. */
  org: { id: string; name: string } | null;
  /** USG scope: every club, for the club filter, by name. Empty in club scope. */
  clubs: Array<{ id: string; name: string }>;
  /** Newest first. */
  rows: AuditRow[];
  /** True when the view hit AUDIT_LIMIT, so older rows are not shown. */
  truncated: boolean;
  /** Today in Pacific time ("2026-11-15"), from the clock (I9): the date filter's default and the
   * CSV file name. */
  today: string;
}

const QUOTA_TARGETS: Record<string, string> = {
  platform: 'Platform',
  student_daily: 'Student daily limit',
  org: 'Club quota',
};

type Named = { id: string; name: string };
const uuids = (ids: Iterable<string | null | undefined>) =>
  [...new Set([...ids].filter((id): id is string => typeof id === 'string' && isUuid(id)))];
const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/**
 * The audit view for a club (president of that club, or a USG admin) or for USG (USG admin only).
 * null when the club (or the USG view's club filter) is not a uuid or does not exist, so the page
 * can 404. A viewer who may not read the view gets AppError `forbidden`.
 */
export async function getAuditPageData(viewer: Actor, scope: AuditScope): Promise<AuditPageData | null> {
  requireUser(viewer);
  // listAudit gives a president their own club when no org is named; the USG view is admins only.
  if (scope.kind === 'usg' && !(await isUsgAdmin(viewer))) {
    throw new AppError({ code: 'forbidden', message: 'Only USG admins can read the USG audit log.' });
  }

  const db = getDb();
  let org: Named | null = null;
  if (scope.orgId !== undefined) {
    if (!isUuid(scope.orgId)) return null;
    const [found] = await db.select({ id: orgs.id, name: orgs.name }).from(orgs).where(eq(orgs.id, scope.orgId));
    if (!found) return null;
    org = found;
  }

  // Forbidden (not a president or admin, or another club's president) propagates to the page.
  const entries = await listAudit(viewer, { ...(org ? { orgId: org.id } : {}), limit: AUDIT_LIMIT });
  const clubs = scope.kind === 'usg'
    ? await db.select({ id: orgs.id, name: orgs.name }).from(orgs).where(eq(orgs.kind, 'rso')).orderBy(asc(orgs.name))
    : [];

  return {
    scope,
    org,
    clubs,
    rows: await toRows(viewer, entries),
    truncated: entries.length === AUDIT_LIMIT,
    today: ptDate(now()),
  };
}

async function toRows(viewer: Actor, entries: AuditEntry[]): Promise<AuditRow[]> {
  if (entries.length === 0) return [];
  const db = getDb();
  const ofType = (type: string) => entries.filter((e) => e.targetType === type).map((e) => e.targetId);

  // Agents: the name an agent shows is its template's name; one join gives it and the club, for
  // only the installations these rows mention (no need to compose every agent on campus).
  const installationIds = uuids([...entries.map((e) => e.installationId), ...ofType('installation')]);
  const agents = new Map<string, { name: string; orgId: string }>();
  if (installationIds.length > 0) {
    const rows = await db.select({ id: agentInstallations.id, orgId: agentInstallations.orgId, name: agentTemplates.name })
      .from(agentInstallations).innerJoin(agentTemplates, eq(agentTemplates.id, agentInstallations.templateId))
      .where(inArray(agentInstallations.id, installationIds));
    for (const r of rows) agents.set(r.id, { name: r.name, orgId: r.orgId });
  }
  const agentOf = (id: string | undefined) => (id ? agents.get(id) : undefined);

  const orgIds = uuids([
    ...entries.map((e) => e.actingOrgId), ...ofType('org'), ...[...agents.values()].map((a) => a.orgId),
  ]);
  const userIds = uuids(entries.map((e) => e.actorUserId));
  const templateIds = uuids(ofType('template'));
  const positionIds = uuids(ofType('position'));
  const rulePackSlugs = [...new Set(ofType('rule_pack'))];
  const documentIds = uuids(entries.flatMap((e) => [
    ...stringArray(e.details.documentIds), ...(e.targetType === 'document' ? [e.targetId] : []),
  ]));

  const byId = (rows: Named[]) => new Map(rows.map((r) => [r.id, r.name]));
  const orgNames = byId(orgIds.length ? await db.select({ id: orgs.id, name: orgs.name }).from(orgs).where(inArray(orgs.id, orgIds)) : []);
  const userNames = byId(userIds.length ? await db.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.id, userIds)) : []);
  const templateNames = byId(templateIds.length ? await db.select({ id: agentTemplates.id, name: agentTemplates.name }).from(agentTemplates).where(inArray(agentTemplates.id, templateIds)) : []);
  const positionNames = byId(positionIds.length ? await db.select({ id: positions.id, name: positions.name }).from(positions).where(inArray(positions.id, positionIds)) : []);
  const packs = rulePackSlugs.length
    ? await db.select({ slug: rulePacks.slug, version: rulePacks.version, label: rulePacks.label }).from(rulePacks)
      .where(inArray(rulePacks.slug, rulePackSlugs)).orderBy(asc(rulePacks.version))
    : [];
  const titles = await readableTitles(viewer, documentIds);

  const club = (id: string | null | undefined): Named | null =>
    id && orgNames.has(id) ? { id, name: orgNames.get(id)! } : null;

  function target(e: AuditEntry): AuditRow['target'] {
    const t = (label: string, restricted = false) => ({ type: e.targetType, label, restricted });
    switch (e.targetType) {
      case 'run':
        return t(agentOf(e.installationId)?.name ?? 'Agent run');
      case 'installation':
        return t(agentOf(e.targetId)?.name ?? 'Unknown agent');
      case 'pending_action':
        return t(typeof e.details.tool === 'string' ? humanizeTool(e.details.tool) : 'Pending action');
      case 'document': {
        const title = titles.get(e.targetId) ?? null;
        return title === null ? t(RESTRICTED_DOCUMENT, true) : t(title);
      }
      case 'org':
        return t(orgNames.get(e.targetId) ?? 'Unknown club');
      case 'position':
        return t(positionNames.get(e.targetId) ?? 'Unknown position');
      case 'template':
        return t(templateNames.get(e.targetId) ?? 'Unknown template');
      case 'rule_pack': {
        const ofSlug = packs.filter((p) => p.slug === e.targetId);
        const exact = ofSlug.find((p) => p.version === e.details.version);
        if (exact) return t(`${exact.label} v${exact.version}`);
        return t(ofSlug.at(-1)?.label ?? 'Rule pack');
      }
      case 'connector':
        return t(`${humanizeTool(e.targetId)} connector`);
      case 'platform':
      case 'quota_limit':
        return t(QUOTA_TARGETS[e.targetId] ?? 'Platform');
      default:
        // An unknown target type: name the type only, never the id or anything it could point at.
        return t(humanizeTool(e.targetType));
    }
  }

  return entries.map((e) => ({
    id: e.id,
    ts: e.ts.toISOString(),
    time: auditTime(e.ts),
    date: ptDate(e.ts),
    actor: e.actorUserId ? { id: e.actorUserId, name: userNames.get(e.actorUserId) ?? 'Unknown user' } : null,
    action: e.action,
    actionLabel: ACTION_LABELS[e.action] ?? e.action,
    club: club(agentOf(e.installationId ?? (e.targetType === 'installation' ? e.targetId : undefined))?.orgId)
      ?? club(e.targetType === 'org' ? e.targetId : null)
      ?? club(e.actingOrgId),
    target: target(e),
    documents: uuids(stringArray(e.details.documentIds)).map((id) => {
      const title = titles.get(id);
      return title === undefined ? { id: null, title: null } : { id, title };
    }),
  }));
}

/**
 * Titles of the given documents that the viewer can read with their own grants (actor.grants, the
 * active org's memberships, I3). RLS decides; a document missing from the result is unreadable.
 * TODO(verify): the source scope is every source, so any document the viewer's grants reach shows its
 * title, not only those in the viewed club. §12 says "under the viewer's RLS" without a source scope.
 */
async function readableTitles(viewer: Actor, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const sourceIds = (await getDb().select({ id: sources.id }).from(sources)).map((s) => s.id);
  // No tier ceiling and no readability check here: the documents_read policy is the filter.
  const rows = await withActor(viewer, { sourceIds }, (tx) =>
    tx.select({ id: documents.id, title: documents.title }).from(documents).where(inArray(documents.id, ids)));
  return new Map(rows.map((r) => [r.id, r.title]));
}
