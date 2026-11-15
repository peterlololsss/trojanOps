'use client';

// The narrow panel beside the chat: empty until the first run, then that run's <Inspector />.
import { useId, type Ref } from 'react';
import { FileText } from 'lucide-react';
import type { RunInspector } from '@/lib/contracts';
import { cn } from '@/lib/utils';
import { Inspector } from './inspector';

export interface RunDetailsPanelProps {
  readonly inspector: RunInspector | null;
  readonly highlightedId?: string | null;
  readonly panelRef?: Ref<HTMLElement>;
  readonly className?: string;
}

export function RunDetailsPanel({ inspector, highlightedId, panelRef, className }: RunDetailsPanelProps) {
  const id = useId();
  return <aside ref={panelRef} tabIndex={-1} aria-labelledby={id} className={cn('w-full min-w-0 bg-background text-[14px] leading-5', className)}>
    <h2 id={id} className="border-b border-border px-4 py-3 text-[14px] font-semibold leading-5">Run details</h2>
    {inspector ? <Inspector inspector={inspector} highlightedId={highlightedId} /> : <div className="px-6 py-8">
      <FileText aria-hidden className="mb-4 size-6 text-muted-foreground" />
      <p className="font-semibold">No runs yet.</p>
      <p className="mt-2 max-w-prose text-muted-foreground">Send a message to see this run’s document access, sources and cost.</p>
    </div>}
  </aside>;
}
