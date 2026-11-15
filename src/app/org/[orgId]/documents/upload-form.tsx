'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { fieldClass } from '@/components/inspector/field';
import type { Tier } from '@/lib/contracts';
import type { LibraryPageData } from '@/lib/documents/library-page';
import { tierOptions } from '@/lib/documents/library-view';
import { reviewDocumentUpload, type ReviewReceipt } from '@/lib/documents/knowledge-actions';
import type { UploadDocumentInput } from '@/lib/documents/library';
import { uploadErrorMessage } from '@/lib/documents/upload-error';
import { accessDecisions } from '@/components/inspector/access-labels';

export function UploadForm({ data }: { readonly data: LibraryPageData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<Tier>('members');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previous, setPrevious] = useState<UploadDocumentInput | null>(null);
  const [review, setReview] = useState<{ readonly receipt: ReviewReceipt; readonly draft: UploadDocumentInput } | null>(null);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);

  function details(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const fields = new FormData(event.currentTarget);
    const value = (name: string) => { const entry = fields.get(name); return typeof entry === 'string' ? entry : ''; };
    const draft: UploadDocumentInput = { title: value('title'), sourceId: value('sourceId'), tier,
      allowedPositions: tier === 'officers' ? fields.getAll('allowedPositions').filter((p): p is string => typeof p === 'string') : [], bodyMd: value('bodyMd') };
    submitting.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await reviewDocumentUpload(data.org.id, draft);
        if (result.ok) { setPrevious(draft); setReview({ receipt: result.receipt, draft }); }
        else setError(result.message);
      } catch (cause) {
        if (cause instanceof Error) setError('Could not reach the server. Try reviewing again.');
        else throw cause;
      } finally { submitting.current = false; }
    });
  }

  function upload() {
    if (!review || submitting.current) return;
    submitting.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/orgs/${data.org.id}/documents`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(review.draft) });
        if (!response.ok) { setError(await uploadErrorMessage(response)); return; }
        setOpen(false); setReview(null); setSuccess(true); router.refresh();
      } catch (cause) {
        if (cause instanceof Error) setError('Could not reach the server. Check your connection and try again.');
        else throw cause;
      } finally { submitting.current = false; }
    });
  }

  if (!data.sources.length) return <p className="rounded-md border border-border bg-muted p-3">No upload sources are configured for {data.org.name}. Ask a platform administrator to add a source.</p>;
  return <div><Sheet open={open} onOpenChange={(value) => { if (!pending) { setOpen(value); setError(null); } }}>
    <SheetTrigger asChild><Button onClick={() => { setReview(null); setPrevious(null); setTier('members'); setSuccess(false); }}><Upload aria-hidden />Upload document</Button></SheetTrigger>
    <SheetContent className="max-w-[680px]">
      <SheetHeader><SheetTitle>Upload document</SheetTitle><SheetDescription>{review ? 'Review access before saving. Nothing has been uploaded yet.' : `Add Markdown text to ${data.org.name}. 1. Details · 2. Review access`}</SheetDescription></SheetHeader>
      {!review ? <form onSubmit={details} className="space-y-4" aria-busy={pending}>
        <label className="block space-y-1"><span className="font-semibold">Title</span><input name="title" defaultValue={previous?.title} required maxLength={200} readOnly={pending} className={fieldClass} /></label>
        <label className="block space-y-1"><span className="font-semibold">Source</span><select name="sourceId" defaultValue={previous?.sourceId} required disabled={pending} className={fieldClass}>{data.sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="block space-y-1"><span className="font-semibold">Who can read</span><select value={tier} disabled={pending} onChange={(e) => { const option = tierOptions(data.org.kind).find((t) => t.value === e.target.value); if (option) setTier(option.value); }} className={fieldClass}>{tierOptions(data.org.kind).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
        <p className="text-sm text-muted-foreground">{tier === 'public' ? 'Any signed-in student can read this document.' : tier === 'members' ? 'All club members can read this document.' : tier === 'usg_internal' ? 'Only USG reviewers and admins can read this document.' : 'The president always has access. Select additional officer positions.'}</p>
        {tier === 'officers' && <fieldset className="space-y-2"><legend className="mb-2 font-semibold">Officer positions</legend>{data.positions.filter((p) => p.slug !== 'president').map((p) => <label key={p.slug} className="flex min-h-9 items-center gap-2"><input type="checkbox" name="allowedPositions" value={p.slug} defaultChecked={previous?.allowedPositions.includes(p.slug)} disabled={pending} className="size-4 accent-primary" />{p.name}</label>)}</fieldset>}
        <label className="block space-y-1"><span className="font-semibold">Markdown text</span><textarea name="bodyMd" defaultValue={previous?.bodyMd} required maxLength={100_000} rows={10} readOnly={pending} className="w-full rounded-md border border-input bg-background p-3 font-mono text-sm" /></label>
        <Button type="submit" disabled={pending}>{pending ? 'Reviewing…' : 'Review access'}</Button>
      </form> : <section className="space-y-5" aria-label="Review access">
        <h2 className="text-lg font-semibold">{review.receipt.title}</h2><div><h3 className="font-semibold">Who can read</h3><p>{review.receipt.whoCanRead}</p></div>
        <div><h3 className="mb-2 font-semibold">Agents that can use this document</h3><ul className="divide-y divide-border">{review.receipt.agents.map((a) => { const decision = accessDecisions[a.reason]; const Icon = decision.icon; return <li key={a.id} className="py-3"><p className="font-semibold">{a.name}</p><p className="mt-1 flex items-start gap-2 text-sm"><Icon aria-hidden className="mt-0.5 size-4 shrink-0" />{decision.label}{a.positions.length ? ` for ${a.positions.join(', ')}` : ''}</p></li>; })}</ul>{!review.receipt.agents.length && <p>No agents are configured yet.</p>}</div>
        <p className="rounded-md border border-border bg-muted p-3 text-sm">Demo index · {review.receipt.chunks.length} chunks · split at headings, up to 800 characters · no embeddings.{review.draft.bodyMd.trim().length < 40 ? ' This text is too short to index. Add at least 40 characters.' : ' Indexing starts after upload.'}</p>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={pending} onClick={() => setReview(null)}>Back to details</Button><Button disabled={pending} onClick={upload}>{pending ? 'Uploading…' : 'Upload document'}</Button></div>
      </section>}
      {error && <p role="alert" className="flex items-start gap-2 text-primary"><AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />{error}</p>}
    </SheetContent>
  </Sheet><p role="status" className="mt-2 text-sm text-muted-foreground">{success ? 'Document uploaded. The demo index is processing; only permitted readers can see it.' : ''}</p></div>;
}
