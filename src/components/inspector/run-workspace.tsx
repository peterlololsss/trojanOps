'use client';

import { AlertCircle, Check, Clock } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import type { ApiError, ModelClass } from '@/lib/contracts';
import type { ChatConfig } from '@/lib/documents/run-config';
import { refreshRunContext } from '@/lib/documents/run-actions';
import { creditLabel } from '@/lib/gateway/prices';
import { Composer } from './composer';
import { Inspector } from './inspector';
import { InspectorPlaceholder } from './inspector-placeholder';
import { ScopePanel } from './scope-panel';
import { canConfirm, canReject, initialRunState, latestInspector, requestConfirm, requestReject, requestRun, runReducer } from './run-state';
import { Transcript } from './transcript';

export interface RunWorkspaceProps {
  readonly installationId: string; readonly agentName: string; readonly demoRuntime: boolean;
  readonly config?: ChatConfig;
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

export function RunWorkspace({ installationId, agentName, demoRuntime, config, headerSpacePx = 220 }: RunWorkspaceProps) {
  const frameStyle: CSSProperties & { readonly '--chat-height': string } = { '--chat-height': `calc(100dvh - ${headerSpacePx}px)` };
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
  const endRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => { if (state.turns.length) endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }, [state.turns.length]);

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
  function fill(value: string) { setInput(value); setInputError(null); textarea.current?.focus(); }
  function stop() { setStoppedId(playingId); setPlayingId(null); setAnnouncement('Stopped showing the answer. The run had already finished.'); }
  function reset() {
    if (state.running || playingId) return;
    dispatch({ type: 'reset' }); setInput(''); setModel(context?.models.defaultClass ?? 'economy'); setStoppedId(null); setSelectedRunId(null); setHighlightedId(null); setInputError(null); setCharge(null); setAnnouncement('New conversation. Earlier messages will not be sent.');
  }
  return <>
    <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">{context && <><span className="rounded-sm border border-border px-2 py-1">{context.audienceLabel}</span><span>Template v{context.templateVersion}</span><span>Paid by {context.scope.billedClub}</span></>}<Button type="button" variant="ghost" className="ml-auto" disabled={state.running || Boolean(playingId)} onClick={reset}>New conversation</Button></div>
    <div style={frameStyle} className="flex flex-col items-start gap-[24px] lg:flex-row"><section aria-label={`Chat with ${agentName}`} className="flex h-[calc(100dvh-340px)] min-h-[360px] lg:h-[var(--chat-height)] w-full min-w-0 max-w-[720px] flex-1 flex-col rounded-md border border-border bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
      {!state.turns.length && context && <section className="mb-6"><h2 className="text-xl font-semibold">What {agentName} can read</h2><p className="mt-2">{context.scope.sentence}</p><p className="mt-2 text-sm text-muted-foreground">{context.scope.sources.join(' · ')}</p><p className="mt-1 text-sm">As {[...new Set(context.scope.grantLabels)].join(', ')}.</p><div className="mt-4 grid gap-2">{context.starters.map((starter) => <button key={starter} type="button" onClick={() => fill(starter)} className="min-h-9 rounded-md border border-border px-3 py-2 text-left hover:bg-accent">{starter}</button>)}</div></section>}
      {(state.turns.length > 0 || !context) && <Transcript turns={state.turns} actions={state.actions} agentName={agentName} demoRuntime={demoRuntime} installationId={installationId} orgId={context?.orgId} onConfirm={(id) => void confirm(id)} onReject={(id) => void reject(id)} onRetry={(text) => void run(text)} onEdit={fill} playingId={playingId} stoppedId={stoppedId} onPlaybackDone={playbackDone} onAnnounce={setAnnouncement} onInspect={(id, runId) => { setSelectedRunId(runId); setHighlightedId(id || null); inspectorRef.current?.scrollIntoView({ block: 'nearest' }); inspectorRef.current?.focus(); }} />}
      <div ref={endRef} />
      </div>
      <Composer config={context} agentName={agentName} input={input} model={model} running={state.running} playing={Boolean(playingId)} error={inputError} charge={charge} textareaRef={textarea} onInput={(value) => { setInput(value); if (inputError) setInputError(validateInput(value)); }} onModel={setModel} onRun={() => void run(input)} onStop={stop} />
      <p aria-live="polite" role="status" className={state.running ? 'flex min-h-5 items-center gap-2 px-4 pb-3 text-sm text-muted-foreground' : 'sr-only'}>{state.running && <Clock aria-hidden className="size-4" />}{announcement}</p>
    </section><div ref={inspectorRef} tabIndex={-1} className="w-[384px] max-w-full shrink-0 lg:max-h-[var(--chat-height)] lg:overflow-y-auto">
      {inspector ? <><div className="border border-border bg-muted p-4 text-sm"><p className="font-semibold">Finished run</p><p className="mt-2"><Check aria-hidden className="mr-1 inline size-4" />Checked access · {new Set(inspector.runGrants.map((g) => g.label)).size} grants</p><p>Read {inspector.readInRun.length} of {inspector.permitted.length} permitted documents</p><p>Paid by {inspector.billedClub} · {creditLabel(inspector.costMicro)} · Audit #{inspector.auditEventId}</p></div><Inspector inspector={inspector} highlightedId={highlightedId} /></> : context ? <ScopePanel config={context} /> : <InspectorPlaceholder />}
    </div></div>
    <p className="mt-3 max-w-[720px] text-xs leading-5 text-muted-foreground">Only you can see what you ask and what the agent answers. {context?.scope.billedClub ?? "The club"}&apos;s president and USG see that you ran it, when, what it cost and which documents it read.</p>
  </>;
}
