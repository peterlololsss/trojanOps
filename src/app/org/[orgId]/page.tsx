// Owner: B (WP-7). Club home (§14): my agents in this club, recent documents, my usage this month.
import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lock } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { buttonVariants } from '@/components/ui/button';
import { getActor } from '@/lib/identity';
import { getClubHome } from './club-home-data';
import {
  DocumentsSkeleton, MyAgents, MyUsage, RecentDocuments, UsageSkeleton,
} from './club-home-sections';

export default async function ClubHomePage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const actor = await getActor();
  if (!actor.userId) {
    return (
      <>
        <PageHeader title="Club home" description="Sign in to see what this club gives you." />
        <p className="flex items-center gap-2 rounded-md border border-border p-4">
          <Lock aria-hidden className="size-4" />
          <Link href="/" className="text-primary underline">Choose a persona to sign in</Link>
        </p>
      </>
    );
  }

  // Null is a club that does not exist; a club with nothing installed still has a home page.
  const home = await getClubHome(actor, orgId);
  if (!home) notFound();

  return (
    <>
      <PageHeader
        title={home.org.name}
        description="Your agents, documents and spend in this club."
        action={(
          <Link href={`/org/${home.org.id}/catalog`} className={buttonVariants({ variant: 'secondary' })}>
            Open catalog
          </Link>
        )}
      />
      <div className="space-y-8">
        <MyAgents home={home} />
        <Suspense fallback={<DocumentsSkeleton />}>
          <RecentDocuments actor={actor} home={home} />
        </Suspense>
        <Suspense fallback={<UsageSkeleton />}>
          <MyUsage actor={actor} home={home} />
        </Suspense>
      </div>
    </>
  );
}
