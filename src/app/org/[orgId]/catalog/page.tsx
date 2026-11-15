// Owner: B (WP-7). The club's agent library (§14 `/org/[orgId]/catalog`) and D3's publish action.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lock } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { catalog } from '@/lib/distribution';
import { getActor } from '@/lib/identity';
import { CatalogTable } from './catalog-table';

export default async function CatalogPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const actor = await getActor();
  if (!actor.userId) {
    return (
      <>
        <PageHeader title="Catalog" description="Sign in to see this club's agents." />
        <p className="flex items-center gap-2 rounded-md border border-border p-4">
          <Lock aria-hidden className="size-4" />
          <Link href="/" className="text-primary underline">Choose a persona to sign in</Link>
        </p>
      </>
    );
  }

  // `catalog()` answers null for an unknown club and for one with nothing installed alike; both are
  // "no such catalog" to a reader. See the note in ../club-home-data.ts.
  const found = await catalog(actor, orgId);
  if (!found) notFound();

  return (
    <>
      <PageHeader
        title="Catalog"
        description={`${found.orgName} · every agent installed in this club, including the ones that are turned off.`}
        action={(
          <Link href={`/org/${found.orgId}`} className="text-primary underline">Club home</Link>
        )}
      />
      <CatalogTable key={`${actor.userId}:${orgId}:${actor.activeOrgId}`} data={found} />
    </>
  );
}
