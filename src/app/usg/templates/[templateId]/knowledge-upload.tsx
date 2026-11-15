'use client';

import { useState, type FormEvent } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { UploadDocumentInput } from '@/lib/documents/library';
import type { KnowledgeUpload } from '@/lib/distribution/usg-view';
import { ErrorNotice, PendingButton, selectClass, SuccessNotice, useConsoleMutation } from '../console-ui';
import { reviewKnowledgeUpload } from './knowledge-actions';

export function KnowledgeUploadDialog({ templateId, orgId, sources }: KnowledgeUpload & { readonly templateId: string }) {
  const [open, setOpen] = useState(false);
  const mutation = useConsoleMutation();
  const [review, setReview] = useState<{
    readonly input: UploadDocumentInput;
    readonly receipt: Awaited<ReturnType<typeof reviewKnowledgeUpload>>;
  } | null>(null);

  function addDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const source = sources.find(item => item.id === fields.get('source'));
    const title = String(fields.get('title') ?? '').trim();
    const file = fields.get('file');

    mutation.run(async () => {
      if (!source || !title || !(file instanceof File) || !/\.(md|txt)$/i.test(file.name)) {
        throw new Error('Enter a title and choose a Markdown or plain-text file.');
      }
      if (file.size > 400_000) throw new Error('Choose a text file with up to 100,000 characters.');
      const bodyMd = await file.text();
      if (!bodyMd.trim() || bodyMd.length > 100_000) {
        throw new Error('Choose a nonempty text file with up to 100,000 characters.');
      }

      const input: UploadDocumentInput = { title, sourceId: source.id, tier: 'public', allowedPositions: [], bodyMd };
      const receipt = await reviewKnowledgeUpload(templateId, input);
      setReview({ input, receipt });
      return '';
    });
  }

  function upload() {
    if (!review) return;
    mutation.run(async () => {
      await reviewKnowledgeUpload(templateId, review.input);
      await mutation.request(`/api/orgs/${orgId}/documents`, 'POST', review.input);
      return `${review.receipt.title} added to ${review.receipt.sourceName}.`;
    }, () => { setReview(null); setOpen(false); });
  }

  return <div>
    <Dialog open={open} onOpenChange={value => { if (!mutation.pending) { setOpen(value); setReview(null); mutation.clear(); } }}>
      <DialogTrigger asChild><Button><Upload aria-hidden />Add document</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{review ? 'Review document access' : 'Add a rulebook document'}</DialogTitle>
          <DialogDescription>Any signed-in student can read this document. Agents connected to this shared source can use it on their next run.</DialogDescription>
        </DialogHeader>
        {review ? <div className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="font-semibold">Document</dt><dd>{review.receipt.title}</dd>
            <dt className="font-semibold">Source</dt><dd>{review.receipt.sourceName}</dd>
            <dt className="font-semibold">Who can read</dt><dd>{review.receipt.whoCanRead}</dd>
          </dl>
          <p className="text-muted-foreground">Adding this document updates the shared library for every connected agent immediately.</p>
          <ErrorNotice message={mutation.error} />
          <DialogFooter><Button variant="secondary" disabled={mutation.pending} onClick={() => { setReview(null); mutation.clear(); }}>Back</Button>
            <PendingButton pending={mutation.pending} onClick={upload}>Add public document</PendingButton></DialogFooter>
        </div> : <form onSubmit={addDocument} className="space-y-4">
          <div><Label htmlFor="knowledge-upload-title">Title</Label><Input id="knowledge-upload-title" name="title" required maxLength={200} /></div>
          <div><Label htmlFor="knowledge-upload-source">Source</Label>
            <select id="knowledge-upload-source" name="source" className={selectClass} required>
              {sources.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}
            </select>
          </div>
          <div><Label htmlFor="knowledge-upload-file">Text file</Label>
            <Input id="knowledge-upload-file" name="file" type="file" accept=".md,.txt" required className="h-auto py-2" aria-describedby="knowledge-upload-help" />
            <p id="knowledge-upload-help" className="mt-1 text-sm text-muted-foreground">Markdown or plain text, up to 100,000 characters.</p>
          </div>
          <ErrorNotice message={mutation.error} />
          <DialogFooter>
            <Button variant="secondary" disabled={mutation.pending} onClick={() => setOpen(false)}>Cancel</Button>
            <PendingButton type="submit" pending={mutation.pending}>Review access</PendingButton>
          </DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
    <SuccessNotice message={mutation.success} />
  </div>;
}
