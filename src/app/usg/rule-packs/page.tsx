import { PageHeader } from '@/components/shell';
import { AppError } from '@/lib/contracts';
import { usgRulePacksView } from '@/lib/distribution/usg-view';
import { getActor } from '@/lib/identity';
import { ConsoleNav, DeniedConsole } from '../templates/console-ui';
import { RulePackCard } from './rule-pack-card';

export default async function RulePacksPage() {
  const actor = await getActor(); let packs;
  try { packs = await usgRulePacksView(actor); }
  catch (error) {
    if (!(error instanceof AppError) || !['forbidden', 'unauthenticated'].includes(error.error.code)) throw error;
    return <><PageHeader title="Rule packs" /><DeniedConsole /></>;
  }
  return <><PageHeader title="Rule packs" description="Published USG policies and the agents that use them." /><ConsoleNav />
    <div key={`${actor.userId}:${actor.activeOrgId}`} className="space-y-6">
      {packs.length ? packs.map(pack => <RulePackCard key={pack.slug} pack={pack} />)
        : <p className="rounded-md border border-border p-6 text-muted-foreground">No rule packs yet. Ask the platform team to publish one.</p>}
    </div></>;
}
