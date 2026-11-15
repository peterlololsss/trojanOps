// Owner: B. Plain-English names and one-line explanations for agent-template settings, shared by the
// template cards, the builder and its preview on /usg/templates.
import { classOf, DEMO_MODELS, MODEL_PROVIDERS, type DemoModel, type ModelId } from '@/lib/gateway/models';
import type { Audience, Tier } from '@/lib/contracts';
import { creditLabel, MODEL_LABELS, priceMicro } from '@/lib/gateway/prices';
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

/** The models a new template offers: every economy model, with gpt-6-luna first in chat. */
export const NEW_TEMPLATE_MODELS: { readonly modelIds: ModelId[]; readonly defaultModelId: ModelId } = {
  modelIds: ['gpt-6-luna', 'claude-haiku-5-5', 'gemini-4-hydrogen'], defaultModelId: 'gpt-6-luna',
};
/** "Economy" or "Standard": the pricing class a model id is billed at. */
export const modelClassName = (id: ModelId) => MODEL_LABELS[classOf(id)];
/** "1 credit per run" or "3 credits per run". */
export const modelPrice = (id: ModelId) => `${creditLabel(priceMicro(classOf(id)))} per run`;
/** The registry's models grouped by provider, in registry order. */
export const MODELS_BY_PROVIDER: ReadonlyArray<{ provider: string; models: readonly DemoModel[] }> =
  MODEL_PROVIDERS.map(provider => ({ provider, models: DEMO_MODELS.filter(model => model.provider === provider) }));

/** "All students", "All members", or the position names ("Treasurer, President"). */
export function audienceLabel(audience: Audience, usableBy: string[], names: ReadonlyArray<{ slug: string; name: string }> = []): string {
  if (audience === 'public') return 'All students';
  if (audience === 'members') return 'All members';
  return usableBy.map(slug => names.find(p => p.slug === slug)?.name ?? positionName(slug)).join(', ');
}
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
