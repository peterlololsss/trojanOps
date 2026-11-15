// Owner: A (WP-4). Quota and billing (§7 step 4, §11, I8–I11) on `quota_limits` and `ai_usage`.
//
// Ledger: spent = sum(amount_micro) of `ai_usage` rows since the period start. A hold is +H, a settle
// is (actual − H) and a release is −H, so a finished run nets to its cost and a failed or stale one to 0.
// Limits and spend are read from the DB on every call (I10). Every check-and-write runs under one
// advisory lock, so two runs cannot both pass at the limit.
//
// A level with no limit row: platform, club and student_daily fail closed (limit 0); member and
// installation inherit the club's limit. TODO(verify): confirm with B (provisionOrg, publish).
import { and, desc, eq, gte, isNull, sql, type SQL } from 'drizzle-orm';
import {
  AppError, type Actor, type EffectiveAgent, type QuotaRemaining, type QuotaScope, type QuotaTarget,
} from '../contracts';
import { activeMemberships, isUsgAdmin } from '../authz';
import { now } from '../clock';
import { getDb, type Db, type Tx } from '../db/client';
import { agentInstallations, aiUsage, orgs, quotaLimits } from '../db/schema';
import { MOCK_COST_MICRO } from '../runtime/mock';
import { audit } from './audit';
import { periodStart } from './period';
import { quotaMessage, usd } from './quota-messages';

const STALE_HOLD_MS = 10 * 60_000;

const lock = (tx: Tx) => tx.execute(sql`select pg_advisory_xact_lock(hashtext('trojanops:quota'))`);

/** Keeps only the fields that identify the scope's limit. */
function normalize(t: QuotaTarget): QuotaTarget {
  switch (t.scope) {
    case 'platform':
      return { scope: 'platform' };
    case 'student_daily': // the limit is global; the user matters only for spend
      return { scope: 'student_daily', userId: t.userId };
    case 'org':
      return { scope: 'org', orgId: t.orgId };
    case 'member':
      return { scope: 'member', orgId: t.orgId, userId: t.userId };
    case 'installation':
      return { scope: 'installation', installationId: t.installationId };
  }
}

function requireFields(t: QuotaTarget): void {
  const missing =
    (t.scope === 'org' && !t.orgId) ||
    (t.scope === 'member' && (!t.orgId || !t.userId)) ||
    (t.scope === 'installation' && !t.installationId);
  if (missing) throw new AppError({ code: 'invalid', message: `A ${t.scope} limit needs its ${t.scope === 'installation' ? 'installation' : t.scope === 'member' ? 'club and member' : 'club'}.` });
}

/** The limit row's own key. An installation row also stores its club, so it is not part of the key. */
function keyConditions(t: QuotaTarget): SQL[] {
  const c: SQL[] = [eq(quotaLimits.scope, t.scope)];
  c.push(t.scope === 'org' || t.scope === 'member' ? eq(quotaLimits.orgId, t.orgId!) : t.scope === 'installation' ? sql`true` : isNull(quotaLimits.orgId));
  c.push(t.scope === 'member' ? eq(quotaLimits.userId, t.userId!) : isNull(quotaLimits.userId));
  c.push(t.scope === 'installation' ? eq(quotaLimits.installationId, t.installationId!) : isNull(quotaLimits.installationId));
  return c;
}

async function limitRow(tx: Tx, t: QuotaTarget): Promise<{ id: string; limitMicro: number } | null> {
  const [row] = await tx.select({ id: quotaLimits.id, limitMicro: quotaLimits.limitMicro })
    .from(quotaLimits)
    .where(and(...keyConditions(t)))
    .orderBy(desc(quotaLimits.setAt), desc(quotaLimits.createdAt))
    .limit(1);
  return row ?? null;
}

async function installationOrg(tx: Pick<Db, 'select'>, installationId: string): Promise<string | null> {
  const [row] = await tx.select({ orgId: agentInstallations.orgId }).from(agentInstallations)
    .where(eq(agentInstallations.id, installationId));
  return row?.orgId ?? null;
}

/** Spend at one level since its period start. */
async function spentMicro(tx: Tx, t: QuotaTarget, at: Date): Promise<number> {
  if (t.scope === 'student_daily' && !t.userId) throw new AppError({ code: 'invalid', message: 'The student daily cap is spent per student: pass the userId.' });
  const conditions: SQL[] = [gte(aiUsage.createdAt, periodStart(t.scope === 'student_daily' ? 'day' : 'month', at))];
  if (t.scope === 'org' || t.scope === 'member') conditions.push(eq(aiUsage.billedOrgId, t.orgId!));
  if (t.scope === 'member' || t.scope === 'student_daily') conditions.push(eq(aiUsage.userId, t.userId!));
  if (t.scope === 'student_daily') conditions.push(eq(aiUsage.isPublic, true));
  if (t.scope === 'installation') conditions.push(eq(aiUsage.installationId, t.installationId!));
  const [row] = await tx.select({ total: sql<string>`coalesce(sum(${aiUsage.amountMicro}), 0)` })
    .from(aiUsage).where(and(...conditions));
  return Number(row.total);
}

