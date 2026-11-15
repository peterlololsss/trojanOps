'use client';

// Owner: B. The Configure tab on /usg/templates/[templateId]: the next version as an always-editable
// form on the left and a live chat preview on the right. The publish bar counts what differs from the
// published version and reviews it, with who it reaches, before POST /api/templates/:id/versions
// (version-draft.ts holds the body, validation and change list).
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Check, CircleAlert, CircleDot } from 'lucide-react';
import { ModelPicker } from '@/components/inspector/model-picker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { Audience, Tier } from '@/lib/contracts';
import type { UsgTemplateView } from '@/lib/distribution/usg-view';
import { DEMO_MODELS, orderedModelIds, type ModelId } from '@/lib/gateway/models';
import { absoluteTime, ErrorNotice, PendingButton, useConsoleMutation } from '../console-ui';
import {
  AUDIENCES, CLUB_TIERS, modelClassName, modelPrice, MODELS_BY_PROVIDER, plural, scopeLabel, SOURCE_KINDS, TIERS, TOOLS, toolOption,
} from '../template-config';
import { TemplatePreview } from './template-preview';
import {
  initialState, reachSentences, toBody, validate, versionChanges, words, type EditorField, type EditorState, type FieldChange,
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

/** A titled part of the form. The title takes focus when another tab links here. */
function BuilderSection({ id, title, hint, children }: { id: string; title: ReactNode; hint?: string; children: ReactNode }) {
  return <section id={id} aria-labelledby={`${id}-title`} className="space-y-3 border-t border-border pt-6 first:border-t-0 first:pt-0">
    <div>
      <h2 id={`${id}-title`} tabIndex={-1} className="text-base font-semibold leading-6">{title}</h2>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
    {children}
  </section>;
}
function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="flex items-center gap-1 text-sm text-primary"><CircleAlert aria-hidden="true" className="size-3 shrink-0" />{message}</p> : null;
}
/** One option in a compact bordered list: the whole row is the control's label. */
function OptionRow({ control, title, description, aside, descriptionId }: { control: ReactNode; title: ReactNode; description?: string; aside?: ReactNode; descriptionId?: string }) {
  return <label className="flex min-h-10 cursor-pointer items-start gap-3 px-3 py-2 hover:bg-accent has-[:checked]:bg-muted has-[[data-state=checked]]:bg-muted has-[:disabled]:cursor-not-allowed">
    <span className="flex h-6 items-center">{control}</span>
    <span className="min-w-0 flex-1"><span className="block font-semibold leading-6">{title}</span>
      {description && <span id={descriptionId} className="block text-xs leading-4 text-muted-foreground">{description}</span>}</span>
    {aside && <span className="shrink-0 pt-0.5 text-xs leading-5 text-muted-foreground">{aside}</span>}
  </label>;
}
const LIST = 'divide-y divide-border overflow-hidden rounded-md border border-border';
const toggle = (values: string[], value: string, on: boolean) => on ? [...values.filter(v => v !== value), value] : values.filter(v => v !== value);
/** The first control of the first invalid field, in the form's order. */
const FIELD_TARGETS: ReadonlyArray<[EditorField, string]> = [
  ['purpose', 'version-purpose'], ['systemPrompt', 'version-prompt'], ['sourceKinds', 'builder-knowledge-title'],
  ['modelIds', 'builder-models-title'], ['usableBy', 'builder-access-title'],
];

