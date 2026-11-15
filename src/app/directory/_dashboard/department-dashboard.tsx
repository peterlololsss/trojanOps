// Owner: D (WP-11). A department's dashboard, reached from the active club's departments
// (`/directory/departments/[slug]`) or from any club's dashboard
// (`/directory/clubs/[orgId]/departments/[slug]`): the same page, so the side nav stays on the path
// the viewer came from. The budget is the president's alone; the service sends null to anyone else.
import Link from 'next/link';
import { Lock, Users } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DepartmentDashboard } from '@/lib/directory/types';
import { budgetText, count, dollars, percentOf } from '@/lib/directory/view';
import { EventsSection, UpcomingPanel } from './events';
import { DashboardHeader } from './header';
import { clubPath, departmentTabs, pickTab, pickWhen, showAllUpdates, type SearchParams } from './model';
import { Bar, Empty, Panel, textLink } from './parts';
import { AvatarRow, MembersTable } from './people';
import { TabLinks } from './tabs';
import { UpdatesPanel } from './updates';

export function DepartmentDashboardView({ data, base, searchParams }: {
  data: DepartmentDashboard;
  /** This page's own path, without a query. */
  base: string;
  searchParams: SearchParams;
}) {
  const { club, department, viewer } = data;
  const tabs = departmentTabs(data, base);
  const active = pickTab(tabs, searchParams.tab);

  return (
    <>
      <DashboardHeader
        name={department.name}
        parent={<Link href={clubPath(club.id)} className={textLink}>{club.name}</Link>}
        tagline={department.purpose}
        facts={<>
          <span className="inline-flex items-center gap-1.5 tabular-nums"><Users aria-hidden="true" className="size-4" />{count(data.members.length, 'member')}</span>
          <span>Lead: {data.lead?.name ?? 'No lead yet'}</span>
        </>}
        actions={viewer.president ? <Link href={`/org/${club.id}/admin`} className={buttonVariants()}>Administration</Link> : undefined}
      />
      <TabLinks label={`${department.name} sections`} tabs={tabs} active={active} />
      {active === 'about' && <AboutTab data={data} base={base} showAll={showAllUpdates(searchParams.updates)} />}
      {active === 'events' && <EventsSection events={data.events} when={pickWhen(searchParams.when)} base={base} showDepartment={false} />}
      {active === 'members' && <MembersTable members={data.members} label={`${department.name} members`} leadId={data.lead?.userId} />}
    </>
  );
}

function AboutTab({ data, base, showAll }: { data: DepartmentDashboard; base: string; showAll: boolean }) {
  const { department, lead } = data;
  const people = data.members.map((m) => ({ userId: m.userId, name: m.name, roles: m.userId === lead?.userId ? ['Lead'] : [] }));
  return (
    <div className="space-y-6">
      <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-2">
        <section aria-labelledby="team-heading" className="bg-background p-4">
          <h2 id="team-heading" className="text-xl font-semibold leading-7">Team</h2>
          {people.length > 0
            ? <div className="mt-2"><AvatarRow label={`${department.name} team`} people={people} moreHref={`${base}?tab=members`} moreLabel="members" /></div>
            : <Empty className="pb-0">No members yet.</Empty>}
        </section>
        <section aria-labelledby="about-heading" className="bg-background p-4">
          <h2 id="about-heading" className="text-xl font-semibold leading-7">About</h2>
          {department.about.length > 0
            ? <div className="mt-2 max-w-prose space-y-3 text-base leading-6">{department.about.map((p) => <p key={p}>{p}</p>)}</div>
            : <Empty className="pb-0">No description yet.</Empty>}
        </section>
      </div>

      {data.budget && <BudgetPanel budget={data.budget} name={department.name} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <UpdatesPanel updates={data.updates} clubName={data.club.name} showAll={showAll} allHref={`${base}?updates=all#recent-updates`} />
        <UpcomingPanel events={data.events} base={base} />
      </div>
    </div>
  );
}

function BudgetPanel({ budget, name }: { budget: NonNullable<DepartmentDashboard['budget']>; name: string }) {
  const text = budgetText(budget);
  return (
    <Panel id="budget-heading" title="Semester budget" bodyClassName="px-0">
      <div className="px-4 py-4">
        <p className="font-semibold tabular-nums">{text}</p>
        <Bar className="mt-1.5 max-w-md" percent={percentOf(budget.committedMicro, budget.allocatedMicro)}
          label={`${name} budget committed`} valueText={text} />
      </div>
      {budget.lines.length > 0 && (
        <Table aria-label={`${name} budget lines`} className="border-t border-border">
          <TableHeader><TableRow>
            <TableHead className="pl-4">Line</TableHead>
            <TableHead className="pr-4 text-right">Allocated</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {budget.lines.map((line) => (
              <TableRow key={line.label}>
                <TableCell className="pl-4">{line.label}</TableCell>
                <TableCell className="pr-4 text-right tabular-nums">{dollars(line.amountMicro)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

/** A student outside the club: who can see departments, and who to ask. */
export function DepartmentForbidden({ message, orgId }: { message: string; orgId: string }) {
  return (
    <>
      <PageHeader title="Department" />
      <Alert>
        <Lock aria-hidden="true" />
        <div>
          <AlertTitle>{message}</AlertTitle>
          <AlertDescription>Ask one of the club&rsquo;s officers to add you to the roster.</AlertDescription>
          <Link href={`${clubPath(orgId)}?tab=officers`} className={buttonVariants({ variant: 'secondary', className: 'mt-3' })}>See the officers</Link>
        </div>
      </Alert>
    </>
  );
}
