import { PageHeader } from '@/components/shell';
import { AppError } from '@/lib/contracts';
import { usgTemplatesView } from '@/lib/distribution/usg-view';
import { getActor } from '@/lib/identity';
import { ConsoleNav, DeniedConsole } from './console-ui';
import { TemplatesTable } from './templates-table';

export default async function TemplatesPage() {
  const actor = await getActor();
  let data;
  try { data = await usgTemplatesView(actor); }
  catch (error) {
    if (!(error instanceof AppError) || !['forbidden', 'unauthenticated'].includes(error.error.code)) throw error;
    return <><PageHeader title="Agent templates" /><DeniedConsole /></>;
  }
  return <><PageHeader title="Agent templates" description="Agents USG builds once for every club: what each one does, the rules it follows and where it is installed." /><ConsoleNav />
    <TemplatesTable key={`${actor.userId}:${actor.activeOrgId}`} data={data} /></>;
}
