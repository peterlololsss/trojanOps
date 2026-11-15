'use client';

import { Check, Clock, Copy, FileText, Lock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Markdown } from '@/components/ui/markdown';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ModelClass, RunResult, Tier } from '@/lib/contracts';
import { citationAccess } from '@/lib/documents/run-actions';
import { creditLabel, MODEL_LABELS } from '@/lib/gateway/prices';
import { tierLabels } from './access-labels';
import { PendingActionCard } from './pending-action-card';
import { CitationContent } from './citation-content';
import { citedSources, type ActionStatus } from './run-state';

type Source = ReturnType<typeof citedSources>[number];

function Citation({ source, n, tier, installationId, orgId, onInspect, compact }: {
  readonly source: Source; readonly n: number; readonly tier: Tier;
  readonly installationId?: string; readonly orgId?: string;
  readonly onInspect?: (documentId: string) => void; readonly compact?: boolean;
}) {
  const [access, setAccess] = useState<{ allowed: boolean; reason: string } | null>(null);
  const [open, setOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef(0);
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);
  function keepOpen() { if (hoverTimer.current) clearTimeout(hoverTimer.current); }
  function leave() { keepOpen(); hoverTimer.current = setTimeout(() => show(false), 200); }
  function show(value: boolean) {
    setOpen(value);
    const current = ++request.current;
    if (value) setAccess(null);
    if (value && installationId) void citationAccess(installationId, source.documentId).then((next) => { if (current === request.current) setAccess(next); }, () => { if (current === request.current) setAccess({ allowed: false, reason: 'Could not check access. Close this source and try again.' }); });
  }
  const allowed = !installationId || access?.allowed;
  return <Popover open={open} onOpenChange={show}><PopoverTrigger asChild><button type="button" onClick={(e) => { if (open) e.preventDefault(); }} onPointerEnter={(e) => { if (e.pointerType === 'mouse') { keepOpen(); show(true); } }} onPointerLeave={(e) => { if (e.pointerType === 'mouse') leave(); }} onFocus={(e) => { if (!open && e.currentTarget.matches(':focus-visible')) show(true); }}
    className="inline-flex min-h-7 items-center gap-1 rounded-sm border border-input px-2 align-baseline text-sm font-semibold hover:bg-accent" aria-label={`Source ${n}: ${source.title}`}>
    {compact ? `[${n}]` : <><FileText aria-hidden className="size-3" />{n} {source.title} · {tierLabels[tier]}</>}
  </button></PopoverTrigger><PopoverContent align="start" onPointerEnter={keepOpen} onPointerLeave={leave} onOpenAutoFocus={(e) => e.preventDefault()}>
    <CitationContent n={n} title={source.title} quote={source.quote} tier={tier} allowed={Boolean(allowed)} reason={access?.reason ?? (installationId ? 'Checking current access…' : 'Permitted for this run.')} orgId={orgId} documentId={source.documentId} onInspect={onInspect ? () => { setOpen(false); onInspect(source.documentId); } : undefined} />
  </PopoverContent></Popover>;
}

export interface AnswerTurnProps {
  readonly result: RunResult; readonly agentName: string; readonly demoRuntime: boolean;
  readonly modelClass?: ModelClass; readonly installationId?: string; readonly orgId?: string;
  readonly actions: Record<string, ActionStatus>; readonly onConfirm?: (id: string) => void; readonly onReject?: (id: string) => void;
  readonly playing?: boolean; readonly stopped?: boolean; readonly onDone?: () => void;
  readonly onInspect?: (documentId: string) => void;
  readonly onAnnounce?: (message: string) => void;
}

