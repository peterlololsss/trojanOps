'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CircleAlert, CircleX, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ConnectorKind, ConnectorStatus } from '@/lib/contracts';
import { RosterSyncError, syncRoster, type RosterSyncResult } from './sync-request';

type ConnectorRow = Omit<ConnectorStatus, 'lastSyncAt'> & { readonly lastSyncAt: string | null };
const labels: Record<ConnectorKind, string> = {
  identity: 'Identity', roster: 'Roster', documents: 'Documents', llm: 'Language model', applications: 'Applications',
};
const operation: Record<ConnectorKind, string> = {
  identity: 'At sign-in', roster: '', documents: 'Manual uploads', llm: 'On each run', applications: 'On confirmation',
};
const health = {
  ok: { label: 'OK', Icon: Check, variant: 'success' },
  degraded: { label: 'Degraded', Icon: CircleAlert, variant: 'attention' },
  down: { label: 'Down', Icon: CircleX, variant: 'danger' },
} as const;
const dateFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium', timeStyle: 'long', timeZone: 'America/Los_Angeles',
});

export function IntegrationPanel({ connectors }: { readonly connectors: readonly ConnectorRow[] }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RosterSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unhealthy = connectors.filter((connector) => connector.status !== 'ok');

  function sync() {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await syncRoster());
        router.refresh();
      } catch (failure) {
        if (!(failure instanceof RosterSyncError)) throw failure;
        setError(failure.message);
        router.refresh();
      } finally {
        inFlight.current = false;
      }
    });
  }

  return <div className="space-y-6">
    {unhealthy.length > 0 && <Alert variant="attention">
      <CircleAlert aria-hidden="true" />
      <div>
        <AlertTitle>Connector attention required</AlertTitle>
        <AlertDescription>{unhealthy.map((connector) => `${labels[connector.kind]}: ${health[connector.status].label}`).join('; ')}. Retry the roster sync if it failed; contact an administrator for other connector issues.</AlertDescription>
      </div>
    </Alert>}
    <Table>
      <TableCaption>All five connectors use local demo implementations. Last sync shows the latest completed sync in Pacific time.</TableCaption>
      <TableHeader><TableRow>
        <TableHead>Kind</TableHead><TableHead>Implementation</TableHead><TableHead>Status</TableHead>
        <TableHead>Last sync</TableHead><TableHead>Action</TableHead>
      </TableRow></TableHeader>
      <TableBody>{connectors.map((connector) => {
        const status = health[connector.status];
        return <TableRow key={connector.kind}>
          <TableHead scope="row">{labels[connector.kind]}</TableHead>
          <TableCell><div className="flex items-center gap-2"><span>{connector.implementation}</span>{connector.isMock && <Badge>Mock</Badge>}</div></TableCell>
          <TableCell><Badge variant={status.variant}><status.Icon aria-hidden="true" />{status.label}</Badge></TableCell>
          <TableCell className="whitespace-nowrap font-mono text-xs">{connector.lastSyncAt
            ? <time dateTime={connector.lastSyncAt}>{dateFormat.format(new Date(connector.lastSyncAt))}</time>
            : <span className="font-sans text-sm text-muted-foreground">Not synced</span>}</TableCell>
          <TableCell>{connector.kind === 'roster'
            ? <Button onClick={sync} disabled={pending} aria-busy={pending} className="min-w-36 border border-transparent disabled:border-input disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"><RefreshCw aria-hidden="true" />{pending ? 'Syncing roster' : 'Sync roster'}</Button>
            : <span className="whitespace-nowrap text-muted-foreground">{operation[connector.kind]}</span>}</TableCell>
        </TableRow>;
      })}</TableBody>
    </Table>
    <div aria-live="polite" aria-atomic="true">
      {pending && <p className="text-sm text-muted-foreground">Syncing club memberships and provisioning agents...</p>}
      {error && !pending && <Alert variant="destructive" role="none"><CircleAlert aria-hidden="true" /><div>
        <AlertTitle>Roster sync did not finish</AlertTitle><AlertDescription>{error}</AlertDescription>
      </div></Alert>}
      {result && !pending && <section aria-labelledby="sync-result-heading" className="space-y-3">
        <h2 id="sync-result-heading" className="flex items-center gap-2 text-xl font-semibold"><Check className="size-5 text-success" aria-hidden="true" />Roster sync complete</h2>
        <p>{result.orgsCreated} clubs added; {result.positionsChanged} positions changed; {result.installationsCreated} agents installed.</p>
        <Table>
          <TableHeader><TableRow><TableHead>Club</TableHead><TableHead>Import</TableHead><TableHead className="text-right">Position changes</TableHead><TableHead className="text-right">Agents installed</TableHead></TableRow></TableHeader>
          <TableBody>{result.clubs.map((club) => <TableRow key={club.orgId}>
            <TableHead scope="row">{club.orgName}</TableHead><TableCell>{club.created ? 'Added' : 'Existing'}</TableCell>
            <TableCell className="text-right tabular-nums">{club.positionsChanged}</TableCell><TableCell className="text-right tabular-nums">{club.installationsCreated}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </section>}
    </div>
  </div>;
}
