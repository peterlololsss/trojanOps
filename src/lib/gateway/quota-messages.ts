// Owner: A (WP-4). The UI copy for quota_exceeded, by scope (docs/architecture.md §11).
import type { QuotaScope } from '../contracts';

/** micro-USD as dollars to the cent: 500000 → "$0.50". */
export function usd(micro: number): string {
  return `$${(micro / 1_000_000).toFixed(2)}`;
}

export interface QuotaMessageContext {
  club: string;
  agent: string;
  spentMicro: number;
  limitMicro: number;
}

export function quotaMessage(scope: QuotaScope, ctx: QuotaMessageContext): string {
  const spent = usd(ctx.spentMicro);
  const limit = usd(ctx.limitMicro);
  switch (scope) {
    case 'member':
      return `Your monthly AI quota in ${ctx.club} is used up (${spent} of ${limit}). Ask your president to raise it.`;
    case 'org':
      return `${ctx.club} has used its monthly AI quota (${spent} of ${limit}). USG can raise it.`;
    case 'installation':
      return `${ctx.agent} has used its monthly budget in ${ctx.club}.`;
    case 'student_daily':
      return `You've reached today's limit for public agents (${limit}). It resets at midnight PT.`;
    case 'platform':
      return 'TrojanOps has reached this month\'s platform limit.';
  }
}