/** Releases holds with no settle or release after 10 minutes (a run that died mid-flight). The release
 * is stamped with its hold's own time, so both rows fall in the same period even when the release
 * happens after a day or month boundary. */
async function releaseStaleHolds(tx: Tx, at: Date): Promise<void> {
  const cutoff = new Date(at.getTime() - STALE_HOLD_MS).toISOString();
  await tx.execute(sql`
    insert into ai_usage (id, run_id, billed_org_id, user_id, installation_id, is_public, model, kind, amount_micro, created_at)
    select gen_random_uuid(), h.run_id, h.billed_org_id, h.user_id, h.installation_id, h.is_public, h.model,
           'release', -h.amount_micro, h.created_at
    from ai_usage h
    where h.kind = 'hold' and h.created_at < ${cutoff}::timestamptz
      and not exists (select 1 from ai_usage s where s.run_id = h.run_id and s.kind in ('settle', 'release'))`);
}

/** Limit, spent and remaining for one level, in micro-USD, for the current period. A member or
 * installation without its own limit reports the club's. `student_daily` needs the student's userId
 * (its limit is global, its spend is per student). A read never waits for the lock: if a hold or
 * setLimit has it, stale holds are left for that writer's next pass. */
export async function remaining(target: QuotaTarget): Promise<QuotaRemaining> {
  const t = normalize(target);
  requireFields(t);
  const at = now();
  return getDb().transaction(async (tx) => {
    await releaseStaleHoldsIfFree(tx, at);
    return levelRemaining(tx, t, at);
  });
}

/** The non-blocking stale release a read does: skipped when a writer holds the lock. */
async function releaseStaleHoldsIfFree(tx: Tx, at: Date): Promise<void> {
  const [{ free }] = await tx.execute<{ free: boolean }>(sql`select pg_try_advisory_xact_lock(hashtext('trojanops:quota')) as free`);
  if (free) await releaseStaleHolds(tx, at);
}

/** One level's limit and spend inside an open transaction (no stale release). */
async function levelRemaining(tx: Tx, t: QuotaTarget, at: Date): Promise<QuotaRemaining> {
  let limit = (await limitRow(tx, t))?.limitMicro;
  if (limit === undefined && (t.scope === 'member' || t.scope === 'installation')) {
    const orgId = t.scope === 'member' ? t.orgId! : await installationOrg(tx, t.installationId!);
    limit = orgId ? (await limitRow(tx, { scope: 'org', orgId }))?.limitMicro : undefined;
  }
  const limitMicro = limit ?? 0;
  const spent = await spentMicro(tx, t, at);
  return { scope: t.scope, limitMicro, spentMicro: spent, remainingMicro: Math.max(0, limitMicro - spent) };
}

// ---------------------------------------------------------------------------------------------
// setLimit

const PARENT: Record<QuotaScope, string | null> = {
  platform: null, org: 'the platform limit', student_daily: null, member: 'club', installation: 'club',
};

/** Sets a limit (§11, §14). USG admins set platform, club and student_daily limits; a club's president
 * sets member and installation limits in their active club. A child cannot exceed its parent. */