export function AnswerTurn(p: AnswerTurnProps) {
  const { playing, onDone } = p;
  const [wordCount, setWordCount] = useState(0);
  const [full, setFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const words = p.result.reply.split(/(?<=\s)/);
  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onDone?.(); return; }
    let count = 0;
    const timer = setInterval(() => {
      count = Math.min(words.length, count + 4);
      setWordCount(count);
      if (count === words.length) { clearInterval(timer); onDone?.(); }
    }, 100);
    return () => clearInterval(timer);
  }, [playing, onDone, words.length]);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  const sources = citedSources(p.result);
  const tiers: Tier[] = ['public', 'members', 'officers', 'usg_internal'];
  const cited = p.result.inspector.permitted.filter((d) => sources.some((s) => s.documentId === d.id));
  const highest = cited.reduce<Tier>((tier, d) => tiers.indexOf(d.tier) > tiers.indexOf(tier) ? d.tier : tier, 'public');
  const shown = full || (!p.playing && !p.stopped) ? p.result.reply : words.slice(0, wordCount).join('');
  const citation = (n: number, compact = false) => {
    const original = p.result.citations[n - 1];
    const source = sources.find((s) => s.documentId === original?.documentId);
    const tier = cited.find((d) => d.id === source?.documentId)?.tier;
    return source && tier ? <Citation key={`${n}-${compact}`} n={n} source={source} tier={tier} compact={compact} installationId={p.installationId} orgId={p.orgId} onInspect={p.onInspect} /> : `[${n}]`;
  };
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${p.result.reply}\n\nSources: ${sources.map((s, i) => `${i + 1}. ${s.title}`).join('; ')}`);
      setCopied(true); setCopyError(false);
      p.onAnnounce?.('Copied answer and sources.');
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) { if (error instanceof Error) { setCopyError(true); setCopied(false); } else throw error; }
  }
  return <article aria-busy={p.playing || undefined}>
    <div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="text-[14px] font-semibold leading-5 text-primary">AI · {p.agentName}</h2>
      <span className="rounded-sm border border-border px-2 py-1 text-xs">{p.demoRuntime ? 'Demo runtime: placeholder answer' : 'AI-generated'}</span>
      {highest !== 'public' && <span title={`This answer quotes ${tierLabels[highest]} documents. Check before sharing it outside the permitted group.`} className="ml-auto text-xs font-semibold"><Lock aria-hidden className="mr-1 inline size-3" />Uses {tierLabels[highest]} information</span>}
    </div>
    {p.playing && <ul className="mb-4 space-y-1 text-sm text-muted-foreground"><li><Check aria-hidden className="mr-1 inline size-4" />Checked access as {[...new Set(p.result.inspector.runGrants.map((g) => g.label))].join(', ')}</li><li><Check aria-hidden className="mr-1 inline size-4" />Read {p.result.inspector.readInRun.length} of {p.result.inspector.permitted.length} permitted documents</li><li><Clock aria-hidden className="mr-1 inline size-4" />Showing the finished answer</li></ul>}
    <Markdown text={shown} renderCitation={(n) => citation(n, true)} />
    {p.stopped && !full && <p className="mt-3 bg-muted p-3 text-sm">Stopped showing the answer. The run had already finished and cost {creditLabel(p.result.inspector.costMicro)}. <button type="button" onClick={() => setFull(true)} className="min-h-9 px-1 text-primary underline">Show full answer</button></p>}
    <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Sources for this answer"><span className="text-xs font-semibold">Sources for this answer</span>{sources.length ? sources.map((s) => citation(p.result.citations.findIndex((c) => c.documentId === s.documentId) + 1)) : <span className="text-sm text-muted-foreground">This answer cites no documents.</span>}</div>
    <p className="mt-3 text-xs tabular-nums text-muted-foreground">{MODEL_LABELS[p.modelClass ?? 'economy']} · −{creditLabel(p.result.inspector.costMicro)} · Read {p.result.inspector.readInRun.length} of {p.result.inspector.permitted.length} permitted documents · Audit #{p.result.inspector.auditEventId}</p>
    <div className="mt-2 flex items-center gap-2"><Button type="button" variant="ghost" onClick={() => void copy()}><Copy aria-hidden className="size-4" />{copied ? 'Copied' : 'Copy'}</Button><details><summary className="cursor-pointer px-2 py-2 text-sm text-primary">Details</summary><p className="max-w-prose text-sm">Checked access · Read {p.result.inspector.readInRun.length} documents · Paid by {p.result.inspector.billedClub} · {creditLabel(p.result.inspector.costMicro)} · Audit #{p.result.inspector.auditEventId}. Earlier messages were not sent.</p></details></div>
    {copyError && <p role="alert" className="text-sm text-primary">Could not copy. Select the answer text and copy it.</p>}
    {p.result.pendingActions.map((a) => <PendingActionCard key={a.id} action={a} status={p.actions[a.id] ?? { status: 'pending' }} onConfirm={p.onConfirm} onReject={p.onReject} />)}
  </article>;
}
