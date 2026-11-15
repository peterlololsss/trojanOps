'use client';

import { AlertCircle, ArrowUpCircle, ChevronDown, Square } from 'lucide-react';
import { useId, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ModelClass } from '@/lib/contracts';
import type { ChatConfig } from '@/lib/documents/run-config';
import { creditLabel, MODEL_LABELS, priceMicro } from '@/lib/gateway/prices';

export interface ComposerProps {
  readonly config?: ChatConfig;
  readonly agentName: string;
  readonly input: string;
  readonly model: ModelClass;
  readonly running: boolean;
  readonly playing: boolean;
  readonly error: string | null;
  readonly charge: number | null;
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
  readonly onInput: (value: string) => void;
  readonly onModel: (model: ModelClass) => void;
  readonly onRun: () => void;
  readonly onStop: () => void;
}

export function Composer({ textareaRef, ...p }: ComposerProps) {
  const id = useId();
  const quota = p.config?.quota;
  const percent = quota ? Math.min(100, quota.limitMicro === 0 ? 100 : Math.floor(quota.spentMicro / quota.limitMicro * 100)) : 0;
  const daily = quota?.scope === 'student_daily';
  const reset = quota ? (daily ? 'resets at midnight PT' : `resets ${new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' }).format(new Date(quota.resetsAt))}`) : '';
  const low = quota && quota.remainingMicro > 0 && priceMicro(p.model) > quota.remainingMicro;
  const economyAffordable = p.config?.models.allowed.some((m) => m.modelClass === 'economy' && m.priceMicro <= (quota?.remainingMicro ?? 0));
  return <form noValidate onSubmit={(e) => { e.preventDefault(); p.onRun(); }} className="shrink-0 border-t border-border bg-background px-4 pt-3 pb-2">
    {p.config?.blockedMessage && <p className="mb-3 flex items-start gap-2 border border-primary p-3 text-primary"><AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />{p.config.blockedMessage}</p>}
    <div className="rounded-md border border-input p-3">
      <label htmlFor={id} className="mb-1 block font-semibold">Message</label>
      <textarea ref={textareaRef} id={id} name="input" rows={3} value={p.input} aria-invalid={p.error ? true : undefined} aria-describedby={`${id}-hint${p.error ? ` ${id}-error` : ''}`}
        onChange={(e) => p.onInput(e.target.value)} onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Escape' && p.playing) { e.preventDefault(); p.onStop(); }
          if (e.key === 'Enter' && (!e.shiftKey || e.ctrlKey || e.metaKey)) { e.preventDefault(); if (!p.playing && !p.running) p.onRun(); }
        }} className="block min-h-[88px] w-full resize-y bg-background text-base leading-6 outline-none [overflow-wrap:anywhere] focus-visible:ring-2 focus-visible:ring-ring" />
      {p.error && <p id={`${id}-error`} className="mt-2 text-primary">{p.error}</p>}
      {p.input.length >= 7000 && <p className="mt-1 text-right text-xs tabular-nums">{p.input.length.toLocaleString('en-US')} / 8,000</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="secondary" aria-label={`Model: ${MODEL_LABELS[p.model]}`}>{MODEL_LABELS[p.model]}<ChevronDown aria-hidden className="size-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80"><DropdownMenuRadioGroup value={p.model} onValueChange={(v) => { if (v === 'economy' || v === 'standard') p.onModel(v); }}>
            {(p.config?.models.allowed ?? [{ modelClass: p.model, priceMicro: priceMicro(p.model) }]).map((m) => <DropdownMenuRadioItem key={m.modelClass} value={m.modelClass}><span className="flex-1">{MODEL_LABELS[m.modelClass]}</span><span>{creditLabel(m.priceMicro)} a message</span></DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup><DropdownMenuSeparator /><p className="px-3 py-2 text-xs leading-4">
            {p.config?.models.fixedByClub ? `${p.config.scope.billedClub} fixed this agent to ${MODEL_LABELS[p.model]}.` : p.config?.models.limitedByTemplate ? 'Its USG template allows Economy only.' : `Allowed by the template, USG and ${p.config?.scope.billedClub ?? 'the club'}.`}
            {p.config && ` Club default: ${MODEL_LABELS[p.config.models.defaultClass]}.`} Demo runtime: both give the same placeholder answer; only the price differs.
          </p></DropdownMenuContent></DropdownMenu>
        <span className="text-sm tabular-nums" title="Demo price per message">≈ {creditLabel(priceMicro(p.model))}</span>
        {quota && <Popover><PopoverTrigger asChild><button type="button" className="min-h-9 rounded-sm border border-border px-2 text-sm tabular-nums hover:bg-accent">{p.charge !== null ? `−${creditLabel(p.charge)}` : `${creditLabel(quota.remainingMicro)} left${daily ? ' today' : ''}`} · {reset}</button></PopoverTrigger>
          <PopoverContent><p>{quota.scope === 'member' ? `Your allowance in ${p.config?.scope.billedClub}` : daily ? 'Your allowance for public agents' : `The ${quota.scope} budget`}: {creditLabel(quota.remainingMicro)} of {creditLabel(quota.limitMicro)} left.</p><p className="mt-2">1 credit = $0.01, paid from {p.config?.scope.billedClub}&apos;s AI budget. {reset}.</p></PopoverContent></Popover>}
        {percent >= 80 && <span className="rounded-sm bg-gold-25 px-2 py-1 text-xs font-semibold"><AlertCircle aria-hidden className="mr-1 inline size-3" />{percent}% used</span>}
        {p.playing ? <Button type="button" onClick={p.onStop} className="ml-auto min-w-24"><Square aria-hidden className="size-4" />Stop</Button> : <Button type="submit" disabled={p.running} className="ml-auto min-w-24" aria-label={`Run ${p.agentName}`}><ArrowUpCircle aria-hidden className="size-4" />Run</Button>}
      </div>
    </div>
    {low && <p className="mt-2 text-sm text-attention-ink">{MODEL_LABELS[p.model]} needs about {creditLabel(priceMicro(p.model))} and you have {creditLabel(quota.remainingMicro)} left{daily ? ' today' : ' this month'}. {economyAffordable && <button type="button" onClick={() => p.onModel('economy')} className="min-h-9 px-1 font-semibold text-primary underline">Switch to Economy</button>} {daily ? 'Or wait until midnight PT.' : `Or wait until the allowance ${reset}.`}</p>}
    <p id={`${id}-hint`} className="mt-2 text-xs text-muted-foreground">{p.playing ? 'Esc or Stop stops showing the answer. The run has finished.' : 'Enter to run · Shift+Enter for a new line'}</p>
  </form>;
}
