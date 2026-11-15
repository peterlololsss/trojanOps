// Owner: B. §13 bootstrap for roster-created clubs; callers are trusted lifecycle services.
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { isUuid } from '../authz';
import { now } from '../clock';
import { AppError, type Actor, type ModelClass } from '../contracts';
import { getDb } from '../db/client';
import { agentInstallations, agentTemplates, agentTemplateVersions, orgCohorts, orgs,
  positions, quotaLimits, sources, usgClubPolicy } from '../db/schema';
import { audit } from '../gateway/audit';
import { clampInstallation } from './clamps';
import { lockQuotaBootstrap } from './write-support';

const DEFAULT_SOURCES = [
  { slug: 'public', name: 'Public', kind: 'public' },
  { slug: 'minutes', name: 'Minutes', kind: 'minutes' },
  { slug: 'finance', name: 'Finance', kind: 'finance' },
  { slug: 'archive', name: 'Archive', kind: 'archive' },
] as const;
const DEFAULT_POLICY = { allowedModelClasses: ['standard', 'economy'] as ModelClass[], allowPublicAgents: true };

/** Fill missing defaults; never reset a club's policy, quota or installation overrides.
 * The org row lock serializes repeated/concurrent provisioning (quota_limits has no unique key).
 * Defaults are prepared in memory and every new installation passes I7 before any row is written.
 */
export async function provisionOrg(orgId: string, actor?: Actor): Promise<{ installed: number }> {
  const notFound = () => new AppError({ code: 'not_found', message: 'This active club does not exist.' });
  if (!isUuid(orgId)) throw notFound();
  let installed: number;
  try {
    installed = await getDb().transaction(async tx => {
      const [org] = await tx.select().from(orgs).where(eq(orgs.id, orgId)).for('no key update');
      if (org?.kind !== 'rso' || org.status !== 'active') throw notFound();
      const createdAt = now();
      const [policy] = await tx.select().from(usgClubPolicy).where(eq(usgClubPolicy.orgId, orgId));
      await lockQuotaBootstrap(tx);
      const quotas = await tx.select().from(quotaLimits).where(inArray(quotaLimits.scope, ['platform', 'org']));
      const ownQuota = quotas.find(q => q.scope === 'org' && q.orgId === orgId);
      // §15 specifies $5 per club. Bootstrap writes the row directly: the optional actor can be
      // absent during roster import, while quota.setLimit is the interactive, authorized editor.
      // TODO(verify): until A's quota seed lands there may be no platform row; retain the §15 default.
      const platform = quotas.filter(q => q.scope === 'platform').map(q => q.limitMicro);
      const quotaMicro = ownQuota?.limitMicro ?? Math.min(5_000_000, ...platform);
      const ownedSources = await tx.select().from(sources).where(eq(sources.orgId, orgId));
      const missingSources = DEFAULT_SOURCES.filter(s => !ownedSources.some(o => o.slug === s.slug))
        .map(s => ({ ...s, id: randomUUID(), orgId, createdAt }));
      const clubPositions = await tx.select().from(positions).where(eq(positions.orgId, orgId));
      const cohorts = await tx.select().from(orgCohorts).where(eq(orgCohorts.orgId, orgId));
      const existing = await tx.select().from(agentInstallations).where(eq(agentInstallations.orgId, orgId));
      const templates = await tx.select().from(agentTemplates).where(and(
        eq(agentTemplates.scope, 'global'), eq(agentTemplates.status, 'active'),
        inArray(agentTemplates.distribution, ['required', 'default']), isNotNull(agentTemplates.distributedAt),
      ));
      const candidates = templates.filter(t => (t.target === 'all' || cohorts.some(c => c.cohortSlug === t.target))
        && !existing.some(i => i.templateId === t.id));
      const publicTemplates = new Set<string>();
      for (const template of candidates) {
        const [version] = await tx.select().from(agentTemplateVersions).where(and(
          eq(agentTemplateVersions.templateId, template.id), eq(agentTemplateVersions.version, template.latestVersion),
        ));
        if (!version) throw new AppError({ code: 'invalid', message: 'A distributed template has no published version.' });
        const result = clampInstallation({ version, installation: {}, club: {
          policy: policy ?? DEFAULT_POLICY, quotaMicro,
          positionSlugs: clubPositions.map(p => p.slug),
          ownedSourceIds: [...ownedSources, ...missingSources].map(s => s.id),
        } });
        if (result.ok && result.effective.audience === 'public') publicTemplates.add(template.id);
        if (!result.ok) {
          const { field, allowed, message } = result.violation;
          throw new AppError({ code: 'clamp_violation', message, cap: { scope: 'installation', field, allowed } });
        }
      }
      if (missingSources.length) await tx.insert(sources).values(missingSources);
      if (!policy) await tx.insert(usgClubPolicy).values({ orgId, ...DEFAULT_POLICY, createdAt });
      if (!ownQuota) await tx.insert(quotaLimits).values({ scope: 'org', orgId, limitMicro: quotaMicro,
        setBy: actor?.userId ?? null, setAt: createdAt, createdAt });
      for (const template of candidates) {
        const id = randomUUID();
        await tx.insert(agentInstallations).values({ id, templateId: template.id, orgId, enabled: true,
          track: 'latest', installedBy: actor?.userId ?? null, installedAt: createdAt, createdAt });
        if (publicTemplates.has(template.id)) {
          await tx.insert(quotaLimits).values({ scope: 'installation', orgId, installationId: id,
            limitMicro: Math.floor(quotaMicro / 2), setBy: actor?.userId ?? null, setAt: createdAt, createdAt });
        }
      }
      return candidates.length;
    });
  } catch (err) {
    // Rejections survive the rolled-back bootstrap; no invalid row or partial defaults persist.
    if (err instanceof AppError && err.error.code === 'clamp_violation') {
      await audit('installation.rejected', { actorUserId: actor?.userId ?? null,
        actingOrgId: actor?.activeOrgId ?? null, targetType: 'org', targetId: orgId,
        details: { field: err.error.cap!.field!, allowed: err.error.cap!.allowed as string | number | string[] } });
    }
    throw err;
  }
  await audit('org.provision', { actorUserId: actor?.userId ?? null,
    actingOrgId: actor?.activeOrgId ?? null, targetType: 'org', targetId: orgId, details: { installed } });
  return { installed };
}
