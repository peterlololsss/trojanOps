// Owner: B (WP-5, real by H6). The installation's effective configuration and who may use it.
import { AppError, type CanUse, type EffectiveAgent } from '../contracts';
import { grantsFor } from '../authz';
import { loadAgents } from './queries';

/**
 * The installation's effective configuration: the template version its track resolves to, plus the
 * club's overrides, clamped (§8). Throws not_found for an unknown installation.
 *
 * It does not refuse a retired template or a switched-off installation — it reports them through
 * `status`, and the gateway's step 1 turns that into the refusal the user sees.
 */
export async function effectiveAgent(installationId: string): Promise<EffectiveAgent> {
  const [agent] = await loadAgents({ installationId });
  if (!agent) throw new AppError({ code: 'not_found', message: 'This agent does not exist.' });
  return agent;
}

/**
 * Whether the user is in the agent's audience. Positions are read in `agent.orgId`, not in the
 * actor's active org — Morgan is Archery's treasurer and a plain member of Startup, so she must
 * not reach Startup's funding pre-check.
 */
export const canUse: CanUse = async (userId, agent) => {
  if (agent.audience === 'public') return { ok: true, reason: 'public' };
  const grants = await grantsFor(userId, agent.orgId);
  if (agent.audience === 'members') {
    return grants.includes(`${agent.orgId}:*`) ? { ok: true, reason: 'members' } : { ok: false };
  }
  const position = agent.usableBy.find((p) => grants.includes(`${agent.orgId}:${p}`));
  return position ? { ok: true, reason: { position } } : { ok: false };
};
