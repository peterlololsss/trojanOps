// Owner: D (WP-11). A club's departments live on its dashboard's Departments tab.
import { redirect } from 'next/navigation';

export default async function ClubDepartmentsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  redirect(`/directory/clubs/${encodeURIComponent(orgId)}?tab=departments`);
}