export async function setLimit(actor: Actor, input: QuotaTarget & { limitMicro: number }): Promise<void> {
  if (!actor.userId) throw new AppError({ code: 'unauthenticated', message: 'Choose a persona to sign in.' });
  const userId = actor.userId;
  const target = normalize(input);
  requireFields(target);
  if (!Number.isSafeInteger(input.limitMicro) || input.limitMicro < 0) {
    throw new AppError({ code: 'invalid', message: 'A limit must be a whole number of micro-dollars, zero or more.' });
  }

  const usgScope = target.scope === 'platform' || target.scope === 'org' || target.scope === 'student_daily';
  const allowed = usgScope
    ? await isUsgAdmin(actor)
    : actor.positions.includes('president') && !!actor.activeOrgId;
  const event = { actorUserId: userId, actingOrgId: actor.activeOrgId };
  // The denial names the club or agent it concerned, so that club's president sees it in their audit view.
  const subject = target.scope === 'member' ? { targetType: 'org', targetId: target.orgId! }
    : target.scope === 'installation' ? { targetType: 'installation', targetId: target.installationId!, installationId: target.installationId }
    : { targetType: 'quota_limit', targetId: target.scope };
  const deny = async (reason: string): Promise<never> => {
    await audit('authz.denied', { ...event, ...subject, details: { reason, scope: target.scope } });
    throw new AppError({
      code: 'forbidden',
      message: usgScope ? 'Only USG admins can set this limit.' : 'Only your club president can set this limit.',
    });
  };
  if (!allowed) return deny('quota_limit_forbidden');

  // A president's reach is their active club; resolve the club each scope belongs to.
  let orgId = target.orgId ?? null;
  let installationOrgId: string | null = null;
  if (target.scope === 'installation') {
    installationOrgId = await installationOrg(getDb(), target.installationId!);
    if (!installationOrgId) return deny('other_club'); // same answer as another club's agent: no existence oracle
    orgId = installationOrgId;
  }
  if (!usgScope && orgId !== actor.activeOrgId) return deny('other_club');
  if (target.scope === 'member') {
    const held = await activeMemberships(target.userId!);
    if (!held?.some((m) => m.orgId === orgId)) {
      throw new AppError({ code: 'not_found', message: 'That person is not a member of this club.' });
    }
  }

  const written = await getDb().transaction(async (tx) => {
    await lock(tx);
    let clubName: string | null = null;
    if (target.scope === 'org') {
      const [org] = await tx.select({ kind: orgs.kind }).from(orgs).where(eq(orgs.id, orgId!));
      if (org?.kind !== 'rso') throw new AppError({ code: 'not_found', message: 'That club does not exist.' });
    }

    // Child ≤ parent. A missing parent limit counts as 0.
    if (PARENT[target.scope]) {
      const parent: QuotaTarget = PARENT[target.scope] === 'club' ? { scope: 'org', orgId: orgId! } : { scope: 'platform' };
      const parentLimit = (await limitRow(tx, parent))?.limitMicro ?? 0;
      if (input.limitMicro > parentLimit) {
        if (parent.scope === 'org') {
          [{ name: clubName }] = await tx.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, orgId!));
        }
        const what = { org: "A club's quota", student_daily: '', member: "A member's limit", installation: "An agent's budget", platform: '' }[target.scope];
        const parentName = parent.scope === 'org' ? `${clubName}'s monthly quota` : 'the platform limit';
        throw new AppError({
          code: 'clamp_violation',
          message: `${what} cannot exceed ${parentName} (${usd(parentLimit)}).`,
          cap: { scope: parent.scope, limitMicro: parentLimit, field: 'limitMicro', allowed: parentLimit },
        });
      }
    }

    const existing = await limitRow(tx, target);
    const at = now();
    if (existing) {
      await tx.update(quotaLimits).set({ limitMicro: input.limitMicro, setBy: userId, setAt: at })
        .where(eq(quotaLimits.id, existing.id));
    } else {
      await tx.insert(quotaLimits).values({
        scope: target.scope,
        orgId: target.scope === 'platform' || target.scope === 'student_daily' ? null : orgId,
        userId: target.scope === 'member' ? target.userId! : null,
        installationId: target.scope === 'installation' ? target.installationId! : null,
        limitMicro: input.limitMicro,
        setBy: userId,
        setAt: at,
        createdAt: at,
      });
    }
    return { previousMicro: existing?.limitMicro ?? null };
  });

  const onClub = target.scope === 'org' || target.scope === 'member';
  await audit('quota.limit.set', {
    ...event,
    ...(target.scope === 'installation' ? { installationId: target.installationId } : {}),
    targetType: onClub ? 'org' : target.scope === 'installation' ? 'installation' : 'platform',
    targetId: onClub ? orgId! : target.scope === 'installation' ? target.installationId! : target.scope,
    details: {
      scope: target.scope,
      limitMicro: input.limitMicro,
      previousMicro: written.previousMicro,
      ...(target.scope === 'member' ? { userId: target.userId! } : {}),
    },
  });
}

// ---------------------------------------------------------------------------------------------
// hold and settle

export interface QuotaHold {
  runId: string;
  holdMicro: number;
  billedOrgId: string;
  userId: string;
  installationId: string;
  isPublic: boolean;
  /** Whether the user was an active member of the billed club when the hold was taken. */
  isMember: boolean;
  /** When the hold was written. The settle row is stamped with it, so both fall in one period. */
  createdAt: Date;
}

/** §7 step 4: holds the estimated cost (mock: a flat $0.01), or blocks with quota.blocked and 429
 * quota_exceeded before the runtime is called. Checks, in order: member (an active member of the
 * billed club, whatever the audience), student_daily (public agents), installation, club, platform. */
