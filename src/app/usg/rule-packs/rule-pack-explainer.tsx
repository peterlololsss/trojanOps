// Owner: B. "What is a rule pack?" at the top of /usg/rule-packs, in plain words, with the seed's
// own example and the agents that follow each pack today.
import Link from 'next/link';
import { currentPackVersion } from '@/lib/distribution/rule-pack-content';
import type { UsgPack } from '@/lib/distribution/usg-view';
import { plural } from '../templates/template-config';

export function RulePackExplainer({ packs }: { packs: UsgPack[] }) {
  const users = packs.flatMap(p => p.usedBy.map(u => ({ ...u, pack: currentPackVersion(p.versions)?.label ?? p.slug })));
  return <section aria-labelledby="rule-pack-explainer" className="rounded-md border border-border p-4">
    <h2 id="rule-pack-explainer" className="text-xl font-semibold leading-7">What is a rule pack?</h2>
    <dl className="mt-3 grid gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
      <div><dt className="font-semibold">What it is</dt>
        <dd className="mt-1">A USG policy split into numbered rules that agents use. Each rule keeps its section number and USG’s wording; any corrections are noted on the pack. Any written USG policy can become a pack; the funding guidelines are the first.</dd></div>
      <div><dt className="font-semibold">Why it exists</dt>
        <dd className="mt-1">Treasurers used to learn these rules when an application came back denied, and reviewers checked every clause by hand. Funding pre-check is built to show Taylor that $40 a person for catering is over the $35 limit before submitting, and to let a reviewer cite §5 in a denial reason.</dd></div>
      <div><dt className="font-semibold">Who uses it</dt>
        <dd className="mt-1">{users.length ? <>An agent template names the pack it uses.{' '}
          {users.map((u, i) => <span key={`${u.templateId}:${u.pack}`}>{i > 0 && '; '}{u.global ? <Link className="text-primary underline" href={`/usg/templates/${u.templateId}`}>{u.name}</Link> : u.name}{` uses ${u.pack} in ${plural(u.installedCount, 'club')}`}</span>)}.</>
          : 'No agent template uses a rule pack yet. Choose one under Rule pack when you edit a template’s configuration.'}</dd></div>
      <div><dt className="font-semibold">When changes apply</dt>
        <dd className="mt-1">A published version never changes. Each agent’s next run uses the newest version, including clubs pinned to an older template version.</dd></div>
    </dl>
  </section>;
}
