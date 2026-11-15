// Owner: B. The configuration editor's draft: the POST body for /api/templates/:id/versions (the
// same shape as versionDraftSchema), its validation, and the fields that differ from the current version.
import type { Audience, ModelClass, Tier } from '@/lib/contracts';
import type { UsgPackOption, UsgPositionOption, UsgVersion } from '@/lib/distribution/usg-view';
import { AUDIENCES, audienceLabel, MODEL_CLASSES, MODEL_ORDER, plural, SOURCE_KINDS, sourceName, TIERS, toolOption } from '../template-config';

export interface EditorState {
  purpose: string; audience: Audience; usableBy: string[]; maxTier: Tier; sourceKinds: string[]; tools: string[];
  modelClasses: ModelClass[]; defaultModelClass: ModelClass; systemPrompt: string; rulePackSlug: string; changelog: string;
}
export interface VersionBody {
  purpose: string; audience: Audience; usableBy: string[]; maxTier: Tier; sourceKinds: string[]; tools: string[];
  modelClasses: ModelClass[]; defaultModelClass: ModelClass; systemPrompt: string; rulePackSlug: string | null; changelog: string;
}
export const initialState = (latest: UsgVersion | undefined): EditorState => ({
  purpose: latest?.purpose ?? '', audience: latest?.audience ?? 'members', usableBy: latest?.usableBy ?? [],
  maxTier: latest?.maxTier ?? 'members', sourceKinds: latest?.sourceKinds ?? [], tools: latest?.tools ?? [],
  modelClasses: latest?.modelClasses ?? ['economy'], defaultModelClass: latest?.defaultModelClass ?? 'economy',
  systemPrompt: latest?.systemPrompt ?? '', rulePackSlug: latest?.rulePackSlug ?? '', changelog: '',
});
/** The request body, unchanged from the slug-based form: positions only for a positions audience, Public for All students. */
export const toBody = (s: EditorState): VersionBody => ({
  purpose: s.purpose.trim(), audience: s.audience, usableBy: s.audience === 'positions' ? s.usableBy : [],
  maxTier: s.audience === 'public' ? 'public' : s.maxTier, sourceKinds: s.sourceKinds, tools: s.tools,
  modelClasses: MODEL_ORDER.filter(m => s.modelClasses.includes(m)), defaultModelClass: s.defaultModelClass,
  systemPrompt: s.systemPrompt, rulePackSlug: s.rulePackSlug.trim() || null, changelog: s.changelog,
});

export type EditorField = 'purpose' | 'usableBy' | 'sourceKinds' | 'modelClasses' | 'systemPrompt';
export function validate(s: EditorState): Partial<Record<EditorField, string>> {
  const errors: Partial<Record<EditorField, string>> = {};
  if (!s.purpose.trim()) errors.purpose = 'Say in one sentence what it does, for example “Checks a funding request against the USG funding rules before you submit it.”';
  if (s.audience === 'positions' && !s.usableBy.length) errors.usableBy = 'Choose at least one position, or choose All members.';
  if (s.sourceKinds.some(k => !SOURCE_KINDS.some(o => o.slug === k))) errors.sourceKinds = 'Use only the knowledge sources listed here.';
  if (!s.modelClasses.length || !s.modelClasses.includes(s.defaultModelClass)) errors.modelClasses = 'Allow at least one model class and make the default one of them.';
  if (!s.systemPrompt.trim()) errors.systemPrompt = 'Write the instructions the agent follows before every request.';
  return errors;
}

export interface FieldChange { field: string; before: string; after: string; detail?: string }
export interface ChangeContext { positions: UsgPositionOption[]; rulePacks: UsgPackOption[] }
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every(x => b.includes(x));
const list = (values: string[], name: (v: string) => string) => values.length ? values.map(name).join(', ') : 'None';
const packName = (slug: string | null, packs: UsgPackOption[]) => !slug ? 'None' : packs.find(p => p.slug === slug)?.label ?? slug;
const audienceName = (a: Audience) => AUDIENCES.find(x => x.slug === a)?.name ?? a;
const words = (text: string) => plural(text.trim() ? text.trim().split(/\s+/).length : 0, 'word');

/** Each setting whose value differs from `before` (the current version), in the editor's order. */
export function versionChanges(before: UsgVersion | undefined, after: VersionBody, ctx: ChangeContext): FieldChange[] {
  const changes: FieldChange[] = []; const none = 'Not set';
  const add = (field: string, differs: boolean, from: string, to: string, detail?: string) => { if (differs) changes.push({ field, before: from, after: to, ...(detail ? { detail } : {}) }); };
  add('Purpose', before?.purpose !== after.purpose, before?.purpose ?? none, after.purpose);
  add('Audience', before?.audience !== after.audience, before ? audienceName(before.audience) : none, audienceName(after.audience));
  add('Positions', !sameSet(before?.usableBy ?? [], after.usableBy),
    before?.usableBy.length ? audienceLabel('positions', before.usableBy, ctx.positions) : 'None', after.usableBy.length ? audienceLabel('positions', after.usableBy, ctx.positions) : 'None');
  add('Instructions', before?.systemPrompt !== after.systemPrompt, before ? words(before.systemPrompt) : none, `${words(after.systemPrompt)}, edited`, after.systemPrompt);
  add('Knowledge sources', !sameSet(before?.sourceKinds ?? [], after.sourceKinds), list(before?.sourceKinds ?? [], sourceName), list(after.sourceKinds, sourceName));
  add('Reads up to', before?.maxTier !== after.maxTier, before ? TIERS[before.maxTier].name : none, TIERS[after.maxTier].name);
  add('Rule pack', (before?.rulePackSlug ?? null) !== after.rulePackSlug, packName(before?.rulePackSlug ?? null, ctx.rulePacks), packName(after.rulePackSlug, ctx.rulePacks));
  add('Tools', !sameSet(before?.tools ?? [], after.tools), list(before?.tools ?? [], t => toolOption(t).name), list(after.tools, t => toolOption(t).name));
  add('Model classes', !sameSet(before?.modelClasses ?? [], after.modelClasses), list(MODEL_ORDER.filter(m => before?.modelClasses.includes(m)), m => MODEL_CLASSES[m as ModelClass].name), list(after.modelClasses, m => MODEL_CLASSES[m as ModelClass].name));
  add('Default model', before?.defaultModelClass !== after.defaultModelClass, before ? MODEL_CLASSES[before.defaultModelClass].name : none, MODEL_CLASSES[after.defaultModelClass].name);
  return changes;
}

const and = (items: string[]) => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** Who the new version reaches and what it may read, for the review step. */
export function reachSentences(body: VersionBody, installedCount: number, ctx: ChangeContext): string[] {
  const clubs = installedCount ? `each of the ${plural(installedCount, 'installed club')}` : 'each club that installs it (none yet)';
  const who = body.audience === 'public' ? `Any signed-in student can use it, through ${clubs}.`
    : body.audience === 'members' ? `Every member of ${clubs} can use it.`
    : `${and(body.usableBy.map(slug => audienceLabel('positions', [slug], ctx.positions)))} in ${clubs} can use it.`;
  const sources = body.sourceKinds.length ? `from ${and(body.sourceKinds.map(sourceName))}` : 'but has no knowledge sources';
  return [
    who,
    'Clubs tracking Latest use it on their next run. Clubs that pinned an older version keep theirs and see “Update available”.',
    `It can read up to ${TIERS[body.maxTier].name} documents ${sources}. It never reads more than the person running it can.`,
  ];
}
