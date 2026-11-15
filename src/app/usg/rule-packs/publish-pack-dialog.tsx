'use client';

// Owner: B. "Publish new version" for a rule pack (demo beat D6): edit the values USG changed,
// review only what differs and who it reaches, then POST the full content as the next version.
import { useState, type FormEvent } from 'react';
import { CircleAlert, PenLine } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  currentPackVersion, editableRules, formatAmount, isAmended, isUsd, parseRulePackContent, ruleValueChanges, unitText, valueError, withRuleValues,
  type PackContent, type PackRule, type RuleValues, type ValueChange,
} from '@/lib/distribution/rule-pack-content';
import type { UsgPack, UsgPackUser } from '@/lib/distribution/usg-view';
import { ErrorNotice, PendingButton, SuccessNotice, useConsoleMutation } from '../templates/console-ui';
import { audienceLabel, plural } from '../templates/template-config';

/** "Applies to Funding pre-check in 4 clubs on the next run, including pinned installations." */
export function reachSentences(usedBy: UsgPackUser[], nextVersion: number): string[] {
  if (!usedBy.length) return ['No agent template uses this rule pack yet, so no run changes until a template names it.'];
  return usedBy.flatMap(u => [
    `Applies to ${u.name} in ${plural(u.installedCount, 'club')} on the next run, including pinned installations.`,
    `${audienceLabel(u.audience, u.usableBy)} in ${u.installedCount === 1 ? 'that club' : 'those clubs'} get answers based on v${nextVersion}.`,
  ]);
}

