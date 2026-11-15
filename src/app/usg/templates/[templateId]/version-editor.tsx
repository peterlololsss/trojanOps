'use client';

// Owner: B. "Edit configuration" on /usg/templates/[templateId]: every setting of the next version as a
// choice with a one-line explanation, then a review of what differs and who it reaches. The POST body
// to /api/templates/:id/versions is the same as before (version-draft.ts).
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { Audience, ModelClass, Tier } from '@/lib/contracts';
import type { UsgTemplateView } from '@/lib/distribution/usg-view';
import { ErrorNotice, PendingButton, selectClass, SuccessNotice, useConsoleMutation } from '../console-ui';
import { AUDIENCES, CLUB_TIERS, demoModelDefault, demoModelDescription, MODEL_CLASSES, MODEL_ORDER, scopeLabel, SOURCE_KINDS, TIERS, TOOLS, toolOption } from '../template-config';
import {
  initialState, reachSentences, toBody, validate, versionChanges, type EditorField, type EditorState, type FieldChange,
} from './version-draft';

export interface VersionReviewProps { templateName: string; nextVersion: number; currentVersion: number | null; changes: FieldChange[]; reach: string[]; changelog: string }
/** The review step: each setting that differs (before → after) and who the version reaches. */
export function VersionReview({ templateName, nextVersion, currentVersion, changes, reach, changelog }: VersionReviewProps) {
  return <div className="space-y-5">
    <section aria-labelledby="version-review-changes" className="space-y-2">
      <h3 id="version-review-changes" className="font-semibold">{currentVersion ? 'Changes' : `First version of ${templateName}`}</h3>
      <div className="rounded-md border border-border"><Table className="min-w-[560px]">
        <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Setting</TableHead><TableHead>{currentVersion ? `Now (v${currentVersion})` : 'Now'}</TableHead><TableHead>After (v{nextVersion})</TableHead></TableRow></TableHeader>
        <TableBody>{changes.map(c => <TableRow key={c.field} className="align-top hover:bg-transparent">
          <TableCell className="font-semibold">{c.field}</TableCell><TableCell className="text-muted-foreground">{c.before}</TableCell>
          <TableCell>{c.after}{c.detail && <details className="mt-1"><summary className="cursor-pointer text-xs text-primary">Show new instructions</summary>
            <p className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted p-2 text-xs leading-4">{c.detail}</p></details>}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div>
    </section>
    {changelog.trim() && <p><span className="font-semibold">Change note:</span> {changelog.trim()}</p>}
    {reach.map(s => <p key={s}>{s}</p>)}
  </div>;
}

function Field({ legend, error, id, children }: { legend: string; error?: string; id: string; children: ReactNode }) {
  return <fieldset aria-describedby={error ? `${id}-error` : undefined} className="space-y-2">
    <legend className="font-semibold">{legend}</legend>
    {children}
    {error && <p id={`${id}-error`} className="flex items-center gap-1 text-primary"><CircleAlert aria-hidden="true" className="size-3 shrink-0" />{error}</p>}
  </fieldset>;
}
function Choice({ id, title, description, tag, control }: { id: string; title: string; description?: string; tag?: string; control: ReactNode }) {
  return <div className="flex items-start gap-3 rounded-md border border-border px-3 py-2 has-[:checked]:border-input has-[:checked]:bg-muted has-[[data-state=checked]]:border-input has-[[data-state=checked]]:bg-muted">
    <div className="flex h-5 items-center">{control}</div>
    <div><label htmlFor={id} className="font-semibold">{title}</label>{tag && <Badge className="ml-2 align-middle">{tag}</Badge>}
      {description && <p id={`${id}-hint`} className="text-muted-foreground">{description}</p>}</div>
  </div>;
}
const toggle = (values: string[], value: string, on: boolean) => on ? [...values.filter(v => v !== value), value] : values.filter(v => v !== value);

export function VersionEditor({ data, editing, setEditing, focusSources = false }: { data: UsgTemplateView; editing: boolean; setEditing: (value: boolean) => void; focusSources?: boolean }) {
  const latest = data.versions.find(v => v.version === data.template.latestVersion) ?? data.versions[0];
  const next = data.template.latestVersion + 1;
  const [state, setState] = useState<EditorState>(() => initialState(latest));
  const [errors, setErrors] = useState<Partial<Record<EditorField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null); const [open, setOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null); const mutation = useConsoleMutation();
  const ctx = { positions: data.positions };
  const body = toBody(state); const changes = versionChanges(latest, body, ctx);
  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) => setState(s => ({ ...s, [key]: value }));

  const sourceHeading = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editing) (focusSources ? sourceHeading.current : heading.current)?.focus();
  }, [editing, focusSources]);

  const positionOptions = [...data.positions, ...state.usableBy.filter(slug => !data.positions.some(p => p.slug === slug)).map(slug => ({ slug, name: slug }))];
  const toolOptions = [...TOOLS, ...state.tools.filter(slug => !TOOLS.some(t => t.slug === slug)).map(toolOption)];
  // USG console templates are global, so USG internal notes stay out (kept only to let a stored choice be removed).
  const sourceOptions = SOURCE_KINDS.filter(s => s.slug !== 'usg_internal' || state.sourceKinds.includes(s.slug));
  const tierOptions: Tier[] = CLUB_TIERS.includes(state.maxTier) ? [...CLUB_TIERS] : [...CLUB_TIERS, state.maxTier];

  function review(event: FormEvent) {
    event.preventDefault(); setFormError(null);
    const found = validate(state); setErrors(found);
    if (Object.keys(found).length) { setFormError('Some settings need a fix. Each one says what to change.'); return; }
    if (latest && !changes.length) { setFormError(`Nothing differs from version ${latest.version} yet. Change a setting before publishing version ${next}.`); return; }
    mutation.clear(); setOpen(true);
  }
  function publish() {
    mutation.run(async () => {
      const result = await mutation.request(`/api/templates/${data.template.id}/versions`, 'POST', body) as { version: number };
      return `Version ${result.version} published.`;
    }, () => { setOpen(false); setEditing(false); });
  }
  function cancel() { setState(initialState(latest)); setErrors({}); setFormError(null); setEditing(false); }

  // Opened from the summary's "Edit configuration" button; nothing shows until then.
  if (!editing) return mutation.success ? <SuccessNotice message={mutation.success} /> : null;
  return <section id="edit-configuration" aria-labelledby="edit-configuration-title" className="space-y-4 rounded-md border border-border p-4">
    <div><h2 id="edit-configuration-title" ref={heading} tabIndex={-1} className="text-xl font-semibold leading-7">Edit configuration</h2>
      <p className="mt-1 text-muted-foreground">Publishes as version {next}</p></div>
    <form onSubmit={review} noValidate className="max-w-[640px] space-y-6">
      <div><Label htmlFor="version-purpose">Purpose</Label>
        <Input id="version-purpose" value={state.purpose} onChange={e => set('purpose', e.target.value)} aria-invalid={!!errors.purpose} aria-describedby={errors.purpose ? 'version-purpose-error' : undefined} />
        {errors.purpose && <p id="version-purpose-error" className="mt-1 flex items-center gap-1 text-primary"><CircleAlert aria-hidden="true" className="size-3 shrink-0" />{errors.purpose}</p>}</div>

      <Field id="version-audience" legend="Audience">
        <RadioGroup value={state.audience} onValueChange={v => set('audience', v as Audience)} className="gap-2" aria-label="Audience">
          {AUDIENCES.map(a => <Choice key={a.slug} id={`audience-${a.slug}`} title={a.name} description={a.description}
            control={<RadioGroupItem id={`audience-${a.slug}`} value={a.slug} aria-describedby={`audience-${a.slug}-hint`} className="size-5" />} />)}
        </RadioGroup>
      </Field>

      {state.audience === 'positions' && <Field id="version-positions" legend="Positions" error={errors.usableBy}>
        <div className="grid gap-2 sm:grid-cols-2">{positionOptions.map(p => <label key={p.slug} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 has-[:checked]:border-input has-[:checked]:bg-muted">
          <Checkbox checked={state.usableBy.includes(p.slug)} onChange={e => set('usableBy', toggle(state.usableBy, p.slug, e.target.checked))} />{p.name}</label>)}</div>
      </Field>}

      <div><Label htmlFor="version-prompt">Instructions</Label>
        <Textarea id="version-prompt" value={state.systemPrompt} onChange={e => set('systemPrompt', e.target.value)} rows={12} className="text-base leading-6" aria-invalid={!!errors.systemPrompt} aria-describedby={errors.systemPrompt ? 'version-prompt-error' : undefined} />
        {errors.systemPrompt && <p id="version-prompt-error" className="mt-1 flex items-center gap-1 text-primary"><CircleAlert aria-hidden="true" className="size-3 shrink-0" />{errors.systemPrompt}</p>}</div>

      <div ref={sourceHeading} tabIndex={-1} className="space-y-2">
        <Field id="version-sources" legend="Knowledge sources" error={errors.sourceKinds}>
          <div className="space-y-2">{sourceOptions.map(s => <Choice key={s.slug} id={`source-${s.slug}`} title={s.name} description={s.description} tag={scopeLabel(s.owner)}
            control={<Checkbox id={`source-${s.slug}`} aria-describedby={`source-${s.slug}-hint`} checked={state.sourceKinds.includes(s.slug)} onChange={e => set('sourceKinds', toggle(state.sourceKinds, s.slug, e.target.checked))} />} />)}</div>
        </Field>
        <p className="text-sm text-muted-foreground">Source connections and access limits are saved in the new template version. Connected libraries supply their latest document versions.</p>
      </div>

      <Field id="version-tier" legend="Reads up to">
        {state.audience === 'public' ? <p className="rounded-md border border-border px-3 py-2 font-semibold">{TIERS.public.name}</p>
          : <><RadioGroup value={state.maxTier} onValueChange={v => set('maxTier', v as Tier)} className="gap-2" aria-label="Reads up to">
            {tierOptions.map(t => <Choice key={t} id={`tier-${t}`} title={TIERS[t].name} description={TIERS[t].plain}
              control={<RadioGroupItem id={`tier-${t}`} value={t} aria-describedby={`tier-${t}-hint`} className="size-5" />} />)}
          </RadioGroup></>}
      </Field>

      <Field id="version-tools" legend="Tools">
        <div className="space-y-2">{toolOptions.map(t => <Choice key={t.slug} id={`tool-${t.slug}`} title={t.name} description={t.description}
          control={<Checkbox id={`tool-${t.slug}`} aria-describedby={t.description ? `tool-${t.slug}-hint` : undefined} checked={state.tools.includes(t.slug)} onChange={e => set('tools', toggle(state.tools, t.slug, e.target.checked))} />} />)}</div>
      </Field>

      <Field id="version-models" legend="Model classes" error={errors.modelClasses}>
        <p className="text-muted-foreground">Demo models use the mock runtime. The allowed choices and default are saved by pricing class.</p>
        <div className="grid gap-2 sm:grid-cols-2">{MODEL_ORDER.map(m => <Choice key={m} id={`model-${m}`} title={MODEL_CLASSES[m].name} description={demoModelDescription(m)}
          control={<Checkbox id={`model-${m}`} aria-describedby={`model-${m}-hint`} checked={state.modelClasses.includes(m)} onChange={e => {
            const classes = MODEL_ORDER.filter(x => x === m ? e.target.checked : state.modelClasses.includes(x));
            setState(s => ({ ...s, modelClasses: classes, defaultModelClass: classes.includes(s.defaultModelClass) ? s.defaultModelClass : classes[0] ?? s.defaultModelClass }));
          }} />} />)}</div>
        <div className="max-w-xs"><Label htmlFor="version-model">Default model</Label>
          <select id="version-model" className={selectClass} value={state.defaultModelClass} onChange={e => set('defaultModelClass', e.target.value as ModelClass)}>
            {MODEL_ORDER.filter(m => state.modelClasses.includes(m)).map(m => <option key={m} value={m}>{demoModelDefault(m)} · {MODEL_CLASSES[m].name}</option>)}</select></div>
      </Field>

      <div><Label htmlFor="version-changes">Change note</Label>
        <Textarea id="version-changes" value={state.changelog} onChange={e => set('changelog', e.target.value)} rows={2} /></div>

      {formError && <Alert variant="destructive"><CircleAlert aria-hidden="true" /><div><AlertTitle>Cannot review yet</AlertTitle><AlertDescription>{formError}</AlertDescription></div></Alert>}
      <div className="flex flex-wrap gap-2"><Button type="submit">Review version {next}</Button><Button type="button" variant="ghost" onClick={cancel}>Cancel</Button></div>
    </form>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl" aria-describedby={undefined}>
      <DialogHeader><DialogTitle>Publish version {next} of {data.template.name}?</DialogTitle></DialogHeader>
      <VersionReview templateName={data.template.name} nextVersion={next} currentVersion={latest?.version ?? null} changes={changes}
        reach={reachSentences(body, data.template.installedCount, ctx)} changelog={state.changelog} />
      <ErrorNotice message={mutation.error} />
      <DialogFooter><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Back to edit</Button><PendingButton pending={mutation.pending} onClick={publish}>Publish version {next}</PendingButton></DialogFooter>
    </DialogContent></Dialog>
  </section>;
}
