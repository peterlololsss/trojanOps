// Owner: B. "Configuration": the latest version of a USG template as a label → value list, first on
// /usg/templates/[templateId].
import type { ReactNode } from 'react';
import type { UsgTemplateView } from '@/lib/distribution/usg-view';
import { absoluteTime } from '../console-ui';
import { audienceLabel, demoModelDescription, demoModelDefault, MODEL_CLASSES, MODEL_ORDER, TIERS, toolOption } from '../template-config';

function Row({ term, children }: { term: string; children: ReactNode }) {
  return <div className="grid gap-1 py-3 md:grid-cols-[180px_minmax(0,1fr)] md:gap-6">
    <dt className="font-semibold">{term}</dt>
    <dd className="min-w-0 space-y-2">{children}</dd>
  </div>;
}

export function AgentSummary({ data, action }: { data: UsgTemplateView; action?: ReactNode }) {
  const { template } = data; const latest = data.versions.find(v => v.version === template.latestVersion) ?? data.versions[0];
  const header = (sub: string) => <div className="flex flex-wrap items-start justify-between gap-4">
    <div><h2 id="agent-summary" className="text-xl font-semibold leading-7">Configuration</h2><p className="mt-1 text-muted-foreground">{sub}</p></div>{action}
  </div>;
  if (!latest) return <section aria-labelledby="agent-summary" className="rounded-md border border-border p-4">{header('No version published yet')}</section>;

  return <section aria-labelledby="agent-summary" className="space-y-2 rounded-md border border-border p-4">
    {header(`Version ${latest.version} · published ${absoluteTime(latest.publishedAt)}`)}
    <dl className="divide-y divide-border border-t border-border">
      <Row term="Purpose"><p>{latest.purpose}</p></Row>
      <Row term="Who uses it"><p>{`${audienceLabel(latest.audience, latest.usableBy, data.positions)}`}</p></Row>
      <Row term="Instructions">
        <div className="max-w-[720px] whitespace-pre-wrap rounded-md border border-border bg-muted px-4 py-3 text-base leading-6">{latest.systemPrompt}</div>
      </Row>
      <Row term="Tools"><p>{latest.tools.length ? latest.tools.map(t => toolOption(t).name).join(', ') : 'None'}</p></Row>
      <Row term="Demo models">
        <p>Default in chat: <span className="font-mono">{demoModelDefault(latest.defaultModelClass)}</span></p>
        <ul className="space-y-1">
          {MODEL_ORDER.filter(model => latest.modelClasses.includes(model)).map(model => <li key={model}>
            <span className="font-semibold">{MODEL_CLASSES[model].name}</span> · {demoModelDescription(model)}
          </li>)}
        </ul>
        <p className="text-sm text-muted-foreground">The template saves pricing classes for the mock runtime.</p>
      </Row>
      <Row term="Reads up to"><p>{TIERS[latest.maxTier].name}</p></Row>
    </dl>
  </section>;
}
