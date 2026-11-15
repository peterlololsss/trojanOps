'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Clock } from 'lucide-react';
import type { IndexStatus } from '@/lib/documents/fixtures';

export function indexStatusLabel(status: IndexStatus): string {
  switch (status.state) {
    case 'queued': return 'Queued';
    case 'indexing': return `Indexing ${status.done}/${status.total}`;
    case 'ready': return 'Ready';
    case 'error': return `Error · ${status.message}`;
    default: { const exhaustive: never = status; return exhaustive; }
  }
}

export function IndexStatusBadge({ status, name }: { readonly status: IndexStatus; readonly name?: string }) {
  const Icon = status.state === 'ready' ? Check : status.state === 'error' ? AlertCircle : Clock;
  return <span role="status" aria-live="polite" aria-label={name ? `${name}: ${indexStatusLabel(status)}` : undefined} title={status.state === 'error' ? status.fix : 'Demo index, not a live retrieval index'} className={`inline-flex items-center gap-1 text-sm ${status.state === 'ready' ? 'text-success' : status.state === 'error' ? 'text-primary' : 'text-muted-foreground'}`}><Icon aria-hidden className="size-4 shrink-0" />{indexStatusLabel(status)}</span>;
}

function ActiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    let polls = 0;
    const timer = setInterval(() => { router.refresh(); if (++polls >= 30) clearInterval(timer); }, 2000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}

export function IndexRefresh({ pending }: { readonly pending: boolean }) {
  return pending ? <ActiveRefresh /> : null;
}
