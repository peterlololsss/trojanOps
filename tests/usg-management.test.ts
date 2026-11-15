// Owner: B. I7 policy/metadata writes and remaining §14 routes on the real app role.
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { usgTemplatesView, usgTemplateView, usgClubsView, usgRulePacksView } from '@/lib/distribution/usg-view';
import { setClubPolicy } from '@/lib/distribution/club-policy';
import { getTemplate, updateTemplate } from '@/lib/distribution/template-admin';
import { installTemplate } from '@/lib/distribution/create-installation';
import { listAudit } from '@/lib/gateway/audit';
import { effectiveAgent } from '@/lib/distribution';
import { ACTIVE_ORG_COOKIE, PERSONA_COOKIE } from '@/lib/identity';
import * as templateRoute from '@/app/api/usg/templates/[templateId]/route';
import * as policyRoute from '@/app/api/usg/club-policy/[orgId]/route';
import * as installRoute from '@/app/api/orgs/[orgId]/installations/route';
import { ORG, TEMPLATE, USER, INSTALLATION } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp } from './db';
const probe = await appSql(); await probe?.end();
afterAll(async () => { if (probe) await closeAppDb(); });
const avery = () => actorFor(USER.avery, ORG.usg);
const sam = () => actorFor(USER.sam, ORG.startup);
const policy = { allowedModelClasses: ['economy' as const], allowPublicAgents: true };
const cookie = (user: string, org: string) => `${PERSONA_COOKIE}=${user}; ${ACTIVE_ORG_COOKIE}=${org}`;
const req = (method: string, body?: unknown, signed = true, json = true) => new Request('http://localhost/api/usg', {
  method, headers: { ...(signed ? { cookie: cookie(USER.avery, ORG.usg) } : {}), ...(json ? { 'content-type': 'application/json' } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
describe.skipIf(!probe)('USG policy and template management', () => {
  it('loads all four console models only for a USG admin and audits refused reads', () => inRolledBackApp(async tx => {
    const actor = await avery();
    expect((await usgTemplatesView(actor)).templates.map(t => t.slug)).toContain('event-planning');
    expect((await usgTemplateView(actor, TEMPLATE.eventPlanning))?.versions[0].modelClasses).toEqual(['economy']);
    expect(await usgClubsView(actor)).toHaveLength(3);
    expect((await usgRulePacksView(actor)).find(p => p.slug === 'usg-funding')?.versions[0].content).toMatchObject({ annualCapUsd: 8000 });
    const [{ count: before }] = await tx.execute<{ count: number }>(sql`select count(*)::int as count from audit_events where action = 'authz.denied'`);
    for (const read of [usgTemplatesView, usgClubsView, usgRulePacksView]) await expect(read(await sam())).rejects.toMatchObject({ error: { code: 'forbidden' } });
    const [{ count: after }] = await tx.execute<{ count: number }>(sql`select count(*)::int as count from audit_events where action = 'authz.denied'`);
    expect(after - before).toBe(3);
  }));
  it('names the templates that use each rule pack and what the template page explains', () => inRolledBackApp(async tx => {
    const actor = await avery();
    const usedBy = async () => (await usgRulePacksView(actor)).find(p => p.slug === 'usg-funding')?.usedBy;
    // Only templates whose version names the pack: Funding pre-check, not the review assistant.
    expect((await usedBy())?.map(u => u.name)).toEqual(['Funding pre-check']);
    expect((await usedBy())?.[0]).toMatchObject({ templateId: TEMPLATE.fundingPrecheck, version: 1, audience: 'positions', usableBy: ['treasurer', 'president'], installedCount: 3, global: true });
    // A turned-off installation does not run the pack, so its club is not counted.
    await tx.execute(sql`update agent_installations set enabled = false where id = ${INSTALLATION.archeryFundingPrecheck}`);
    expect((await usedBy())?.[0].installedCount).toBe(2);
    const list = await usgTemplatesView(actor);
    expect(list.rulePacks).toEqual([{ slug: 'usg-funding', label: 'USG Funding Guidelines 2026–27', version: 1, ruleCount: 13 }]);
    expect(list.templates.find(t => t.id === TEMPLATE.fundingPrecheck)).toMatchObject({ rulePackSlug: 'usg-funding', purpose: expect.stringContaining('funding request') });
    const detail = await usgTemplateView(actor, TEMPLATE.fundingPrecheck);
    expect(detail?.usgDocuments).toContainEqual({ kind: 'rulebook', title: 'USG Funding Department Guidelines', tier: 'public' });
    expect(detail?.positions.map(p => p.slug)).toEqual(expect.arrayContaining(['president', 'treasurer']));
  }));
  it('applies a compatible policy, audits it, and never widens a template model ceiling', () => inRolledBackApp(async tx => {
    await setClubPolicy(await avery(), ORG.archery, policy);
    expect((await effectiveAgent(INSTALLATION.archeryFundingPrecheck)).modelClass).toBe('economy');
    expect((await tx.execute(sql`select * from usg_club_policy where org_id = ${ORG.archery}`))[0].allowed_model_classes).toEqual(['economy']);
    expect(await tx.execute(sql`select id from audit_events where target_type = 'org' and details->>'resource' = 'club_policy' and target_id = ${ORG.archery}`)).toHaveLength(1);
  }));
  it('shows a USG policy change in the affected president’s scoped audit', () => inRolledBackApp(async () => {
    await setClubPolicy(await avery(), ORG.startup, { allowedModelClasses: ['standard', 'economy'], allowPublicAgents: true });
    const rows = await listAudit(await sam(), { orgId: ORG.startup });
    expect(rows.some(r => r.targetId === ORG.startup && r.details.resource === 'club_policy')).toBe(true);
  }));
  it('rejects policy changes that would invalidate an existing override or public installation before writing', () => inRolledBackApp(async tx => {
    await tx.execute(sql`update agent_installations set model_class = 'standard' where id = ${INSTALLATION.archeryFundingPrecheck}`);
    await expect(setClubPolicy(await avery(), ORG.archery, policy)).rejects.toMatchObject({ error: { code: 'clamp_violation', cap: { field: 'modelClass' } } });
    await expect(setClubPolicy(await avery(), ORG.startup, { ...policy, allowPublicAgents: false })).rejects.toMatchObject({ error: { code: 'clamp_violation', cap: { field: 'audience' } } });
    expect((await tx.execute(sql`select allow_public_agents from usg_club_policy where org_id = ${ORG.startup}`))[0].allow_public_agents).toBe(true);
  }));
  it('rejects non-admins, non-clubs and invalid policy payloads', () => inRolledBackApp(async () => {
    await expect(setClubPolicy(await sam(), ORG.startup, policy)).rejects.toMatchObject({ error: { code: 'forbidden' } });
    await expect(setClubPolicy(await avery(), ORG.usg, policy)).rejects.toMatchObject({ error: { code: 'invalid' } });
    await expect(setClubPolicy(await avery(), ORG.archery, { ...policy, allowedModelClasses: [] })).rejects.toMatchObject({ error: { code: 'invalid' } });
  }));
  it('reads immutable history and patches only authorized metadata, keeping old installations on target changes', () => inRolledBackApp(async tx => {
    const actor = await avery();
    const detail = await getTemplate(actor, TEMPLATE.eventPlanning);
    expect(detail.versions).toHaveLength(1); expect(detail.targets).toHaveLength(3);
    await updateTemplate(actor, TEMPLATE.eventPlanning, { name: 'Event planning updated', target: 'pilot' });
    const next = await getTemplate(actor, TEMPLATE.eventPlanning);
    expect(next.template.name).toBe('Event planning updated'); expect(next.targets).toHaveLength(2);
    expect(next.versions).toEqual(detail.versions);
    await expect(updateTemplate(actor, TEMPLATE.fundingPrecheck, { distribution: 'optional' })).rejects.toMatchObject({ error: { code: 'invalid' } });
    await expect(updateTemplate(actor, TEMPLATE.eventPlanning, { target: 'missing-cohort' })).rejects.toMatchObject({ error: { code: 'invalid' } });
    await expect(updateTemplate(await sam(), TEMPLATE.eventPlanning, { name: 'No' })).rejects.toMatchObject({ error: { code: 'forbidden' } });
    await updateTemplate(await sam(), TEMPLATE.handoff, { name: 'Club handoff updated' });
    expect((await tx.execute(sql`select name from agent_templates where id = ${TEMPLATE.handoff}`))[0].name).toBe('Club handoff updated');
  }));
  it('authenticates and validates the GET/PATCH/PUT HTTP routes', () => inRolledBackApp(async () => {
    const ctx = { params: Promise.resolve({ templateId: TEMPLATE.eventPlanning }) };
    expect((await templateRoute.GET(req('GET'), ctx)).status).toBe(200);
    expect((await templateRoute.GET(req('GET', undefined, false), ctx)).status).toBe(401);
    expect((await templateRoute.PATCH(req('PATCH', { target: 'pilot' }), ctx)).status).toBe(200);
    expect((await templateRoute.PATCH(req('PATCH', { latestVersion: 99 }), ctx)).status).toBe(400);
    const clubCtx = { params: Promise.resolve({ orgId: ORG.archery }) };
    expect((await policyRoute.PUT(req('PUT', policy, false), clubCtx)).status).toBe(401);
    expect((await policyRoute.PUT(req('PUT', policy, true, false), clubCtx)).status).toBe(400);
    expect((await policyRoute.PUT(req('PUT', policy), clubCtx)).status).toBe(200);
  }));
  it('installs an optional template idempotently and preserves its row', () => inRolledBackApp(async tx => {
    await tx.execute(sql`update agent_templates set distribution = 'optional' where id = ${TEMPLATE.eventPlanning}`);
    const actor = await sam();
    const first = await installTemplate(actor, ORG.startup, { templateId: TEMPLATE.eventPlanning });
    expect(first).toMatchObject({ status: 'enabled', modelClass: 'economy' });
    expect((await installTemplate(actor, ORG.startup, { templateId: TEMPLATE.eventPlanning })).installationId).toBe(first.installationId);
    expect(await tx.execute(sql`select id from agent_installations where template_id = ${TEMPLATE.eventPlanning} and org_id = ${ORG.startup}`)).toHaveLength(1);
  }));
  it('keeps new public installations disabled until the explicit publish path', () => inRolledBackApp(async tx => {
    await tx.execute(sql`update agent_templates set distribution = 'optional' where id = ${TEMPLATE.eventPlanning}`);
    await tx.execute(sql`update agent_template_versions set audience = 'public', max_tier = 'public', usable_by = array[]::text[] where template_id = ${TEMPLATE.eventPlanning}`);
    const installed = await installTemplate(await sam(), ORG.startup, { templateId: TEMPLATE.eventPlanning });
    expect(installed).toMatchObject({ audience: 'public', status: 'disabled' });
    expect(await tx.execute(sql`select id from quota_limits where installation_id = ${installed.installationId}`)).toHaveLength(1);
  }));
  it('refuses default installs, cross-club templates, excluded cohorts and non-presidents', () => inRolledBackApp(async tx => {
    await expect(installTemplate(await sam(), ORG.startup, { templateId: TEMPLATE.eventPlanning })).rejects.toMatchObject({ error: { code: 'invalid' } });
    await expect(installTemplate(await sam(), ORG.startup, { templateId: TEMPLATE.showcaseQa })).rejects.toMatchObject({ error: { code: 'not_found' } });
    await expect(installTemplate(await actorFor(USER.casey, ORG.startup), ORG.startup, { templateId: TEMPLATE.handoff })).rejects.toMatchObject({ error: { code: 'forbidden' } });
    await tx.execute(sql`update agent_templates set distribution = 'optional', target = 'no-clubs' where id = ${TEMPLATE.eventPlanning}`);
    await expect(installTemplate(await sam(), ORG.startup, { templateId: TEMPLATE.eventPlanning })).rejects.toMatchObject({ error: { code: 'not_found' } });
  }));
  it('POST installations enforces JSON, identity and a strict template-only body', () => inRolledBackApp(async tx => {
    await tx.execute(sql`update agent_templates set distribution = 'optional' where id = ${TEMPLATE.eventPlanning}`);
    const ctx = { params: Promise.resolve({ orgId: ORG.startup }) };
    const request = (body: unknown) => new Request('http://localhost/api/orgs', { method: 'POST', headers: { cookie: cookie(USER.sam, ORG.startup), 'content-type': 'application/json' }, body: JSON.stringify(body) });
    expect((await installRoute.POST(req('POST', { templateId: TEMPLATE.eventPlanning }, false), ctx)).status).toBe(401);
    expect((await installRoute.POST(request({ templateId: TEMPLATE.eventPlanning, modelClass: 'standard' }), ctx)).status).toBe(400);
    expect((await installRoute.POST(request({ templateId: TEMPLATE.eventPlanning }), ctx)).status).toBe(200);
  }));
});
