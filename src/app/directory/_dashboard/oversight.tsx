// Owner: D (WP-11). What USG sees about a club and students do not: the monthly quota meter, the
// installed agents, the club policy and USG funding against the published rule pack.
import { AlertCircle, ArrowUpCircle, Check, CircleSlash, Clock, TriangleAlert } from 'lucide-react';
import { meter } from '@/app/org/[orgId]/admin/admin-view';
import { Badge } from '@/components/ui/badge';
import type { ModelClass } from '@/lib/contracts';
import type { ClubOversight, QuotaUse } from '@/lib/directory/types';
import { fundingLines } from '@/lib/directory/view';
import { quotaMessage } from '@/lib/gateway/quota-messages';
import { Bar } from './parts';

const MODEL_LABEL: Record<ModelClass, string> = { economy: 'Economy', standard: 'Standard' };

/** The meter's words, plus §11's club copy once the quota is used up. */
export function quotaView(quota: QuotaUse, club: string) {
  const bar = meter(quota.spentMicro, quota.limitMicro);
  const blocked = quota.spentMicro >= quota.limitMicro
    ? quotaMessage('org', { club, agent: '', spentMicro: quota.spentMicro, limitMicro: quota.limitMicro })
    : null;
  return { ...bar, blocked };
}

export function QuotaMeter({ quota, club, className }: { quota: QuotaUse; club: string; className?: string }) {
  const q = quotaView(quota, club);
  return (
    <div className={className}>
      <p className="tabular-nums">
        <span className="font-semibold">{q.spent}</span>
        <span className="text-muted-foreground"> of {q.limit} used</span>
      </p>
      <Bar className="mt-1.5" percent={q.percent} label={`${club} monthly quota`} valueText={`${q.spent} of ${q.limit} used`} />
      {q.blocked
        ? <Badge variant="danger" className="mt-2"><AlertCircle aria-hidden="true" />Quota used up</Badge>
        : q.attention && <Badge variant="attention" className="mt-2"><ArrowUpCircle aria-hidden="true" />{q.attention}</Badge>}
    </div>
  );
}

function Cell({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-background p-4">
      <dt className="text-xs font-semibold text-muted-foreground">{term}</dt>
      <dd className="mt-1 space-y-1">{children}</dd>
    </div>
  );
}

export function OversightStrip({ club, oversight }: { club: string; oversight: ClubOversight }) {
  const q = quotaView(oversight.quota, club);
  const funding = fundingLines(oversight.funding);
  const { policy } = oversight;
  return (
    <section aria-labelledby="oversight-heading" className="overflow-hidden rounded-md border border-border">
      <h2 id="oversight-heading" className="border-b border-border bg-muted px-4 py-2 font-semibold">USG oversight</h2>
      <dl className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        <Cell term="Monthly quota"><QuotaMeter quota={oversight.quota} club={club} /></Cell>
        <Cell term="Agents">
          <p className="tabular-nums">{oversight.installedAgents} installed · {oversight.enabledAgents} enabled</p>
        </Cell>
        <Cell term="Policy">
          {policy.hasPolicy
            ? <>
              <p>{policy.allowedModelClasses.length
                ? `Models: ${policy.allowedModelClasses.map((m) => MODEL_LABEL[m]).join(', ')}`
                : 'No model classes allowed'}</p>
              {policy.allowPublicAgents
                ? <p className="flex items-center gap-1 text-success"><Check aria-hidden="true" className="size-4" />Public agents allowed</p>
                : <p className="flex items-center gap-1"><CircleSlash aria-hidden="true" className="size-4" />Public agents blocked</p>}
            </>
            : <Badge variant="attention"><TriangleAlert aria-hidden="true" />Policy missing</Badge>}
        </Cell>
        <Cell term="USG funding">
          <p className="font-semibold tabular-nums">{funding.year}</p>
          <p className="tabular-nums text-muted-foreground">{funding.semester}</p>
          {funding.pending && <Badge variant="attention"><Clock aria-hidden="true" />{funding.pending}</Badge>}
        </Cell>
      </dl>
      {q.blocked && (
        <p role="alert" className="flex items-start gap-2 border-t border-primary px-4 py-3">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{q.blocked}</span>
        </p>
      )}
    </section>
  );
}
