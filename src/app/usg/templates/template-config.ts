// Owner: B. Plain-English names and one-line explanations for agent-template settings, shared by the
// read-only summary and the configuration editor on /usg/templates/[templateId].
import { DEMO_MODELS } from '@/components/inspector/demo-models';
import type { Audience, ModelClass, Tier } from '@/lib/contracts';
import { creditLabel, priceMicro } from '@/lib/gateway/prices';
import { positionName } from '@/lib/distribution/labels';

export type SourceKind = 'public' | 'minutes' | 'archive' | 'finance' | 'rulebook' | 'usg_internal';
export const SOURCE_KINDS: ReadonlyArray<{ slug: SourceKind; name: string; owner: 'club' | 'usg'; description: string }> = [
  { slug: 'public', name: 'Public pages', owner: 'club', description: 'Readable by anyone signed in.' },
  { slug: 'minutes', name: 'Meeting minutes', owner: 'club', description: 'Readable by club members.' },
  { slug: 'archive', name: 'Past events', owner: 'club', description: 'Readable by club members.' },
  { slug: 'finance', name: 'Club finances', owner: 'club', description: 'Budgets and sponsor contacts. Readable by the positions the president grants.' },
  { slug: 'rulebook', name: 'USG rulebook', owner: 'usg', description: 'USG’s published rules.' },
  { slug: 'usg_internal', name: 'USG internal notes', owner: 'usg', description: 'USG reviewers’ notes.' },
];
export const sourceName = (slug: string) => SOURCE_KINDS.find(s => s.slug === slug)?.name ?? slug;
export const scopeLabel = (owner: 'club' | 'usg' | undefined) => owner === 'usg' ? 'USG library' : 'Each club';

export const TIERS: Record<Tier, { name: string; plain: string }> = {
  public: { name: 'Public', plain: 'Public documents.' },
  members: { name: 'Members', plain: 'Public and member documents.' },
  officers: { name: 'Officers', plain: 'Public, member and officer documents.' },
  usg_internal: { name: 'USG internal', plain: 'All documents, including USG internal notes.' },
};
/** Global templates reach clubs, so the server refuses USG internal for them. */
export const CLUB_TIERS: readonly Tier[] = ['public', 'members', 'officers'];
const TIER_ORDER: readonly Tier[] = ['public', 'members', 'officers', 'usg_internal'];
/** Whether a document of `tier` is at or below an agent's max tier. */
export const withinTier = (tier: Tier, maxTier: Tier) => TIER_ORDER.indexOf(tier) <= TIER_ORDER.indexOf(maxTier);

export const AUDIENCES: ReadonlyArray<{ slug: Audience; name: string; description: string }> = [
  { slug: 'public', name: 'All students', description: 'Anyone signed in with a USC account. Public documents only.' },
  { slug: 'members', name: 'All members', description: 'Every member of each club.' },
  { slug: 'positions', name: 'Named positions', description: 'Only the positions you choose.' },
];

export interface ToolOption { slug: string; name: string; description?: string }
export const TOOLS: readonly ToolOption[] = [
  // The name matches the inspector's humanizeTool (src/components/inspector/format.ts).
  { slug: 'submit_to_queue', name: 'Submit to queue', description: 'Proposes filing the application in USG’s queue; the user confirms.' },
];
export const toolOption = (slug: string): ToolOption => TOOLS.find(t => t.slug === slug) ?? { slug, name: slug };

export const MODEL_CLASSES: Record<ModelClass, { name: string }> = {
  economy: { name: 'Economy' },
  standard: { name: 'Standard' },
};
export const MODEL_ORDER: readonly ModelClass[] = ['economy', 'standard'];
export const demoModelNames = (modelClass: ModelClass) =>
  DEMO_MODELS.filter(model => model.modelClass === modelClass).map(model => model.label);
export const demoModelDefault = (modelClass: ModelClass) =>
  demoModelNames(modelClass)[0] ?? MODEL_CLASSES[modelClass].name;
export const demoModelDescription = (modelClass: ModelClass) =>
  `${demoModelNames(modelClass).join(', ')} · ${creditLabel(priceMicro(modelClass))} per run`;

/** "All students", "All members", or the position names ("Treasurer, President"). */
export function audienceLabel(audience: Audience, usableBy: string[], names: ReadonlyArray<{ slug: string; name: string }> = []): string {
  if (audience === 'public') return 'All students';
  if (audience === 'members') return 'All members';
  return usableBy.map(slug => names.find(p => p.slug === slug)?.name ?? positionName(slug)).join(', ');
}
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
