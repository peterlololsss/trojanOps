// Owner: B. Retired history cannot make policy tightening impossible, or become executable.
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { catalog, directory, myAgents, retire, distribute } from '@/lib/distribution';
import { setClubPolicy } from '@/lib/distribution/club-policy';
import { runAgent } from '@/lib/gateway';
import * as queries from '@/lib/distribution/queries';
import { mockRuntime } from '@/lib/runtime/mock';
import { INSTALLATION, ORG, TEMPLATE, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp } from './db';
const probe = await appSql(); await probe?.end();
afterAll(async () => { if (probe) await closeAppDb(); });
const avery = () => actorFor(USER.avery, ORG.usg);

describe.skipIf(!probe)('policy tightening after retirement', () => {
  it('can close public agents after retirement, preserving disabled installation history and blocking execution', () => inRolledBackApp(async tx => {
    const actor = await avery();
    await retire(actor, TEMPLATE.recruitingQa);
    const original = await tx.execute(sql`select * from agent_installations where id = ${INSTALLATION.startupRecruitingQa}`);
    await setClubPolicy(actor, ORG.startup, { allowedModelClasses: ['standard', 'economy'], allowPublicAgents: false });
    expect(await tx.execute(sql`select * from agent_installations where id = ${INSTALLATION.startupRecruitingQa}`)).toEqual(original);
    const found = await catalog(await actorFor(USER.sam, ORG.startup), ORG.startup);
    const retired = found!.agents.filter(a => a.installationId === INSTALLATION.startupRecruitingQa);
    expect(retired).toHaveLength(1);
    expect(retired[0]).toMatchObject({ status: 'retired', reasonLabel: null, canPublishPublic: false });
    expect(retired[0]).not.toHaveProperty('sourceIds');
    expect(retired[0]).not.toHaveProperty('systemPrompt');
    expect((await directory()).some(a => a.installationId === INSTALLATION.startupRecruitingQa)).toBe(false);
    expect((await myAgents(USER.casey)).flatMap(c => c.agents).some(a => a.installationId === INSTALLATION.startupRecruitingQa)).toBe(false);
    const runtime = vi.spyOn(mockRuntime, 'run');
    const ledger = await tx.execute(sql`select id from ai_usage order by id`);
    try {
      await expect(runAgent(await actorFor(USER.sam, ORG.startup), INSTALLATION.startupRecruitingQa, 'x')).rejects.toMatchObject({ error: { code: 'clamp_violation' } });
      expect(runtime).not.toHaveBeenCalled();
      expect(await tx.execute(sql`select id from ai_usage order by id`)).toEqual(ledger);
    } finally { runtime.mockRestore(); }
  }));

  it('permits disjoint model policy after retirement and retains pinned version/overrides and retired listing', () => inRolledBackApp(async tx => {
    const actor = await avery();
    await distribute(actor, TEMPLATE.eventPlanning);
    await tx.execute(sql`update agent_installations set track = 'pinned', pinned_version = 1, model_class = 'economy', prompt_addendum = 'Keep history' where template_id = ${TEMPLATE.eventPlanning} and org_id = ${ORG.archery}`);
    await retire(actor, TEMPLATE.eventPlanning);
    // The seeded beginner guide is also Economy-only. Retire it so this scenario isolates
    // whether historical event-planning rows prevent a Standard-only policy.
    await retire(actor, TEMPLATE.archeryGettingStarted);
    const before = await tx.execute(sql`select * from agent_installations where template_id = ${TEMPLATE.eventPlanning} and org_id = ${ORG.archery}`);
    await setClubPolicy(actor, ORG.archery, { allowedModelClasses: ['standard'], allowPublicAgents: true });
    expect(await tx.execute(sql`select * from agent_installations where template_id = ${TEMPLATE.eventPlanning} and org_id = ${ORG.archery}`)).toEqual(before);
    const view = await catalog(actor, ORG.archery);
    expect(view!.agents.find(a => a.templateSlug === 'event-planning')).toMatchObject({ status: 'retired', templateVersion: 1, canPublishPublic: false, reasonLabel: null });
    expect(view!.agents.find(a => a.templateSlug === 'funding-precheck')?.status).toBe('enabled');
  }));

  it('lets the fresh retired record win when retirement occurs between catalog reads', () => inRolledBackApp(async () => {
    const actor = await avery(); const president = await actorFor(USER.sam, ORG.startup);
    const load = queries.loadAgents;
    const spy = vi.spyOn(queries, 'loadAgents').mockImplementation(async filter => {
      const loaded = await load(filter);
      await retire(actor, TEMPLATE.handoff);
      return loaded;
    });
    try {
      const view = await catalog(president, ORG.startup);
      const rows = view!.agents.filter(a => a.installationId === INSTALLATION.startupHandoff);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ status: 'retired', reasonLabel: null, canPublishPublic: false });
    } finally { spy.mockRestore(); }
  }));

  it('still validates disabled/pinned installations of active templates before any policy write', () => inRolledBackApp(async tx => {
    const actor = await avery();
    await distribute(actor, TEMPLATE.eventPlanning);
    await tx.execute(sql`update agent_installations set enabled = false, track = 'pinned', pinned_version = 1, model_class = 'economy' where template_id = ${TEMPLATE.eventPlanning} and org_id = ${ORG.archery}`);
    await expect(setClubPolicy(actor, ORG.archery, { allowedModelClasses: ['standard'], allowPublicAgents: true })).rejects.toMatchObject({ error: { code: 'clamp_violation' } });
    await expect(setClubPolicy(actor, ORG.startup, { allowedModelClasses: ['standard', 'economy'], allowPublicAgents: false })).rejects.toMatchObject({ error: { code: 'clamp_violation' } });
    expect((await tx.execute(sql`select allow_public_agents from usg_club_policy where org_id = ${ORG.startup}`))[0].allow_public_agents).toBe(true);
  }));
});
