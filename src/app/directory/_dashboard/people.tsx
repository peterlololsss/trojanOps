// Owner: D (WP-11). People on a dashboard: a row of initials avatars ending in "+N", the officer seats
// (vacant seats included), and the roster table.
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DirectoryPerson, OfficerSeat } from '@/lib/directory/types';
import { count, initials } from '@/lib/directory/view';
import { Empty } from './parts';

export interface AvatarPerson { userId: string; name: string; roles: string[] }

/** Each officer once, with every seat they hold: "Sam Rivera, President". */
export function officerPeople(seats: readonly OfficerSeat[]): AvatarPerson[] {
  const people = new Map<string, AvatarPerson>();
  for (const seat of seats) {
    for (const holder of seat.holders) {
      const person = people.get(holder.userId) ?? { userId: holder.userId, name: holder.name, roles: [] };
      person.roles.push(seat.name);
      people.set(holder.userId, person);
    }
  }
  return [...people.values()];
}

/** Avatars with the name on hover and for screen readers; the rest collapse into "+N", a link to the full list. */
export function AvatarRow({ label, people, max = 6, moreHref, moreLabel }: {
  label: string;
  people: readonly AvatarPerson[];
  max?: number;
  moreHref: string;
  /** "officers", "members". */
  moreLabel: string;
}) {
  const shown = people.slice(0, max);
  const more = people.length - shown.length;
  return (
    <ul aria-label={label} className="flex flex-wrap items-start gap-x-4 gap-y-3">
      {shown.map((p) => (
        <li key={p.userId} className="flex w-24 flex-col items-center gap-1 text-center">
          <Avatar initials={initials(p.name)} />
          <span className="max-w-full font-semibold [overflow-wrap:anywhere]">{p.name}</span>
          {p.roles.length > 0 && <span className="max-w-full text-xs text-muted-foreground [overflow-wrap:anywhere]">{p.roles.join(', ')}</span>}
        </li>
      ))}
      {more > 0 && (
        <li className="flex w-24 flex-col items-center text-center">
          <Link href={moreHref} aria-label={`+${more} more ${moreLabel}`} className="inline-flex">
            <Avatar tone="more" initials={`+${more}`} />
          </Link>
        </li>
      )}
    </ul>
  );
}

/** The Officers tab: one row per seat; a seat with no holder reads "Vacant". */
export function OfficersList({ seats }: { seats: readonly OfficerSeat[] }) {
  if (seats.length === 0) return <Empty>No officer positions yet.</Empty>;
  return (
    <section aria-labelledby="officers-heading" className="max-w-[720px]">
      <h2 id="officers-heading" className="mb-3 text-xl font-semibold leading-7">Officers</h2>
      <ul className="rounded-md border border-border">
        {seats.map((seat) => (
          <li key={seat.slug} className="flex min-h-14 flex-wrap items-center gap-x-6 gap-y-2 border-b border-border px-4 py-2 last:border-b-0">
            {seat.holders.length > 0
              ? seat.holders.map((holder) => (
                <span key={holder.userId} className="flex min-w-48 items-center gap-3">
                  <Avatar initials={initials(holder.name)} />
                  <span>
                    <span className="block font-semibold">{holder.name}</span>
                    <span className="block text-muted-foreground">{seat.name}</span>
                  </span>
                </span>
              ))
              : (
                <span className="flex min-w-48 items-center gap-3">
                  <Avatar tone="vacant" />
                  <span>
                    <span className="block text-muted-foreground">Vacant</span>
                    <span className="block text-muted-foreground">{seat.name}</span>
                  </span>
                </span>
              )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The roster: name and positions. `lead` marks a department's lead. */
export function MembersTable({ members, label, leadId }: { members: readonly DirectoryPerson[]; label: string; leadId?: string | null }) {
  if (members.length === 0) return <Empty>No members yet.</Empty>;
  return (
    <section aria-labelledby="members-heading" className="max-w-[880px]">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="members-heading" className="text-xl font-semibold leading-7">Members</h2>
        <p className="tabular-nums text-muted-foreground">{count(members.length, 'member')}</p>
      </div>
      <Table aria-label={label} className="min-w-[480px]">
        <TableHeader><TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Positions</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.userId}>
              <TableCell>
                <span className="flex items-center gap-2">
                  <Avatar size="sm" initials={initials(m.name)} />
                  <span className="font-semibold">{m.name}</span>
                  {leadId === m.userId && <Badge>Lead</Badge>}
                </span>
              </TableCell>
              <TableCell className="[overflow-wrap:anywhere]">{m.positions.join(', ') || 'Member'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
