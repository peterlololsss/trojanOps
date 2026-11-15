// Owner: B. WP-5 writes: D2, propagation and retirement.
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { distribute, publishVersion, publishRulePack, retire, updateInstallation, publishToAllStudents, effectiveAgent, directory } from '@/lib/distribution';
import * as quotaService from '@/lib/gateway/quota';
import type { VersionDraft } from '@/lib/distribution/versions';
import { INSTALLATION, ORG, SOURCE, TEMPLATE, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp } from './db';

const probe = await appSql(); await probe?.end();
afterAll(async () => { if (probe) await closeAppDb(); });
const avery = () => actorFor(USER.avery, ORG.usg);
const sam = () => actorFor(USER.sam, ORG.startup);
const draft: VersionDraft = { purpose: 'Plan club events', audience: 'positions', usableBy: ['president', 'secretary'],
  maxTier: 'members', sourceKinds: ['archive', 'minutes'], tools: [], modelClasses: ['economy'],
  defaultModelClass: 'economy', systemPrompt: 'Plan events with the club.', changelog: 'Second version' };

// §8 gives a club two different powers: narrowing its own installation, and opening an agent to
// the whole campus. Only the second checks the club has a budget, gives the installation one and
// audits agent.publish_public — so a patch must not be able to reach the same state.
describe.skipIf(!probe)('only Publish to all students opens an agent to the campus', () => {
  const inDirectory = async () => (await directory()).map(a => a.templateSlug);

  it('refuses a patch that sets the audience to public', () => inRolledBackApp(async tx => {
    await expect(updateInstallation(await sam(), INSTALLATION.startupRecruitingQa, { audience: 'public', enabled: true }))
      .rejects.toMatchObject({ error: { code: 'clamp_violation', cap: { field: 'audience' } } });
    expect(await inDirectory()).not.toContain('recruiting-qa');
    expect((await tx.execute(sql`select audience, enabled from agent_installations where id = ${INSTALLATION.startupRecruitingQa}`))[0])
      .toEqual({ audience: null, enabled: false });
  }));

  // The same state by a quieter route: recruiting-qa's *version* is already public, so merely
  // enabling the installation would put it on the directory.
  it('refuses a patch that only enables an installation of a public version', () => inRolledBackApp(async () => {
    await expect(updateInstallation(await sam(), INSTALLATION.startupRecruitingQa, { enabled: true }))
      .rejects.toMatchObject({ error: { code: 'clamp_violation', cap: { field: 'audience' } } });
    expect(await inDirectory()).not.toContain('recruiting-qa');
  }));

  it('still allows ordinary narrowing of an agent that is not public', () => inRolledBackApp(async () => {
    const updated = await updateInstallation(await sam(), INSTALLATION.startupHandoff, { promptAddendum: 'We meet on Tuesdays.' });
    expect(updated.systemPrompt).toContain('We meet on Tuesdays.');
  }));

  // Once published, the president can still edit it without tripping the guard.
  it('allows patching an installation that is already public', () => inRolledBackApp(async () => {
    await publishToAllStudents(await sam(), INSTALLATION.startupRecruitingQa);
    const updated = await updateInstallation(await sam(), INSTALLATION.startupRecruitingQa, { promptAddendum: 'Ask us anything.' });
    expect(updated.audience).toBe('public');
    expect(await inDirectory()).toContain('recruiting-qa');
  }));
});

