// Owner: B (WP-5, real by H7). The campus directory: every club's public agents.
import type { AgentListing } from '../contracts';
import { loadAgents } from './queries';

/**
 * Every club's enabled installations whose **effective** audience is public — so Startup's
 * recruiting-qa is absent until D3 publishes it, and Dance's showcase-qa is there from the seed.
 *
 * "Effective" matters twice: a club that narrowed a public version to members drops out without
 * anyone editing the template, and `enabledOnly` covers a retired template as well as a
 * switched-off installation, so a retired agent is never offered to a student who cannot run it.
 */
export async function directory(): Promise<AgentListing[]> {
  const loaded = await loadAgents({ enabledOnly: true });

  return loaded
    .filter(({ agent }) => agent.audience === 'public')
    .map(({ agent, orgName }) => ({
      installationId: agent.installationId,
      orgId: agent.orgId,
      orgName,
      templateSlug: agent.templateSlug,
      name: agent.name,
      purpose: agent.purpose,
      audience: agent.audience,
      reasonLabel: 'All students',
      templateVersion: agent.templateVersion,
    }));
}
