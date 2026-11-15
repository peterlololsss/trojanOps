// Owner: D. Makes another of the viewer's clubs active and reloads the current page in it, for an
// internal agent opened while a different club is active (gateway step 1).
'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { changeSession, SessionChangeError } from './session-request';

export function SwitchOrgButton({ orgId, orgName }: { readonly orgId: string; readonly orgName: string }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function switchOrg() {
    if (inFlight.current || pending) return;
    inFlight.current = true;
    setError(null);
    startTransition(async () => {
      try {
        await changeSession({ kind: 'org', orgId });
        startTransition(() => router.refresh());
      } catch (failure) {
        if (!(failure instanceof SessionChangeError)) throw failure;
        setError(failure.message);
      } finally {
        inFlight.current = false;
      }
    });
  }

  return <div className="mt-3">
    <Button type="button" variant="secondary" aria-busy={pending || undefined} onClick={switchOrg}>
      {pending ? `Switching to ${orgName}…` : `Switch to ${orgName}`}
    </Button>
    <p role="status" aria-live="polite" className={error ? 'mt-2 text-primary' : 'sr-only'}>{error ?? (pending ? `Switching to ${orgName}` : '')}</p>
  </div>;
}