describe.skipIf(!probe)('distribution writes', () => {
  it('D2 distributes to all active clubs once and preserves a default installation’s overrides', () => inRolledBackApp(async tx => {
    const actor = await avery();
    expect(await distribute(actor, TEMPLATE.eventPlanning)).toEqual({ count: 4 });
    const rows = await tx.execute(sql`select * from agent_installations where template_id = ${TEMPLATE.eventPlanning}`);
    expect(rows).toHaveLength(4);
    expect(rows.every(r => r.enabled && r.track === 'latest')).toBe(true);
    await tx.execute(sql`update agent_installations set enabled = false, track = 'pinned', pinned_version = 1,
      usable_by = array['president'], prompt_addendum = 'Keep me' where template_id = ${TEMPLATE.eventPlanning} and org_id = ${ORG.startup}`);
    expect(await distribute(actor, TEMPLATE.eventPlanning)).toEqual({ count: 0 });
    expect((await tx.execute(sql`select * from agent_installations where template_id = ${TEMPLATE.eventPlanning} and org_id = ${ORG.startup}`))[0])
      .toMatchObject({ enabled: false, track: 'pinned', pinned_version: 1, usable_by: ['president'], prompt_addendum: 'Keep me' });
  }));
  it('forces required enabled and retains overrides', () => inRolledBackApp(async tx => {
    await tx.execute(sql`update agent_installations set enabled = false, prompt_addendum = 'Keep' where id = ${INSTALLATION.startupFundingPrecheck}`);
    expect(await distribute(await avery(), TEMPLATE.fundingPrecheck)).toEqual({ count: 1 });
    expect((await tx.execute(sql`select enabled, prompt_addendum from agent_installations where id = ${INSTALLATION.startupFundingPrecheck}`))[0])
      .toMatchObject({ enabled: true, prompt_addendum: 'Keep' });
  }));
  it('limits distribution to an active cohort and refuses optional templates', () => inRolledBackApp(async tx => {
    await tx.execute(sql`update agent_templates set target = 'pilot' where id = ${TEMPLATE.eventPlanning}`);
    await tx.execute(sql`update orgs set status = 'inactive' where id = ${ORG.archery}`);
    expect(await distribute(await avery(), TEMPLATE.eventPlanning)).toEqual({ count: 2 });
    await expect(distribute(await avery(), TEMPLATE.recruitingQa)).rejects.toMatchObject({ error: { code: 'invalid' } });
  }));
  it('rolls back the whole distribution when a target policy rejects it', () => inRolledBackApp(async tx => {
    await tx.execute(sql`update usg_club_policy set allowed_model_classes = array['standard'] where org_id = ${ORG.dance}`);
    await expect(distribute(await avery(), TEMPLATE.eventPlanning)).rejects.toMatchObject({ error: { code: 'clamp_violation' } });
    expect(await tx.execute(sql`select id from agent_installations where template_id = ${TEMPLATE.eventPlanning}`)).toHaveLength(0);
    expect((await tx.execute(sql`select distributed_at from agent_templates where id = ${TEMPLATE.eventPlanning}`))[0].distributed_at).toBeNull();
    expect(await tx.execute(sql`select id from audit_events where action = 'installation.rejected' and target_id = ${TEMPLATE.eventPlanning}`)).toHaveLength(1);
  }));
  it('D2 rejects the standard model with the allowed cap and leaves the row unchanged', () => inRolledBackApp(async tx => {
    await distribute(await avery(), TEMPLATE.eventPlanning);
    const [row] = await tx.execute<{ id: string }>(sql`select id from agent_installations where template_id = ${TEMPLATE.eventPlanning} and org_id = ${ORG.startup}`);
    await expect(updateInstallation(await sam(), row.id, { modelClass: 'standard' })).rejects.toMatchObject({
      error: { code: 'clamp_violation', cap: { field: 'modelClass', allowed: ['economy'] } } });
    expect((await effectiveAgent(row.id)).modelClass).toBe('economy');
    expect(await tx.execute(sql`select id from audit_events where action = 'installation.rejected' and installation_id = ${row.id}`)).toHaveLength(1);
  }));
  it('merges a patch with existing overrides rather than forgetting a narrowing', () => inRolledBackApp(async () => {
    await updateInstallation(await sam(), INSTALLATION.startupHandoff, { audience: 'positions', usableBy: ['treasurer'] });
    const agent = await updateInstallation(await sam(), INSTALLATION.startupHandoff, { promptAddendum: 'Keep grants scoped.' });
    expect(agent).toMatchObject({ audience: 'positions', usableBy: ['treasurer'] });
    expect(agent.systemPrompt).toContain('Keep grants scoped.');
    await expect(updateInstallation(await sam(), INSTALLATION.startupHandoff, { extraSourceIds: [SOURCE.archery.finance] }))
      .rejects.toMatchObject({ error: { code: 'clamp_violation' } });
  }));
  it('refuses disabling required agents, invalid pins, and a budget above the club’s', () => inRolledBackApp(async () => {
    await expect(updateInstallation(await sam(), INSTALLATION.startupFundingPrecheck, { enabled: false })).rejects.toMatchObject({ error: { code: 'clamp_violation' } });
    await expect(updateInstallation(await sam(), INSTALLATION.startupHandoff, { track: 'pinned' })).rejects.toMatchObject({ error: { code: 'invalid' } });
    await expect(updateInstallation(await sam(), INSTALLATION.startupHandoff, { track: 'pinned', pinnedVersion: 999 })).rejects.toMatchObject({ error: { code: 'not_found' } });
    await expect(updateInstallation(await sam(), INSTALLATION.startupHandoff, { limitMicro: 9_000_000 })).rejects.toMatchObject({ error: { code: 'clamp_violation', cap: { field: 'quotaMicro' } } });
  }));
  it('validates the selected pin against its version and latest resumes propagation', () => inRolledBackApp(async tx => {
    await distribute(await avery(), TEMPLATE.eventPlanning);
    const [row] = await tx.execute<{ id: string }>(sql`select id from agent_installations where template_id = ${TEMPLATE.eventPlanning} and org_id = ${ORG.startup}`);
    await updateInstallation(await sam(), row.id, { track: 'pinned', pinnedVersion: 1 });
    expect(await publishVersion(await avery(), TEMPLATE.eventPlanning, draft)).toMatchObject({ version: 2 });
    expect((await effectiveAgent(row.id)).templateVersion).toBe(1);
    const other = await tx.execute<{ id: string }>(sql`select id from agent_installations where template_id = ${TEMPLATE.eventPlanning} and org_id = ${ORG.archery}`);
    expect((await effectiveAgent(other[0].id)).templateVersion).toBe(2);
    expect((await updateInstallation(await sam(), row.id, { track: 'latest' })).templateVersion).toBe(2);
  }));
  it('rejects a new version incompatible with latest overrides, without advancing latest', () => inRolledBackApp(async tx => {
    await distribute(await avery(), TEMPLATE.eventPlanning);
    await tx.execute(sql`update agent_installations set usable_by = array['secretary'] where template_id = ${TEMPLATE.eventPlanning} and org_id = ${ORG.startup}`);
    await expect(publishVersion(await avery(), TEMPLATE.eventPlanning, { ...draft, usableBy: ['president'] })).rejects.toMatchObject({ error: { code: 'clamp_violation' } });
    expect((await tx.execute(sql`select latest_version from agent_templates where id = ${TEMPLATE.eventPlanning}`))[0].latest_version).toBe(1);
    expect(await tx.execute(sql`select id from agent_template_versions where template_id = ${TEMPLATE.eventPlanning} and version = 2`)).toHaveLength(0);
  }));
  it('allows a president to publish only an own-club template; validates drafts strictly', () => inRolledBackApp(async () => {
    await expect(publishVersion(await sam(), TEMPLATE.eventPlanning, draft)).rejects.toMatchObject({ error: { code: 'forbidden' } });
    await expect(publishVersion(await sam(), TEMPLATE.handoff, { ...draft, audience: 'members', usableBy: [] })).resolves.toMatchObject({ version: 2 });
    await expect(publishVersion(await sam(), TEMPLATE.handoff, { ...draft, audience: 'members', usableBy: [], maxTier: 'usg_internal' })).rejects.toMatchObject({ error: { code: 'invalid' } });
    await expect(publishVersion(await avery(), TEMPLATE.eventPlanning, { ...draft, modelClasses: [] })).rejects.toMatchObject({ error: { code: 'invalid' } });
    await expect(publishVersion(await avery(), TEMPLATE.eventPlanning, { ...draft, audience: 'public', maxTier: 'officers' })).rejects.toMatchObject({ error: { code: 'invalid' } });
  }));
  it('retires across pins, hides public listings and refuses later publish/distribute/update', () => inRolledBackApp(async () => {
    await retire(await avery(), TEMPLATE.showcaseQa);
    expect((await effectiveAgent(INSTALLATION.danceShowcaseQa)).status).toBe('retired');
    expect((await directory()).some(a => a.templateSlug === 'showcase-qa')).toBe(false);
    await retire(await avery(), TEMPLATE.eventPlanning);
    await expect(distribute(await avery(), TEMPLATE.eventPlanning)).rejects.toMatchObject({ error: { code: 'invalid' } });
    await expect(publishVersion(await avery(), TEMPLATE.eventPlanning, draft)).rejects.toMatchObject({ error: { code: 'invalid' } });
    await expect(retire(await sam(), TEMPLATE.handoff)).rejects.toMatchObject({ error: { code: 'forbidden' } });
  }));
  it('allows publication when an inactive club retains its disabled installation', () => inRolledBackApp(async tx => {
    await distribute(await avery(), TEMPLATE.eventPlanning);
    await tx.execute(sql`update orgs set status = 'inactive' where id = ${ORG.archery}`);
    await tx.execute(sql`update agent_installations set enabled = false where org_id = ${ORG.archery}`);
    expect(await publishVersion(await avery(), TEMPLATE.eventPlanning, draft)).toEqual({ version: 2 });
  }));
  it('resolves a new published rule pack on the next read of a template that names it', () => inRolledBackApp(async tx => {
    // The seed attaches the pack to no template; name it on funding-precheck v1 for this case.
    await tx.execute(sql`update agent_template_versions set rule_pack_slug = 'usg-funding' where template_id = ${TEMPLATE.fundingPrecheck}`);
    const old = (await effectiveAgent(INSTALLATION.startupFundingPrecheck)).rulePack!;
    expect(await publishRulePack(await avery(), 'usg-funding', { label: old.label,
      content: { ...(old.content as Record<string, number>), annualCapUsd: 10000 } })).toEqual({ version: 2 });
    const next = (await effectiveAgent(INSTALLATION.startupFundingPrecheck)).rulePack!;
    expect(next.version).toBe(2);
    expect(next.content).toMatchObject({ annualCapUsd: 10000 });
    await expect(publishRulePack(await sam(), 'usg-funding', { label: old.label, content: {} })).rejects.toMatchObject({ error: { code: 'forbidden' } });
  }));
  it('validates a pin’s model cap and refuses a retired installation update', () => inRolledBackApp(async tx => {
    await distribute(await avery(), TEMPLATE.eventPlanning);
    const [row] = await tx.execute<{ id: string }>(sql`select id from agent_installations where template_id = ${TEMPLATE.eventPlanning} and org_id = ${ORG.startup}`);
    await publishVersion(await avery(), TEMPLATE.eventPlanning, { ...draft, modelClasses: ['economy', 'standard'], defaultModelClass: 'standard' });
    await updateInstallation(await sam(), row.id, { modelClass: 'standard' });
    await expect(updateInstallation(await sam(), row.id, { track: 'pinned', pinnedVersion: 1 })).rejects.toMatchObject({ error: { code: 'clamp_violation' } });
    expect((await effectiveAgent(row.id)).templateVersion).toBe(2);
    await retire(await avery(), TEMPLATE.handoff);
    await expect(updateInstallation(await sam(), INSTALLATION.startupHandoff, { enabled: true })).rejects.toMatchObject({ error: { code: 'invalid' } });
  }));
  it('gives distributed public installations budgets and preserves existing quotas', () => inRolledBackApp(async tx => {
    await tx.execute(sql`update agent_template_versions set audience = 'public', usable_by = array[]::text[], max_tier = 'public' where template_id = ${TEMPLATE.eventPlanning}`);
    await distribute(await avery(), TEMPLATE.eventPlanning);
    const quotas = await tx.execute(sql`select q.limit_micro from quota_limits q join agent_installations i on i.id = q.installation_id where i.template_id = ${TEMPLATE.eventPlanning}`);
    expect(quotas).toHaveLength(4);
    expect(quotas.every(q => Number(q.limit_micro) === 2500000)).toBe(true);
    await tx.execute(sql`update quota_limits set limit_micro = 123 where scope = 'installation' and installation_id in (select id from agent_installations where template_id = ${TEMPLATE.eventPlanning})`);
    await distribute(await avery(), TEMPLATE.eventPlanning);
    expect((await tx.execute(sql`select q.limit_micro from quota_limits q join agent_installations i on i.id = q.installation_id where i.template_id = ${TEMPLATE.eventPlanning}`)).every(q => Number(q.limit_micro) === 123)).toBe(true);
  }));
  it('re-checks a concurrent version change after the separate quota transaction', () => inRolledBackApp(async tx => {
    const actualSetLimit = quotaService.setLimit;
    const spy = vi.spyOn(quotaService, 'setLimit').mockImplementation(async (actor, input) => {
      await actualSetLimit(actor, input);
      await publishVersion(await sam(), TEMPLATE.recruitingQa, { ...draft, audience: 'members', usableBy: [], maxTier: 'members' });
    });
    try {
      // A limit different from the one already stored, so the separate quota transaction this
      // case is about actually runs: publishing without changing the limit no longer calls
      // setLimit, which would otherwise audit a quota.limit.set nobody made.
      await expect(publishToAllStudents(await sam(), INSTALLATION.startupRecruitingQa, { limitMicro: 1_000_000 }))
        .rejects.toMatchObject({ error: { code: 'clamp_violation' } });
      expect((await tx.execute(sql`select audience, enabled from agent_installations where id = ${INSTALLATION.startupRecruitingQa}`))[0])
        .toEqual({ audience: null, enabled: false });
    } finally { spy.mockRestore(); }
  }));
  it('does not block quota FK inserts from A’s separate transaction while holding write locks', () => inRolledBackApp(async () => {
    const connection = (await appSql())!;
    const rollback = new Error('rollback quota probe');
    const spy = vi.spyOn(quotaService, 'setLimit').mockImplementation(async () => {
      try {
        await connection.begin(async other => {
          await other`set local lock_timeout = '500ms'`;
          await other`insert into quota_limits (scope, org_id, installation_id, limit_micro, set_at, created_at)
            values ('installation', ${ORG.startup}, ${INSTALLATION.startupHandoff}, 1, current_timestamp, current_timestamp)`;
          throw rollback;
        });
      } catch (err) { if (err !== rollback) throw err; }
    });
    try {
      await updateInstallation(await sam(), INSTALLATION.startupHandoff, { limitMicro: 1 });
      expect(spy).toHaveBeenCalledOnce();
    } finally { spy.mockRestore(); await connection.end(); }
  }));
  it('rejects anonymous/member/cross-club writers and malformed ids', () => inRolledBackApp(async () => {
    await expect(distribute({ userId: null, activeOrgId: null, positions: [], grants: [] }, TEMPLATE.eventPlanning)).rejects.toMatchObject({ error: { code: 'unauthenticated' } });
    const casey = await actorFor(USER.casey, ORG.startup);
    await expect(distribute(casey, TEMPLATE.eventPlanning)).rejects.toMatchObject({ error: { code: 'forbidden' } });
    await expect(updateInstallation(casey, INSTALLATION.startupHandoff, {})).rejects.toMatchObject({ error: { code: 'forbidden' } });
    await expect(updateInstallation(await sam(), INSTALLATION.danceShowcaseQa, {})).rejects.toMatchObject({ error: { code: 'forbidden' } });
    await expect(distribute(await avery(), 'bad-id')).rejects.toMatchObject({ error: { code: 'not_found' } });
  }));
});
