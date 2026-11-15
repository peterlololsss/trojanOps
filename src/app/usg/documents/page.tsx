import { PageHeader } from '@/components/shell';
import { AppError } from '@/lib/contracts';
import { usgDocumentsView } from '@/lib/documents/usg-documents';
import { getActor } from '@/lib/identity';
import { ConsoleNav, DeniedConsole } from '../templates/console-ui';
import { DocumentsTable } from './documents-table';

export default async function DocumentsPage() {
  const actor = await getActor(); let data;
  try { data = await usgDocumentsView(actor); }
  catch (error) {
    if (!(error instanceof AppError) || !['forbidden', 'unauthenticated'].includes(error.error.code)) throw error;
    return <><PageHeader title="Documents" /><DeniedConsole /></>;
  }
  const documents = [...(data?.documents ?? [])].sort((a, b) => a.title.localeCompare(b.title));
  return <><PageHeader title="Documents" description="USG’s documents and the agents that read them." /><ConsoleNav />
    <DocumentsTable key={`${actor.userId}:${actor.activeOrgId}`} documents={documents} orgId={data?.orgId ?? null} /></>;
}
