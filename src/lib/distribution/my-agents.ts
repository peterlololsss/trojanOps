// Owner: B (WP-5, real by H7). What a student's own clubs expose to them.
import { activeMemberships } from '../authz';
import type { AgentListing, MyAgentsClub } from '../contracts';
import { canUse } from './effective-config';
import { positionName, reasonLabel } from './labels';
import { loadAgents } from './queries';

/**
 * For each **distinct** club where the user is an active member: that club's enabled
 * installations that `canUse` admits, each with its reason label.
 *
 * Morgan belongs to two clubs, and each club's agents are judged in that club — she gets
 * Archery's funding pre-check as its treasurer, and only the member-level agents in Startup.
 */
export async function myAgents(userId: string): Promise<MyAgentsClub[]> {
  const held = await activeMemberships(userId);
  if (!held || held.length === 0) return [];

  const orgIds = [...new Set(held.map((m) => m.orgId))];
  const agents = await loadAgents({ orgIds, enabledOnly: true });

  const clubs: MyAgentsClub[] = [];

  for (const orgId of orgIds) {
    const inOrg = held.filter((m) => m.orgId === orgId);
    const orgName = inOrg[0]?.orgName ?? '';
    const listings: AgentListing[] = [];

    for (const agent of agents.filter((a) => a.orgId === orgId)) {
      const verdict = await canUse(userId, agent);
      if (!verdict.ok) continue;
      listings.push({
        installationId: agent.installationId,
        orgId,
        orgName,
        templateSlug: agent.templateSlug,
        name: agent.name,
        purpose: agent.purpose,
        audience: agent.audience,
        reasonLabel: reasonLabel(verdict.reason, agent.usableBy),
        templateVersion: agent.templateVersion,
      });
    }

    clubs.push({
      orgId,
      orgName,
      positionNames: inOrg.map((m) => positionName(m.positionSlug)),
      agents: listings,
    });
  }

  return clubs;
}
