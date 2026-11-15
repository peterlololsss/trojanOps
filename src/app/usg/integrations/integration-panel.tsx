'use client';

import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, CircleAlert, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DemoSummary } from '@/components/ui/demo-summary';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { connectorLabels, health, syncTimeFormat, type ConnectorRow } from './connector-status';
import { RosterSyncError, syncRoster, type RosterSyncResult } from './sync-request';

export function IntegrationPanel({ connectors, clubs }: {
  readonly connectors: readonly ConnectorRow[];
  readonly clubs: readonly { readonly id: string; readonly name: string }[];
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RosterSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unhealthy = connectors.filter((connector) => connector.status !== 'ok');
  const lastRosterSync = connectors.find((connector) => connector.kind === 'roster')?.lastSyncAt ?? null;

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
        <AlertDescription>{unhealthy.map((connector) => `${connectorLabels[connector.kind]}: ${health[connector.status].label}`).join('; ')}. Retry the roster sync if it failed; contact an administrator for other connector issues.</AlertDescription>
      </div>
    </Alert>}
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-muted-foreground">Open a club to review its members, documents and quota.</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Last roster sync: {lastRosterSync
          ? <time dateTime={lastRosterSync} className="font-mono text-xs">{syncTimeFormat.format(new Date(lastRosterSync))}</time>
          : 'Not synced'}</span>
        <Button type="button" onClick={sync} disabled={pending} aria-busy={pending} className="min-w-36 border border-transparent disabled:border-input disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"><RefreshCw aria-hidden="true" />{pending ? 'Syncing roster' : 'Sync roster'}</Button>
      </div>
    </div>
    <div aria-live="polite" aria-atomic="true">
      {pending && <p className="text-sm text-muted-foreground">Syncing club memberships and provisioning agents...</p>}
      {error && !pending && <Alert variant="destructive" role="none"><CircleAlert aria-hidden="true" /><div>
        <AlertTitle>Roster sync did not finish</AlertTitle><AlertDescription>{error}</AlertDescription>
      </div></Alert>}
    </div>
    <Dialog open={result !== null && !pending} onOpenChange={(open) => { if (!open) setResult(null); }}>
      {result && <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Check className="size-5 text-success" aria-hidden="true" />Roster sync complete</DialogTitle>
          <DialogDescription>{result.orgsCreated} clubs added; {result.positionsChanged} positions changed; {result.installationsCreated} agents installed.</DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Club</TableHead><TableHead>Import</TableHead><TableHead className="text-right">Position changes</TableHead><TableHead className="text-right">Agents installed</TableHead></TableRow></TableHeader>
          <TableBody>{result.clubs.map((club) => <TableRow key={club.orgId}>
            <TableHead scope="row">{club.orgName}</TableHead><TableCell>{club.created ? 'Added' : 'Existing'}</TableCell>
            <TableCell className="text-right tabular-nums">{club.positionsChanged}</TableCell><TableCell className="text-right tabular-nums">{club.installationsCreated}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
        <DialogFooter><DialogClose asChild><Button type="button">Close</Button></DialogClose></DialogFooter>
      </DialogContent>}
    </Dialog>
    <Table aria-label="Clubs">
      <TableCaption>{clubs.length} {clubs.length === 1 ? 'club' : 'clubs'}. Details are read-only; manage quotas and policy from Clubs.</TableCaption>
      <TableHeader><TableRow><TableHead>Club</TableHead><TableHead className="w-0 text-right"><span className="sr-only">Action</span></TableHead></TableRow></TableHeader>
      <TableBody>{clubs.length === 0
        ? <TableRow><TableCell colSpan={2} className="p-6 text-center text-muted-foreground">No clubs yet. Sync the roster to import clubs.</TableCell></TableRow>
        : clubs.map((club) => <TableRow key={club.id}>
          <TableHead scope="row">{club.name}</TableHead>
          <TableCell className="text-right"><Link href={`/usg/integrations?club=${club.id}`} className={buttonVariants({ variant: 'secondary', size: 'icon' })} aria-label={`View ${club.name} details`} title="View details"><ChevronRight aria-hidden="true" /></Link></TableCell>
        </TableRow>)}</TableBody>
    </Table>
  </div>;
}
