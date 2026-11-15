// Owner: B (WP-7). The club's agent library: everything installed in one club, whether the
// member looking at it may use each one, and what the president may do with it.
//
// Unlike `myAgents`, this lists installations a club has switched off and templates USG has
// retired — a president cannot turn an agent back on, or see why it stopped working, if the page
// hides it. What each viewer may *use* is a separate question, answered per row.
import { grantsFor } from '../authz';
import type { Actor, Audience, EffectiveAgent, Tier } from '../contracts';
import { canUseWithGrants } from './effective-config';
import { reasonLabel } from './labels';
import { loadAgents } from './queries';

export interface CatalogEntry {
  installationId: string;
  templateSlug: string;
  name: string;
  purpose: string;
  audience: Audience;
  maxTier: Tier;
  /** `enabled`, `disabled` (the club switched it off) or `retired` (USG withdrew the template). */
  status: EffectiveAgent['status'];
  templateVersion: number;
  distribution: 'required' | 'default' | 'optional';
  /** §8: a pinned installation whose template has published past it. */
  updateAvailable: boolean;
  /** Why this viewer may use it — "All students", "All members", the position names — or null. */
  reasonLabel: string | null;
  /** Already open to the whole campus, so "Publish to all students" is done for this one. */
  isPublic: boolean;
}

export interface ClubCatalog {
  orgId: string;
  orgName: string;
  /** Whether the viewer may change these installations (§8: the president, acting in this club). */
  canManage: boolean;
  agents: CatalogEntry[];
}

/**
 * The club's catalog for one viewer.
 *
 * Grants are computed once for the club and reused for every row, rather than letting `canUse`
 * re-read the viewer's memberships per agent. They are read **in this club**, which is what keeps
 * a treasurer of another club from reading this one's officer-level agents as usable.
 */
export async function catalog(actor: Actor, orgId: string): Promise<ClubCatalog | null> {
  const loaded = await loadAgents({ orgIds: [orgId] });
  if (loaded.length === 0) return null;

  const grants = actor.userId ? await grantsFor(actor.userId, orgId) : [];
  const canManage = actor.activeOrgId === orgId && actor.positions.includes('president');

  return {
    orgId,
    orgName: loaded[0].orgName,
    canManage,
    agents: loaded.map(({ agent, distribution, updateAvailable }) => {
      // A switched-off or retired agent is listed but not offered: nobody can run it, so saying
      // "All members" next to it would be a lie.
      const verdict = agent.status === 'enabled' ? canUseWithGrants(agent, grants) : { ok: false as const };
      return {
        installationId: agent.installationId,
        templateSlug: agent.templateSlug,
        name: agent.name,
        purpose: agent.purpose,
        audience: agent.audience,
        maxTier: agent.maxTier,
        status: agent.status,
        templateVersion: agent.templateVersion,
        distribution,
        updateAvailable,
        reasonLabel: verdict.ok ? reasonLabel(verdict.reason, agent.usableBy) : null,
        isPublic: agent.audience === 'public',
      };
    }),
  };
}
