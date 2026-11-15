// Owner: C (WP-9). A run's details inside the Run details panel beside the transcript. Server-renderable
// and hook-free: it only renders the RunInspector it is given.
// Sizes are in px because the app's root font size is 14px, so rem-based utilities run small.
import { FileText, Folder, KeyRound, Lock } from 'lucide-react';
import type { RunInspector } from '@/lib/contracts';
import { accessDecisions, tierIcons, tierLabels } from './access-labels';
import { Chip } from './chip';
import { money } from './format';
import { creditLabel } from '@/lib/gateway/prices';

/** One inspector section, under the panel's "Run details" heading. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-[16px] py-[16px] last:border-b-0">
      <h3 className="mb-[8px] text-[14px] font-semibold leading-5">{title}</h3>
      {children}
    </section>
  );
}

function SubSection({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="mt-[12px] first:mt-0">
      <div className="flex items-baseline justify-between gap-[8px]">
        <h4 className="text-[12px] font-semibold leading-4 text-muted-foreground">{title}</h4>
        {count !== undefined && <span className="text-[12px] leading-4 tabular-nums text-muted-foreground">{String(count)}</span>}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="py-[4px] text-muted-foreground">{children}</p>;
}

function Row({ children, highlighted }: { children: React.ReactNode; highlighted?: boolean }) {
  return <li data-highlighted={highlighted || undefined} className={`flex min-h-[32px] items-center justify-between gap-[8px] border-b border-border py-[4px] last:border-b-0 ${highlighted ? 'bg-gold-25' : ''}`}>{children}</li>;
}

export function Inspector({ inspector, highlightedId }: { inspector: RunInspector; highlightedId?: string | null }) {
  const tierOf = new Map(inspector.permitted.map((d) => [d.id, d.tier]));
  const quota = Object.entries(inspector.quotaRemainingMicro);

  return (
    <div className="w-full min-w-0 bg-background text-[14px] leading-5">
      <Section title="Run grants">
        {inspector.runGrants.length === 0 ? <Empty>This run had no grants.</Empty> : (
          <ul>
            {[...new Map(inspector.runGrants.map((g) => [g.label, g])).values()].map((g) => (
              <li key={g.grant} className="flex items-center gap-[8px] py-[4px]">
                <KeyRound aria-hidden className="size-[16px] shrink-0 text-muted-foreground" />
                <span>{g.label}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Sources">
        {inspector.sources.length === 0 ? <Empty>This agent has no document sources.</Empty> : (
          <ul>
            {inspector.sources.map((s) => (
              <li key={s.id} className="flex items-center gap-[8px] py-[4px]">
                <Folder aria-hidden className="size-[16px] shrink-0 text-muted-foreground" />
                <span>{s.name}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Documents">
        <SubSection title="Permitted" count={inspector.permitted.length}>
          {inspector.permitted.length === 0 ? <Empty>This run could read no documents.</Empty> : (
            <ul>
              {inspector.permitted.map((d) => (
                <Row key={d.id} highlighted={d.id === highlightedId}>
                  <span className="min-w-0 break-words">{d.title}</span>
                  <Chip icon={tierIcons[d.tier]}>{tierLabels[d.tier]}</Chip>
                </Row>
              ))}
            </ul>
          )}
        </SubSection>

        <SubSection title="Read in this run" count={inspector.readInRun.length}>
          {inspector.readInRun.length === 0 ? <Empty>No documents cited in this run.</Empty> : (
            <ul>
              {inspector.readInRun.map((d) => {
                const tier = tierOf.get(d.id);
                return (
                  <Row key={d.id} highlighted={d.id === highlightedId}>
                    <span className="flex min-w-0 items-center gap-[8px]">
                      <FileText aria-hidden className="size-[16px] shrink-0 text-muted-foreground" />
                      <span className="break-words">{d.title}</span>
                    </span>
                    {tier && <Chip icon={tierIcons[tier]}>{tierLabels[tier]}</Chip>}
                  </Row>
                );
              })}
            </ul>
          )}
        </SubSection>

        {inspector.blocked !== undefined && (
          <SubSection title="Blocked by rule" count={inspector.blocked.length}>
            {inspector.blocked.length === 0 ? <Empty>Nothing blocked for this run.</Empty> : (
              <ul>
                {inspector.blocked.map((d) => {
                  const reason = accessDecisions[d.reason];
                  return (
                    <Row key={d.id}>
                      {d.title === null ? (
                        <span className="flex min-w-0 items-center gap-[8px] text-muted-foreground">
                          <Lock aria-hidden className="size-[16px] shrink-0" />
                          <span>Restricted document</span>
                        </span>
                      ) : <span className="min-w-0 break-words">{d.title}</span>}
                      <Chip icon={reason.icon} tone={reason.tone}>{reason.label}</Chip>
                    </Row>
                  );
                })}
              </ul>
            )}
          </SubSection>
        )}
      </Section>

      <Section title="Versions">
        <ul>
          <li className="py-[4px]">{`Template v${inspector.templateVersion}`}</li>
          {inspector.rulePack && <li className="py-[4px]">{`${inspector.rulePack.label} v${inspector.rulePack.version}`}</li>}
          {inspector.permitted.filter((d) => (d.version ?? 1) > 1).map((d) => <li key={d.id} className="py-[4px]">{`${d.title} v${d.version}`}</li>)}
        </ul>
      </Section>

      <Section title="Billing">
        <dl className="grid grid-cols-[1fr_auto] gap-x-[16px] gap-y-[4px]">
          <dt className="text-muted-foreground">Billed club</dt>
          <dd className="text-right">{inspector.billedClub}</dd>
          <dt className="text-muted-foreground">Cost of this run</dt>
          <dd className="text-right tabular-nums">{creditLabel(inspector.costMicro)} ({money(inspector.costMicro)})</dd>
          {quota.map(([club, micro]) => (
            <div key={club} className="contents">
              <dt className="text-muted-foreground">{`Quota left · ${club}`}</dt>
              <dd className="text-right tabular-nums">{creditLabel(micro)} ({money(micro)})</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Audit">
        <dl className="grid grid-cols-[1fr_auto] gap-x-[16px]">
          <dt className="text-muted-foreground">Audit event</dt>
          <dd className="text-right font-mono">{`#${inspector.auditEventId}`}</dd>
        </dl>
      </Section>
    </div>
  );
}
