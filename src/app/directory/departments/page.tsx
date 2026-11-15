// Owner: D (WP-11). The active club's departments (§14 `/directory/departments`), for its members;
// budgets for the president. Anyone not acting in a club browses the clubs instead.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shell';
import { buttonVariants } from '@/components/ui/button';
import { departmentsDirectory } from '@/lib/directory/service';
import { count } from '@/lib/directory/view';
import { getActor } from '@/lib/identity';
import { DepartmentsTable } from '../_dashboard/departments';
import { clubPath } from '../_dashboard/model';
import { DirectorySignedOut } from '../_dashboard/route-states';
import { DepartmentsSummary } from '../_dashboard/demo-summary';

export default async function DepartmentsPage() {
  const actor = await getActor();
  if (!actor.userId) return <DirectorySignedOut title="Departments" />;
  const view = await departmentsDirectory(actor);
  if (!view) redirect('/directory/clubs');
  return <>
    <PageHeader title={`${view.club.name} departments`} description={count(view.departments.length, 'department')}
      action={<Link href={clubPath(view.club.id)} className={buttonVariants({ variant: 'secondary' })}>Club profile</Link>} />
    <div className="mb-6"><DepartmentsSummary data={view} /></div>
    <DepartmentsTable departments={view.departments} club={view.club.name} base="/directory/departments" />
  </>;
}
