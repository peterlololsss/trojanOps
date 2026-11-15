// Owner: B. Historical presentation only: never an EffectiveAgent or a runtime configuration.
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { agentInstallations, agentTemplates, agentTemplateVersions } from '../db/schema';
import { ownInstallationLimit } from './write-support';
import type { CatalogEntry } from './catalog';

/** Called only after catalog authorization. Policy can change after retirement, so these labels
 * are the recorded installation/version, not a promise of current permission. The runtime read
 * path still applies every clamp; the catalog never exposes sources, tools, prompts or a model.
 */
export async function retiredCatalogEntries(orgId: string): Promise<CatalogEntry[]> {
  const rows = await getDb().select({ id: agentInstallations.id, slug: agentTemplates.slug,
    name: agentTemplates.name, purpose: agentTemplateVersions.purpose, distribution: agentTemplates.distribution,
    version: agentTemplateVersions.version, latest: agentTemplates.latestVersion, track: agentInstallations.track,
    audienceOverride: agentInstallations.audience, usableByOverride: agentInstallations.usableBy,
    audience: agentTemplateVersions.audience, usableBy: agentTemplateVersions.usableBy, maxTier: agentTemplateVersions.maxTier,
  }).from(agentInstallations).innerJoin(agentTemplates, eq(agentTemplates.id, agentInstallations.templateId))
    .innerJoin(agentTemplateVersions, and(eq(agentTemplateVersions.templateId, agentTemplates.id),
      eq(agentTemplateVersions.version, sql`case when ${agentInstallations.track} = 'pinned' and ${agentInstallations.pinnedVersion} is not null then ${agentInstallations.pinnedVersion} else ${agentTemplates.latestVersion} end`)))
    .where(and(eq(agentInstallations.orgId, orgId), eq(agentTemplates.status, 'retired')))
    .orderBy(agentTemplates.name, agentInstallations.id);
  const entries: CatalogEntry[] = [];
  for (const r of rows) {
    const audience = r.audienceOverride ?? r.audience;
    const own = await ownInstallationLimit(getDb(), r.id);
    entries.push({ installationId: r.id, templateSlug: r.slug, name: r.name, purpose: r.purpose,
      templateVersion: r.version, distribution: r.distribution, status: 'retired', memberModels: null,
      audience, usableBy: audience === 'positions' ? r.usableByOverride ?? r.usableBy : [],
      maxTier: r.audience === 'public' || audience === 'public' ? 'public' : r.maxTier,
      updateAvailable: r.track === 'pinned' && r.version < r.latest,
      reasonLabel: null, canPublishPublic: false, isPublic: audience === 'public',
      limitMicro: own !== null && own > 0 ? own : null });
  }
  return entries;
}
