'use client';

import { AlertCircle, ArrowUpCircle, ChevronDown, LoaderCircle } from 'lucide-react';
import { useId, useLayoutEffect, useState, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ModelClass } from '@/lib/contracts';
import type { ChatConfig } from '@/lib/documents/run-config';
import { creditLabel, MODEL_LABELS, priceMicro } from '@/lib/gateway/prices';
import { DEMO_MODELS } from './demo-models';

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

/** The textarea grows with its text from one line to eight (24px lines below 12px of padding), then scrolls. */
const MAX_FIELD_PX = 8 * 24 + 12;

export function Composer({ textareaRef, ...p }: ComposerProps) {
  const id = useId();
  const [choiceId, setChoiceId] = useState<string>('gpt-6-luna');
  const choices = DEMO_MODELS.filter((choice) => (p.config?.models.allowed ?? [{ modelClass: p.model }]).some((allowed) => allowed.modelClass === choice.modelClass));
  const selectedChoice = choices.find((choice) => choice.id === choiceId && choice.modelClass === p.model)
    ?? choices.find((choice) => choice.modelClass === p.model);
  const quota = p.config?.quota;
  const percent = quota ? Math.min(100, quota.limitMicro === 0 ? 100 : Math.floor(quota.spentMicro / quota.limitMicro * 100)) : 0;
  const daily = quota?.scope === 'student_daily';
  const reset = quota ? (daily ? 'resets at midnight PT' : `resets ${new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' }).format(new Date(quota.resetsAt))}`) : '';
  const low = quota && quota.remainingMicro > 0 && priceMicro(p.model) > quota.remainingMicro;
  const economyAffordable = p.config?.models.allowed.some((m) => m.modelClass === 'economy' && m.priceMicro <= (quota?.remainingMicro ?? 0));
  const restriction = p.config?.models.fixedByClub ? `${p.config.scope.billedClub} sets the available model pricing for this agent.`
    : p.config?.models.limitedByTemplate ? 'Its USG template allows lower-cost demo models only.' : null;

  useLayoutEffect(() => {
    const field = textareaRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, MAX_FIELD_PX)}px`;
    field.style.overflowY = field.scrollHeight > MAX_FIELD_PX ? 'auto' : 'hidden';
  }, [p.input, textareaRef]);

  return <form noValidate onSubmit={(e) => { e.preventDefault(); p.onRun(); }} className="shrink-0">
    {p.config?.blockedMessage && <p className="mb-3 flex items-start gap-2 rounded-md border border-primary p-3"><AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />{p.config.blockedMessage}</p>}
    <div className="rounded-md border border-input bg-background has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-ring has-[textarea:focus-visible]:outline-solid">
      <label htmlFor={id} className="sr-only">Message</label>
      <textarea ref={textareaRef} id={id} name="input" rows={1} value={p.input} placeholder={`Ask ${p.agentName}…`}
        aria-invalid={p.error ? true : undefined} aria-describedby={p.error ? `${id}-error` : undefined}
        onChange={(e) => p.onInput(e.target.value)} onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Escape' && p.playing) { e.preventDefault(); p.onStop(); }
          if (e.key === 'Enter' && (!e.shiftKey || e.ctrlKey || e.metaKey)) { e.preventDefault(); if (!p.playing && !p.running) p.onRun(); }
        }}
        className="block w-full resize-none overflow-hidden bg-transparent px-3 pt-3 text-base leading-6 outline-none placeholder:text-muted-foreground [overflow-wrap:anywhere] focus-visible:outline-none" />
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-2 py-2">
        <div className="flex min-w-0 items-center gap-1">
          <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="sm" className="max-w-48 px-2 font-mono text-xs" aria-label={`Demo model: ${selectedChoice?.label ?? MODEL_LABELS[p.model]}`}><span className="truncate">{selectedChoice?.label ?? MODEL_LABELS[p.model]}</span><ChevronDown aria-hidden className="size-3" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-80"><p className="px-2 py-2 text-xs text-muted-foreground">Demo models · mock runtime</p><DropdownMenuRadioGroup value={selectedChoice?.id} onValueChange={(value) => {
              const choice = choices.find((item) => item.id === value);
              if (choice) { setChoiceId(choice.id); p.onModel(choice.modelClass); }
            }}>
              {choices.map((choice) => <DropdownMenuRadioItem key={choice.id} value={choice.id}><span className="flex-1">{choice.label}</span><span className="text-xs tabular-nums text-muted-foreground">{creditLabel(priceMicro(choice.modelClass))}</span></DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>{restriction && <><DropdownMenuSeparator /><p className="px-3 py-2 text-xs leading-4">{restriction}</p></>}</DropdownMenuContent></DropdownMenu>
          <span className="text-xs tabular-nums text-muted-foreground">{creditLabel(priceMicro(p.model))}</span>
        </div>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          {quota && <Popover><PopoverTrigger asChild><button type="button" aria-label={`${creditLabel(quota.remainingMicro)} left${daily ? ' today' : ''}, ${reset}`} className="min-h-9 rounded-sm px-2 text-right text-xs tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground">{p.charge !== null ? `−${creditLabel(p.charge)}` : `${creditLabel(quota.remainingMicro)} left`}</button></PopoverTrigger>
            <PopoverContent><p>{quota.scope === 'member' ? `Your allowance in ${p.config?.scope.billedClub}` : daily ? 'Your allowance for public agents' : `The ${quota.scope} budget`}: {creditLabel(quota.remainingMicro)} of {creditLabel(quota.limitMicro)} left.</p><p className="mt-2">1 credit = $0.01, paid from {p.config?.scope.billedClub}&apos;s AI budget. {reset[0]?.toUpperCase()}{reset.slice(1)}.</p></PopoverContent></Popover>}
          {percent >= 80 && <span className="inline-flex items-center gap-1 rounded-sm bg-gold-25 px-2 py-0.5 text-xs font-semibold"><AlertCircle aria-hidden className="size-3 text-attention-ink" />{percent}% used</span>}
          {p.playing ? <Button type="button" onClick={p.onStop} className="min-w-20"><LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" />Stop</Button> : <Button type="submit" disabled={p.running} className="min-w-20" aria-label={`Run ${p.agentName}`}>{p.running ? <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" /> : <ArrowUpCircle aria-hidden className="size-4" />}Run</Button>}
        </div>
      </div>
    </div>
    {p.error && <p id={`${id}-error`} className="mt-2 text-primary">{p.error}</p>}
    {p.input.length >= 7000 && <p className="mt-1 text-right text-xs tabular-nums">{p.input.length.toLocaleString('en-US')} / 8,000</p>}
    {low && <p className="mt-2 text-sm text-attention-ink">{selectedChoice?.label ?? MODEL_LABELS[p.model]} needs about {creditLabel(priceMicro(p.model))} and you have {creditLabel(quota.remainingMicro)} left{daily ? ' today' : ' this month'}. {economyAffordable && <button type="button" onClick={() => { setChoiceId('gpt-6-luna'); p.onModel('economy'); }} className="min-h-9 px-1 font-semibold text-primary underline">Switch to gpt-6-luna</button>} {daily ? 'Or wait until midnight PT.' : `Or wait until the allowance ${reset}.`}</p>}
  </form>;
}
