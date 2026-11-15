'use client';

// Owner: B (WP-7). D7: "Transfer" on an officer row, with the succession confirmation in front of
// it. The agents a position opens move with it, so the confirmation names them before the POST.
//
// A member is chosen rather than defaulted: the primary button hands an office to a named person,
// and the name has to be the president's choice, not the order the roster happens to be in.
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ClubAdmin, ClubMember, ClubPosition } from '@/lib/distribution';
import { transferConfirmation, writeErrorMessage } from './admin-view';

export function TransferButton({ data, position, candidates, onTransferred }: {
  data: ClubAdmin;
  position: ClubPosition;
  /** Members who do not already hold it: `transferCandidates`, called on the server. */
  candidates: ClubMember[];
  onTransferred: (message: string) => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [toUserId, setToUserId] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const chosen = candidates.find((member) => member.userId === toUserId) ?? null;
  const copy = chosen ? transferConfirmation(data, position, chosen) : null;
  const fieldId = `transfer-${position.slug}`;
  const errorId = `${fieldId}-error`;
  const titleId = `${fieldId}-title`;

  function open() {
    setToUserId('');
    setInvalid(null);
    setFailure(null);
    dialog.current?.showModal();
  }

  function transfer() {
    if (pending) return;
    if (!chosen) {
      setInvalid(`Choose the member who will take over as ${position.name}.`);
      document.getElementById(fieldId)?.focus();
      return;
    }
    setInvalid(null);
    setFailure(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/orgs/${data.org.id}/positions/${position.slug}/transfer`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ toUserId: chosen.userId }),
          },
        );
        if (!response.ok) {
          setFailure(await writeErrorMessage(response, 'This position could not be transferred.'));
          return;
        }
        dialog.current?.close();
        onTransferred(`${chosen.displayName} is now ${position.name} of ${data.org.name}.`);
        router.refresh();
      } catch {
        setFailure('Could not reach the server. Check your connection and try again.');
      }
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={open}>Transfer</Button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[560px] max-w-[calc(100vw-48px)] rounded-md border border-border bg-background p-6 text-left text-foreground shadow-overlay backdrop:bg-foreground/50"
      >
        <h2 id={titleId} className="text-[20px] font-semibold leading-7">
          {copy ? copy.title : `Transfer ${position.name}`}
        </h2>

        <div className="mt-4 max-w-[320px]">
          <label htmlFor={fieldId} className="block font-semibold">New holder</label>
          <select
            id={fieldId}
            value={toUserId}
            aria-describedby={invalid ? errorId : undefined}
            aria-invalid={invalid ? true : undefined}
            onChange={(current) => { setToUserId(current.target.value); setInvalid(null); }}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-primary"
          >
            <option value="">Not chosen yet</option>
            {candidates.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName}
                {member.positions.length > 0 ? ` · ${member.positions.map((held) => held.name).join(', ')}` : ''}
              </option>
            ))}
          </select>
          {invalid && (
            <p id={errorId} className="mt-1 flex items-start gap-2 text-primary">
              <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{invalid}</span>
            </p>
          )}
        </div>

        <div aria-live="polite" className="mt-4">
          {copy ? (
            <ul className="space-y-2">
              {copy.points.map((point) => (
                <li key={point} className="flex gap-2">
                  <span aria-hidden className="text-muted-foreground">&middot;</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              Choose a member to see which agents change hands with this position.
            </p>
          )}
        </div>

        {failure && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-primary p-3">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{failure}</span>
          </p>
        )}
        <p role="status" className="mt-3 text-muted-foreground">{pending ? 'Transferring the position…' : ''}</p>
        <div className="mt-2 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={() => dialog.current?.close()}>Cancel</Button>
          <Button
            onClick={transfer}
            aria-disabled={pending}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          >
            {pending ? 'Transferring…' : copy ? copy.confirm : `Transfer ${position.name}`}
          </Button>
        </div>
      </dialog>
    </>
  );
}
