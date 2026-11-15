'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Tier } from '@/lib/contracts';
import type { LibraryPageData } from '@/lib/documents/library-page';
import { uploadErrorMessage } from '@/lib/documents/upload-error';

export const tierLabels: Record<Tier, string> = {
  public: 'Public', members: 'Members', officers: 'Officers', usg_internal: 'USG internal',
};
export const fieldClass = 'h-9 w-full rounded-md border border-input bg-background px-3';

export function UploadForm({ data }: { data: LibraryPageData }) {
  const router = useRouter();
  const [tier, setTier] = useState<Tier>('members');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || pending) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    submitting.current = true;
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/orgs/${data.org.id}/documents`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: fields.get('title'), sourceId: fields.get('sourceId'), tier,
            allowedPositions: tier === 'officers' ? fields.getAll('allowedPositions') : [],
            bodyMd: fields.get('bodyMd'),
          }),
        });
        if (!response.ok) {
          setError(await uploadErrorMessage(response));
          return;
        }
        form.reset();
        setTier('members');
        setSuccess(true);
        router.refresh();
      } catch {
        setError('Could not reach the server. Check your connection and try again.');
      } finally {
        submitting.current = false;
      }
    });
  }

  if (data.sources.length === 0) {
    return <p className="rounded-md border border-border bg-muted p-3">No upload sources are configured for {data.org.name}. Ask a platform administrator to add a source.</p>;
  }

  return (
    <details className="rounded-md border border-border">
      <summary className="cursor-pointer px-4 py-3 font-semibold text-primary">Upload document</summary>
      <form onSubmit={submit} className="max-w-[640px] space-y-4 px-4 pb-4" aria-busy={pending}>
        <p className="text-muted-foreground">Add Markdown text to {data.org.name}. Choose who can read it before uploading.</p>
        <fieldset disabled={pending} className="space-y-4">
          <label className="block space-y-1"><span className="block font-semibold">Title</span>
            <input name="title" required maxLength={200} className={fieldClass} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1"><span className="block font-semibold">Source</span>
              <select name="sourceId" required className={fieldClass}>
                {data.sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
              </select>
            </label>
            <label className="block space-y-1"><span className="block font-semibold">Access tier</span>
              <select value={tier} onChange={(event) => setTier(event.target.value as Tier)} className={fieldClass}>
                {Object.entries(tierLabels).filter(([value]) => value !== 'usg_internal' || data.org.kind === 'usg')
                  .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <p className="text-muted-foreground">{tier === 'public' ? 'Any signed-in student can read this document.'
            : tier === 'members' ? `Members of ${data.org.name} can read this document.`
              : tier === 'usg_internal' ? 'USG admins and reviewers can read this document.'
                : 'The president can read this document. Select additional officer positions below; leaving all unchecked limits access to the president.'}</p>
          {tier === 'officers' && (
            <fieldset className="space-y-2"><legend className="mb-1 font-semibold">Officer positions</legend>
              {data.positions.map((position) => (
                <label key={position.slug} className="flex items-center gap-2">
                  <input type="checkbox" name="allowedPositions" value={position.slug} className="size-4 accent-primary" />
                  {position.name}
                </label>
              ))}
            </fieldset>
          )}
          <label className="block space-y-1"><span className="block font-semibold">Markdown text</span>
            <textarea name="bodyMd" required maxLength={100_000} rows={8} className="w-full rounded-md border border-input bg-background p-3 font-mono" />
          </label>
        </fieldset>
        {error && <p role="alert" className="flex items-start gap-2 text-primary"><AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />{error}</p>}
        <p role="status" className="flex items-start gap-2 text-muted-foreground">
          {pending ? 'Uploading document…' : success && <><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />Document uploaded. The library shows documents your current positions can read.</>}
        </p>
        <Button type="submit" aria-disabled={pending}><Upload aria-hidden />{pending ? 'Uploading…' : 'Upload document'}</Button>
      </form>
    </details>
  );
}
