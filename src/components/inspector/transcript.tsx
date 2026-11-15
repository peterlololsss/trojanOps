'use client';

// Owner: C (WP-9). The run transcript (ui-designer.md "Agent run page"): it reads like a document, not
// chat bubbles. Each turn has a small label ("You" or the agent name) and turns are separated by
// 1px rules. Replies are plain text, never HTML. Pending actions follow the turn that proposed them.
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { useId, useState } from 'react';
import type { RunResult } from '@/lib/contracts';
import { money, readCount } from './format';
import { PendingActionCard } from './pending-action-card';
import { citedSources, type ActionStatus, type Turn } from './run-state';

export interface TranscriptProps {
  turns: Turn[];
  actions: Record<string, ActionStatus>;
  agentName: string;
  /** The mock runtime answered: replies are labelled "Demo runtime: placeholder answer". */
  demoRuntime: boolean;
  onConfirm?: (id: string) => void;
  onReject?: (id: string) => void;
}

function TurnLabel({ children }: { children: string }) {
  return <p className="mb-[4px] text-[12px] font-semibold leading-4 text-muted-foreground">{children}</p>;
}

function AgentTurn({ result, agentName, demoRuntime, actions, onConfirm, onReject }: {
  result: RunResult;
  agentName: string;
  demoRuntime: boolean;
  actions: Record<string, ActionStatus>;
  onConfirm?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const sources = citedSources(result);
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <>
      <TurnLabel>{agentName}</TurnLabel>
      <p className="whitespace-pre-wrap break-words text-[16px] leading-6">{result.reply}</p>
      <div className="mt-[8px] flex flex-wrap items-center gap-x-[12px] gap-y-[4px] text-[12px] leading-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-[24px] items-center gap-[4px] rounded-sm border border-input bg-background px-[8px] font-semibold hover:bg-accent"
        >
          <Chevron aria-hidden className="size-[12px] shrink-0" />
          {demoRuntime ? 'Demo runtime: placeholder answer' : 'AI-generated'}
        </button>
        <span className="tabular-nums text-muted-foreground">{`${readCount(result.inspector.readInRun.length)} · ${money(result.inspector.costMicro)}`}</span>
      </div>
      <div id={listId} hidden={!open} className="mt-[8px] border-l-2 border-border pl-[12px]">
        <h3 className="text-[12px] font-semibold leading-4 text-muted-foreground">Sources for this answer</h3>
        {sources.length === 0 ? (
          <p className="py-[4px] text-muted-foreground">This answer cites no documents.</p>
        ) : (
          <ul>
            {sources.map((s, i) => (
              <li key={`${s.documentId}-${i}`} className="py-[4px]">
                <span className="flex items-center gap-[8px] font-semibold">
                  <FileText aria-hidden className="size-[16px] shrink-0 text-muted-foreground" />
                  <span className="break-words">{s.title}</span>
                </span>
                {s.quote && <q className="mt-[2px] block break-words pl-[24px] text-muted-foreground">{s.quote}</q>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {result.pendingActions.map((a) => (
        <PendingActionCard key={a.id} action={a} status={actions[a.id] ?? { status: 'pending' }} onConfirm={onConfirm} onReject={onReject} />
      ))}
    </>
  );
}

export function Transcript({ turns, actions, agentName, demoRuntime, onConfirm, onReject }: TranscriptProps) {
  if (turns.length === 0) {
    return (
      <div className="border-y border-border py-[16px]">
        <p className="font-semibold">{`No runs yet. Write a message below to run ${agentName}.`}</p>
        <p className="mt-[4px] text-muted-foreground">Each run checks your access first. The inspector then shows which documents the agent could read and what the run cost.</p>
      </div>
    );
  }
  return (
    <ol aria-label="Transcript" className="border-b border-border">
      {turns.map((turn) => (
        <li key={turn.key} className="border-t border-border py-[16px]">
          {turn.kind === 'you' ? (
            <>
              <TurnLabel>You</TurnLabel>
              <p className="whitespace-pre-wrap break-words text-[16px] leading-6">{turn.text}</p>
            </>
          ) : (
            <AgentTurn result={turn.result} agentName={agentName} demoRuntime={demoRuntime} actions={actions} onConfirm={onConfirm} onReject={onReject} />
          )}
        </li>
      ))}
    </ol>
  );
}
