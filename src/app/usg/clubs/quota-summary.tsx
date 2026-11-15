'use client';

import { useState, type FormEvent } from 'react';
import type { QuotaRemaining } from '@/lib/contracts';
import { creditLabel, priceMicro, MODEL_LABELS } from '@/lib/gateway/prices';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ErrorNotice, money, PendingButton, SuccessNotice, useConsoleMutation } from '../templates/console-ui';

function QuotaEditor({ scope, limitMicro }: { readonly scope: 'platform' | 'student_daily'; readonly limitMicro: number | null }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(limitMicro === null ? '' : (limitMicro / 1_000_000).toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const mutation = useConsoleMutation();
  const title = scope === 'platform' ? 'Platform monthly budget' : 'Student daily allowance';
  function save(event: FormEvent) {
    event.preventDefault();
    const amount = Number(value); const micro = Math.round(amount * 1_000_000);
    if (!/^\d+(?:\.\d{1,2})?$/.test(value) || !Number.isSafeInteger(micro)) { setError('Enter zero or more dollars, to at most two decimal places.'); return; }
    setError(null);
    mutation.run(async () => { await mutation.request('/api/quota/limits', 'PUT', { scope, limitMicro: micro }); return `${title} saved: ${money(micro)} · ${creditLabel(micro)}.`; });
  }
  const live = Number(value);
  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setValue(limitMicro === null ? '' : (limitMicro / 1_000_000).toFixed(2)); setError(null); mutation.clear(); } }}><DialogTrigger asChild><Button variant="secondary" size="sm">Edit {scope === 'platform' ? 'platform budget' : 'daily allowance'}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{scope === 'platform' ? 'Every billed run counts toward the platform budget. A lower limit can block new runs immediately.' : 'This allowance applies separately to every student who uses public agents, paid by each agent’s club. It resets at midnight PT.'}</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-4"><label className="block space-y-1"><span className="block font-semibold">Limit (USD)</span><Input type="number" required min={0} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} /></label><p aria-live="polite" className="text-sm text-muted-foreground">{value !== '' && Number.isFinite(live) && live >= 0 ? `${money(Math.round(live * 1_000_000))} = ${creditLabel(Math.round(live * 1_000_000))}` : '1 credit = $0.01.'}</p><ErrorNotice message={error ?? mutation.error} /><SuccessNotice message={mutation.success} /><div className="flex justify-end gap-2"><Button variant="ghost" type="button" onClick={() => setOpen(false)}>Close</Button><PendingButton type="submit" pending={mutation.pending}>Save allowance</PendingButton></div></form></DialogContent></Dialog>;
}

export function QuotaSummary({ platform, dailyLimitMicro }: { readonly platform: QuotaRemaining; readonly dailyLimitMicro: number | null }) {
  return <section aria-label="Platform and public-agent budgets" className="mb-6 space-y-4 rounded-md border border-border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Platform budget</h2><p>{money(platform.limitMicro)} a month · {creditLabel(platform.limitMicro)}</p><p className="text-sm text-muted-foreground">{money(platform.spentMicro)} used · {creditLabel(platform.spentMicro)}</p></div><QuotaEditor scope="platform" limitMicro={platform.limitMicro} /></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><div><h2 className="font-semibold">Student daily allowance</h2><p>{dailyLimitMicro === null ? 'Not configured' : `${money(dailyLimitMicro)} · ${creditLabel(dailyLimitMicro)} per student`}</p></div><QuotaEditor scope="student_daily" limitMicro={dailyLimitMicro} /></div><p className="border-t border-border pt-4 text-sm">Prices per message (demo): {(['economy', 'standard'] as const).map((model) => `${MODEL_LABELS[model]} ${creditLabel(priceMicro(model))} (${money(priceMicro(model))})`).join(' · ')}. 1 credit = $0.01.</p></section>;
}
