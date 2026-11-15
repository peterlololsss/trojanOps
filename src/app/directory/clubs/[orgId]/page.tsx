// Owner: D (WP-11). A club's dashboard (§14 `/directory/clubs/[orgId]?tab=`): about, events, members,
// officers, departments and public agents. What a viewer may see is decided by the service.
import { notFound } from 'next/navigation';
import { clubDashboard } from '@/lib/directory/service';
import { getActor } from '@/lib/identity';
import { ClubDashboardView } from '../../_dashboard/club-dashboard';
import type { SearchParams } from '../../_dashboard/model';
import { DirectorySignedOut } from '../../_dashboard/route-states';

export default async function ClubDashboardPage({ params, searchParams }: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const actor = await getActor();
  if (!actor.userId) return <DirectorySignedOut title="Club" />;
  const [{ orgId }, query] = await Promise.all([params, searchParams]);
  const data = await clubDashboard(actor, orgId);
  if (!data) notFound();
  return <ClubDashboardView data={data} searchParams={query} />;
}
