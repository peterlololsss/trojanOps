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
  // A failed load is a banner, not Next's error page: the two inner sections already handle their
  // own failures that way, and this one is the only load that could take the whole page down.
  let home;
  try {
    home = await getClubHome(actor, orgId);
  } catch {
    return (
      <>
        <PageHeader title="Club" description="Your agents, documents and spend in this club." />
        <p role="alert" className="rounded-md border border-border p-4">
          This club could not be loaded. Reload the page, or try again in a moment.
        </p>
      </>
    );
  }
  if (!home) notFound();

  return (
    <>
      <PageHeader
        title={home.org.name}
        description="Your agents, documents and spend in this club."
        action={(
          // The admin page has no entry in the side nav, which is stream D's, so the club home is
          // how a president reaches it — otherwise it is only findable by typing the URL.
          <div className="flex items-center gap-2">
            <Link href={`/org/${home.org.id}/catalog`} className={buttonVariants({ variant: 'secondary' })}>
              Open catalog
            </Link>
            {home.canManage && (
              <Link href={`/org/${home.org.id}/admin`} className={buttonVariants({ variant: 'secondary' })}>
                Manage club
              </Link>
            )}
          </div>
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
