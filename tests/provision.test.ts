// Owner: B. D1: roster provisioning fills defaults without changing an existing club.
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { provisionOrg, effectiveAgent } from '@/lib/distribution';
import { ORG, TEMPLATE, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp, ts } from './db';
import type { Tx } from '@/lib/db/client';

const probe = await appSql();
await probe?.end();
afterAll(async () => { if (probe) await closeAppDb(); });

async function newClub(tx: Tx) {
  const id = randomUUID();
  await tx.execute(sql`insert into orgs (id, kind, slug, name, status, created_at)
    values (${id}, 'rso', ${id}, 'Robotics Club', 'active', ${ts()})`);
  return id;
}

async function snapshot(tx: Tx, orgId: string) {
  const [row] = await tx.execute<{ state: unknown }>(sql`select jsonb_build_object(
    'sources', (select jsonb_agg(s order by s.id) from sources s where org_id = ${orgId}),
    'policy', (select jsonb_agg(p) from usg_club_policy p where org_id = ${orgId}),
    'quota', (select jsonb_agg(q order by q.id) from quota_limits q where org_id = ${orgId}),
    'installations', (select jsonb_agg(i order by i.id) from agent_installations i where org_id = ${orgId})
  ) as state`);
  return row.state;
}

describe.skipIf(!probe)('provisionOrg · D1', () => {
  it('creates sources, policy, default quota and only the already-distributed funding template', () =>
    inRolledBackApp(async (tx) => {
      const orgId = await newClub(tx);
      const actor = await actorFor(USER.avery, ORG.usg);
      const [{ baseline }] = await tx.execute<{ baseline: number }>(sql`select coalesce(max(id),0)::int as baseline from audit_events`);
      expect(await provisionOrg(orgId, actor)).toEqual({ installed: 1 });
      const rows = await tx.execute<{ kind: string }>(sql`select kind from sources where org_id = ${orgId} order by kind`);
      expect(rows.map(r => r.kind)).toEqual(['archive', 'finance', 'minutes', 'public']);
      const [policy] = await tx.execute(sql`select * from usg_club_policy where org_id = ${orgId}`);
      expect(policy).toMatchObject({ allowed_model_classes: ['standard', 'economy'], allow_public_agents: true });
      const quota = await tx.execute(sql`select limit_micro from quota_limits where org_id = ${orgId} and scope = 'org'`);
      expect(quota).toHaveLength(1);
      expect(Number(quota[0].limit_micro)).toBe(5_000_000);
      const [installation] = await tx.execute<{ id: string; template_id: string }>(sql`select id, template_id from agent_installations where org_id = ${orgId}`);
      expect(installation.template_id).toBe(TEMPLATE.fundingPrecheck);
      expect(await effectiveAgent(installation.id)).toMatchObject({ status: 'enabled', templateVersion: 1, orgId });
      expect(await tx.execute(sql`select id from audit_events where id > ${baseline} and action = 'org.provision' and target_id = ${orgId}`)).toHaveLength(1);
      const before = await snapshot(tx, orgId);
      expect(await provisionOrg(orgId, actor)).toEqual({ installed: 0 });
      expect(await snapshot(tx, orgId)).toEqual(before);
    }));

  it('preserves existing clubs and their installation overrides', () => inRolledBackApp(async tx => {
    await tx.execute(sql`update agent_installations set prompt_addendum = 'Keep this', track = 'pinned', pinned_version = 1 where org_id = ${ORG.startup}`);
    const before = await snapshot(tx, ORG.startup);
    expect(await provisionOrg(ORG.startup)).toEqual({ installed: 0 });
    // Older seeds have no quota row yet; compare again after filling that missing default.
    const filled = await snapshot(tx, ORG.startup);
    expect(await provisionOrg(ORG.startup)).toEqual({ installed: 0 });
    expect(await snapshot(tx, ORG.startup)).toEqual(filled);
    expect((filled as Record<string, unknown>).installations).toEqual((before as Record<string, unknown>).installations);
  }));

  it('honours cohorts and skips optional, retired and other clubs’ org templates', () => inRolledBackApp(async tx => {
    const orgId = await newClub(tx);
    await tx.execute(sql`update agent_templates set target = 'pilot' where id = ${TEMPLATE.fundingPrecheck}`);
    expect(await provisionOrg(orgId)).toEqual({ installed: 0 });
    await tx.execute(sql`insert into org_cohorts (cohort_slug, org_id, created_at) values ('pilot', ${orgId}, ${ts()})`);
    expect(await provisionOrg(orgId)).toEqual({ installed: 1 });
    const next = await newClub(tx);
    await tx.execute(sql`update agent_templates set distributed_at = ${ts()}, target = 'all', status = 'retired' where id = ${TEMPLATE.fundingPrecheck}`);
    await tx.execute(sql`update agent_templates set distributed_at = ${ts()} where scope = 'org'`);
    await tx.execute(sql`update agent_templates set distributed_at = ${ts()}, distribution = 'optional' where id = ${TEMPLATE.eventPlanning}`);
    expect(await provisionOrg(next)).toEqual({ installed: 0 });
  }));

  it('keeps custom defaults and caps a new club quota at the platform limit', () => inRolledBackApp(async tx => {
    const orgId = await newClub(tx);
    await tx.execute(sql`insert into quota_limits (scope, limit_micro, set_at, created_at) values ('platform', 1000000, ${ts()}, ${ts()})`);
    await provisionOrg(orgId);
    expect(Number((await tx.execute(sql`select limit_micro from quota_limits where org_id = ${orgId}`))[0].limit_micro)).toBe(1_000_000);
    await tx.execute(sql`update quota_limits set limit_micro = 123 where org_id = ${orgId}`);
    await tx.execute(sql`update usg_club_policy set allowed_model_classes = array['economy'], allow_public_agents = false where org_id = ${orgId}`);
    await provisionOrg(orgId);
    expect(Number((await tx.execute(sql`select limit_micro from quota_limits where org_id = ${orgId}`))[0].limit_micro)).toBe(123);
    expect((await tx.execute(sql`select allow_public_agents from usg_club_policy where org_id = ${orgId}`))[0].allow_public_agents).toBe(false);
  }));

  it('gives any distributed public installation its own half-club budget', () => inRolledBackApp(async tx => {
    const orgId = await newClub(tx);
    await tx.execute(sql`update agent_templates set distributed_at = ${ts()} where id = ${TEMPLATE.eventPlanning}`);
    await tx.execute(sql`update agent_template_versions set audience = 'public', max_tier = 'public' where template_id = ${TEMPLATE.eventPlanning}`);
    expect(await provisionOrg(orgId)).toEqual({ installed: 2 });
    const rows = await tx.execute(sql`select q.limit_micro from quota_limits q join agent_installations i on q.installation_id = i.id
      where i.org_id = ${orgId} and i.template_id = ${TEMPLATE.eventPlanning}`);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].limit_micro)).toBe(2_500_000);
  }));

  it('rolls back the whole bootstrap when a distributed version is missing', () => inRolledBackApp(async tx => {
    const orgId = await newClub(tx);
    await tx.execute(sql`update agent_templates set latest_version = 999 where id = ${TEMPLATE.fundingPrecheck}`);
    await expect(provisionOrg(orgId)).rejects.toMatchObject({ error: { code: 'invalid' } });
    expect(Object.values(await snapshot(tx, orgId) as Record<string, unknown>)).toEqual([null, null, null, null]);
  }));

  it('rejects invalid or unknown org ids and never provisions USG or an inactive club', () => inRolledBackApp(async tx => {
    for (const id of ['bad-id', randomUUID(), ORG.usg]) {
      await expect(provisionOrg(id)).rejects.toMatchObject({ error: { code: 'not_found' } });
    }
    const orgId = await newClub(tx);
    await tx.execute(sql`update orgs set status = 'inactive' where id = ${orgId}`);
    await expect(provisionOrg(orgId)).rejects.toMatchObject({ error: { code: 'not_found' } });
    expect(await tx.execute(sql`select id from sources where org_id = ${orgId}`)).toHaveLength(0);
  }));

  it('clamps before any default rows are written and audits a rejection', () => inRolledBackApp(async tx => {
    const orgId = await newClub(tx);
    await tx.execute(sql`update agent_template_versions set audience = 'positions', usable_by = array[]::text[] where template_id = ${TEMPLATE.fundingPrecheck}`);
    await expect(provisionOrg(orgId)).rejects.toMatchObject({ error: { code: 'clamp_violation', cap: { field: 'usableBy' } } });
    const state = await snapshot(tx, orgId) as Record<string, unknown>;
    expect(Object.values(state)).toEqual([null, null, null, null]);
    expect(await tx.execute(sql`select id from audit_events where action = 'installation.rejected' and target_id = ${orgId}`)).toHaveLength(1);
  }));
});
