import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell';
import { AppError } from '@/lib/contracts';
import { usgTemplateView } from '@/lib/distribution/usg-view';
import { isDemoRuntime } from '@/lib/documents/run-page';
import { getActor } from '@/lib/identity';
import { BackToTemplates, ConsoleNav, DeniedConsole } from '../console-ui';
import { TemplateDetail } from './template-detail';

export default async function TemplatePage({ params }: { params: Promise<{ templateId: string }> }) {
  const actor = await getActor(); const { templateId } = await params;
  let data;
  try { data = await usgTemplateView(actor, templateId); }
  catch (error) {
    if (!(error instanceof AppError) || !['forbidden', 'unauthenticated'].includes(error.error.code)) throw error;
    return <><PageHeader title="Agent template" /><DeniedConsole /></>;
  }
  if (!data) notFound();
  return <><PageHeader title={data.template.name} description="What this agent does, which clubs have it, and its versions." action={<BackToTemplates />} /><ConsoleNav />
    <TemplateDetail key={`${actor.userId}:${actor.activeOrgId}:${templateId}:${data.template.latestVersion}:${data.template.status}:${data.template.target}:${data.template.distribution}:${data.template.name}`} data={data} demoRuntime={isDemoRuntime()} /></>;
}
