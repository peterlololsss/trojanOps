// Owner: D. One club's read-only management detail: AI summary, then collapsible blocks.
import Link from 'next/link';
import { Check, ChevronRight, CircleAlert, CircleSlash } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ClubDetail, ClubQuota, DetailBlock, DetailTable } from '@/lib/connectors/club-detail';
import { creditLabel, MODEL_LABELS } from '@/lib/gateway/prices';
import { AiSummary } from './ai-summary';

const SUMMARY = "Members shows who is in the club and their positions. Documents lists the club's documents you can read. Quotas shows the club's monthly budget, usage and model policy.";
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = (micro: number) => usd.format(micro / 1_000_000);

export function ClubDetailPanel({ detail }: { readonly detail: ClubDetail }) {
  const back = <Link href="/usg/integrations" className={buttonVariants({ variant: 'secondary' })}>Back to management</Link>;
  return <>
    <PageHeader title={detail.name} description="Members, documents and quota for this club. Read-only." action={back} />
    <div className="space-y-4">
      <section aria-labelledby="club-summary-heading" className="space-y-3 rounded-md border border-border border-l-4 border-l-primary bg-gold-25 p-6">
        <h2 id="club-summary-heading" className="text-xl font-bold leading-7 text-primary">AI summary</h2>
        {/* TODO(verify): fixed text for now; a generated summary arrives with the real runtime (WP-13). */}
        <AiSummary text={SUMMARY} />
      </section>
      <Block title="Members">
        <TableBlock block={detail.identity} title="Members" empty="No members in this club yet. Sync the roster from Management to import them." />
      </Block>
      <Block title="Documents">
        <TableBlock block={detail.documents} title="Documents" empty="No documents you can read in this club's own library. Club officers add documents from the club's Documents page." />
      </Block>
      <Block title="Quotas">
        <QuotaBlock block={detail.quota} clubName={detail.name} />
      </Block>
    </div>
  </>;
}

/** Native details/summary: collapsed by default, keyboard operable, no client script. */
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <details className="group rounded-md border border-border">
    <summary className="flex min-h-10 cursor-pointer list-none items-center gap-3 px-4 py-2 hover:bg-accent [&::-webkit-details-marker]:hidden">
      <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
      <h2 className="text-base font-semibold">{title}</h2>
    </summary>
    <div className="border-t border-border p-4">{children}</div>
  </details>;
}

function Unavailable({ title }: { title: string }) {
  return <Alert variant="destructive"><CircleAlert aria-hidden="true" /><div>
    <AlertTitle>{title} unavailable</AlertTitle>
    <AlertDescription>Could not read this section&apos;s source data. Reload the page to retry. The other sections remain available.</AlertDescription>
  </div></Alert>;
}

function TableBlock({ block, title, empty }: { block: DetailBlock<DetailTable>; title: string; empty: string }) {
  if (block.status === 'unavailable') return <Unavailable title={title} />;
  const { columns, rows } = block.data;
  return <Table>
    <TableCaption>{title} · {rows.length} {rows.length === 1 ? 'row' : 'rows'}</TableCaption>
    <TableHeader><TableRow>{columns.map((column) => <TableHead key={column}>{column}</TableHead>)}</TableRow></TableHeader>
    <TableBody>{rows.length === 0
      ? <TableRow><TableCell colSpan={columns.length} className="p-6 text-center text-muted-foreground">{empty}</TableCell></TableRow>
      : rows.map((row, index) => <TableRow key={index}>{columns.map((column, cellIndex) => cellIndex === 0
        ? <TableHead key={column} scope="row">{row[cellIndex] ?? ''}</TableHead>
        : <TableCell key={column}>{row[cellIndex] ?? ''}</TableCell>)}</TableRow>)}</TableBody>
  </Table>;
}

function Amount({ micro }: { micro: number }) {
  return <>{money(micro)}<span className="block text-sm text-muted-foreground">{creditLabel(micro)}</span></>;
}

function QuotaBlock({ block, clubName }: { block: DetailBlock<ClubQuota>; clubName: string }) {
  if (block.status === 'unavailable') return <Unavailable title="Quotas" />;
  const quota = block.data;
  return <div className="space-y-3">
    <Table>
      <TableCaption>Monthly quota and USG policy for {clubName}. 1 credit = $0.01.</TableCaption>
      <TableHeader><TableRow>
        <TableHead>Status</TableHead><TableHead className="text-right">Monthly limit</TableHead><TableHead className="text-right">Used</TableHead>
        <TableHead className="text-right">Remaining</TableHead><TableHead>Model classes</TableHead><TableHead>Public agents</TableHead>
      </TableRow></TableHeader>
      <TableBody><TableRow>
        <TableCell><span className="inline-flex items-center gap-1">{quota.status === 'active'
          ? <Check className="size-3 text-success" aria-hidden="true" /> : <CircleSlash className="size-3" aria-hidden="true" />}{quota.status === 'active' ? 'Active' : 'Inactive'}</span></TableCell>
        <TableCell className="text-right tabular-nums"><Amount micro={quota.limitMicro} /></TableCell>
        <TableCell className="text-right tabular-nums"><Amount micro={quota.spentMicro} /></TableCell>
        <TableCell className="text-right tabular-nums"><Amount micro={quota.remainingMicro} /></TableCell>
        <TableCell>{quota.hasPolicy
          ? quota.allowedModelClasses.map((model) => MODEL_LABELS[model]).join(', ') || 'No models'
          : <span className="inline-flex items-center gap-1"><CircleAlert className="size-3 text-primary" aria-hidden="true" />Policy missing</span>}</TableCell>
        <TableCell>{quota.hasPolicy ? (quota.allowPublicAgents ? 'Allowed' : 'Blocked') : '—'}</TableCell>
      </TableRow></TableBody>
    </Table>
    <Link href="/usg/clubs" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>Manage in Clubs</Link>
  </div>;
}
