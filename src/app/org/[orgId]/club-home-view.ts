// Owner: B (WP-7). Pure view logic and copy for the club home: no I/O, so the page and the tests
// share one definition of what the quota meter says.
import type { QuotaRemaining } from '@/lib/contracts';
import { quotaMessage, usd } from '@/lib/gateway/quota-messages';

/** The share of the limit at which the meter earns an attention chip (ui-designer.md). */
export const ATTENTION_PERCENT = 80;

export interface UsageSummary {
  /** 0–100, for the meter's fill. A limit of $0.00 reads as full, because nothing is left. */
  percent: number;
  spent: string;
  limit: string;
  left: string;
  /** "80% used", once the viewer is near the limit and not yet over it. */
  attention: string | null;
  /** §11's member copy, once nothing is left; null while the viewer can still run an agent. */
  blocked: string | null;
}

/** The meter's numbers and words for one member's own monthly spend in one club. */
export function usageSummary(usage: QuotaRemaining, clubName: string): UsageSummary {
  const percent = usage.limitMicro > 0
    ? Math.min(100, Math.round((usage.spentMicro / usage.limitMicro) * 100))
    : 100;
  const blocked = usage.remainingMicro === 0
    ? quotaMessage('member', {
      club: clubName, agent: '', spentMicro: usage.spentMicro, limitMicro: usage.limitMicro,
    })
    : null;
  return {
    percent,
    spent: usd(usage.spentMicro),
    limit: usd(usage.limitMicro),
    left: usd(usage.remainingMicro),
    attention: !blocked && percent >= ATTENTION_PERCENT ? `${percent}% used` : null,
    blocked,
  };
}

export const documentCount = (count: number) => `${count} ${count === 1 ? 'document' : 'documents'}`;
export const agentCount = (count: number) => `${count} ${count === 1 ? 'agent' : 'agents'}`;
