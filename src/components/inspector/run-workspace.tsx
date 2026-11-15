'use client';

import { AlertCircle, ArrowUpRight, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import type { ApiError, ModelClass } from '@/lib/contracts';
import type { ChatConfig } from '@/lib/documents/run-config';
import { refreshRunContext } from '@/lib/documents/run-actions';
import { creditLabel } from '@/lib/gateway/prices';
import { cn } from '@/lib/utils';
import { AgentHeader, CHAT_COLUMN as COLUMN, type AgentHeaderProps } from './agent-header';
import { Composer } from './composer';
import { RunDetailsPanel } from './run-details-panel';
import { canConfirm, canReject, initialRunState, latestInspector, requestConfirm, requestReject, requestRun, runReducer } from './run-state';
import { Transcript } from './transcript';

export interface RunWorkspaceProps {
  readonly installationId: string; readonly agentName: string;
  readonly config?: ChatConfig;
  /** Source, version, tags and description shown under the agent's name. */
  readonly header?: Omit<AgentHeaderProps, 'name' | 'action' | 'className'>;
  /** Fill the parent's height (the My agents workspace). Otherwise the viewport less `headerSpacePx`. */
  readonly fill?: boolean;
  readonly headerSpacePx?: number;
}

export function validateInput(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.length) return 'Write a message before you run the agent.';
  return trimmed.length > 8000 ? `Messages can be up to 8,000 characters. Shorten this one by ${(trimmed.length - 8000).toLocaleString('en-US')}.` : null;
}

export function RunErrorBanner({ error, onDismiss }: { readonly error: ApiError; readonly onDismiss?: () => void }) {
  return <div role="alert" className="mb-3 flex flex-wrap items-start gap-2 rounded-md border border-primary bg-background px-4 py-3"><AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" /><p className="min-w-0 flex-1">{error.message}{error.code === 'unauthenticated' && <>{' '}<Link href="/" className="text-primary underline">Choose a persona</Link></>}</p><Button type="button" variant="ghost" onClick={onDismiss}>Dismiss</Button></div>;
}