export function VersionEditor({ data }: { data: UsgTemplateView }) {
  const { template } = data; const retired = template.status === 'retired';
  const latest = data.versions.find(v => v.version === template.latestVersion) ?? data.versions[0];
  const next = template.latestVersion + 1;
  const formId = useId();
  const [state, setState] = useState<EditorState>(() => initialState(latest));
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null); const [open, setOpen] = useState(false);
  const mutation = useConsoleMutation();
  const ctx = { positions: data.positions };
  const body = toBody(state); const changes = versionChanges(latest, body, ctx);
  // Validated on submit; after that, each error clears as soon as its field is fixed.
  const errors = submitted ? validate(state) : {};
  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) => { setFormError(null); setState(s => ({ ...s, [key]: value })); };

  const positionOptions = [...data.positions, ...state.usableBy.filter(slug => !data.positions.some(p => p.slug === slug)).map(slug => ({ slug, name: slug }))];
  const toolOptions = [...TOOLS, ...state.tools.filter(slug => !TOOLS.some(t => t.slug === slug)).map(toolOption)];
  // USG console templates are global, so USG internal notes stay out (kept only to let a stored choice be removed).
  const sourceOptions = SOURCE_KINDS.filter(s => s.slug !== 'usg_internal' || state.sourceKinds.includes(s.slug));
  const tierOptions: Tier[] = CLUB_TIERS.includes(state.maxTier) ? [...CLUB_TIERS] : [...CLUB_TIERS, state.maxTier];
  const offered = DEMO_MODELS.filter(model => state.modelIds.includes(model.id));

  function toggleModel(id: ModelId, on: boolean) {
    setFormError(null);
    setState(s => {
      const ids = orderedModelIds(on ? [...s.modelIds, id] : s.modelIds.filter(x => x !== id));
      return { ...s, modelIds: ids, defaultModelId: ids.includes(s.defaultModelId) ? s.defaultModelId : ids[0] ?? s.defaultModelId };
    });
  }
  function review(event: FormEvent) {
    event.preventDefault(); if (retired) return;
    setSubmitted(true); setFormError(null);
    const found = validate(state);
    const first = FIELD_TARGETS.find(([field]) => found[field]);
    if (first) { setFormError('Some settings need a fix. Each one says what to change.'); document.getElementById(first[1])?.focus(); return; }
    if (latest && !changes.length) { setFormError(`Nothing differs from version ${latest.version} yet. Change a setting before publishing version ${next}.`); return; }
    mutation.clear(); setOpen(true);
  }
  function publish() {
    mutation.run(async () => {
      await mutation.request(`/api/templates/${template.id}/versions`, 'POST', body);
      // The page remounts on the new version; its publish bar then reads "Version N · published".
      return '';
    }, () => setOpen(false));
  }
  function discard() { setState(initialState(latest)); setSubmitted(false); setFormError(null); }

  return <div className="space-y-6">
    <div className="sticky top-0 z-20 -mx-6 border-b border-border bg-background px-6 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="font-semibold">{latest ? <>Version {latest.version} · published <time dateTime={latest.publishedAt} className="font-mono text-xs font-normal">{absoluteTime(latest.publishedAt)}</time></> : 'No version published yet'}</p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            {retired ? 'Retired templates cannot publish new versions.'
              : !latest ? 'Draft of version 1'
              : changes.length ? <><CircleDot aria-hidden="true" className="size-3 text-attention-ink" />{plural(changes.length, 'unpublished change')}</>
              : <><Check aria-hidden="true" className="size-3 text-success" />No unpublished changes</>}
          </p>
        </div>
        {!retired && <div className="flex flex-wrap gap-2">
          {changes.length > 0 && latest && <Button type="button" variant="ghost" onClick={discard}>Discard</Button>}
          <Button type="submit" form={formId}>Review and publish v{next}</Button>
        </div>}
      </div>
      {formError && <Alert variant="destructive" className="mt-3"><CircleAlert aria-hidden="true" /><div><AlertTitle>Cannot review yet</AlertTitle><AlertDescription>{formError}</AlertDescription></div></Alert>}
    </div>

    <div className="grid gap-8 lg:grid-cols-[minmax(0,640px)_1fr] lg:items-start">
      <form id={formId} onSubmit={review} noValidate aria-label={`Configure version ${next}`}>
        <fieldset disabled={retired} className="min-w-0 space-y-6">
          <BuilderSection id="builder-details" title="Details">
            <div><Label htmlFor="version-purpose">Purpose</Label>
              <Input id="version-purpose" value={state.purpose} onChange={e => set('purpose', e.target.value)} aria-invalid={!!errors.purpose}
                aria-describedby={errors.purpose ? 'version-purpose-error' : 'version-purpose-hint'} />
              <p id="version-purpose-hint" className="mt-1 text-xs leading-4 text-muted-foreground">One sentence. Members see it above the chat.</p>
              <FieldError id="version-purpose-error" message={errors.purpose} /></div>
          </BuilderSection>

          <BuilderSection id="builder-instructions" title={<label htmlFor="version-prompt">Instructions</label>} hint="What the agent follows before every request.">
            <div><Textarea id="version-prompt" value={state.systemPrompt} onChange={e => set('systemPrompt', e.target.value)} rows={14} className="text-base leading-6"
              aria-invalid={!!errors.systemPrompt} aria-describedby={`version-prompt-count${errors.systemPrompt ? ' version-prompt-error' : ''}`} />
              <div className="mt-1 flex items-start justify-between gap-4">
                <FieldError id="version-prompt-error" message={errors.systemPrompt} />
                <p id="version-prompt-count" className="ml-auto text-xs leading-4 tabular-nums text-muted-foreground">{words(state.systemPrompt)}</p>
              </div></div>
          </BuilderSection>

          <BuilderSection id="builder-knowledge" title="Knowledge" hint="Each club supplies its own documents; USG supplies its library. Permissions apply on every run.">
            <div role="group" aria-label="Knowledge sources" className={LIST}>
              {sourceOptions.map(s => <OptionRow key={s.slug} title={s.name} description={s.description} descriptionId={`source-${s.slug}-hint`} aside={scopeLabel(s.owner)}
                control={<Checkbox aria-describedby={`source-${s.slug}-hint`} checked={state.sourceKinds.includes(s.slug)} onChange={e => set('sourceKinds', toggle(state.sourceKinds, s.slug, e.target.checked))} />} />)}
            </div>
            <FieldError id="version-sources-error" message={errors.sourceKinds} />
            <div className="space-y-2 pt-2">
              <h3 id="version-tier-title" className="text-sm font-semibold">Reads up to</h3>
              {state.audience === 'public' ? <p className="rounded-md border border-border px-3 py-2"><span className="font-semibold">{TIERS.public.name}</span>
                <span className="block text-xs leading-4 text-muted-foreground">Agents for all students read Public documents only.</span></p>
                : <RadioGroup value={state.maxTier} onValueChange={v => set('maxTier', v as Tier)} aria-labelledby="version-tier-title" className={`${LIST} gap-0`}>
                  {tierOptions.map(t => <OptionRow key={t} title={TIERS[t].name} description={TIERS[t].plain} descriptionId={`tier-${t}-hint`}
                    control={<RadioGroupItem value={t} aria-describedby={`tier-${t}-hint`} className="size-5" />} />)}
                </RadioGroup>}
            </div>
          </BuilderSection>

          <BuilderSection id="builder-tools" title="Tools" hint="Tools that change something wait for the member to confirm.">
            <div className={LIST}>
              {toolOptions.map(t => <OptionRow key={t.slug} title={t.name} description={t.description} descriptionId={`tool-${t.slug}-hint`}
                control={<Switch checked={state.tools.includes(t.slug)} aria-describedby={t.description ? `tool-${t.slug}-hint` : undefined}
                  onCheckedChange={on => set('tools', toggle(state.tools, t.slug, on))} />} />)}
            </div>
          </BuilderSection>

          <BuilderSection id="builder-models" title="Models" hint="Members choose from these in chat. Each run is paid from the club’s budget at the model’s price.">
            <div role="group" aria-label="Models offered" className={LIST}>
              {MODELS_BY_PROVIDER.map(group => <div key={group.provider} role="group" aria-labelledby={`provider-${group.provider}`}>
                <p id={`provider-${group.provider}`} className="bg-muted px-3 py-1 text-xs font-semibold leading-5 text-muted-foreground">{group.provider}</p>
                {group.models.map(model => <label key={model.id} className="flex min-h-10 cursor-pointer items-center gap-3 border-t border-border px-3 py-2 hover:bg-accent has-[:disabled]:cursor-not-allowed">
                  <Checkbox checked={state.modelIds.includes(model.id)} onChange={e => toggleModel(model.id, e.target.checked)} />
                  <span className="min-w-0 flex-1 font-mono text-sm">{model.label}</span>
                  <span className="w-20 text-sm text-muted-foreground">{modelClassName(model.id)}</span>
                  <span className="w-32 text-right text-sm tabular-nums">{modelPrice(model.id)}</span>
                </label>)}
              </div>)}
            </div>
            <FieldError id="version-models-error" message={errors.modelIds} />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
              <span className="text-sm font-semibold">Default in chat</span>
              {offered.length ? <>
                <ModelPicker choices={offered} value={state.defaultModelId} onChange={id => set('defaultModelId', id)} label="Default in chat" disabled={retired}
                  className="h-9 border border-input px-3 text-sm" />
                <span className="text-sm tabular-nums text-muted-foreground">{modelPrice(state.defaultModelId)}</span>
              </> : <span className="text-sm text-muted-foreground">Choose a model above first.</span>}
            </div>
          </BuilderSection>

          <BuilderSection id="builder-access" title="Access" hint="Who can use the agent in each club that installs it.">
            <RadioGroup value={state.audience} onValueChange={v => set('audience', v as Audience)} aria-label="Audience" className={`${LIST} gap-0`}>
              {AUDIENCES.map(a => <OptionRow key={a.slug} title={a.name} description={a.description} descriptionId={`audience-${a.slug}-hint`}
                control={<RadioGroupItem value={a.slug} aria-describedby={`audience-${a.slug}-hint`} className="size-5" />} />)}
            </RadioGroup>
            {state.audience === 'positions' && <fieldset aria-describedby={errors.usableBy ? 'version-positions-error' : undefined} className="space-y-2">
              <legend className="text-sm font-semibold">Positions</legend>
              <div className="grid gap-2 sm:grid-cols-2">{positionOptions.map(p => <label key={p.slug} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-accent has-[:checked]:bg-muted">
                <Checkbox checked={state.usableBy.includes(p.slug)} onChange={e => set('usableBy', toggle(state.usableBy, p.slug, e.target.checked))} />{p.name}</label>)}</div>
              <FieldError id="version-positions-error" message={errors.usableBy} />
            </fieldset>}
          </BuilderSection>

          <BuilderSection id="builder-note" title={<label htmlFor="version-changes">Change note</label>} hint="Shown in version history.">
            <Textarea id="version-changes" value={state.changelog} onChange={e => set('changelog', e.target.value)} rows={2} />
          </BuilderSection>
        </fieldset>
      </form>

      <TemplatePreview name={template.name} slug={template.slug} versionLabel={changes.length || !latest ? `v${next} draft` : `v${latest.version}`}
        purpose={state.purpose.trim()} modelIds={state.modelIds} defaultModelId={state.defaultModelId} onDefaultModel={id => set('defaultModelId', id)} disabled={retired} />
    </div>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl" aria-describedby={undefined}>
      <DialogHeader><DialogTitle>Publish version {next} of {template.name}?</DialogTitle></DialogHeader>
      <VersionReview templateName={template.name} nextVersion={next} currentVersion={latest?.version ?? null} changes={changes}
        reach={reachSentences(body, template.installedCount, ctx)} changelog={state.changelog} />
      <ErrorNotice message={mutation.error} />
      <DialogFooter><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Back to edit</Button><PendingButton pending={mutation.pending} onClick={publish}>Publish version {next}</PendingButton></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
