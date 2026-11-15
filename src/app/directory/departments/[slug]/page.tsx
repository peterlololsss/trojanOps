// Owner: D (WP-11). A department of the active club (§14 `/directory/departments/[slug]?tab=`), so the
// side nav stays on Departments. Anyone not acting in a club browses the clubs instead.
import { notFound, redirect } from 'next/navigation';
import { directoryLanding } from '@/lib/directory/service';
import { getActor } from '@/lib/identity';
import { DepartmentDashboardView, DepartmentForbidden } from '../../_dashboard/department-dashboard';
import { loadDepartment } from '../../_dashboard/load';
import type { SearchParams } from '../../_dashboard/model';
import { DirectorySignedOut } from '../../_dashboard/route-states';

export default async function DepartmentPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const actor = await getActor();
  if (!actor.userId) return <DirectorySignedOut title="Department" />;
  const orgId = actor.activeOrgId;
  if (!orgId || (await directoryLanding(actor)) !== '/directory/departments') redirect('/directory/clubs');
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const { data, forbidden } = await loadDepartment(actor, orgId, slug);
  if (forbidden) return <DepartmentForbidden message={forbidden} orgId={orgId} />;
  if (!data) notFound();
  return <DepartmentDashboardView data={data}
    base={`/directory/departments/${data.department.slug}`} searchParams={query} />;
}
