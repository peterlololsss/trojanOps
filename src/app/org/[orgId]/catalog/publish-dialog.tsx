'use client';

// Owner: B (WP-7). D3: "Publish to all students" with the §8 confirmation in front of it.
//
// The confirmation is a native <dialog> opened with showModal(), so Escape, the focus trap and the
// backdrop come from the browser rather than from a component this stream does not own. The POST
// sends `{}` as application/json: the body may be empty, but the content-type check in parseBody is
// the cross-site write guard, so it is never left off.
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CatalogEntry } from '@/lib/distribution';
import { publishConfirmation, publishErrorMessage } from './catalog-view';

export function PublishButton({ orgId, orgName, clubLimitMicro, entry, onPublished }: {
  orgId: string;
  orgName: string;
  /** The club's monthly quota: §8's default budget is half of it. */
  clubLimitMicro: number;
  entry: CatalogEntry;
  onPublished: (name: string) => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const copy = publishConfirmation(entry, orgName, clubLimitMicro);
  const titleId = `publish-title-${entry.installationId}`;

  function publish() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/orgs/${orgId}/installations/${entry.installationId}/publish`,
          { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
        );
        if (!response.ok) {
          setError(await publishErrorMessage(response));
          return;
        }
        dialog.current?.close();
        onPublished(entry.name);
        router.refresh();
      } catch {
        setError('Could not reach the server. Check your connection and try again.');
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => { setError(null); dialog.current?.showModal(); }}>
        Publish to all students
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => setError(null)}
        className="m-auto w-[560px] max-w-[calc(100vw-48px)] rounded-md border border-border bg-background p-6 text-left text-foreground shadow-overlay backdrop:bg-foreground/50"
      >
        <h2 id={titleId} className="text-[20px] font-semibold leading-7">{copy.title}</h2>
        <ul className="mt-3 space-y-2">
          {copy.points.map((point) => (
            <li key={point} className="flex gap-2">
              <span aria-hidden className="text-muted-foreground">&middot;</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-primary p-3">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{error}</span>
          </p>
        )}
        <p role="status" className="mt-3 text-muted-foreground">{pending ? 'Publishing…' : ''}</p>
        <div className="mt-2 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={() => dialog.current?.close()}>Cancel</Button>
          <Button
            onClick={publish}
            aria-disabled={pending}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          >
            {pending ? 'Publishing…' : copy.confirm}
          </Button>
        </div>
      </dialog>
    </>
  );
}
