// Owner: B (WP-5, real by H7). What a student's own clubs expose to them.
import { activeMemberships, grantsFromMemberships } from '../authz';
import type { AgentListing, MyAgentsClub } from '../contracts';
import { canUseWithGrants } from './effective-config';
import { positionName, reasonLabel } from './labels';
import { loadAgents } from './queries';

/**
 * For each **distinct** club where the user is an active member: that club's enabled
 * installations that `canUse` admits, each with its reason label.
 *
 * Morgan belongs to two clubs, and each club's agents are judged in that club — she gets
 * Archery's funding pre-check as its treasurer, and only the member-level agents in Startup.
 *
 * Grants are computed once per club from the memberships already in hand, rather than letting
 * `canUse` re-read them for every agent.
 */
export async function myAgents(userId: string): Promise<MyAgentsClub[]> {
  const held = await activeMemberships(userId);
  if (!held || held.length === 0) return [];

  const orgIds = [...new Set(held.map((m) => m.orgId))];
  const loaded = await loadAgents({ orgIds, enabledOnly: true });

  return orgIds.map((orgId) => {
    const inOrg = held.filter((m) => m.orgId === orgId);
    const orgName = inOrg[0]?.orgName ?? '';
    const grants = grantsFromMemberships(held, orgId);
    const agents: AgentListing[] = [];

    for (const { agent } of loaded.filter((l) => l.agent.orgId === orgId)) {
      const verdict = canUseWithGrants(agent, grants);
      if (!verdict.ok) continue;
      agents.push({
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

    return {
      orgId,
      orgName,
      positionNames: inOrg.map((m) => positionName(m.positionSlug)),
      agents,
    };
  });
}
