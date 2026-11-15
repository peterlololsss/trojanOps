import { afterAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { runAgent } from '@/lib/gateway';
import { periodEnd } from '@/lib/gateway/period';
import { credits, priceMicro } from '@/lib/gateway/prices';
import { quotaLine } from '@/lib/gateway/quota-line';
import { myUsage } from '@/lib/gateway/usage';
import { effectiveAgent } from '@/lib/distribution';
import { INSTALLATION, ORG, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp } from './db';

const probe = await appSql();
await probe?.end();
afterAll(async () => { if (probe) await closeAppDb(); });

describe('credit prices and resets', () => {
  it('converts the billed model price to student credits', () => {
    expect(credits(priceMicro('economy'))).toBe(1);
    expect(credits(priceMicro('standard'))).toBe(3);
    expect(credits(15_000)).toBe(1.5);
  });
  it.each([
    ['day', '2026-03-08T12:00:00-07:00', '2026-03-09T07:00:00.000Z'],
    ['day', '2026-11-01T12:00:00-08:00', '2026-11-02T08:00:00.000Z'],
    ['month', '2026-12-31T23:00:00-08:00', '2027-01-01T08:00:00.000Z'],
  ] as const)('ends %s at the next Pacific boundary', (kind, at, expected) => {
    expect(periodEnd(kind, new Date(at)).toISOString()).toBe(expected);
  });
});

describe.skipIf(!probe)('model credits through the real gateway', () => {
  it.each([['economy', 10_000, 'gpt-6-luna'], ['standard', 30_000, 'claude-sonnet-5-5']] as const)('bills %s and preserves private usage metadata', (modelClass, cost, model) => inRolledBackApp(async () => {
    const actor = await actorFor(USER.casey, ORG.startup);
    const agent = await effectiveAgent(INSTALLATION.startupHandoff);
    const before = await quotaLine(actor, agent);
    const result = await runAgent(actor, agent.installationId, 'What did we decide?', { modelClass });
    expect(result.inspector.costMicro).toBe(cost);
    expect((await quotaLine(actor, agent)).remainingMicro).toBe(before.remainingMicro - cost);
    expect(result.reply).toContain('[1]');
    expect(result.reply).not.toContain(result.citations[0].documentId);
    const usage = await myUsage(actor);
    expect(usage.runs.find((r) => r.id === result.runId)).toMatchObject({ model, costMicro: cost });
    expect(JSON.stringify(usage)).not.toContain('What did we decide?');
    expect((await myUsage(await actorFor(USER.sam, ORG.startup))).runs.some((r) => r.id === result.runId)).toBe(false);
  }));
  it('runs the named model at its class price and records it (decision 29)', () => inRolledBackApp(async () => {
    const actor = await actorFor(USER.casey, ORG.startup);
    const result = await runAgent(actor, INSTALLATION.startupHandoff, 'What did we decide?', { modelId: 'gemini-4-hydrogen' });
    expect(result.inspector.costMicro).toBe(10_000);
    expect((await myUsage(actor)).runs.find((r) => r.id === result.runId)).toMatchObject({ model: 'gemini-4-hydrogen', costMicro: 10_000 });
  }));
  it('audits a model the template or club does not offer, without billing a run', () => inRolledBackApp(async (tx) => {
    const actor = await actorFor(USER.casey, ORG.startup);
    await tx.execute(sql`update agent_installations set model_class = 'economy' where id = ${INSTALLATION.startupHandoff}`);
    const agent = await effectiveAgent(INSTALLATION.startupHandoff);
    const before = await quotaLine(actor, agent);
    for (const modelId of ['claude-sonnet-5-5', 'gpt-7']) {
      await expect(runAgent(actor, INSTALLATION.startupHandoff, 'Hello', { modelId })).rejects.toMatchObject({ status: 422, error: { code: 'clamp_violation' } });
      const rows = await tx.execute(sql`select details from audit_events where action = 'authz.denied' and actor_user_id = ${USER.casey} order by id desc limit 1`);
      expect(rows[0].details).toMatchObject({ reason: 'model' });
    }
    expect((await quotaLine(actor, agent)).remainingMicro).toBe(before.remainingMicro);
  }));
  it('audits an invalid class without starting or billing a run', () => inRolledBackApp(async (tx) => {
    const actor = await actorFor(USER.casey, ORG.startup);
    await tx.execute(sql`update agent_installations set model_class = 'economy' where id = ${INSTALLATION.startupHandoff}`);
    await expect(runAgent(actor, INSTALLATION.startupHandoff, 'Hello', { modelClass: 'standard' })).rejects.toMatchObject({ status: 422, error: { code: 'clamp_violation' } });
    const rows = await tx.execute(sql`select details from audit_events where action = 'authz.denied' and actor_user_id = ${USER.casey} order by id desc limit 1`);
    expect(rows[0].details).toMatchObject({ reason: 'model_class' });
  }));
});
