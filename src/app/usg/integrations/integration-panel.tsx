'use client';

import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CircleAlert, CircleX, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { DemoSummary } from '@/components/ui/demo-summary';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ConnectorKind, ConnectorStatus } from '@/lib/contracts';
import { RosterSyncError, syncRoster, type RosterSyncResult } from './sync-request';

type ConnectorRow = Omit<ConnectorStatus, 'lastSyncAt'> & { readonly lastSyncAt: string | null };
const labels: Record<ConnectorKind, string> = {
  identity: 'Identity', roster: 'Roster', documents: 'Documents', llm: 'Language model', applications: 'Applications',
};
const operation: Record<ConnectorKind, string> = {
  identity: 'At sign-in', roster: 'Manual sync', documents: 'Manual uploads', llm: 'Demo answers', applications: 'Run-page confirmation',
};
const health = {
  ok: { label: 'OK', Icon: Check, variant: 'success' },
  degraded: { label: 'Degraded', Icon: CircleAlert, variant: 'attention' },
  down: { label: 'Down', Icon: CircleX, variant: 'danger' },
} as const;
const dateFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium', timeStyle: 'long', timeZone: 'America/Los_Angeles',
});

export function IntegrationPanel({ connectors }: {
  readonly connectors: readonly ConnectorRow[];
}) {
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
    <DemoSummary source="current connector configuration and recorded health">
      <p>{connectors.length} connectors support the flow from USG to clubs and their members. {connectors.filter(connector => connector.isMock).length} use demo implementations.</p>
      <p>{unhealthy.length ? `${unhealthy.length} connectors need attention.` : 'No connector is currently marked degraded or down.'}</p>
    </DemoSummary>
    {unhealthy.length > 0 && <Alert variant="attention">
      <CircleAlert aria-hidden="true" />
      <div>
        <AlertTitle>Connector attention required</AlertTitle>
        <AlertDescription>{unhealthy.map((connector) => `${labels[connector.kind]}: ${health[connector.status].label}`).join('; ')}. Retry the roster sync if it failed; contact an administrator for other connector issues.</AlertDescription>
      </div>
    </Alert>}
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-muted-foreground">Preview connector data or manage clubs and quotas.</p>
      <Button type="button" onClick={sync} disabled={pending} aria-busy={pending} className="min-w-36 border border-transparent disabled:border-input disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"><RefreshCw aria-hidden="true" />{pending ? 'Syncing roster' : 'Sync roster'}</Button>
    </div>
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
    <section aria-labelledby="management-areas-heading" className="space-y-3">
      <h2 id="management-areas-heading" className="text-xl font-semibold">Management areas</h2>
      <Table>
        <TableCaption>Platform-wide connectors and club settings. Demo ready is not a live health check; last sync applies to roster imports.</TableCaption>
        <TableHeader><TableRow>
          <TableHead>Area</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead>
          <TableHead>Last sync</TableHead><TableHead>Operation</TableHead><TableHead>Action</TableHead>
        </TableRow></TableHeader>
        <TableBody>{connectors.map((connector) => {
          const status = health[connector.status];
          return <TableRow key={connector.kind}>
            <TableHead scope="row">{labels[connector.kind]}</TableHead>
            <TableCell><div className="flex items-center gap-2"><span>{connector.implementation}</span>{connector.isMock && <Badge>Mock</Badge>}</div></TableCell>
            <TableCell><Badge variant={status.variant}><status.Icon aria-hidden="true" />{connector.isMock && connector.status === 'ok' ? 'Demo ready' : status.label}</Badge></TableCell>
            <TableCell className="whitespace-nowrap font-mono text-xs">{connector.lastSyncAt
              ? <time dateTime={connector.lastSyncAt}>{dateFormat.format(new Date(connector.lastSyncAt))}</time>
              : <span className="font-sans text-sm text-muted-foreground">{connector.kind === 'roster' ? 'Not synced' : 'N/A'}</span>}</TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">{operation[connector.kind]}</TableCell>
            <TableCell><Link href={`/usg/integrations?connector=${connector.kind}`} className={buttonVariants({ variant: 'secondary', size: 'sm' })} aria-label={`View ${labels[connector.kind].toLowerCase()} details`}>View details</Link></TableCell>
          </TableRow>;
        })}
          <TableRow>
            <TableHead scope="row">Clubs and quotas</TableHead>
            <TableCell>Platform settings</TableCell><TableCell className="text-muted-foreground">Managed in app</TableCell>
            <TableCell className="text-muted-foreground">N/A</TableCell><TableCell>Quotas and policy</TableCell>
            <TableCell><Link href="/usg/clubs" className={buttonVariants({ variant: 'secondary', size: 'sm' })} aria-label="View clubs and quotas">View details</Link></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </section>
  </div>;
}
