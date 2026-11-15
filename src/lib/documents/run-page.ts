// Owner: C (WP-9). Data for the agent run page, /org/[orgId]/agents/[installationId] (§14). It reads
// the installation and whether the viewer could run it, so the page can say why before they type.
// The gateway still decides on every run (§7 steps 1–2); this is a UI pre-check only, and
// tests/run-page.test.ts checks that it agrees with runAgent. It never reads run input or output (I15).
import { and, eq, inArray } from 'drizzle-orm';
import { requireUser } from '../api';
import { grantsFor, isUuid } from '../authz';
import { AppError, type Actor, type Audience, type Tier } from '../contracts';
import { getDb } from '../db/client';
import { orgs, positions } from '../db/schema';
import { canUse, effectiveAgent } from '../distribution';
import { buildRunConfig } from './run-page-config';
import type { ChatConfig } from './run-config';

/**
 * - `ok`: the viewer can run it now.
 * - `not_member`: an internal agent and the viewer is not a member of its club. The page shows no
 *   name, purpose or audience: the catalog is readable by members only (§14).
 * - `not_in_audience`: a member outside the agent's audience.
 * - `switch_org`: an internal agent, with another club (or none) active.
 * - `unavailable`: turned off in the club, or retired by USG.
 */
export type RunAccess =
  | { kind: 'ok' }
  | { kind: 'not_member' }
  | { kind: 'not_in_audience' }
  | { kind: 'switch_org' }
  | { kind: 'unavailable'; reason: 'disabled' | 'retired'; message: string };

export interface RunPageAgent {
  installationId: string;
  /** Picks the agent's topic tags (src/app/me/agents/agent-tags.ts). */
  templateSlug: string;
  name: string;
  purpose: string;
  audience: Audience;
  /** Who may use it (ui-designer.md "Audience labels"): "All students", "All members", or "Treasurer, President". */
  audienceLabel: string;
  maxTier: Tier;
  templateVersion: number;
}

export type RunPageData = { org: { id: string; name: string }; demoRuntime: boolean; workspace?: ChatConfig } & (
  | { access: { kind: 'not_member' }; agent: null }
  | { access: Exclude<RunAccess, { kind: 'not_member' }>; agent: RunPageAgent }
);

/**
 * Whether replies come from the mock runtime (§7). It reads the same env var as `runtime/index.ts`
 * without importing it: only the gateway imports the runtime (I5).
 * TODO(verify): process-wide. Ask A for a per-run marker on RunResult (contract PR) once WP-13 can
 * run some agents on the real runtime.
 */
export function isDemoRuntime(): boolean {
  return (process.env.AGENT_RUNTIME ?? 'mock') === 'mock';
}

/** The audience label of a positions agent with no positions listed yet. */
export const NO_POSITIONS_LABEL = 'No positions yet';

async function audienceLabel(audience: Audience, usableBy: string[], orgId: string): Promise<string> {
  if (audience === 'public') return 'All students';
  if (audience === 'members') return 'All members';
  if (usableBy.length === 0) return NO_POSITIONS_LABEL;
  const rows = await getDb().select({ slug: positions.slug, name: positions.name }).from(positions)
    .where(and(eq(positions.orgId, orgId), inArray(positions.slug, usableBy)));
  const names = new Map(rows.map((r) => [r.slug, r.name]));
  return usableBy.map((slug) => names.get(slug) ?? slug).join(', ');
}

/** null when the club or the installation does not exist, or the installation belongs to another club. */
export async function getRunPageData(viewer: Actor, orgId: string, installationId: string): Promise<RunPageData | null> {
  const userId = requireUser(viewer);
  if (!isUuid(orgId) || !isUuid(installationId)) return null;
  const [org] = await getDb().select({ id: orgs.id, name: orgs.name }).from(orgs).where(eq(orgs.id, orgId));
  if (!org) return null;

  let agent;
  try {
    agent = await effectiveAgent(installationId);
  } catch (error) {
    if (error instanceof AppError && error.error.code === 'not_found') return null;
    throw error;
  }
  if (agent.orgId !== orgId) return null;
  const demoRuntime = isDemoRuntime();

  // Internal agents are described to the club's members only. Membership is read in the agent's
  // club, whatever club is active (I3).
  // TODO(verify): confirm with the team that a non-member sees no internal agent details here.
  if (agent.audience !== 'public' && !(await grantsFor(userId, orgId)).includes(`${orgId}:*`)) {
    return { org, demoRuntime, access: { kind: 'not_member' }, agent: null };
  }

  // The gateway checks the active org before the audience. Here the audience goes first, so a
  // member outside the audience is not told to switch to a club they can't use the agent in.
  let access: Exclude<RunAccess, { kind: 'not_member' }>;
  if (agent.status === 'retired') access = { kind: 'unavailable', reason: 'retired', message: 'Retired by USG.' };
  else if (agent.status === 'disabled') access = { kind: 'unavailable', reason: 'disabled', message: `${agent.name} is turned off in ${org.name}.` };
  else if (!(await canUse(userId, agent)).ok) access = { kind: 'not_in_audience' };
  else if (agent.audience !== 'public' && viewer.activeOrgId !== orgId) access = { kind: 'switch_org' };
  else access = { kind: 'ok' };

  const label = await audienceLabel(agent.audience, agent.usableBy, orgId);
  return {
    org,
    demoRuntime,
    access,
    ...(access.kind === 'ok' ? { workspace: await buildRunConfig(viewer, agent, { club: org.name, audience: label }) } : {}),
    agent: {
      installationId: agent.installationId,
      templateSlug: agent.templateSlug,
      name: agent.name,
      purpose: agent.purpose,
      audience: agent.audience,
      audienceLabel: label,
      maxTier: agent.maxTier,
      templateVersion: agent.templateVersion,
    },
  };
}
