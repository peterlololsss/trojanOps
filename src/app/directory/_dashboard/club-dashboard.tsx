// Owner: D (WP-11). A club's dashboard (§14 `/directory/clubs/[orgId]`), laid out after EngageSC's club
// page: header, tabs, then the tab. Server-rendered from one `ClubDashboard`; the service has already
// left out what this viewer may not see (roster, departments, oversight), so this only lays it out.
import Link from 'next/link';
import { CircleSlash, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ClubDashboard } from '@/lib/directory/types';
import { cohortLabel, count } from '@/lib/directory/view';
import { DepartmentsTable } from './departments';
import { EventsSection, UpcomingPanel } from './events';
import { DashboardHeader } from './header';
import { clubPath, clubTabs, pickTab, pickWhen, showAllUpdates, type SearchParams } from './model';
import { OversightStrip } from './oversight';
import { Empty, Panel, textLink } from './parts';
import { AvatarRow, MembersTable, OfficersList, officerPeople } from './people';
import { TabLinks } from './tabs';
import { UpdatesPanel } from './updates';

export function ClubDashboardView({ data, searchParams }: { data: ClubDashboard; searchParams: SearchParams }) {
  const { club, viewer } = data;
  const tabs = clubTabs(data);
  const active = pickTab(tabs, searchParams.tab);
  const base = clubPath(club.id);

  return (
    <>
      <DashboardHeader
        name={club.name}
        parent="Registered student organization"
        tagline={club.tagline}
        chips={[
          viewer.usg && club.status === 'inactive' && <Badge key="status"><CircleSlash aria-hidden="true" />Inactive</Badge>,
          ...club.categories.map((c) => <Badge key={c}>{c}</Badge>),
          ...club.cohorts.map((c) => <Badge key={`cohort-${c}`} className="bg-background">{cohortLabel(c)}</Badge>),
        ]}
        facts={<span className="inline-flex items-center gap-1.5 tabular-nums"><Users aria-hidden="true" className="size-4" />{count(data.memberCount, 'member')}</span>}
        actions={<>
          {club.contactEmail && <a href={`mailto:${club.contactEmail}`} className={buttonVariants({ variant: 'secondary' })}>Contact</a>}
          {viewer.usgAdmin && <Link href="/usg/clubs" className={buttonVariants()}>Manage quota and policy</Link>}
          {viewer.president && <Link href={`/org/${club.id}/admin`} className={buttonVariants()}>Administration</Link>}
        </>}
      />
      <TabLinks label={`${club.name} sections`} tabs={tabs} active={active} />
      {active === 'about' && <AboutTab data={data} showAll={showAllUpdates(searchParams.updates)} />}
      {active === 'events' && <EventsSection events={data.events} when={pickWhen(searchParams.when)} base={base} />}
      {active === 'members' && data.members && <MembersTable members={data.members} label={`${club.name} members`} />}
      {active === 'officers' && <OfficersList seats={data.officers} />}
      {active === 'departments' && data.departments && (
        <section aria-labelledby="departments-heading">
          <h2 id="departments-heading" className="mb-3 text-xl font-semibold leading-7">Departments</h2>
          <DepartmentsTable departments={data.departments} club={club.name} base={`${base}/departments`} />
        </section>
      )}
      {active === 'agents' && <AgentsTab data={data} />}
    </>
  );
}

function AboutTab({ data, showAll }: { data: ClubDashboard; showAll: boolean }) {
  const { club } = data;
  const base = clubPath(club.id);
  const officers = officerPeople(data.officers);
  return (
    <div className="space-y-6">
      {data.oversight && <OversightStrip club={club.name} oversight={data.oversight} />}

      <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-2">
        <section aria-labelledby="contact-heading" className="bg-background p-4">
          <h2 id="contact-heading" className="text-xl font-semibold leading-7">Contact</h2>
          {club.contactEmail || club.meets
            ? <dl className="mt-2 space-y-2">
              {club.contactEmail && <div>
                <dt className="text-xs font-semibold text-muted-foreground">Email</dt>
                <dd><a href={`mailto:${club.contactEmail}`} className={textLink}>{club.contactEmail}</a></dd>
              </div>}
              {club.meets && <div>
                <dt className="text-xs font-semibold text-muted-foreground">Meets</dt>
                <dd>{club.meets}</dd>
              </div>}
            </dl>
            : <Empty className="pb-0">No contact details yet.</Empty>}
        </section>
        <section aria-labelledby="officer-avatars-heading" className="bg-background p-4">
          <h2 id="officer-avatars-heading" className="text-xl font-semibold leading-7">Officers</h2>
          {officers.length > 0
            ? <div className="mt-2"><AvatarRow label={`${club.name} officers`} people={officers} moreHref={`${base}?tab=officers`} moreLabel="officers" /></div>
            : <Empty className="pb-0">No officers yet.</Empty>}
        </section>
      </div>

      <Panel id="about-heading" title="About">
        {club.about.length > 0
          ? <div className="max-w-prose space-y-3 py-4 text-base leading-6">{club.about.map((p) => <p key={p}>{p}</p>)}</div>
          : <Empty>No description yet.</Empty>}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <UpdatesPanel updates={data.updates} clubName={club.name} showAll={showAll} allHref={`${base}?updates=all#recent-updates`} />
        <UpcomingPanel events={data.events} base={base} />
      </div>
    </div>
  );
}

function AgentsTab({ data }: { data: ClubDashboard }) {
  const { club, publicAgents } = data;
  if (publicAgents.length === 0) {
    return (
      <Empty action={data.viewer.president
        ? <Link href={`/org/${club.id}/catalog`} className={buttonVariants({ variant: 'secondary' })}>Open catalog</Link>
        : undefined}>
        {club.name} has no public agents yet.
      </Empty>
    );
  }
  return (
    <section aria-labelledby="agents-heading" className="max-w-[880px]">
      <h2 id="agents-heading" className="mb-3 text-xl font-semibold leading-7">Public agents</h2>
      <Table aria-label={`${club.name} public agents`} className="min-w-[640px]">
        <TableHeader><TableRow>
          <TableHead>Agent</TableHead>
          <TableHead>Audience</TableHead>
          <TableHead className="text-right">Version</TableHead>
          <TableHead><span className="sr-only">Actions</span></TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {publicAgents.map((agent) => (
            <TableRow key={agent.installationId}>
              <TableCell className="max-w-md [overflow-wrap:anywhere]">
                <p className="font-semibold">{agent.name}</p>
                <p className="text-muted-foreground">{agent.purpose}</p>
              </TableCell>
              <TableCell><Badge className="whitespace-nowrap"><Users aria-hidden="true" />All students</Badge></TableCell>
              <TableCell className="text-right tabular-nums">v{agent.templateVersion}</TableCell>
              <TableCell className="text-right">
                <Link href={`/directory/${agent.installationId}`} aria-label={`Open ${agent.name}`} className={buttonVariants({ variant: 'secondary' })}>Open</Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
