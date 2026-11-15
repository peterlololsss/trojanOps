'use client';

import Link from 'next/link';
import { AlertCircle, Info } from 'lucide-react';
import type { RunInspector } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { AnswerTurn } from './answer-turn';
import type { ActionStatus, Turn } from './run-state';

export interface TranscriptProps {
  readonly turns: Turn[]; readonly actions: Record<string, ActionStatus>;
  readonly agentName: string;
  readonly onConfirm?: (id: string) => void; readonly onReject?: (id: string) => void;
  readonly onRetry?: (input: string) => void; readonly onEdit?: (input: string) => void;
  readonly installationId?: string; readonly orgId?: string;
  readonly playingId?: string | null; readonly stoppedId?: string | null;
  readonly onPlaybackDone?: () => void; readonly onInspect?: (documentId: string, runId: string) => void;
  readonly onAnnounce?: (message: string) => void;
}

function changes(before: RunInspector | null, after: RunInspector): string[] {
  if (!before) return [];
  const notes: string[] = [];
  const removed = [...new Set(before.runGrants.filter((g) => !after.runGrants.some((a) => a.grant === g.grant)).map((g) => g.label))];
  if (removed.length) notes.push(`Your access changed since your last run: ${removed.join(', ')} no longer applies.`);
  if (after.rulePack && before.rulePack?.version !== after.rulePack.version) notes.push(`${after.rulePack.label} is now v${after.rulePack.version}.`);
  for (const doc of after.permitted) {
    const old = before.permitted.find((d) => d.id === doc.id);
    if (old && (doc.version ?? 1) > (old.version ?? 1)) notes.push(`${doc.title} is now v${doc.version}.`);
  }
  if (before.templateVersion !== after.templateVersion) notes.push(`The agent was updated to template v${after.templateVersion}.`);
  return notes;
}

export function Transcript(p: TranscriptProps) {
  if (!p.turns.length) return null;
  return <ol aria-label="Transcript" className="space-y-8">{p.turns.map((turn, index) => {
    const previous = p.turns.slice(0, index).findLast((t) => t.kind === 'agent')?.result.inspector ?? null;
    const question = p.turns.slice(0, index).findLast((t) => t.kind === 'you')?.text ?? '';
    switch (turn.kind) {
      case 'you':
        return <li key={turn.key} className="flex justify-end"><div className="max-w-[85%] rounded-md bg-muted px-4 py-3"><p className="mb-1 text-right text-[12px] font-semibold leading-4 text-muted-foreground">You</p><p className="whitespace-pre-wrap break-words text-[16px] leading-6 [overflow-wrap:anywhere]">{turn.text}</p></div></li>;
      case 'note': {
        const input = question;
        const blocked = ['quota_exceeded', 'forbidden', 'unauthenticated', 'clamp_violation', 'not_found'].includes(turn.error.code);
        return <li key={turn.key} className="my-3 rounded-md border border-border bg-muted p-4" role="alert"><p className="flex items-center gap-2 font-semibold"><AlertCircle aria-hidden className="size-4 text-primary" />{turn.error.code === 'quota_exceeded' ? 'Blocked before the agent ran' : blocked ? 'Blocked by the access check' : "Couldn't get an answer"}</p><p className="mt-2">{turn.error.message}</p><p className="mt-1 text-sm text-muted-foreground">{blocked ? 'Nothing was charged.' : 'If the run went through, it was billed and recorded.'}</p>
          {turn.error.code === 'unauthenticated' && <Link href="/" className="text-primary underline">Choose a persona</Link>}
          {turn.retry && <Button type="button" variant="secondary" className="mt-2" onClick={() => p.onRetry?.(input)}>Try again</Button>}
          {blocked && p.onEdit && <Button type="button" variant="ghost" onClick={() => p.onEdit?.(input)}>Edit message</Button>}
        </li>;
      }
      case 'agent': {
        const notes = changes(previous, turn.result.inspector);
        return <li key={turn.key} className="mr-auto min-w-0 py-1">{notes.map((note) => <p key={note} className="mb-4 flex items-start gap-2 bg-muted p-3 text-sm"><Info aria-hidden className="mt-0.5 size-4 shrink-0" />{note}</p>)}<AnswerTurn result={turn.result} agentName={p.agentName} actions={p.actions} onConfirm={p.onConfirm} onReject={p.onReject}
          installationId={p.installationId} orgId={p.orgId} playing={p.playingId === turn.result.runId} stopped={p.stoppedId === turn.result.runId} onDone={p.onPlaybackDone} onInspect={p.onInspect ? (id) => p.onInspect?.(id, turn.result.runId) : undefined}
          onDetails={p.onInspect ? () => p.onInspect?.('', turn.result.runId) : undefined} onAnnounce={p.onAnnounce} /></li>;
      }
      default: { const exhaustive: never = turn; return exhaustive; }
    }
  })}</ol>;
}
