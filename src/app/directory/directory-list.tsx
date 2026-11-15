'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AgentListing } from '@/lib/contracts';

export function DirectoryList({ agents }: { readonly agents: readonly AgentListing[] }) {
  const [search, setSearch] = useState('');
  const [club, setClub] = useState('all');
  const [purpose, setPurpose] = useState('all');
  const clubs = [...new Map(agents.map((agent) => [agent.orgId, agent.orgName])).entries()]
    .sort((left, right) => left[1].localeCompare(right[1]));
  const purposes = [...new Set(agents.map((agent) => agent.purpose))].sort();
  const query = search.trim().toLocaleLowerCase();
  const filtered = agents.filter((agent) => (club === 'all' || agent.orgId === club)
    && (purpose === 'all' || agent.purpose === purpose)
    && `${agent.name} ${agent.purpose} ${agent.orgName}`.toLocaleLowerCase().includes(query));
  const clearFilters = () => { setSearch(''); setClub('all'); setPurpose('all'); };

  if (agents.length === 0) {
    return <section className="space-y-2">
      <h2 className="text-xl leading-7 font-semibold">No public agents yet</h2>
      <p className="text-muted-foreground">Clubs publish agents here for all students. Check My agents for agents available through your clubs.</p>
      <Link href="/me/agents" className={buttonVariants({ variant: 'secondary' })}>Go to My agents</Link>
    </section>;
  }

  return <div className="min-w-0 space-y-4">
    <div role="search" aria-label="Filter public agents" className="grid min-w-0 gap-4 lg:grid-cols-3">
      <div className="min-w-0">
        <Label htmlFor="directory-search">Search</Label>
        <Input id="directory-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Agent, purpose or club" />
      </div>
      <div className="min-w-0">
        <Label htmlFor="directory-club">Club</Label>
        <Select value={club} onValueChange={setClub}>
          <SelectTrigger id="directory-club" aria-label="Club"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clubs</SelectItem>
            {clubs.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0">
        <Label htmlFor="directory-purpose">Purpose</Label>
        <Select value={purpose} onValueChange={setPurpose}>
          <SelectTrigger id="directory-purpose" aria-label="Purpose"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All purposes</SelectItem>
            {purposes.map((item) => <SelectItem key={item} value={item} className="max-w-lg whitespace-normal [overflow-wrap:anywhere]">{item}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p role="status" className="tabular-nums text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'agent' : 'agents'}</p>
      <Button variant="ghost" onClick={clearFilters}>Clear filters</Button>
    </div>
    {filtered.length === 0 ? <section className="space-y-2 border-t pt-6">
      <h2 className="text-xl leading-7 font-semibold">No matching agents</h2>
      <p className="text-muted-foreground">Try another search, club or purpose, or clear the filters.</p>
    </section> : <Table aria-label="Public agents" className="min-w-[640px]">
      <TableHeader><TableRow>
        <TableHead>Agent</TableHead><TableHead>Club</TableHead><TableHead>Audience</TableHead><TableHead className="relative"><span className="sr-only">Actions</span></TableHead>
      </TableRow></TableHeader>
      <TableBody>{filtered.map((agent) => <TableRow key={agent.installationId}>
        <TableCell className="max-w-md [overflow-wrap:anywhere]">
          <p className="font-semibold">{agent.name}</p>
          <p className="text-muted-foreground">{agent.purpose}</p>
        </TableCell>
        <TableCell className="[overflow-wrap:anywhere]">{agent.orgName}</TableCell>
        <TableCell><Badge className="whitespace-nowrap"><Users aria-hidden="true" />{agent.reasonLabel}</Badge></TableCell>
        <TableCell className="text-right">
          <Link href={`/directory/${encodeURIComponent(agent.installationId)}`} aria-label={`Open ${agent.name} from ${agent.orgName}`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>Open</Link>
        </TableCell>
      </TableRow>)}</TableBody>
    </Table>}
  </div>;
}
