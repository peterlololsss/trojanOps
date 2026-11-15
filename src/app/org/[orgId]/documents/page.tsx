import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lock } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { getLibraryPageData } from '@/lib/documents/library-page';
import { getActor } from '@/lib/identity';
import { DocumentLibrary } from './document-library';

export default async function DocumentsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const actor = await getActor();
  if (!actor.userId) {
    return (
      <>
        <PageHeader title="Documents" description="Sign in to browse the document library." />
        <p className="flex items-center gap-2 rounded-md border border-border p-4">
          <Lock aria-hidden className="size-4" />
          <Link href="/" className="text-primary underline">Choose a persona to sign in</Link>
        </p>
      </>
    );
  }
  const data = await getLibraryPageData(actor, orgId);
  if (!data) notFound();
  return (
    <>
      <PageHeader title="Documents" description={`${data.org.name} · Documents available to you, including public USG sources.`} />
      <DocumentLibrary key={`${actor.userId}:${orgId}:${actor.activeOrgId}`} data={data} />
    </>
  );
}
