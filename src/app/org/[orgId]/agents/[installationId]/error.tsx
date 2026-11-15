'use client';

// Owner: C (WP-9). Error boundary for the run page: a banner with a retry, never an empty state.
import { AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';

export default function AgentRunError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <>
      <PageHeader title="Agent" />
      <div role="alert" className="flex max-w-[720px] flex-wrap items-center gap-[12px] rounded-md border border-primary px-[16px] py-[16px]">
        <AlertCircle aria-hidden className="size-[16px] shrink-0 text-primary" />
        <p className="flex-1">Could not load this agent. Try again in a moment.</p>
        <Button variant="secondary" className="h-[36px] px-[16px]" onClick={retry}>Try again</Button>
      </div>
    </>
  );
}
