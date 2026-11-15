// Owner: B (WP-5, real by H7). The campus directory: every club's public agents.
import type { AgentListing } from '../contracts';
import { getDb } from '../db/client';
import { orgs } from '../db/schema';
import { loadAgents } from './queries';

/**
 * Every club's enabled installations whose **effective** audience is public — so Startup's
 * recruiting-qa is absent until D3 publishes it, and Dance's showcase-qa is there from the seed.
 *
 * "Effective" matters: a club that narrowed a public version to members drops out of the
 * directory without anyone editing the template.
 */
export async function directory(): Promise<AgentListing[]> {
  const agents = await loadAgents({ enabledOnly: true });
  const publicAgents = agents.filter((a) => a.audience === 'public');
  if (publicAgents.length === 0) return [];

  const names = await clubNames();

  return publicAgents.map((a) => ({
    installationId: a.installationId,
    orgId: a.orgId,
    orgName: names.get(a.orgId) ?? '',
    templateSlug: a.templateSlug,
    name: a.name,
    purpose: a.purpose,
    audience: a.audience,
    reasonLabel: 'All students',
    templateVersion: a.templateVersion,
  }));
}

export async function clubNames(): Promise<Map<string, string>> {
  const rows = await getDb().select({ id: orgs.id, name: orgs.name }).from(orgs);
  return new Map(rows.map((r) => [r.id, r.name]));
}
