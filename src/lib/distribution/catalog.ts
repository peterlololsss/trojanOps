// Owner: B (WP-7). The club's agent library: everything installed in one club, whether the
// member looking at it may use each one, and what the president may do with it.
//
// Unlike `myAgents`, this lists installations a club has switched off and templates USG has
// retired — a president cannot turn an agent back on, or see why it stopped working, if the page
// hides it. What each viewer may *use* is a separate question, answered per row.
import { eq } from 'drizzle-orm';
import { grantsFor, isUsgAdmin, isUuid } from '../authz';
import { AppError, type Actor, type Audience, type EffectiveAgent, type Tier } from '../contracts';
import { getDb } from '../db/client';
import { orgs } from '../db/schema';
import { remaining } from '../gateway/quota';
import { canUseWithGrants } from './effective-config';
import { reasonLabel } from './labels';
import { loadAgents } from './queries';
import { ownInstallationLimit } from './write-support';

export interface CatalogEntry {
  installationId: string;
  templateSlug: string;
  name: string;
  purpose: string;
  audience: Audience;
  /** Position slugs the agent is for; empty unless the audience is `positions`. */
  usableBy: string[];
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
  /**
   * Whether publishing it to all students could succeed. False when the agent's template version
   * was never published campus-wide, or USG has turned public agents off for this club — offering
   * the action on those rows would only ever return a clamp violation.
   */
  canPublishPublic: boolean;
  /** The agent's own monthly budget in micro-USD, or null when it has none of its own yet. */
  limitMicro: number | null;
}

export interface ClubCatalog {
  orgId: string;
  orgName: string;
  /** Whether the viewer may change these installations (§8: the president, acting in this club). */
  canManage: boolean;
  /** The club's own monthly quota, which §8's publish default is half of. */
  clubLimitMicro: number;
  agents: CatalogEntry[];
}

/**
 * The club's catalog for one viewer. Null only when the club does not exist — a club with nothing
 * installed answers with an empty list, so the page can say "nothing yet" instead of 404.
 *
 * §14 scopes this to the club's members (and USG admins, who oversee every club). It carries the
 * club's monthly quota and each agent's budget, and for USG it carries the audience and max tier
 * of an `usg_internal` agent — none of which belongs to a student who simply knows the club's id.
 *
 * Grants are computed once for the club and reused for every row, rather than letting `canUse`
 * re-read the viewer's memberships per agent. They are read **in this club**, which is what keeps
 * a treasurer of another club from reading this one's officer-level agents as usable.
 */
/** A club's identity, for a page that must name it before deciding what the viewer may see.
 * Null when there is no such club — the club home's 404. Deliberately carries nothing sensitive,
 * so it answers for any signed-in viewer, member or not. */
export async function clubProfile(orgId: string): Promise<{ id: string; name: string } | null> {
  if (!isUuid(orgId)) return null;
  const [org] = await getDb().select({ id: orgs.id, name: orgs.name }).from(orgs).where(eq(orgs.id, orgId));
  return org ?? null;
}

export async function catalog(actor: Actor, orgId: string): Promise<ClubCatalog | null> {
  if (!isUuid(orgId)) return null;
  const [org] = await getDb().select({ id: orgs.id, name: orgs.name }).from(orgs).where(eq(orgs.id, orgId));
  if (!org) return null;

  const loaded = await loadAgents({ orgIds: [orgId] });
  const grants = actor.userId ? await grantsFor(actor.userId, orgId) : [];
  if (!grants.includes(`${orgId}:*`) && !(await isUsgAdmin(actor))) {
    throw new AppError({ code: 'forbidden', message: 'Only this club’s members can see its agent library.' });
  }

  const canManage = actor.activeOrgId === orgId && actor.positions.includes('president');
  const club = await remaining({ scope: 'org', orgId });

  // Sequential, not Promise.all: each `remaining()` opens its own transaction, and concurrent
  // transactions would share one connection. A club has a handful of agents.
  const agents: CatalogEntry[] = [];
  for (const { agent, distribution, updateAvailable, canPublishPublic } of loaded) {
    {
      // A switched-off or retired agent is listed but not offered: nobody can run it, so saying
      // "All members" next to it would be a lie.
      const verdict = agent.status === 'enabled' ? canUseWithGrants(agent, grants) : { ok: false as const };
      // The installation's OWN limit: `remaining()` falls back to the club's when it has none,
      // which would make the publish confirmation name the club's whole quota as this agent's.
      const own = await ownInstallationLimit(getDb(), agent.installationId);
      agents.push({
        installationId: agent.installationId,
        templateSlug: agent.templateSlug,
        name: agent.name,
        purpose: agent.purpose,
        audience: agent.audience,
        usableBy: agent.usableBy,
        maxTier: agent.maxTier,
        status: agent.status,
        templateVersion: agent.templateVersion,
        distribution,
        updateAvailable,
        reasonLabel: verdict.ok ? reasonLabel(verdict.reason, agent.usableBy) : null,
        isPublic: agent.audience === 'public',
        canPublishPublic: canPublishPublic && agent.status !== 'retired',
        limitMicro: own !== null && own > 0 ? own : null,
      });
    }
  }

  return { orgId, orgName: org.name, canManage, clubLimitMicro: club.limitMicro, agents };
}
