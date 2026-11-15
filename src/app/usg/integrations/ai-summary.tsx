'use client';
// Owner: D. Shows a short named loading step, then fades the summary text in. Reduced motion skips the pulse and fade.
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const REVEAL_AFTER_MS = 1200;

export function AiSummary({ text }: { readonly text: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), REVEAL_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  return <div aria-live="polite" aria-busy={!ready}>
    {ready
      ? <p className="text-base leading-relaxed transition-opacity duration-500 starting:opacity-0 motion-reduce:transition-none">{text}</p>
      : <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Summarizing members, documents and quotas</p>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>}
  </div>;
}
