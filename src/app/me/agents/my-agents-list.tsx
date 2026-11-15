'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { CircleAlert } from 'lucide-react';
import { changeSession, SessionChangeError } from '@/components/shell/session-request';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AgentListing, MyAgentsClub } from '@/lib/contracts';

export function MyAgentsList({ clubs }: { readonly clubs: readonly MyAgentsClub[] }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, startTransition] = useTransition();
  const [opening, setOpening] = useState<AgentListing | null>(null);
  const [error, setError] = useState<{ readonly message: string; readonly agent: AgentListing } | null>(null);

  function openAgent(agent: AgentListing) {
    if (inFlight.current || pending) return;
    inFlight.current = true;
    setOpening(agent);
    setError(null);
    startTransition(async () => {
      try {
        await changeSession({ kind: 'org', orgId: agent.orgId });
        startTransition(() => {
          router.push(`/org/${encodeURIComponent(agent.orgId)}/agents/${encodeURIComponent(agent.installationId)}`);
          router.refresh();
        });
      } catch (failure) {
        if (!(failure instanceof SessionChangeError)) throw failure;
        setError({ message: failure.message, agent });
        setOpening(null);
      } finally {
        inFlight.current = false;
      }
    });
  }

  if (clubs.length === 0) return <div className="space-y-3">
    <h2 className="text-xl font-semibold leading-7">No club memberships yet</h2>
    <p className="max-w-prose text-muted-foreground">Browse agents available to all students in the Directory. If a club membership is missing, ask the club president to check the roster.</p>
    <Link href="/directory" className={buttonVariants({ variant: 'secondary' })}>Browse directory</Link>
  </div>;

  return <div className="min-w-0 space-y-8">
    <p role="status" aria-live="polite" className={pending ? 'text-muted-foreground' : 'sr-only'}>
      {pending && opening ? `Switching to ${opening.orgName} and opening ${opening.name}.` : ''}
    </p>
    {error && <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <div className="min-w-0">
        <AlertTitle>Could not open {error.agent.name}</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
        <Button variant="secondary" className="mt-3 disabled:opacity-100" disabled={pending} onClick={() => openAgent(error.agent)}>Retry</Button>
      </div>
    </Alert>}
    {clubs.map((club) => <section key={club.orgId} aria-labelledby={`club-${club.orgId}`} className="min-w-0">
      <div className="mb-4 [overflow-wrap:anywhere]">
        <h2 id={`club-${club.orgId}`} className="text-xl font-semibold leading-7">{club.orgName}</h2>
        <p className="mt-1 text-muted-foreground">Your positions: {club.positionNames.length ? club.positionNames.join(', ') : 'Member'}</p>
      </div>
      {club.agents.length ? <Table aria-labelledby={`club-${club.orgId}`} className="min-w-[640px]">
        <TableHeader><TableRow>
          <TableHead>Agent</TableHead>
          <TableHead>Access</TableHead>
          <TableHead className="text-right">Version</TableHead>
          <TableHead className="relative"><span className="sr-only">Actions</span></TableHead>
        </TableRow></TableHeader>
        <TableBody>{club.agents.map((agent) => <TableRow key={agent.installationId}>
          <TableCell className="max-w-lg [overflow-wrap:anywhere]">
            <p className="font-semibold">{agent.name}</p>
            <p className="mt-1 text-muted-foreground">{agent.purpose}</p>
          </TableCell>
          <TableCell className="max-w-48 [overflow-wrap:anywhere]">{agent.reasonLabel}</TableCell>
          <TableCell className="text-right tabular-nums">v{agent.templateVersion}</TableCell>
          <TableCell className="text-right">
            <Button variant="secondary" className="disabled:bg-muted disabled:opacity-100" disabled={pending}
              aria-label={`Open ${agent.name} in ${club.orgName}`} aria-busy={pending && opening?.installationId === agent.installationId}
              onClick={() => openAgent(agent)}>Open</Button>
          </TableCell>
        </TableRow>)}</TableBody>
      </Table> : <div className="space-y-3">
        <p className="text-muted-foreground">No agents are available to you in this club yet. Ask the club president about access, or browse agents for all students.</p>
        <Link href="/directory" className={buttonVariants({ variant: 'secondary' })}>Browse directory</Link>
      </div>}
    </section>)}
  </div>;
}
