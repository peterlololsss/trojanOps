// Owner: B (WP-7). The club admin page's read-only sections: the club's own monthly quota, and the
// agents installed here. Both render from the one `clubAdmin` payload the page already loaded, so
// neither needs a Suspense boundary of its own.
import Link from 'next/link';
import { AlertCircle, ArrowUpCircle, Check, CircleSlash, Lock } from 'lucide-react';
import type { ClubAdmin } from '@/lib/distribution';
import { audienceLabel, distributionLabels, statusLabels } from '../catalog/catalog-view';
import { chip, clubBudget, panel, row } from './admin-view';

export function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="text-[20px] font-semibold leading-7">{children}</h2>;
}

export function Banner({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-primary p-4">
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>{children}</span>
    </p>
  );
}

// ---------------------------------------------------------------------------------------------
// The club's own monthly quota

export function ClubBudget({ data }: { data: ClubAdmin }) {
  const budget = clubBudget(data);
  return (
    <section aria-labelledby="club-budget" className="space-y-3">
      <div>
        <SectionTitle id="club-budget">This club&rsquo;s monthly quota</SectionTitle>
        <p className="text-muted-foreground">
          Every agent run billed to {data.org.name} counts against it. USG sets this figure; a member&rsquo;s
          limit can never exceed it.
        </p>
      </div>
      <div className={`${panel} max-w-[640px] space-y-3 p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="tabular-nums">
            <span className="font-semibold">{budget.spent}</span>
            <span className="text-muted-foreground"> of {budget.limit} used · {budget.left} left</span>
          </p>
          {budget.attention && (
            <span className={`${chip} border-transparent bg-gold-25`}>
              <ArrowUpCircle aria-hidden className="size-3 text-attention-ink" />
              {budget.attention}
            </span>
          )}
        </div>
        <div
          role="meter"
          aria-labelledby="club-budget"
          aria-valuenow={budget.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${budget.spent} of ${budget.limit} used`}
          className="h-2 w-full overflow-hidden rounded-sm bg-border"
        >
          <div className="h-2 bg-primary" style={{ width: `${budget.percent}%` }} />
        </div>
        {budget.blocked && <Banner>{budget.blocked}</Banner>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// The agents installed in this club

export function ClubAgents({ data }: { data: ClubAdmin }) {
  return (
    <section aria-labelledby="club-agents" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionTitle id="club-agents">Agents in this club</SectionTitle>
          <p className="text-muted-foreground">
            Who each agent is for. Turning one on, or opening it to all students, happens in the catalog.
          </p>
        </div>
        <Link href={`/org/${data.org.id}/catalog`} className="text-primary underline">Open catalog</Link>
      </div>

      {data.agents.length === 0 ? (
        <div className={`${panel} bg-muted p-4`}>
          <p>
            No agents are installed in {data.org.name} yet. USG distributes agent templates to clubs;
            ask USG to distribute the one this club needs.
          </p>
        </div>
      ) : (
        <ul className={panel}>
          {data.agents.map((agent) => (
            <li key={agent.installationId} className={row}>
              <div className="min-w-[240px] flex-1">
                <p className="font-semibold">{agent.name}</p>
                <p className="text-muted-foreground">{agent.purpose}</p>
              </div>
              <p className="w-[180px]">
                <span className="text-muted-foreground">For </span>{audienceLabel(agent)}
              </p>
              <span className={chip}>
                {agent.distribution === 'required' && <Lock aria-hidden className="size-3" />}
                {distributionLabels[agent.distribution]}
              </span>
              <span className={chip}>
                {agent.status === 'enabled' ? <Check aria-hidden className="size-3 text-success" />
                  : agent.status === 'retired' ? <AlertCircle aria-hidden className="size-3 text-primary" />
                    : <CircleSlash aria-hidden className="size-3 text-muted-foreground" />}
                {statusLabels[agent.status]}
              </span>
              <p className="w-[56px] font-mono text-xs">v{agent.templateVersion}</p>
              <Link
                href={`/org/${data.org.id}/catalog`}
                className="text-primary underline"
              >
                Manage
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
