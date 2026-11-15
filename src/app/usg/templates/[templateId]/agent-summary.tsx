// Owner: B. "What this agent does": the latest version of a USG template in plain words, first on
// /usg/templates/[templateId], so an admin sees who uses it, what it is told, what it may read and
// which rules it follows before touching distribution or publishing.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { FileText, LockKeyhole } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DEMO_RUNTIME_PACK_NOTE } from '@/lib/distribution/rule-pack-content';
import type { UsgTemplateView } from '@/lib/distribution/usg-view';
import { absoluteTime } from '../console-ui';
import {
  AUDIENCES, audienceLabel, MODEL_CLASSES, MODEL_ORDER, plural, ROLE_EXAMPLES, SOURCE_KINDS, TIERS, toolOption, withinTier,
} from '../template-config';

function Row({ term, hint, children }: { term: string; hint?: string; children: ReactNode }) {
  return <div className="grid gap-2 py-4 md:grid-cols-[180px_minmax(0,1fr)] md:gap-6">
    <dt><span className="font-semibold">{term}</span>{hint && <span className="mt-1 block text-xs leading-4 text-muted-foreground">{hint}</span>}</dt>
    <dd className="min-w-0 space-y-2">{children}</dd>
  </div>;
}

export function AgentSummary({ data, action, demoRuntime = false }: { data: UsgTemplateView; action?: ReactNode; demoRuntime?: boolean }) {
  const { template } = data; const latest = data.versions.find(v => v.version === template.latestVersion) ?? data.versions[0];
  const header = (sub: string) => <div className="flex flex-wrap items-start justify-between gap-4">
    <div><h2 id="agent-summary" className="text-xl font-semibold leading-7">What this agent does</h2><p className="mt-1 text-muted-foreground">{sub}</p></div>{action}
  </div>;
  if (!latest) return <section aria-labelledby="agent-summary" className="space-y-4 rounded-md border border-border p-4">
    {header('No version is published yet, so no club can run this agent.')}
    <p>Publish the first version to set who uses it, what it is told and what it may read. Use Edit configuration to start.</p>
  </section>;

  const audience = AUDIENCES.find(a => a.slug === latest.audience);
  const who = audienceLabel(latest.audience, latest.usableBy, data.positions);
  const reach = template.installedCount ? (template.installedCount === template.targetCount ? `Installed in all ${plural(template.installedCount, 'club')} in its target.` : `Installed in ${template.installedCount} of the ${plural(template.targetCount, 'club')} in its target.`)
    : template.distribution === 'optional' ? 'Not installed in any club yet. Club presidents can add it from their catalog.' : 'Not installed in any club yet. Distribute it to install it.';
  const example = ROLE_EXAMPLES[template.slug];
  const pack = latest.rulePackSlug ? data.rulePacks.find(p => p.slug === latest.rulePackSlug) : undefined;
  const allowed = MODEL_ORDER.filter(m => latest.modelClasses.includes(m) && m !== latest.defaultModelClass);

  return <section aria-labelledby="agent-summary" className="space-y-2 rounded-md border border-border p-4">
    {header(`Version ${latest.version}, published ${absoluteTime(latest.publishedAt)}. Every installed club runs this version unless it pinned an older one.`)}
    <dl className="divide-y divide-border border-t border-border">
      <Row term="Purpose"><p>{latest.purpose}</p></Row>

      <Row term="Who uses it" hint="The audience: who may open it in each club.">
        <p><Badge className="mr-2 align-middle">{audience?.name ?? latest.audience}</Badge>
          {latest.audience === 'positions' ? `${who} in each club. ` : latest.audience === 'members' ? 'Every member of each club. ' : 'Any student signed in with a USC account. '}{reach}</p>
        {example && <p className="rounded-md bg-muted px-3 py-2"><span className="font-semibold">Built for: </span>{example}</p>}
      </Row>

      <Row term="Instructions" hint="The system prompt: what the agent is told before every request. Users do not see it.">
        <div className="max-w-[720px] whitespace-pre-wrap rounded-md border border-border bg-muted px-4 py-3 text-base leading-6">{latest.systemPrompt}</div>
      </Row>

      <Row term="Knowledge" hint="Sources: the kinds of documents it may look in. Club sources stay inside each club.">
        {latest.sourceKinds.length ? <ul className="space-y-3">{latest.sourceKinds.map(kind => {
          const info = SOURCE_KINDS.find(s => s.slug === kind);
          // Only what this version could read: never list a document above its max tier.
          const docs = data.usgDocuments.filter(d => d.kind === kind && withinTier(d.tier, latest.maxTier));
          return <li key={kind}>
            <p><span className="font-semibold">{info?.name ?? kind}</span> <Badge className="ml-1 align-middle">{info?.owner === 'usg' ? 'USG library' : 'Each club'}</Badge></p>
            <p className="text-muted-foreground">{info?.description ?? 'A source kind this page has no description for.'}</p>
            {info?.owner === 'usg' && (docs.length ? <ul className="mt-1 space-y-1">{docs.map(d => <li key={d.title} className="flex items-center gap-2"><FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />{d.title}</li>)}</ul>
              : <p className="text-muted-foreground">No documents in this source that it can read.</p>)}
            {kind === 'finance' && <p className="mt-1 flex items-center gap-2 text-muted-foreground"><LockKeyhole aria-hidden="true" className="size-4 shrink-0" />USG cannot open club finance documents, so their titles are not listed here.</p>}
          </li>;
        })}</ul> : <p>None. It answers from its instructions only.</p>}
      </Row>

      <Row term="Rules" hint="A rule pack: the USG policy this agent is built to apply.">
        {latest.rulePackSlug ? <p>
          {pack ? <Link className="text-primary underline" href="/usg/rule-packs">{`${pack.label} · v${pack.version} · ${plural(pack.ruleCount, 'rule')}`}</Link>
            : <><span className="font-mono text-xs">{latest.rulePackSlug}</span> (no published version yet)</>}
          <span className="mt-1 block text-muted-foreground">Every run uses the newest published version of the pack.</span>
          {demoRuntime && <span className="mt-1 block text-muted-foreground">{DEMO_RUNTIME_PACK_NOTE}</span>}
        </p> : <p>None. It does not use a rule pack.</p>}
      </Row>

      <Row term="Tools" hint="Actions it can take besides answering.">
        {latest.tools.length ? <ul className="space-y-1">{latest.tools.map(slug => { const tool = toolOption(slug); return <li key={slug}><span className="font-semibold">{tool.name}</span> <span className="text-muted-foreground">{tool.description}</span></li>; })}</ul>
          : <p>None. It can only answer; it cannot submit or change anything.</p>}
      </Row>

      <Row term="Model" hint="Model class: how strong a model runs it.">
        <p>{MODEL_CLASSES[latest.defaultModelClass].name} by default{allowed.length ? `; clubs may switch to ${allowed.map(m => MODEL_CLASSES[m].name).join(', ')}` : '; clubs cannot switch'}.</p>
        <p className="text-muted-foreground">{MODEL_CLASSES[latest.defaultModelClass].description}</p>
      </Row>

      <Row term="Reads up to" hint="Max tier: the most sensitive documents it may read.">
        <p><span className="font-semibold">{TIERS[latest.maxTier].name} documents.</span> {TIERS[latest.maxTier].plain}</p>
        <p className="text-muted-foreground">It never reads more than the person running it can already read.</p>
      </Row>
    </dl>
  </section>;
}
