import { PageHeader } from '@/components/shell';
import { AppError } from '@/lib/contracts';
import { usgClubsView } from '@/lib/distribution/usg-view';
import { getActor } from '@/lib/identity';
import { ConsoleNav, DeniedConsole } from '../templates/console-ui';
import { ClubsTable } from './clubs-table';
import { ownLimitMicro, remaining } from '@/lib/gateway/quota';
import { getDb } from '@/lib/db/client';
import { QuotaSummary } from './quota-summary';
export default async function ClubsPage() {
  const actor = await getActor(); let clubs;
  try { clubs = await usgClubsView(actor); }
  catch (error) {
    if (!(error instanceof AppError) || !['forbidden', 'unauthenticated'].includes(error.error.code)) throw error;
    return <><PageHeader title="Clubs" /><DeniedConsole /></>;
  }
  const platform = await remaining({ scope: 'platform' });
  const dailyLimitMicro = await ownLimitMicro(getDb(), { scope: 'student_daily' });
  return <><PageHeader title="Clubs" description="Budgets and model access for every club. 1 credit = $0.01." /><ConsoleNav /><QuotaSummary key={`${platform.limitMicro}:${dailyLimitMicro}`} platform={platform} dailyLimitMicro={dailyLimitMicro} /><ClubsTable key={`${actor.userId}:${actor.activeOrgId}`} clubs={clubs} /></>;
}
