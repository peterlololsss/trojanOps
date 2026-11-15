// Owner: D (WP-11). A club's departments as rows: name and purpose, lead, members, next event, and
// for the president only, the semester budget.
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DepartmentRow } from '@/lib/directory/types';
import { budgetText, initials, percentOf, shortDate } from '@/lib/directory/view';
import { Bar, Empty } from './parts';

export function DepartmentsTable({ departments, club, base }: {
  departments: readonly DepartmentRow[];
  club: string;
  /** Rows link to `${base}/[slug]`: `/directory/departments` or `/directory/clubs/[orgId]/departments`. */
  base: string;
}) {
  if (departments.length === 0) return <Empty>{club} has no departments yet.</Empty>;
  const budgets = departments.some((d) => d.budget);
  return (
    <Table aria-label={`${club} departments`} className={budgets ? 'min-w-[960px]' : 'min-w-[760px]'}>
      <TableHeader><TableRow>
        <TableHead>Department</TableHead>
        <TableHead>Lead</TableHead>
        <TableHead className="text-right">Members</TableHead>
        <TableHead>Next event</TableHead>
        {budgets && <TableHead>Semester budget</TableHead>}
      </TableRow></TableHeader>
      <TableBody>
        {departments.map((d) => (
          <TableRow key={d.slug}>
            <TableCell className="max-w-md [overflow-wrap:anywhere]">
              <Link href={`${base}/${d.slug}`} className="font-semibold text-primary underline-offset-4 hover:underline">{d.name}</Link>
              <p className="text-muted-foreground">{d.purpose}</p>
            </TableCell>
            <TableCell>
              {d.lead
                ? <span className="flex items-center gap-2 whitespace-nowrap"><Avatar size="sm" initials={initials(d.lead.name)} />{d.lead.name}</span>
                : <span className="text-muted-foreground">No lead yet</span>}
            </TableCell>
            <TableCell className="text-right tabular-nums">{d.memberCount}</TableCell>
            <TableCell className="max-w-56">
              {d.nextEvent
                ? <><span className="tabular-nums">{shortDate(d.nextEvent.startsAt)}</span> <span className="text-muted-foreground">{d.nextEvent.title}</span></>
                : <span className="text-muted-foreground">None scheduled</span>}
            </TableCell>
            {budgets && (
              <TableCell className="w-56">
                {d.budget && <>
                  <p className="tabular-nums">{budgetText(d.budget)}</p>
                  <Bar className="mt-1.5" percent={percentOf(d.budget.committedMicro, d.budget.allocatedMicro)}
                    label={`${d.name} budget committed`} valueText={budgetText(d.budget)} />
                </>}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
