// Owner: A (WP-4). The UI copy for quota_exceeded, by scope (docs/architecture.md §11).
import type { QuotaScope } from '../contracts';
import { now } from '../clock';
import { periodEnd } from './period';
import { creditLabel } from './prices';

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
  const limit = creditLabel(ctx.limitMicro);
  const reset = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' }).format(periodEnd('month', now()));
  // TODO(verify): use role wording until the team approves naming the current president.
  switch (scope) {
    case 'member':
      return ctx.limitMicro === 0 ? `Your allowance in ${ctx.club} is 0 credits this month. Ask your club president to raise it.` : `You've used this month's ${limit} in ${ctx.club}. They reset ${reset}. Ask your club president to raise your allowance.`;
    case 'org':
      return `${ctx.club} has used its ${limit} for this month. They reset ${reset}. USG can raise the club's budget.`;
    case 'installation':
      return `${ctx.agent} has used its ${limit} for this month in ${ctx.club}. They reset ${reset}. Ask the club president to raise its budget.`;
    case 'student_daily':
      return `You've used today's ${limit} for public agents. They reset at midnight PT.`;
    case 'platform':
      return `TrojanOps has reached this month's platform limit. It resets ${reset}.`;
  }
}
