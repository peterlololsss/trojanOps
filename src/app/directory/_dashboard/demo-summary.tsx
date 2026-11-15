import Link from 'next/link';
import { DemoSummary } from '@/components/ui/demo-summary';
import type { ClubDashboard, ClubsDirectoryView, DepartmentDashboard, DepartmentsDirectoryView } from '@/lib/directory/types';
import { count } from '@/lib/directory/view';

export function ClubsSummary({ data }: { readonly data: ClubsDirectoryView }) {
  const active = data.clubs.filter(club => club.status === 'active');
  const upcoming = active.filter(club => club.nextEvent);
  return <DemoSummary source="current club directory and event schedule">
    <p>{count(active.length, 'active club')} are listed. {count(upcoming.length, 'club')} have an upcoming event.</p>
  </DemoSummary>;
}

export function ClubSummary({ data }: { readonly data: ClubDashboard }) {
  const next = data.events.filter(event => !event.past).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const departments = data.departments;
  return <DemoSummary source={`${data.club.name} profile, visible departments and event schedule`}>
    <p>{data.club.name} has {count(data.memberCount, 'current member')}{departments ? ` across ${count(departments.length, 'department')}` : ''}.</p>
    {departments && <p>{departments.map(department => `${department.name} — ${department.lead?.name ?? 'lead unassigned'}`).join(' · ')}.</p>}
    <p>{next ? `Next event is ${next.title}. ${next.summary}` : 'No upcoming event is scheduled.'}</p>
    {data.updates[0] && <p><span className="font-semibold">Latest visible update</span><br />{data.updates[0].text}</p>}
    {departments && <p><Link className="text-primary underline" href={`/org/${data.club.id}/catalog`}>Review club agents and their audiences</Link></p>}
  </DemoSummary>;
}

export function DepartmentsSummary({ data }: { readonly data: DepartmentsDirectoryView }) {
  return <DemoSummary source={`${data.club.name} department roster`}>
    <p>USG → {data.club.name} → {data.departments.map(department => department.name).join(', ') || 'departments not yet assigned'} → members.</p>
    <p>{count(data.departments.length, 'department')} coordinate the club’s work. {data.departments.map(department => `${department.name} is led by ${department.lead?.name ?? 'an unassigned lead'}`).join('. ')}.</p>
  </DemoSummary>;
}

export function DepartmentSummary({ data }: { readonly data: DepartmentDashboard }) {
  const next = data.events.filter(event => !event.past).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  return <DemoSummary source={`${data.club.name} · ${data.department.name} team and schedule`}>
    <p>{data.department.purpose}</p>
    <p>{data.lead ? `${data.lead.name} leads` : 'No lead is assigned to'} this team of {count(data.members.length, 'member')}.</p>
    <p>{next ? `Next event is ${next.title}. ${next.summary}` : 'No upcoming event is assigned to this department.'}</p>
  </DemoSummary>;
}
