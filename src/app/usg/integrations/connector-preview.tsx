import Link from 'next/link';
import { CircleAlert } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ConnectorPreviewState } from '@/lib/connectors/preview';

/** Each connector supplies its own CSV columns, source rows and summary. No write runs here. */
export function ConnectorPreviewPanel({ preview }: { readonly preview: ConnectorPreviewState }) {
  const back = <Link href="/usg/integrations" className={buttonVariants({ variant: 'secondary' })}>Back to management</Link>;
  if (preview.status === 'unavailable') {
    return <><PageHeader title={preview.title} action={back} /><Alert variant="destructive"><CircleAlert aria-hidden="true" /><div>
      <AlertTitle>CSV preview unavailable</AlertTitle>
      <AlertDescription>Could not read this connector’s source data. Check the source and reload the page to retry. Other connectors remain available from Management.</AlertDescription>
    </div></Alert></>;
  }
  const { data } = preview;
  return <>
    <PageHeader title={data.title} description={data.description} action={back} />
    <div className="space-y-4">
      <section aria-labelledby="connector-summary-heading" className="space-y-3 rounded-md border border-border border-l-4 border-l-primary bg-gold-25 p-6">
        <h2 id="connector-summary-heading" className="flex items-center gap-3 text-xl font-bold leading-7 text-primary">AI summary {data.isDemo && <Badge>Demo</Badge>}</h2>
        <p className="text-base leading-relaxed">{data.summary}</p>
        {data.isDemo && <p className="text-sm text-muted-foreground">Demo summary based on this CSV.</p>}
      </section>
      <p className="text-sm text-muted-foreground">Source: <span className="font-mono text-xs">{data.source}</span>. Read-only preview; viewing this page does not import or change records.</p>
      <div className="overflow-x-auto rounded-md border border-border" tabIndex={0} role="region" aria-label={`${data.title} CSV rows`}>
        <Table>
          <TableCaption>{data.title} · {data.rows.length} source rows</TableCaption>
          <TableHeader><TableRow>{data.columns.map((column, index) => <TableHead key={index}>{column}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{data.rows.length === 0
            ? <TableRow><TableCell colSpan={data.columns.length} className="p-6 text-center text-muted-foreground">No current records to show. Reload this page after the source changes.</TableCell></TableRow>
            : data.rows.map((row, index) => <TableRow key={index}>{data.columns.map((_, cellIndex) => cellIndex === 0
              ? <TableHead key={cellIndex} scope="row">{row[cellIndex] ?? ''}</TableHead>
              : <TableCell key={cellIndex}>{row[cellIndex] ?? ''}</TableCell>)}</TableRow>)}</TableBody>
        </Table>
      </div>
    </div>
  </>;
}
