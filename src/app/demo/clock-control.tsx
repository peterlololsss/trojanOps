'use client';

import { useRef, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const confirmation = z.object({ now: z.iso.datetime({ offset: true }) });
const timestamp = z.iso.datetime({ offset: true });

export function ClockControl({ initialNow }: { readonly initialNow: string }) {
  const [draft, setDraft] = useState(initialNow);
  const [confirmed, setConfirmed] = useState(initialNow);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'long',
  }).format(new Date(confirmed));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    setError(null);
    setSaved(false);
    if (!timestamp.safeParse(draft).success) {
      setError('Enter an ISO timestamp with Z or a timezone offset, such as 2026-11-15T10:00:00-08:00.');
      return;
    }
    busy.current = true;
    setPending(true);
    try {
      const response = await fetch('/api/demo/clock', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ now: draft }), signal: AbortSignal.timeout(10000),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const details = z.object({ message: z.string().min(1) }).safeParse(body);
        setError(details.success ? details.data.message : 'The clock request failed. Try again.');
        return;
      }
      const result = confirmation.safeParse(body);
      if (!result.success) {
        setError('The server did not confirm the clock. Reload to check its time before retrying.');
        return;
      }
      setConfirmed(result.data.now);
      setSaved(true);
    } catch (cause) {
      if (!(cause instanceof TypeError || cause instanceof DOMException || cause instanceof SyntaxError)) throw cause;
      setError('Could not confirm the clock. Reload to check its time, then try again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <section aria-labelledby="clock-heading" className="space-y-4">
    <div className="space-y-2">
      <h2 id="clock-heading" className="text-xl font-semibold">Demo clock</h2>
      <p>Last confirmed server time</p>
      <p className="font-mono text-sm"><time dateTime={confirmed}>{formatted}</time></p>
      <p className="text-muted-foreground">The clock keeps advancing. Reload for the current time.
        A change affects all demo users in this server process, including quota periods.</p>
    </div>
    <form onSubmit={submit} className="space-y-3">
      <Label htmlFor="demo-now">Server time</Label>
      <Input id="demo-now" value={draft} onChange={(event) => setDraft(event.target.value)}
        disabled={pending} aria-describedby="clock-help" aria-invalid={Boolean(error)} />
      <p id="clock-help" className="text-sm text-muted-foreground">ISO timestamp with timezone:
        {' '}<code className="break-all">2026-11-15T10:00:00-08:00</code>. Times above use Pacific Time.</p>
      <Button type="submit" disabled={pending} className="min-w-32">{pending ? 'Setting clock…' : 'Set clock'}</Button>
      <p role="status" aria-live="polite">{pending ? 'Setting the server clock.' : saved ? 'Clock set. Time continues from the confirmed value.' : ''}</p>
      {error && <Alert variant="destructive"><AlertTitle>Clock not confirmed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    </form>
  </section>;
}
