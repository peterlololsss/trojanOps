// The My agents rail: every agent a student can use, grouped by where it comes from. Pure, so the
// grouping, de-duplication and default choice are unit-tested (tests/my-agents-groups.test.ts).
import type { AgentListing, Audience, MyAgentsClub } from '@/lib/contracts';
import { agentTags } from './agent-tags';

export interface RailAgent {
  readonly installationId: string;
  readonly orgId: string;
  readonly orgName: string;
  readonly name: string;
  readonly purpose: string;
  readonly audience: Audience;
  readonly templateVersion: number;
  readonly tags: readonly string[];
}

export interface AgentGroup {
  /** The org id, or `public` for other clubs' agents open to all students. */
  readonly key: string;
  readonly label: string;
  readonly kind: 'club' | 'usg' | 'public';
  readonly agents: readonly RailAgent[];
}

export interface GroupInput {
  /** `myAgents(userId)`: one entry per org the user is an active member of. */
  readonly clubs: readonly MyAgentsClub[];
  /** Which of those orgs are USG (`orgs.kind = 'usg'`). */
  readonly usgOrgIds: ReadonlySet<string>;
  /** `directory()`: every club's public agents. */
  readonly publicAgents: readonly AgentListing[];
  readonly activeOrgId: string | null;
}

export const PUBLIC_GROUP_LABEL = 'All students';

function railAgent(listing: AgentListing): RailAgent {
  return {
    installationId: listing.installationId,
    orgId: listing.orgId,
    orgName: listing.orgName,
    name: listing.name,
    purpose: listing.purpose,
    audience: listing.audience,
    templateVersion: listing.templateVersion,
    tags: agentTags(listing.templateSlug),
  };
}

/**
 * The user's own orgs first (the active one, then clubs by name, then USG), then "All students":
 * public agents of clubs the user is not in. Each installation appears once; a public agent of one
 * of the user's clubs stays under that club. Groups with no agents are left out.
 */
export function groupAgents({ clubs, usgOrgIds, publicAgents, activeOrgId }: GroupInput): AgentGroup[] {
  const seen = new Set<string>();
  const own = clubs.map((club) => {
    const agents: RailAgent[] = [];
    for (const listing of [...club.agents, ...publicAgents.filter((p) => p.orgId === club.orgId)]) {
      if (seen.has(listing.installationId)) continue;
      seen.add(listing.installationId);
      agents.push(railAgent(listing));
    }
    return { key: club.orgId, label: club.orgName, kind: usgOrgIds.has(club.orgId) ? 'usg' as const : 'club' as const, agents };
  });
  const rank = (group: AgentGroup) => (group.key === activeOrgId ? 0 : group.kind === 'club' ? 1 : 2);
  own.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));

  const others = publicAgents
    .filter((p) => !seen.has(p.installationId) && !clubs.some((c) => c.orgId === p.orgId))
    .filter((p, i, all) => all.findIndex((q) => q.installationId === p.installationId) === i)
    .sort((a, b) => a.orgName.localeCompare(b.orgName) || a.name.localeCompare(b.name))
    .map(railAgent);

  return [...own, { key: 'public', label: PUBLIC_GROUP_LABEL, kind: 'public' as const, agents: others }]
    .filter((group) => group.agents.length > 0);
}

export function findAgent(groups: readonly AgentGroup[], installationId: string): RailAgent | null {
  for (const group of groups) {
    const agent = group.agents.find((a) => a.installationId === installationId);
    if (agent) return agent;
  }
  return null;
}

/** With no `?agent=`: the first agent of the active org, else the first public agent, else the first one listed. */
export function defaultAgent(groups: readonly AgentGroup[], activeOrgId: string | null): RailAgent | null {
  return groups.find((g) => g.kind !== 'public' && g.key === activeOrgId)?.agents[0]
    ?? groups.find((g) => g.kind === 'public')?.agents[0]
    ?? groups[0]?.agents[0]
    ?? null;
}

/** An internal agent runs only with its club active (gateway step 1), so choosing one switches first. */
export function needsSwitch(agent: Pick<RailAgent, 'audience' | 'orgId'>, activeOrgId: string | null): boolean {
  return agent.audience !== 'public' && agent.orgId !== activeOrgId;
}
