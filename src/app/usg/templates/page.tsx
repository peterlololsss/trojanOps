import { PageHeader } from '@/components/shell';
import { AppError } from '@/lib/contracts';
import { usgTemplatesView } from '@/lib/distribution/usg-view';
import { getActor } from '@/lib/identity';
import { DeniedConsole } from './console-ui';
import { TemplatesGrid } from './templates-grid';
import { CreateTemplate } from './create-template';

export default async function TemplatesPage() {
  const actor = await getActor();
  let data;
  try { data = await usgTemplatesView(actor); }
  catch (error) {
    if (!(error instanceof AppError) || !['forbidden', 'unauthenticated'].includes(error.error.code)) throw error;
    return <><PageHeader title="Agent templates" /><DeniedConsole /></>;
  }
  return <><PageHeader title="Agent templates" description="USG agent templates and where they are installed." action={<CreateTemplate targets={data.targets} />} />
    <TemplatesGrid key={`${actor.userId}:${actor.activeOrgId}`} data={data} /></>;
}
