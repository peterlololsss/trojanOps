'use client';

// Owner: B. Shared presentational controls within the USG console.
import Link from 'next/link';
import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CircleAlert, LockKeyhole } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const money = (micro: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(micro / 1_000_000);
export const absoluteTime = (iso: string | null) => iso ? new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Los_Angeles',
}).format(new Date(iso)) + ' PT' : 'Not published';
export const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
export const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm';
export const chipClass = 'inline-flex items-center gap-1 rounded-sm border border-border px-2 text-xs';

export function DeniedConsole() {
  return <Alert><LockKeyhole aria-hidden="true" /><div><AlertTitle>USG administrator access required</AlertTitle>
    <AlertDescription>Use a USG administrator account with USG active. Contact a USG administrator if you need access.
      <Link href="/" className="ml-1 text-primary underline">Choose a persona or active organization</Link>
    </AlertDescription></div></Alert>;
}
export function ErrorNotice({ message }: { message: string | null }) {
  return message ? <Alert variant="destructive"><CircleAlert aria-hidden="true" /><div><AlertTitle>Could not save</AlertTitle>
    <AlertDescription>{message}</AlertDescription></div></Alert> : null;
}
export function SuccessNotice({ message }: { message: string | null }) {
  return message ? <p role="status" className="flex items-center gap-2 text-success"><Check aria-hidden="true" className="size-4" />{message}</p> : null;
}
export function useConsoleMutation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  async function request(url: string, method: string, body: unknown): Promise<unknown> {
    const response = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.message ?? 'The server could not save this change. Refresh and try again.');
    return result;
  }
  function run(action: () => Promise<string>, done?: () => void) {
    if (pending) return;
    setError(null); setSuccess(null);
    startTransition(async () => {
      try { const message = await action(); setSuccess(message); done?.(); router.refresh(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not reach the server. Check your connection and try again.'); }
    });
  }
  return { pending, error, success, request, run, clear: () => { setError(null); setSuccess(null); } };
}
export function PendingButton({ pending, children, ...props }: React.ComponentProps<typeof Button> & { pending: boolean }) {
  return <Button type="button" {...props} aria-disabled={pending} className="aria-disabled:cursor-wait aria-disabled:opacity-50">{pending ? 'Saving…' : children}</Button>;
}
export function SearchBar({ value, onChange, count, placeholder = 'Search by name' }: {
  value: string; onChange: (value: string) => void; count: number; placeholder?: string;
}) {
  return <div className="flex items-end justify-between gap-4"><div className="w-full max-w-sm"><label htmlFor="console-search" className="mb-1 block font-semibold">Search</label>
    <Input id="console-search" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></div>
    <p role="status" className="whitespace-nowrap text-muted-foreground">{count} results{value && <Button type="button" variant="link" className="ml-2" onClick={() => onChange('')}>Clear filters</Button>}</p></div>;
}
export function Pagination({ page, setPage, total, pageSize = 10 }: { page: number; setPage: (page: number) => void; total: number; pageSize?: number }) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  return <div className="flex items-center justify-end gap-3"><span className="text-muted-foreground">Page {page} of {last}</span>
    <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
    <Button type="button" variant="secondary" size="sm" disabled={page >= last} onClick={() => setPage(page + 1)}>Next</Button></div>;
}
export function ConsoleNav() {
  return <nav aria-label="USG distribution" className="mb-6 flex flex-wrap gap-4 border-b border-border pb-3">
    <Link className="text-primary underline" href="/usg/templates">Templates</Link><Link className="text-primary underline" href="/usg/clubs">Clubs</Link><Link className="text-primary underline" href="/usg/documents">Documents</Link>
  </nav>;
}
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-4 rounded-md border border-border p-4"><h2 className="text-xl font-semibold leading-7">{title}</h2>{children}</section>;
}
export function BackToTemplates() { return <Link className={buttonVariants({ variant: 'secondary' })} href="/usg/templates">All templates</Link>; }
