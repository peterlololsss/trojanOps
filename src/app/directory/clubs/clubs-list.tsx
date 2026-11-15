'use client';

// Owner: D (WP-11). The clubs list (§14 `/directory/clubs`): dense rows with search and category
// filters. USG viewers also get status, the monthly quota meter and USG funding, and a status filter.
import { useState } from 'react';
import Link from 'next/link';
import { CircleSlash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ClubRow, ClubsDirectoryView } from '@/lib/directory/types';
import { count, fundingUsed, shortDate, dollars } from '@/lib/directory/view';
import { InitialsTile } from '../_dashboard/header';
import { ALL, clubPath, filterClubs, NO_FILTERS, type ClubFilters } from '../_dashboard/model';
import { QuotaMeter } from '../_dashboard/oversight';
import { Empty } from '../_dashboard/parts';

export function ClubsList({ view }: { view: ClubsDirectoryView }) {
  const [filters, setFilters] = useState<ClubFilters>(NO_FILTERS);
  const set = (patch: Partial<ClubFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const { clubs, viewer } = view;
  const usg = viewer.usg;

  if (clubs.length === 0) {
    return (
      <Empty action={viewer.usgAdmin
        ? <Link href="/usg/integrations" className={buttonVariants({ variant: 'secondary' })}>Import the roster</Link>
        : undefined}>
        No clubs yet.
      </Empty>
    );
  }

  const categories = [...new Set(clubs.flatMap((c) => c.categories))].sort();
  const shown = filterClubs(clubs, filters);
  const filtering = filters.search.trim() !== '' || filters.category !== ALL || filters.status !== ALL;

  return (
    <div className="min-w-0 space-y-4">
      <div role="search" aria-label="Filter clubs" className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0">
          <Label htmlFor="clubs-search">Search</Label>
          <Input id="clubs-search" type="search" value={filters.search} onChange={(e) => set({ search: e.target.value })} placeholder="Club name or topic" />
        </div>
        <div className="min-w-0">
          <Label htmlFor="clubs-category">Category</Label>
          <Select value={filters.category} onValueChange={(category) => set({ category })}>
            <SelectTrigger id="clubs-category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {usg && (
          <div className="min-w-0">
            <Label htmlFor="clubs-status">Status</Label>
            <Select value={filters.status} onValueChange={(status) => set({ status })}>
              <SelectTrigger id="clubs-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
        <p role="status" className="tabular-nums text-muted-foreground">
          {filtering ? `${shown.length} of ${count(clubs.length, 'club')}` : count(clubs.length, 'club')}
        </p>
        {filtering && shown.length > 0 && <Button variant="ghost" onClick={() => setFilters(NO_FILTERS)}>Clear filters</Button>}
      </div>

      {shown.length === 0
        ? <Empty className="border-t border-border" action={<Button variant="secondary" onClick={() => setFilters(NO_FILTERS)}>Clear filters</Button>}>
          No clubs match these filters.
        </Empty>
        : <ClubsTable clubs={shown} usg={usg} />}
    </div>
  );
}

function ClubsTable({ clubs, usg }: { clubs: readonly ClubRow[]; usg: boolean }) {
  return (
    <Table aria-label="Clubs" className={usg ? 'min-w-[880px]' : 'min-w-[720px]'}>
      <TableHeader><TableRow>
        <TableHead>Club</TableHead>
        <TableHead className="text-right">Members</TableHead>
        <TableHead>Next event</TableHead>
        <TableHead className="text-right">Public agents</TableHead>
        {usg && <>
          <TableHead>Monthly quota</TableHead>
          <TableHead>USG funding</TableHead>
        </>}
      </TableRow></TableHeader>
      <TableBody>
        {clubs.map((club) => (
          <TableRow key={club.id}>
            <TableCell className="min-w-72 max-w-md">
              <div className="flex items-start gap-3">
                <InitialsTile name={club.name} size="sm" />
                <div className="min-w-0 [overflow-wrap:anywhere]">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link href={clubPath(club.id)} className="font-semibold text-primary underline-offset-4 hover:underline">{club.name}</Link>
                    {usg && club.status === 'inactive' && <Badge><CircleSlash aria-hidden="true" />Inactive</Badge>}
                  </p>
                  <p>{club.tagline}</p>
                  {club.categories.length > 0 && <p className="text-xs text-muted-foreground">{club.categories.join(' · ')}</p>}
                </div>
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">{club.memberCount}</TableCell>
            <TableCell className="max-w-48">
              {club.nextEvent
                ? <><p className="tabular-nums">{shortDate(club.nextEvent.startsAt)}</p><p className="text-muted-foreground">{club.nextEvent.title}</p></>
                : <span className="text-muted-foreground">None scheduled</span>}
            </TableCell>
            <TableCell className="text-right tabular-nums">{club.publicAgentCount}</TableCell>
            {usg && <>
              <TableCell className="w-40">
                {club.oversight && <QuotaMeter quota={club.oversight.quota} club={club.name} />}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {club.oversight && <>
                  <p className="tabular-nums">{fundingUsed(club.oversight.funding)}</p>
                  {club.oversight.funding.pendingMicro > 0 && (
                    <p className="tabular-nums text-muted-foreground">{dollars(club.oversight.funding.pendingMicro)} pending</p>
                  )}
                </>}
              </TableCell>
            </>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
