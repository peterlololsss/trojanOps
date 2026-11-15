import { requireUser } from '../api';
import { activeMemberships } from '../authz';
import { now } from '../clock';
import type { Actor, EffectiveAgent, QuotaRemaining, QuotaTarget } from '../contracts';
import { withActor } from '../db/with-actor';
import { periodEnd } from './period';
import { levelRemaining, releaseStaleHoldsIfFree } from './quota';

export type QuotaLine = QuotaRemaining & { readonly resetsAt: string };

export async function quotaLine(actor: Actor, agent: Pick<EffectiveAgent, 'orgId' | 'installationId' | 'audience'>): Promise<QuotaLine> {
  const userId = requireUser(actor);
  const member = (await activeMemberships(userId))?.some((m) => m.orgId === agent.orgId);
  const targets: QuotaTarget[] = [];
  if (member) targets.push({ scope: 'member', userId, orgId: agent.orgId });
  if (agent.audience === 'public') targets.push({ scope: 'student_daily', userId });
  targets.push({ scope: 'installation', installationId: agent.installationId }, { scope: 'org', orgId: agent.orgId }, { scope: 'platform' });
  const at = now();
  return withActor(actor, {}, async (tx) => {
    await releaseStaleHoldsIfFree(tx, at);
    let binding: QuotaRemaining | undefined;
    for (const target of targets) {
      const level = await levelRemaining(tx, target, at);
      if (!binding || level.remainingMicro < binding.remainingMicro) binding = level;
    }
    const level = binding ?? { scope: 'platform', limitMicro: 0, remainingMicro: 0, spentMicro: 0 };
    return { ...level, resetsAt: periodEnd(level.scope === 'student_daily' ? 'day' : 'month', at).toISOString() };
  });
}
