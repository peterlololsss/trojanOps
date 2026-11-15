import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell';
import { getActor } from '@/lib/identity';
import { getDocumentPageData } from '@/lib/documents/document-page';
import { DocumentView } from './document-view';

export default async function DocumentPage({ params }: { readonly params: Promise<{ orgId: string; documentId: string }> }) {
  const { orgId, documentId } = await params;
  const actor = await getActor();
  if (!actor.userId) return <><PageHeader title="Document" /><Link href="/" className="text-primary underline">Choose a persona to sign in.</Link></>;
  const data = await getDocumentPageData(actor, orgId, documentId);
  if (!data) notFound();
  if (!data.document) return <><PageHeader title="Restricted document" /><p>You can&apos;t read this document. If you need it, ask {data.org.name}&apos;s president.</p><Link href={`/org/${orgId}/documents`} className="mt-4 inline-block text-primary underline">Back to documents</Link></>;
  return <><Link href={`/org/${orgId}/documents`} className="mb-3 inline-block text-primary underline">Documents</Link><PageHeader title={data.document.title} description={`${data.document.sourceName} · Version ${data.document.version}`} /><DocumentView data={data} /></>;
}
