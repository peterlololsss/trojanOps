'use client';

// /usg/documents/[documentId]: one USG document, its metadata and text, and "Publish new version":
// edit the text, review the changed lines, then POST it as version n+1.
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CircleAlert } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { UsgDocumentUser, UsgDocumentView } from '@/lib/documents/usg-documents';
import { ConsoleNav, ErrorNotice, PendingButton, SuccessNotice, useConsoleMutation } from '../../templates/console-ui';
import { TIERS } from '../../templates/template-config';
import { DocumentBody } from '../document-body';
import { UsedByList } from '../documents-table';
import { lineDiff, type LineDiff } from '../line-diff';

const SHOWN_CHANGES = 10;
const MAX_LENGTH = 100_000;
const and = (items: string[]) => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** "Funding pre-check and USG review assistant read version 2 on their next run." */
export function consequence(usedBy: UsgDocumentUser[], nextVersion: number): string {
  if (!usedBy.length) return `No agent reads this document. Version ${nextVersion} replaces the current text.`;
  return `${and(usedBy.map(u => u.name))} ${usedBy.length === 1 ? 'reads' : 'read'} version ${nextVersion} on ${usedBy.length === 1 ? 'its' : 'their'} next run.`;
}

export function BackToDocuments() { return <Link className={buttonVariants({ variant: 'secondary' })} href="/usg/documents">All documents</Link>; }

export function DocumentReview({ diff, usedBy, nextVersion, error = null }: { diff: LineDiff; usedBy: UsgDocumentUser[]; nextVersion: number; error?: string | null }) {
  const changes = diff.changes ?? []; const shown = changes.slice(0, SHOWN_CHANGES); const more = changes.length - shown.length;
  return <div className="space-y-4">
    <section aria-labelledby="document-review-changes" className="space-y-2">
      <h3 id="document-review-changes" className="font-semibold">Changed lines ({diff.count.toLocaleString('en-US')})</h3>
      {!diff.changes ? null : changes.length ? <div className="rounded-md border border-border"><Table className="min-w-[560px] table-fixed">
        <colgroup><col className="w-16" /><col /><col /></colgroup>
        <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-right">Line</TableHead><TableHead>Before</TableHead><TableHead>After</TableHead></TableRow></TableHeader>
        <TableBody>{shown.map(c => <TableRow key={`${c.line}:${c.before}:${c.after}`} className="align-top hover:bg-transparent">
          <TableCell className="text-right font-mono text-xs tabular-nums">{c.line}</TableCell>
          <TableCell className="break-words text-muted-foreground">{c.before ?? <><span aria-hidden="true">—</span><span className="sr-only">Added line</span></>}</TableCell>
          <TableCell className="break-words">{c.after ?? <><span aria-hidden="true">—</span><span className="sr-only">Removed line</span></>}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div> : <p className="text-muted-foreground">Blank lines only.</p>}
      {more > 0 && <p className="text-muted-foreground">{more} more changed {more === 1 ? 'line' : 'lines'} not shown</p>}
    </section>
    <p>{consequence(usedBy, nextVersion)}</p>
    <ErrorNotice message={error} />
  </div>;
}

export function DocumentDetail({ data }: { data: UsgDocumentView }) {
  const { document, usedBy, orgId } = data; const next = document.version + 1;
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(document.bodyMd);
  const [error, setError] = useState<string | null>(null); const [open, setOpen] = useState(false);
  const [diff, setDiff] = useState<LineDiff>({ changes: [], count: 0 }); const [baseVersion, setBaseVersion] = useState(document.version);
  const textarea = useRef<HTMLTextAreaElement>(null); const mutation = useConsoleMutation();

  useEffect(() => { if (editing) textarea.current?.focus(); }, [editing]);

  function startEditing() { setDraft(document.bodyMd); setBaseVersion(document.version); setError(null); mutation.clear(); setEditing(true); }
  function cancel() { setEditing(false); setError(null); }
  function review(event: FormEvent) {
    event.preventDefault(); setError(null);
    if (!draft.trim()) { setError('Enter the document text.'); return; }
    if (draft.length > MAX_LENGTH) { setError(`The text is ${draft.length.toLocaleString('en-US')} characters. Shorten it to ${MAX_LENGTH.toLocaleString('en-US')} or fewer.`); return; }
    if (draft === document.bodyMd) { setError(`No changes to publish. Edit the text, then review v${next}.`); return; }
    setDiff(lineDiff(document.bodyMd, draft)); mutation.clear(); setOpen(true);
  }
  function publish() {
    mutation.run(async () => {
      const result = await mutation.request(`/api/orgs/${orgId}/documents/${document.id}/versions`, 'POST', { bodyMd: draft, baseVersion }) as { version: number };
      return `Version ${result.version} published.`;
    }, () => { setOpen(false); setEditing(false); });
  }

  return <>
    <PageHeader title={document.title} action={<div className="flex flex-wrap gap-2"><BackToDocuments />
      {!editing && <Button type="button" onClick={startEditing}>Publish new version</Button>}</div>} />
    <ConsoleNav />
    <div className="space-y-6">
      <dl className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border pb-4">
        <div className="flex gap-2"><dt className="text-muted-foreground">Source</dt><dd>{document.sourceName}</dd></div>
        <div className="flex gap-2"><dt className="text-muted-foreground">Readable by</dt><dd>{TIERS[document.tier].name}</dd></div>
        <div className="flex gap-2"><dt className="text-muted-foreground">Version</dt><dd className="tabular-nums">v{document.version}</dd></div>
        <div className="flex gap-2"><dt className="text-muted-foreground">Used by</dt><dd><UsedByList users={usedBy} /></dd></div>
      </dl>
      <SuccessNotice message={mutation.success} />
      {editing ? <form onSubmit={review} noValidate className="space-y-4">
        <div><Label htmlFor="document-text">Text</Label>
          <Textarea ref={textarea} id="document-text" value={draft} onChange={e => setDraft(e.target.value)} rows={28} spellCheck={false}
            aria-invalid={!!error} aria-describedby={error ? 'document-text-error' : undefined} className="font-mono text-base leading-6" /></div>
        {error && <Alert variant="destructive" id="document-text-error"><CircleAlert aria-hidden="true" /><div><AlertTitle>Cannot review yet</AlertTitle><AlertDescription>{error}</AlertDescription></div></Alert>}
        <div className="flex flex-wrap gap-2"><Button type="submit">Review v{next}</Button><Button type="button" variant="ghost" onClick={cancel}>Cancel</Button></div>
      </form> : <DocumentBody text={document.bodyMd} />}
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-3xl" aria-describedby={undefined}>
      <DialogHeader><DialogTitle>Publish v{next} of {document.title}?</DialogTitle></DialogHeader>
      <DocumentReview diff={diff} usedBy={usedBy} nextVersion={next} error={mutation.error} />
      <DialogFooter><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Back to edit</Button><PendingButton pending={mutation.pending} onClick={publish}>Publish v{next}</PendingButton></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
