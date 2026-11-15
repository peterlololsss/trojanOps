import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell';
import { AppError } from '@/lib/contracts';
import { usgDocumentView } from '@/lib/documents/usg-documents';
import { getActor } from '@/lib/identity';
import { DeniedConsole } from '../../templates/console-ui';
import { DocumentDetail } from './document-detail';

export default async function DocumentPage({ params }: { params: Promise<{ documentId: string }> }) {
  const actor = await getActor(); const { documentId } = await params;
  let data;
  try { data = await usgDocumentView(actor, documentId); }
  catch (error) {
    if (!(error instanceof AppError) || !['forbidden', 'unauthenticated'].includes(error.error.code)) throw error;
    return <><PageHeader title="Document" /><DeniedConsole /></>;
  }
  if (!data) notFound();
  return <DocumentDetail key={`${actor.userId}:${actor.activeOrgId}:${documentId}`} data={data} />;
}
