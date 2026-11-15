import { PageHeader } from '@/components/shell';
import { AppError } from '@/lib/contracts';
import { usgRulePacksView } from '@/lib/distribution/usg-view';
import { isDemoRuntime } from '@/lib/documents/run-page';
import { getActor } from '@/lib/identity';
import { ConsoleNav, DeniedConsole } from '../templates/console-ui';
import { RulePackCard } from './rule-pack-card';
import { RulePackExplainer } from './rule-pack-explainer';

export default async function RulePacksPage() {
  const actor = await getActor(); let packs;
  try { packs = await usgRulePacksView(actor); }
  catch (error) {
    if (!(error instanceof AppError) || !['forbidden', 'unauthenticated'].includes(error.error.code)) throw error;
    return <><PageHeader title="Rule packs" /><DeniedConsole /></>;
  }
  return <><PageHeader title="Rule packs" description="USG policies, written as numbered rules that agents use." /><ConsoleNav />
    <div key={`${actor.userId}:${actor.activeOrgId}`} className="space-y-6">
      <RulePackExplainer packs={packs} />
      {packs.length ? packs.map(pack => <RulePackCard key={pack.slug} pack={pack} demoRuntime={isDemoRuntime()} />)
        : <p className="rounded-md border border-border p-6 text-muted-foreground">No rule packs exist yet. Ask the platform team to load USG’s funding guidelines.</p>}
    </div></>;
}