export interface PackReviewProps {
  /** Prefix for element ids, the pack slug. */
  idPrefix?: string;
  label: string; nextVersion: number; labelChange: { before: string; after: string } | null;
  changes: ValueChange[]; changeNote: string; usedBy: UsgPackUser[]; json?: Record<string, unknown>;
}
/** The review step: only what differs from the current version, and who it reaches. */
export function PackReview({ idPrefix = 'pack', label, nextVersion, labelChange, changes, changeNote, usedBy, json }: PackReviewProps) {
  return <div className="space-y-5">
    <section aria-labelledby={`${idPrefix}-review-changes`} className="space-y-2">
      <h3 id={`${idPrefix}-review-changes`} className="font-semibold">What changes in {label} v{nextVersion}</h3>
      {json ? <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs">{JSON.stringify(json, null, 2)}</pre>
        : <dl className="divide-y divide-border rounded-md border border-border">
          {labelChange && <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-3 py-2"><dt>Label</dt><dd className="text-right">{`${labelChange.before} → ${labelChange.after}`}</dd></div>}
          {changes.map(c => <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-3 py-2">
            <dt><span className="text-muted-foreground">{c.section}</span> {c.title}</dt>
            <dd className="text-right"><span className="font-semibold tabular-nums">{`${c.before} → ${c.after}`}</span>{c.unit && <span className="ml-1 text-muted-foreground">{c.unit}</span>}</dd>
          </div>)}
        </dl>}
      {!json && <p className="text-muted-foreground">Every other rule, its USG wording and its example carry over unchanged.</p>}
    </section>
    {changeNote.trim() && <p><span className="font-semibold">Change note:</span> {changeNote.trim()}</p>}
    <section aria-labelledby={`${idPrefix}-review-reach`} className="space-y-1">
      <h3 id={`${idPrefix}-review-reach`} className="font-semibold">Who it reaches</h3>
      {reachSentences(usedBy, nextVersion).map(s => <p key={s}>{s}</p>)}
      <p className="text-muted-foreground">Published versions cannot be edited. To undo, publish another version with the old values.</p>
    </section>
  </div>;
}

type Inputs = Record<string, string>;
const inputsFor = (pack: PackContent | null): Inputs => pack ? Object.fromEntries(editableRules(pack).map(r => [r.id, String(r.value)])) : {};
const parseInput = (rule: PackRule, raw: string): number | string => typeof rule.value === 'number' ? (raw.trim() === '' ? Number.NaN : Number(raw)) : raw.trim();

export function PublishPackDialog({ pack }: { pack: UsgPack }) {
  const base = currentPackVersion(pack.versions); const parsed = parseRulePackContent(base?.content);
  const next = Math.max(0, ...pack.versions.map(v => v.version)) + 1;
  const [open, setOpen] = useState(false); const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [label, setLabel] = useState(base?.label ?? ''); const [inputs, setInputs] = useState<Inputs>(() => inputsFor(parsed));
  const [touched, setTouched] = useState<Set<string>>(new Set()); const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState(''); const [json, setJson] = useState(JSON.stringify(base?.content ?? {}, null, 2));
  const [formError, setFormError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<{ content: Record<string, unknown>; changes: ValueChange[] } | null>(null);
  const mutation = useConsoleMutation();

  function reset(value: boolean) {
    setOpen(value); setStep('edit'); setFormError(null); setErrors({}); setTouched(new Set()); setPrepared(null); mutation.clear();
    if (value) { setLabel(base?.label ?? ''); setInputs(inputsFor(parsed)); setNote(''); setJson(JSON.stringify(base?.content ?? {}, null, 2)); }
  }
  function check(rule: PackRule, raw: string): string | null { return valueError(rule, parseInput(rule, raw)); }
  function blur(rule: PackRule) {
    if (!touched.has(rule.id)) return;
    const message = check(rule, inputs[rule.id] ?? '');
    setErrors(current => { const rest = { ...current }; delete rest[rule.id]; return message ? { ...rest, [rule.id]: message } : rest; });
  }
  function prepare(event: FormEvent) {
    event.preventDefault(); setFormError(null);
    if (!label.trim()) { setFormError('Enter a label, for example “USG Funding Guidelines 2026–27”.'); return; }
    if (!parsed) {
      try {
        const content: unknown = JSON.parse(json);
        if (!content || typeof content !== 'object' || Array.isArray(content)) throw new Error('not an object');
        setPrepared({ content: content as Record<string, unknown>, changes: [] }); setStep('review');
      } catch { setFormError('The content is not a JSON object. Fix the JSON, for example a missing quote or comma, then review again.'); }
      return;
    }
    const values: RuleValues = {}; const found: Record<string, string> = {};
    for (const rule of editableRules(parsed)) {
      const value = parseInput(rule, inputs[rule.id] ?? ''); const message = valueError(rule, value);
      if (message) found[rule.id] = message; else values[rule.id] = value;
    }
    setErrors(found);
    if (Object.keys(found).length) { setFormError(`Fix ${plural(Object.keys(found).length, 'value')} marked in the table, then review again.`); return; }
    const changes = ruleValueChanges(parsed, values);
    if (!changes.length && label.trim() === base?.label) { setFormError('Nothing has changed yet. Change a value or the label before publishing a new version.'); return; }
    setPrepared({ content: withRuleValues(base?.content ?? {}, values, note), changes }); setStep('review');
  }
  function publish() {
    if (!prepared) return;
    mutation.run(async () => {
      const result = await mutation.request(`/api/usg/rule-packs/${encodeURIComponent(pack.slug)}/versions`, 'POST', { label: label.trim(), content: prepared.content }) as { version: number };
      const users = pack.usedBy.map(u => u.name).join(', ');
      return `${label.trim()} v${result.version} published. ${users ? `The next ${users} run uses it.` : 'No agent uses this pack yet.'}`;
    }, () => setOpen(false));
  }

  return <div className="flex flex-col items-end gap-2">
    <Button type="button" onClick={() => reset(true)}>Publish new version</Button>
    <SuccessNotice message={mutation.success} />
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{step === 'review' ? `Publish ${label.trim()} v${next}?` : `New version of ${base?.label ?? pack.slug}`}</DialogTitle>
          <DialogDescription>{step === 'review' ? 'Check what changes and who it reaches.'
            : parsed ? 'Change the values USG updated. The USG wording, examples and every other rule carry over.' : 'This pack has no rule list, so edit its content as JSON.'}</DialogDescription>
        </DialogHeader>
        {step === 'review' && prepared ? <>
          <PackReview idPrefix={pack.slug} label={label.trim()} nextVersion={next} changes={prepared.changes} changeNote={note} usedBy={pack.usedBy}
            labelChange={base && label.trim() !== base.label ? { before: base.label, after: label.trim() } : null} json={parsed ? undefined : prepared.content} />
          <ErrorNotice message={mutation.error} />
          <DialogFooter><Button type="button" variant="ghost" onClick={() => setStep('edit')}>Back to edit</Button>
            <PendingButton pending={mutation.pending} onClick={publish}>Publish v{next}</PendingButton></DialogFooter>
        </> : <form onSubmit={prepare} noValidate className="space-y-4">
          <div className="max-w-md"><Label htmlFor={`${pack.slug}-label`}>Label</Label><Input id={`${pack.slug}-label`} value={label} onChange={e => setLabel(e.target.value)} /></div>
          {parsed ? <ValuesTable idPrefix={pack.slug} rules={editableRules(parsed)} inputs={inputs} errors={errors}
            onChange={(id, value) => { setInputs(v => ({ ...v, [id]: value })); setTouched(t => new Set(t).add(id)); }} onBlur={blur} />
            : <div><Label htmlFor={`${pack.slug}-json`}>Content (JSON)</Label><Textarea id={`${pack.slug}-json`} value={json} onChange={e => setJson(e.target.value)} rows={12} className="font-mono text-xs" /></div>}
          <div><Label htmlFor={`${pack.slug}-note`}>Change note</Label><Textarea id={`${pack.slug}-note`} value={note} onChange={e => setNote(e.target.value)} rows={2} aria-describedby={`${pack.slug}-note-hint`} />
            <p id={`${pack.slug}-note-hint`} className="mt-1 text-muted-foreground">Optional. Shown in the version history, for example “Annual cap raised after the fall budget vote.”</p></div>
          <div className="sticky -bottom-6 -mx-6 -mb-6 space-y-3 border-t border-border bg-background px-6 py-4">
            {formError && <Alert variant="destructive"><CircleAlert aria-hidden="true" /><div><AlertTitle>Cannot review yet</AlertTitle><AlertDescription>{formError}</AlertDescription></div></Alert>}
            <DialogFooter><Button type="button" variant="ghost" onClick={() => reset(false)}>Cancel</Button><Button type="submit">Review v{next}</Button></DialogFooter>
          </div>
        </form>}
      </DialogContent>
    </Dialog>
  </div>;
}

function ValuesTable({ idPrefix, rules, inputs, errors, onChange, onBlur }: {
  idPrefix: string; rules: PackRule[]; inputs: Inputs; errors: Record<string, string>;
  onChange: (id: string, value: string) => void; onBlur: (rule: PackRule) => void;
}) {
  return <div className="rounded-md border border-border">
    <Table className="min-w-[640px]">
      <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="w-16">Section</TableHead><TableHead>Rule</TableHead><TableHead className="text-right">Current</TableHead><TableHead>New value</TableHead></TableRow></TableHeader>
      <TableBody>{rules.map(rule => {
        const raw = inputs[rule.id] ?? ''; const changed = raw !== String(rule.value); const error = errors[rule.id];
        const numeric = typeof rule.value === 'number'; const unit = unitText(rule);
        return <TableRow key={rule.id} className={changed ? 'bg-gold-25 hover:bg-gold-25' : undefined}>
          <TableCell className="text-muted-foreground">{rule.section}</TableCell>
          <TableCell id={`${idPrefix}-rule-title-${rule.id}`}>{rule.title}</TableCell>
          <TableCell className="whitespace-nowrap text-right tabular-nums">{formatAmount(rule, rule.value)}
            {isAmended(rule) && <span className="block text-xs text-muted-foreground">{`USG: ${formatAmount(rule, rule.amendedFrom)}`}</span>}</TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="w-2 shrink-0">{isUsd(rule) ? '$' : ''}</span>
              <Input id={`${idPrefix}-rule-${rule.id}`} aria-labelledby={`${idPrefix}-rule-title-${rule.id}`} aria-describedby={`${idPrefix}-rule-unit-${rule.id}${error ? ` ${idPrefix}-rule-error-${rule.id}` : ''}`}
                aria-invalid={!!error} className={numeric ? 'w-28 text-right tabular-nums' : 'w-48'} inputMode={numeric ? 'decimal' : undefined}
                type={numeric ? 'number' : 'text'} min={numeric ? 0 : undefined} step={numeric ? 'any' : undefined}
                value={raw} onChange={e => onChange(rule.id, e.target.value)} onBlur={() => onBlur(rule)} />
              <span id={`${idPrefix}-rule-unit-${rule.id}`} className="text-muted-foreground">{isUsd(rule) && <span className="sr-only">US dollars </span>}{unit}</span>
              {changed && !error && <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold"><PenLine aria-hidden="true" className="size-3 text-attention-ink" />Changed</span>}
            </div>
            {error && <p id={`${idPrefix}-rule-error-${rule.id}`} className="mt-1 flex items-center gap-1 text-primary"><CircleAlert aria-hidden="true" className="size-3" />{error}</p>}
          </TableCell>
        </TableRow>;
      })}</TableBody>
    </Table>
  </div>;
}
