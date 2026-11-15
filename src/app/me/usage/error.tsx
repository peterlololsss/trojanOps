'use client';
import { Button } from '@/components/ui/button';

export default function UsageError({ reset }: { readonly reset: () => void }) {
  return <div role="alert" className="rounded-md border border-primary p-4"><p>Couldn&apos;t load your usage. Try again in a moment.</p><Button type="button" variant="secondary" className="mt-3" onClick={reset}>Try again</Button></div>;
}
