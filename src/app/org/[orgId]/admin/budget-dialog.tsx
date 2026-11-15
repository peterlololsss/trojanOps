'use client';

// Owner: B (WP-7). D5: "Set limit" on a member's row, with the form that writes it.
//
// Like the catalog's publish confirmation, the overlay is a native <dialog> opened with
// showModal(), so Escape, the focus trap and the backdrop come from the browser rather than from a
// component this stream does not own. The PUT goes to stream A's /api/quota/limits with scope
// `member`: a president may set member and installation limits only, and a figure above the club's
// comes back 422 clamp_violation, whose message is shown as it is.
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ClubAdmin, ClubMember } from '@/lib/distribution';
import { budgetExplanation, budgetSaved, dollars, parseDollars, writeErrorMessage } from './admin-view';
import { creditLabel } from '@/lib/gateway/prices';

export function BudgetButton({ data, member, onSaved }: {
  data: ClubAdmin;
  member: ClubMember;
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  // An inherited member starts empty, not prefilled with the club's figure: saving that figure
  // would quietly give them a limit of their own, which then stops following the club's quota —
  // and nothing on this page can take it back. The empty-field error says what to type instead.
  const [amount, setAmount] = useState(() => (member.inherited ? '' : dollars(member.limitMicro)));
  const [touched, setTouched] = useState(false);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmZero, setConfirmZero] = useState(false);
  const liveAmount = parseDollars(amount, data.clubLimitMicro);
  const fieldId = `limit-${member.userId}`;
  const errorId = `${fieldId}-error`;
  const titleId = `${fieldId}-title`;

  // Opening the dialog, rather than an effect, is what re-reads the member's current limit: after
  // a save the page refreshes, and the next open starts from the figure the server now holds.
  function open() {
    setAmount(member.inherited ? '' : dollars(member.limitMicro));
    setTouched(false);
    setInvalid(null);
    setFailure(null);
    setConfirmZero(false);
    dialog.current?.showModal();
  }

  function save() {
    if (pending) return;
    const parsed = parseDollars(amount, data.clubLimitMicro);
    if ('error' in parsed) {
      setInvalid(parsed.error);
      document.getElementById(fieldId)?.focus();
      return;
    }
    setInvalid(null);
    if (parsed.micro === 0 && !confirmZero) { setConfirmZero(true); return; }
    setFailure(null);
    startTransition(async () => {
      try {
        const response = await fetch('/api/quota/limits', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            scope: 'member', orgId: data.org.id, userId: member.userId, limitMicro: parsed.micro,
          }),
        });
        if (!response.ok) {
          setFailure(await writeErrorMessage(response, 'This limit could not be saved.'));
          return;
        }
        dialog.current?.close();
        onSaved(budgetSaved(member, data, parsed.micro));
        router.refresh();
      } catch {
        setFailure('Could not reach the server. Check your connection and try again.');
      }
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={open}>Set limit</Button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[560px] max-w-[calc(100vw-48px)] rounded-md border border-border bg-background p-6 text-left text-foreground shadow-overlay backdrop:bg-foreground/50"
      >
        <h2 id={titleId} className="text-[20px] font-semibold leading-7">
          Monthly limit for {member.displayName}
        </h2>
        <ul className="mt-3 space-y-2">
          {budgetExplanation(member, data).map((point) => (
            <li key={point} className="flex gap-2">
              <span aria-hidden className="text-muted-foreground">&middot;</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 max-w-[240px]">
          <label htmlFor={fieldId} className="block font-semibold">Monthly limit</label>
          <div className="mt-1 flex h-9 items-center gap-1 rounded-md border border-input px-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
            <span aria-hidden className="text-muted-foreground">$</span>
            <input
              id={fieldId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              aria-describedby={invalid ? errorId : undefined}
              aria-invalid={invalid ? true : undefined}
              onChange={(current) => {
                setAmount(current.target.value);
                setConfirmZero(false);
                setTouched(true);
                if (invalid) setInvalid(null);
              }}
              onBlur={() => {
                if (!touched) return;
                const parsed = parseDollars(amount, data.clubLimitMicro);
                setInvalid('error' in parsed ? parsed.error : null);
              }}
              className="h-full w-full bg-background tabular-nums outline-none"
            />
          </div>
          {invalid && (
            <p id={errorId} className="mt-1 flex items-start gap-2 text-primary">
              <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{invalid}</span>
            </p>
          )}
        </div>

        <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">{'micro' in liveAmount ? `$${dollars(liveAmount.micro)} = ${creditLabel(liveAmount.micro)}. ` : ''}Up to {data.org.name}&apos;s budget, ${dollars(data.clubLimitMicro)}.</p>
        {confirmZero && <p role="alert" className="mt-4 rounded-md border border-primary p-3">Set {member.displayName}&apos;s allowance to $0.00? Their next run in {data.org.name} will be blocked until you raise it.</p>}
        {failure && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-primary p-3">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{failure}</span>
          </p>
        )}
        <p role="status" className="mt-3 text-muted-foreground">{pending ? 'Saving the limit…' : ''}</p>
        <div className="mt-2 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={() => dialog.current?.close()}>Cancel</Button>
          <Button
            onClick={save}
            aria-disabled={pending}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          >
            {pending ? 'Saving…' : confirmZero ? 'Confirm $0.00 allowance' : 'Save limit'}
          </Button>
        </div>
      </dialog>
    </>
  );
}
