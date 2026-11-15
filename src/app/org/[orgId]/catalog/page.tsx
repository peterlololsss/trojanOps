// Owner: B (WP-7). The club's agent library (§14 `/org/[orgId]/catalog`) and D3's publish action.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lock } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { AppError } from '@/lib/contracts';
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

  // Null means there is no such club; a club with nothing installed answers with an empty list and
  // gets the table's "nothing yet" row. §14 scopes the catalog to the club's members, so a student
  // who is not one gets told, and pointed at what they can use.
  let found;
  try {
    found = await catalog(actor, orgId);
  } catch (error) {
    if (!(error instanceof AppError) || error.error.code !== 'forbidden') throw error;
    return (
      <>
        <PageHeader title="Catalog" description="This club's agent library is for its members." />
        <p className="flex items-center gap-2 rounded-md border border-border p-4">
          <Lock aria-hidden className="size-4" />
          <span>
            Join the club to see its agents, or browse the{' '}
            <Link href="/directory" className="text-primary underline">campus directory</Link> for
            agents open to every student.
          </span>
        </p>
      </>
    );
  }
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
