// Owner: A (WP-4). Quota mechanics (§11): quota periods, setLimit permissions and child ≤ parent, the
// ai_usage ledger (hold, settle, stale release) against the DB as trojanops_app. Runs through the gateway
// (blocking, D5, §11 messages) are in tests/gateway.test.ts. Every case runs in a rolled-back transaction
// on the real seed; limits are set relative to remaining() because the app role cannot delete usage
// committed by earlier manual runs.
import { and, eq, gt, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { now } from '@/lib/clock';
import type { QuotaTarget } from '@/lib/contracts';
import type { Tx } from '@/lib/db/client';
import { aiUsage, auditEvents, quotaLimits } from '@/lib/db/schema';
import { periodStart } from '@/lib/gateway/period';
import { remaining, setLimit, settle, type QuotaHold } from '@/lib/gateway/quota';
import { quotaMessage, usd } from '@/lib/gateway/quota-messages';
import { INSTALLATION, ORG, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp } from './db';

const probe = await appSql();
await probe?.end();
afterAll(async () => {
  if (probe) await closeAppDb();
});

const iso = (d: Date) => d.toISOString();

describe('periodStart', () => {
  it('starts the month at 00:00 PT on the 1st, across both DST changes', () => {
    // PDT (UTC−7) until 2026-11-01 02:00, PST (UTC−8) after: November 1st itself begins in PDT.
    expect(iso(periodStart('month', new Date('2026-11-15T18:00:00Z')))).toBe('2026-11-01T07:00:00.000Z');
    expect(iso(periodStart('month', new Date('2026-12-20T00:00:00Z')))).toBe('2026-12-01T08:00:00.000Z');
    // 2026-03-08 02:00 PST jumps to PDT: March 1st begins in PST, April 1st in PDT.
    expect(iso(periodStart('month', new Date('2026-03-20T12:00:00Z')))).toBe('2026-03-01T08:00:00.000Z');
    expect(iso(periodStart('month', new Date('2026-04-02T12:00:00Z')))).toBe('2026-04-01T07:00:00.000Z');
  });

  it('starts the day at PT midnight, on the right side of the UTC date', () => {
    expect(iso(periodStart('day', new Date('2026-11-15T10:00:00-08:00')))).toBe('2026-11-15T08:00:00.000Z');
    // 23:59 PT on the 14th is already the 15th in UTC: still the 14th's day.
    expect(iso(periodStart('day', new Date('2026-11-14T23:59:00-08:00')))).toBe('2026-11-14T08:00:00.000Z');
    expect(iso(periodStart('day', new Date('2026-11-15T00:00:00-08:00')))).toBe('2026-11-15T08:00:00.000Z');
    // The days around a DST change are 23 and 25 hours long.
    expect(iso(periodStart('day', new Date('2026-03-08T12:00:00-07:00')))).toBe('2026-03-08T08:00:00.000Z');
    expect(iso(periodStart('day', new Date('2026-11-01T12:00:00-08:00')))).toBe('2026-11-01T07:00:00.000Z');
  });
});

describe('quotaMessage (§11)', () => {
  const ctx = { club: 'Startup Club', agent: 'Club handoff', spentMicro: 500_000, limitMicro: 500_000 };
  it('copies the §11 UI copy for every scope', () => {
    expect(usd(500_000)).toBe('$0.50');
    expect(quotaMessage('member', ctx)).toBe(
      'Your monthly AI quota in Startup Club is used up ($0.50 of $0.50). Ask your president to raise it.');
    expect(quotaMessage('org', { ...ctx, spentMicro: 5_000_000, limitMicro: 5_000_000 })).toBe(
      'Startup Club has used its monthly AI quota ($5.00 of $5.00). USG can raise it.');
    expect(quotaMessage('installation', ctx)).toBe('Club handoff has used its monthly budget in Startup Club.');
    expect(quotaMessage('student_daily', { ...ctx, limitMicro: 50_000 })).toBe(
      "You've reached today's limit for public agents ($0.05). It resets at midnight PT.");
    expect(quotaMessage('platform', ctx)).toBe("TrojanOps has reached this month's platform limit.");
  });
});

const newAudit = (tx: Tx, auditId: number) =>
  tx.select().from(auditEvents).where(gt(auditEvents.id, auditId)).orderBy(auditEvents.id);
const scenario = (fn: (tx: Tx, auditId: number) => Promise<void>) => inRolledBackApp(async (tx) => {
  const [{ max }] = await tx.execute<{ max: string }>(sql`select coalesce(max(id), 0) as max from audit_events`);
  await fn(tx, Number(max));
});

describe.skipIf(!probe)('setLimit', () => {
  it('lets USG admins set platform, club and student_daily limits, and presidents member and installation limits', () => scenario(async (tx) => {
    const avery = await actorFor(USER.avery, ORG.usg);
    const sam = await actorFor(USER.sam, ORG.startup);
    await setLimit(avery, { scope: 'platform', limitMicro: 40_000_000 });
    await setLimit(avery, { scope: 'org', orgId: ORG.startup, limitMicro: 4_000_000 });
    await setLimit(avery, { scope: 'student_daily', limitMicro: 60_000 });
    await setLimit(sam, { scope: 'member', orgId: ORG.startup, userId: USER.casey, limitMicro: 300_000 });
    await setLimit(sam, { scope: 'installation', installationId: INSTALLATION.startupRecruitingQa, limitMicro: 2_000_000 });

    expect((await remaining({ scope: 'platform' })).limitMicro).toBe(40_000_000);
    expect((await remaining({ scope: 'org', orgId: ORG.startup })).limitMicro).toBe(4_000_000);
    expect((await remaining({ scope: 'student_daily', userId: USER.lee })).limitMicro).toBe(60_000);
    expect((await remaining({ scope: 'member', orgId: ORG.startup, userId: USER.casey })).limitMicro).toBe(300_000);
    expect((await remaining({ scope: 'installation', installationId: INSTALLATION.startupRecruitingQa })).limitMicro).toBe(2_000_000);
    const [row] = await tx.select().from(quotaLimits).where(and(eq(quotaLimits.scope, 'member'), eq(quotaLimits.userId, USER.casey)));
    expect(row).toMatchObject({ setBy: USER.sam, orgId: ORG.startup });
  }));

  it('refuses everyone else with 403 and audits authz.denied', () => scenario(async (tx, auditId) => {
    const sam = await actorFor(USER.sam, ORG.startup);
    const attempts: Array<[string, Parameters<typeof setLimit>]> = [
      ['sam sets a club limit', [sam, { scope: 'org', orgId: ORG.startup, limitMicro: 1 }]],
      ['sam sets the platform limit', [sam, { scope: 'platform', limitMicro: 1 }]],
      ['sam sets the student cap', [sam, { scope: 'student_daily', limitMicro: 1 }]],
      ['a treasurer of another club sets a Startup member', [await actorFor(USER.morgan, ORG.archery), { scope: 'member', orgId: ORG.startup, userId: USER.casey, limitMicro: 1 }]],
      ['a treasurer sets a member limit', [await actorFor(USER.taylor, ORG.startup), { scope: 'member', orgId: ORG.startup, userId: USER.casey, limitMicro: 1 }]],
      ['casey sets her own limit', [await actorFor(USER.casey, ORG.startup), { scope: 'member', orgId: ORG.startup, userId: USER.casey, limitMicro: 10_000_000 }]],
      ['a reviewer sets a club limit', [await actorFor(USER.riley, ORG.usg), { scope: 'org', orgId: ORG.startup, limitMicro: 1 }]],
      ['avery sets a member limit', [await actorFor(USER.avery, ORG.usg), { scope: 'member', orgId: ORG.startup, userId: USER.casey, limitMicro: 1 }]],
      ["sam sets another club's installation", [sam, { scope: 'installation', installationId: INSTALLATION.danceShowcaseQa, limitMicro: 1 }]],
    ];
    for (const [, args] of attempts) await expect(setLimit(...args)).rejects.toMatchObject({ status: 403 });
    const rows = await newAudit(tx, auditId);
    expect(rows.map((r) => r.action)).toEqual(attempts.map(() => 'authz.denied'));
    expect(rows[0].details).toEqual({ reason: 'quota_limit_forbidden', scope: 'org' });
    // A member or installation denial is filed under that club or agent, so the club's president sees it.
    expect(rows[3]).toMatchObject({ targetType: 'org', targetId: ORG.startup, details: { scope: 'member' } });
    expect(rows[8]).toMatchObject({ targetType: 'installation', targetId: INSTALLATION.danceShowcaseQa, installationId: INSTALLATION.danceShowcaseQa });
    expect((await remaining({ scope: 'org', orgId: ORG.startup })).limitMicro).toBe(5_000_000);
    await expect(setLimit({ userId: null, activeOrgId: null, positions: [], grants: [] }, { scope: 'platform', limitMicro: 1 }))
      .rejects.toMatchObject({ status: 401 });
  }));

  it('rejects a child above its parent with clamp_violation naming the parent', () => scenario(async () => {
    const avery = await actorFor(USER.avery, ORG.usg);
    const sam = await actorFor(USER.sam, ORG.startup);
    const platform = (await remaining({ scope: 'platform' })).limitMicro;
    const club = (await remaining({ scope: 'org', orgId: ORG.startup })).limitMicro;

    await expect(setLimit(avery, { scope: 'org', orgId: ORG.startup, limitMicro: platform + 1 })).rejects.toMatchObject({
      status: 422,
      error: { code: 'clamp_violation', cap: { scope: 'platform', limitMicro: platform, field: 'limitMicro', allowed: platform },
        message: expect.stringContaining('the platform limit') },
    });
    await expect(setLimit(avery, { scope: 'student_daily', limitMicro: platform + 1 })).rejects.toMatchObject({ status: 422 });
    await expect(setLimit(sam, { scope: 'member', orgId: ORG.startup, userId: USER.casey, limitMicro: club + 1 })).rejects.toMatchObject({
      status: 422,
      error: { code: 'clamp_violation', cap: { scope: 'org', limitMicro: club }, message: expect.stringContaining("Startup Club's monthly quota") },
    });
    await expect(setLimit(sam, { scope: 'installation', installationId: INSTALLATION.startupRecruitingQa, limitMicro: club + 1 }))
      .rejects.toMatchObject({ status: 422, error: { cap: { scope: 'org' } } });
    // Exactly the parent's limit is fine.
    await setLimit(sam, { scope: 'member', orgId: ORG.startup, userId: USER.casey, limitMicro: club });
  }));

  it('rejects bad input and a member who is not in the club', () => scenario(async () => {
    const avery = await actorFor(USER.avery, ORG.usg);
    const sam = await actorFor(USER.sam, ORG.startup);
    for (const limitMicro of [-1, 1.5, Number.NaN, 2 ** 60]) {
      await expect(setLimit(avery, { scope: 'platform', limitMicro })).rejects.toMatchObject({ status: 400 });
    }
    await expect(setLimit(avery, { scope: 'org', limitMicro: 1 })).rejects.toMatchObject({ status: 400 });
    await expect(setLimit(sam, { scope: 'member', orgId: ORG.startup, limitMicro: 1 })).rejects.toMatchObject({ status: 400 });
    await expect(setLimit(sam, { scope: 'member', orgId: ORG.startup, userId: USER.lee, limitMicro: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(setLimit(avery, { scope: 'org', orgId: ORG.usg, limitMicro: 1 })).rejects.toMatchObject({ status: 404 });
    // An unknown agent answers like another club's: 403, so a president cannot probe for ids.
    await expect(setLimit(sam, { scope: 'installation', installationId: '00000000-0000-4000-8000-000000000000', limitMicro: 1 }))
      .rejects.toMatchObject({ status: 403 });
  }));

  it('updates the existing row instead of adding one, and audits the change with ids and numbers', () => scenario(async (tx, auditId) => {
    const sam = await actorFor(USER.sam, ORG.startup);
    const caseyLimit = () => tx.select().from(quotaLimits)
      .where(and(eq(quotaLimits.scope, 'member'), eq(quotaLimits.userId, USER.casey), eq(quotaLimits.orgId, ORG.startup)));
    const [before] = await caseyLimit();
    await setLimit(sam, { scope: 'member', orgId: ORG.startup, userId: USER.casey, limitMicro: 0 });
    await setLimit(sam, { scope: 'member', orgId: ORG.startup, userId: USER.casey, limitMicro: 100_000 });
    const rows = await caseyLimit();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: before.id, limitMicro: 100_000 });
    expect(rows[0].setAt.getTime()).toBeGreaterThanOrEqual(before.setAt.getTime());

    const audits = await newAudit(tx, auditId);
    expect(audits.map((r) => r.action)).toEqual(['quota.limit.set', 'quota.limit.set']);
    expect(audits[0]).toMatchObject({
      actorUserId: USER.sam, actingOrgId: ORG.startup, targetType: 'org', targetId: ORG.startup,
      details: { scope: 'member', limitMicro: 0, previousMicro: before.limitMicro, userId: USER.casey },
    });
    expect(audits[1].details).toMatchObject({ limitMicro: 100_000, previousMicro: 0 });
  }));
});

describe.skipIf(!probe)('ai_usage ledger', () => {
  const held = (over: Partial<QuotaHold> = {}): QuotaHold => ({
    runId: crypto.randomUUID(), holdMicro: 10_000, billedOrgId: ORG.startup, userId: USER.casey,
    installationId: INSTALLATION.startupHandoff, isPublic: false, ...over,
  });
  const club: QuotaTarget = { scope: 'org', orgId: ORG.startup };
  const insertHold = (tx: Tx, h: QuotaHold, ageMs: number) => tx.insert(aiUsage).values({
    runId: h.runId, billedOrgId: h.billedOrgId, userId: h.userId, installationId: h.installationId, isPublic: h.isPublic,
    kind: 'hold', amountMicro: h.holdMicro, createdAt: new Date(now().getTime() - ageMs),
  });
  const runRows = (tx: Tx, runId: string) => tx.select().from(aiUsage).where(eq(aiUsage.runId, runId)).orderBy(aiUsage.kind);

  it('settles with actual − hold, so a run nets to its cost', () => scenario(async (tx) => {
    const before = (await remaining(club)).spentMicro;
    const h = held();
    await insertHold(tx, h, 0);
    expect((await remaining(club)).spentMicro).toBe(before + 10_000);
    await settle(h, 25_000, 'mock');
    expect((await runRows(tx, h.runId)).map((r) => [r.kind, r.amountMicro])).toEqual([['hold', 10_000], ['settle', 15_000]]);
    expect((await remaining(club)).spentMicro).toBe(before + 25_000);
  }));

  it('settles a failed run at 0, returning the whole hold', () => scenario(async (tx) => {
    const before = (await remaining(club)).spentMicro;
    const h = held();
    await insertHold(tx, h, 0);
    await settle(h, 0);
    expect((await runRows(tx, h.runId)).map((r) => [r.kind, r.amountMicro])).toEqual([['hold', 10_000], ['settle', -10_000]]);
    expect((await remaining(club)).spentMicro).toBe(before);
  }));

  it('releases a hold nobody settled after 10 minutes, once, and keeps a younger or settled one', () => scenario(async (tx) => {
    const before = (await remaining(club)).spentMicro;
    const stale = held();
    const young = held();
    const settled = held();
    await insertHold(tx, stale, 11 * 60_000);
    await insertHold(tx, young, 5 * 60_000);
    await insertHold(tx, settled, 30 * 60_000);
    await settle(settled, 10_000);

    // stale −10,000 released; young +10,000 held; settled nets +10,000.
    expect((await remaining(club)).spentMicro).toBe(before + 20_000);
    expect((await runRows(tx, stale.runId)).map((r) => [r.kind, r.amountMicro])).toEqual([['hold', 10_000], ['release', -10_000]]);
    expect((await runRows(tx, young.runId)).map((r) => r.kind)).toEqual(['hold']);
    expect((await runRows(tx, settled.runId)).map((r) => r.kind)).toEqual(['hold', 'settle']);
  }));

  it('releases a hold from a past period into that same period, not the current one', () => scenario(async (tx) => {
    const before = (await remaining(club)).spentMicro;
    const old = held();
    const lastMonth = new Date(periodStart('month', now()).getTime() - 60_000);
    await tx.insert(aiUsage).values({
      runId: old.runId, billedOrgId: old.billedOrgId, userId: old.userId, installationId: old.installationId, isPublic: false,
      kind: 'hold', amountMicro: 10_000, createdAt: lastMonth,
    });
    expect((await remaining(club)).spentMicro).toBe(before); // this month never sees the −H
    const rows = await runRows(tx, old.runId);
    expect(rows.map((r) => r.kind)).toEqual(['hold', 'release']);
    expect(rows[1].createdAt.getTime()).toBe(lastMonth.getTime());
  }));

  it('charges the actual cost once when a run settles after its hold was released', () => scenario(async (tx) => {
    const before = (await remaining(club)).spentMicro;
    const late = held();
    await insertHold(tx, late, 11 * 60_000);
    expect((await remaining(club)).spentMicro).toBe(before); // released
    await settle(late, 7_000);
    expect((await runRows(tx, late.runId)).map((r) => [r.kind, r.amountMicro])).toEqual([
      ['hold', 10_000], ['release', -10_000], ['settle', 7_000],
    ]);
    expect((await remaining(club)).spentMicro).toBe(before + 7_000);
  }));

  it('counts spend only from the start of the period', () => scenario(async (tx) => {
    const before = (await remaining(club)).spentMicro;
    const old = held();
    await tx.insert(aiUsage).values({
      runId: old.runId, billedOrgId: old.billedOrgId, userId: old.userId, installationId: old.installationId, isPublic: false,
      kind: 'settle', amountMicro: 999_999, createdAt: new Date(periodStart('month', now()).getTime() - 1),
    });
    expect((await remaining(club)).spentMicro).toBe(before);
  }));

  it('reports the club limit for a member or installation without a limit of their own', () => scenario(async () => {
    const morgan = await remaining({ scope: 'member', orgId: ORG.startup, userId: USER.morgan });
    const taylor = await remaining({ scope: 'installation', installationId: INSTALLATION.startupFundingPrecheck });
    const clubLimit = (await remaining(club)).limitMicro;
    expect(morgan.limitMicro).toBe(clubLimit);
    expect(taylor.limitMicro).toBe(clubLimit);
  }));
});