export function RunWorkspace({ installationId, agentName, config, header, fill = false, headerSpacePx = 96 }: RunWorkspaceProps) {
  const frameStyle: (CSSProperties & { readonly '--workspace-height': string }) | undefined = fill ? undefined : { '--workspace-height': `max(480px, calc(100dvh - ${headerSpacePx}px))` };
  const [state, dispatch] = useReducer(runReducer, initialRunState);
  const [context, setContext] = useState(config);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<ModelClass>(config?.models.defaultClass ?? 'economy');
  const [inputError, setInputError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [stoppedId, setStoppedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [charge, setCharge] = useState<number | null>(null);
  const inFlight = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const panelRef = useRef<HTMLElement>(null);
  const chargeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = state.turns.find((turn) => turn.kind === 'agent' && turn.result.runId === selectedRunId);
  const inspector = selected?.kind === 'agent' ? selected.result.inspector : latestInspector(state);
  const playbackDone = useCallback(() => setPlayingId(null), []);
  useEffect(() => {
    if (!playingId) return;
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) { setStoppedId(playingId); setPlayingId(null); setAnnouncement('Stopped showing the answer. The run had already finished.'); }
    }
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [playingId]);
  useEffect(() => () => { if (chargeTimer.current) clearTimeout(chargeTimer.current); }, []);
  // Keep the newest text in view while an answer plays, unless the reader scrolled up.
  useEffect(() => {
    const box = scroller.current;
    const inner = content.current;
    if (!box || !inner || typeof ResizeObserver === 'undefined') return;
    const onScroll = () => { pinned.current = box.scrollHeight - box.scrollTop - box.clientHeight < 48; };
    const observer = new ResizeObserver(() => { if (pinned.current) box.scrollTop = box.scrollHeight; });
    box.addEventListener('scroll', onScroll, { passive: true });
    observer.observe(inner);
    return () => { observer.disconnect(); box.removeEventListener('scroll', onScroll); };
  }, []);
  useEffect(() => {
    const box = scroller.current;
    if (!state.turns.length || !box) return;
    pinned.current = true;
    box.scrollTop = box.scrollHeight;
  }, [state.turns.length]);
  useEffect(() => {
    if (highlightedId) panelRef.current?.querySelector('[data-highlighted]')?.scrollIntoView({ block: 'nearest' });
  }, [highlightedId, selectedRunId]);

  function refresh() {
    if (!config) return;
    void refreshRunContext(installationId).then((next) => {
      if (next) { setContext(next); setModel((current) => next.models.allowed.some((m) => m.modelClass === current) ? current : next.models.defaultClass); }
    }, () => setAnnouncement('The run finished. Reload the page to refresh allowance details.'));
  }

  async function run(text: string) {
    if (inFlight.current || playingId) return;
    const problem = validateInput(text);
    setInputError(problem);
    if (problem) { textarea.current?.focus(); return; }
    inFlight.current = true;
    dispatch({ type: 'submit', text: text.trim() });
    setInput(''); setAnnouncement('Checking access and quota');
    try {
      const event = await requestRun(fetch, installationId, text.trim(), "Couldn't get an answer. Check your connection and try again.", model);
      dispatch(event);
      if (event.type === 'succeeded') {
        setSelectedRunId(event.result.runId); setHighlightedId(null);
        setPlayingId(event.result.runId); setStoppedId(null); setCharge(event.result.inspector.costMicro);
        if (chargeTimer.current) clearTimeout(chargeTimer.current);
        chargeTimer.current = setTimeout(() => setCharge(null), 2000);
        const balances = Object.values(event.result.inspector.quotaRemainingMicro);
        const left = balances.length ? Math.min(...balances) : undefined;
        if (left !== undefined) setContext((current) => current ? { ...current, quota: { ...current.quota, remainingMicro: left, spentMicro: Math.max(0, current.quota.limitMicro - left) } } : current);
        setAnnouncement(`${agentName} answered. Read ${event.result.inspector.readInRun.length} documents. ${creditLabel(event.result.inspector.costMicro)} used. ${left === undefined ? '' : `${creditLabel(left)} left.`}`);
      } else if (event.type === 'failed') setAnnouncement(event.error.message);
      refresh();
    } finally { inFlight.current = false; }
  }

  async function confirm(id: string) {
    if (!canConfirm(state.actions[id])) return;
    dispatch({ type: 'confirm_started', id });
    dispatch(await requestConfirm(fetch, id, 'Could not confirm this action. Check your connection and try again.'));
  }
  async function reject(id: string) {
    if (!canReject(state.actions[id])) return;
    dispatch({ type: 'reject_started', id });
    dispatch(await requestReject(fetch, id, 'Could not reject this action. Check your connection and try again.'));
  }
  function prefill(value: string) { setInput(value); setInputError(null); textarea.current?.focus(); }
  function stop() { setStoppedId(playingId); setPlayingId(null); setAnnouncement('Stopped showing the answer. The run had already finished.'); }
  function reset() {
    if (state.running || playingId) return;
    dispatch({ type: 'reset' }); setInput(''); setModel(context?.models.defaultClass ?? 'economy'); setStoppedId(null); setSelectedRunId(null); setHighlightedId(null); setInputError(null); setCharge(null); setAnnouncement('New conversation. Earlier messages will not be sent.');
  }
  function inspect(documentId: string, runId: string) {
    setSelectedRunId(runId); setHighlightedId(documentId || null);
    panelRef.current?.focus({ preventScroll: true });
  }

  const busy = state.running || Boolean(playingId);
  const starters = !state.turns.length ? context?.starters ?? [] : [];
  return <div style={frameStyle} className={cn('flex min-w-0 flex-col lg:flex-row', fill ? 'min-h-0 flex-1' : 'w-full lg:h-(--workspace-height)')}>
    <section aria-label={`Chat with ${agentName}`} className="flex min-h-[480px] min-w-0 flex-1 flex-col lg:min-h-0">
      <div className="shrink-0 border-b border-border py-4">
        <AgentHeader className={COLUMN} name={agentName} {...header} description={state.turns.length || !starters.length ? header?.description : undefined}
          action={state.turns.length > 0 && <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={reset}>New conversation</Button>} />
      </div>
      <div ref={scroller} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div ref={content} className={cn(COLUMN, 'py-6', !state.turns.length && 'my-auto')}>
          <Transcript turns={state.turns} actions={state.actions} agentName={agentName} installationId={installationId} orgId={context?.orgId} onConfirm={(id) => void confirm(id)} onReject={(id) => void reject(id)} onRetry={(text) => void run(text)} onEdit={prefill} playingId={playingId} stoppedId={stoppedId} onPlaybackDone={playbackDone} onAnnounce={setAnnouncement} onInspect={inspect} />
          {starters.length > 0 && <section className="mx-auto max-w-lg py-8">
            <h2 className="text-xl font-semibold leading-7">What would you like to work on?</h2>
            {header?.description && <p className="mt-2 text-base leading-6 text-muted-foreground">{header.description}</p>}
            <div role="group" aria-label="Suggested questions" className="mt-6 divide-y divide-border border-y border-border">
              {starters.map((starter) => <button key={starter} type="button" onClick={() => prefill(starter)} className="flex min-h-12 w-full items-center justify-between gap-4 px-3 py-3 text-left hover:bg-accent [overflow-wrap:anywhere]">
                <span>{starter}</span><ArrowUpRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              </button>)}
            </div>
          </section>}
          {state.running && <div data-run-activity="checking" className="mt-6 space-y-3 rounded-md border border-border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" /><span>Checking access and quota</span></div>
            <div aria-hidden className="h-1 overflow-hidden bg-muted"><div className="h-full w-1/2 bg-primary motion-safe:animate-pulse" /></div>
          </div>}
          <p aria-live="polite" role="status" className="sr-only">{announcement}</p>
        </div>
      </div>
      <div className={cn(COLUMN, 'shrink-0 pb-4')}>
        <Composer config={context} agentName={agentName} input={input} model={model} running={state.running} playing={Boolean(playingId)} error={inputError} charge={charge} textareaRef={textarea} onInput={(value) => { setInput(value); if (inputError) setInputError(validateInput(value)); }} onModel={setModel} onRun={() => void run(input)} onStop={stop} />
      </div>
    </section>
    <RunDetailsPanel panelRef={panelRef} inspector={inspector} highlightedId={highlightedId}
      className="shrink-0 border-t border-border lg:w-[320px] lg:overflow-y-auto lg:border-t-0 lg:border-l" />
  </div>;
}
