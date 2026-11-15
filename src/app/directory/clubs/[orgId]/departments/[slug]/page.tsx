// Owner: D (WP-11). A department's dashboard reached from a club's dashboard (§14
// `/directory/clubs/[orgId]/departments/[slug]?tab=`), so the side nav stays on Clubs.
import { notFound } from 'next/navigation';
import { getActor } from '@/lib/identity';
import { DepartmentDashboardView, DepartmentForbidden } from '../../../../_dashboard/department-dashboard';
import { loadDepartment } from '../../../../_dashboard/load';
import type { SearchParams } from '../../../../_dashboard/model';
import { DirectorySignedOut } from '../../../../_dashboard/route-states';

export default async function ClubDepartmentPage({ params, searchParams }: {
  params: Promise<{ orgId: string; slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const actor = await getActor();
  if (!actor.userId) return <DirectorySignedOut title="Department" />;
  const [{ orgId, slug }, query] = await Promise.all([params, searchParams]);
  const { data, forbidden } = await loadDepartment(actor, orgId, slug);
  if (forbidden) return <DepartmentForbidden message={forbidden} orgId={orgId} />;
  if (!data) notFound();
  return <DepartmentDashboardView data={data}
    base={`/directory/clubs/${data.club.id}/departments/${data.department.slug}`} searchParams={query} />;
}