export async function hold(
  agent: EffectiveAgent, userId: string, actingOrgId: string | null, runId: string, club: string,
): Promise<QuotaHold> {
  const holdMicro = MOCK_COST_MICRO;
  const at = now();
  const held: QuotaHold = {
    runId, holdMicro, billedOrgId: agent.orgId, userId, installationId: agent.installationId, isPublic: agent.audience === 'public',
    createdAt: at, isMember: false,
  };
  const isMember = (await activeMemberships(userId))?.some((m) => m.orgId === agent.orgId) ?? false;
  held.isMember = isMember;

  const blocked = await getDb().transaction(async (tx) => {
    await lock(tx);
    await releaseStaleHolds(tx, at);
    const levels: Array<{ target: QuotaTarget; limit: number | null }> = [];
    if (isMember) {
      const target: QuotaTarget = { scope: 'member', orgId: agent.orgId, userId };
      levels.push({ target, limit: (await limitRow(tx, target))?.limitMicro ?? null }); // no row: the club limit covers it
    }
    if (held.isPublic) {
      const target: QuotaTarget = { scope: 'student_daily', userId };
      levels.push({ target, limit: (await limitRow(tx, { scope: 'student_daily' }))?.limitMicro ?? 0 });
    }
    const installation: QuotaTarget = { scope: 'installation', installationId: agent.installationId };
    levels.push({ target: installation, limit: (await limitRow(tx, installation))?.limitMicro ?? null });
    const clubTarget: QuotaTarget = { scope: 'org', orgId: agent.orgId };
    levels.push({ target: clubTarget, limit: (await limitRow(tx, clubTarget))?.limitMicro ?? 0 });
    levels.push({ target: { scope: 'platform' }, limit: (await limitRow(tx, { scope: 'platform' }))?.limitMicro ?? 0 });

    for (const { target, limit } of levels) {
      if (limit === null) continue;
      const spent = await spentMicro(tx, target, at);
      if (limit === 0 || spent + holdMicro > limit) return { scope: target.scope, limitMicro: limit, spentMicro: spent };
    }
    await tx.insert(aiUsage).values({
      runId, billedOrgId: held.billedOrgId, userId, installationId: held.installationId, isPublic: held.isPublic,
      kind: 'hold', amountMicro: holdMicro, createdAt: at,
    });
    return null;
  });

  if (blocked) {
    await audit('quota.blocked', {
      actorUserId: userId,
      actingOrgId,
      installationId: agent.installationId,
      runId,
      targetType: 'installation',
      targetId: agent.installationId,
      details: { scope: blocked.scope, limitMicro: blocked.limitMicro, spentMicro: blocked.spentMicro, holdMicro },
    });
    throw new AppError({
      code: 'quota_exceeded',
      message: quotaMessage(blocked.scope, { club, agent: agent.name, ...blocked }),
      cap: { scope: blocked.scope, limitMicro: blocked.limitMicro, spentMicro: blocked.spentMicro },
    });
  }
  return held;
}

/** §7 step 8: settles a hold with the actual cost (0 for a failed run). Writes (actual − hold), or
 * +actual when the hold was already released as stale. The row also marks the hold as settled, and is
 * stamped with the hold's time, so a run that crosses a period boundary nets to its cost in the period
 * that holds it. */
export async function settle(held: QuotaHold, actualMicro: number, model?: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    await lock(tx);
    const [released] = await tx.select({ id: aiUsage.id }).from(aiUsage)
      .where(and(eq(aiUsage.runId, held.runId), eq(aiUsage.kind, 'release'))).limit(1);
    await tx.insert(aiUsage).values({
      runId: held.runId, billedOrgId: held.billedOrgId, userId: held.userId, installationId: held.installationId,
      isPublic: held.isPublic, model: model ?? null, kind: 'settle',
      amountMicro: released ? actualMicro : actualMicro - held.holdMicro, createdAt: held.createdAt,
    });
  });
}

/** The smallest remaining amount over the levels that apply to a run of `agent` by `userId`: member
 * (an active member of the billed club), student_daily (public agents), installation, club and
 * platform. What the user can still spend before a run would be blocked. One transaction: stale
 * holds are released once, then each level is read. Pass `isMember` when it is already known (the
 * run's hold carries it). */
export async function headroom(
  agent: Pick<EffectiveAgent, 'orgId' | 'installationId' | 'audience'>, userId: string, isMember?: boolean,
): Promise<number> {
  const member = isMember ?? ((await activeMemberships(userId))?.some((m) => m.orgId === agent.orgId) ?? false);
  const targets: QuotaTarget[] = [];
  if (member) targets.push({ scope: 'member', orgId: agent.orgId, userId });
  if (agent.audience === 'public') targets.push({ scope: 'student_daily', userId });
  targets.push(
    { scope: 'installation', installationId: agent.installationId },
    { scope: 'org', orgId: agent.orgId },
    { scope: 'platform' },
  );
  const at = now();
  return getDb().transaction(async (tx) => {
    await releaseStaleHoldsIfFree(tx, at);
    let smallest = Infinity;
    for (const target of targets) smallest = Math.min(smallest, (await levelRemaining(tx, target, at)).remainingMicro);
    return smallest;
  });
}

export const quota = { setLimit, remaining, hold, settle, headroom };
