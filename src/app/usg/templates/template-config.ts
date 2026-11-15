// Owner: B. Plain-English names and one-line explanations for agent-template settings, shared by the
// read-only summary and the configuration editor on /usg/templates/[templateId].
import type { Audience, ModelClass, Tier } from '@/lib/contracts';
import { positionName } from '@/lib/distribution/labels';

export type SourceKind = 'public' | 'minutes' | 'archive' | 'finance' | 'rulebook' | 'usg_internal';
export const SOURCE_KINDS: ReadonlyArray<{ slug: SourceKind; name: string; owner: 'club' | 'usg'; description: string }> = [
  { slug: 'public', name: 'Public pages', owner: 'club', description: 'Each club’s public documents, such as its recruiting FAQ. Anyone signed in can read them.' },
  { slug: 'minutes', name: 'Meeting minutes', owner: 'club', description: 'Each club’s meeting minutes. Club members can read them.' },
  { slug: 'archive', name: 'Past events', owner: 'club', description: 'Each club’s record of past events and venues. Club members can read them.' },
  { slug: 'finance', name: 'Club finances', owner: 'club', description: 'Each club’s own budgets and sponsor contacts. Only the positions the club president grants, usually Treasurer and President, can read them.' },
  { slug: 'rulebook', name: 'USG rulebook', owner: 'usg', description: 'USG’s published rules, the same documents in every club.' },
  { slug: 'usg_internal', name: 'USG internal notes', owner: 'usg', description: 'USG reviewers’ own notes. Agents that USG distributes to clubs never read them.' },
];
export const sourceName = (slug: string) => SOURCE_KINDS.find(s => s.slug === slug)?.name ?? slug;

export const TIERS: Record<Tier, { name: string; plain: string }> = {
  public: { name: 'Public', plain: 'Only documents anyone signed in can read.' },
  members: { name: 'Members', plain: 'Public documents and those for club members, such as meeting minutes.' },
  officers: { name: 'Officers', plain: 'Public, member and officer documents such as budgets, but only those the person’s own position can read.' },
  usg_internal: { name: 'USG internal', plain: 'Everything above plus USG reviewers’ notes. Only for USG’s own agents.' },
};
/** Global templates reach clubs, so the server refuses USG internal for them. */
export const CLUB_TIERS: readonly Tier[] = ['public', 'members', 'officers'];
const TIER_ORDER: readonly Tier[] = ['public', 'members', 'officers', 'usg_internal'];
/** Whether a document of `tier` is at or below an agent's max tier. */
export const withinTier = (tier: Tier, maxTier: Tier) => TIER_ORDER.indexOf(tier) <= TIER_ORDER.indexOf(maxTier);

export const AUDIENCES: ReadonlyArray<{ slug: Audience; name: string; description: string }> = [
  { slug: 'public', name: 'All students', description: 'Anyone signed in with a USC account, in the club or not. It reads public documents only.' },
  { slug: 'members', name: 'All members', description: 'Every member of each club that has it installed.' },
  { slug: 'positions', name: 'Named positions', description: 'Only the positions you choose, such as Treasurer, in each club.' },
];

export interface ToolOption { slug: string; name: string; description: string }
export const TOOLS: readonly ToolOption[] = [
  // The name matches the inspector's humanizeTool (src/components/inspector/format.ts).
  { slug: 'submit_to_queue', name: 'Submit to queue', description: 'Proposes filing the application in USG’s queue; the user confirms. In this demo, confirming records the decision only.' },
];
export const toolOption = (slug: string): ToolOption => TOOLS.find(t => t.slug === slug)
  ?? { slug, name: slug, description: 'A tool this template already uses. Write tools wait for the user’s confirmation.' };

export const MODEL_CLASSES: Record<ModelClass, { name: string; description: string }> = {
  economy: { name: 'Economy', description: 'A lighter model, enough for short answers from a few documents.' },
  standard: { name: 'Standard', description: 'A stronger model for longer checks.' },
};
export const MODEL_ORDER: readonly ModelClass[] = ['economy', 'standard'];

/**
 * The job each template is built for, with a person from the seed; shown after "Built for:". It
 * describes the intent: the mock runtime does not evaluate rules yet (WP-14).
 */
export const ROLE_EXAMPLES: Record<string, string> = {
  'funding-precheck': 'Taylor, Startup Club’s treasurer, checking the Demo day request before the Wednesday 11:59 PM deadline, so that $40 a person for catering shows up as over USG’s $35 limit before a reviewer has to deny it.',
  'event-planning': 'Sam, Startup Club’s president, planning Demo day: a room booked four weeks ahead and every approval with its due date.',
};

/** "All students", "All members", or the position names ("Treasurer, President"). */
export function audienceLabel(audience: Audience, usableBy: string[], names: ReadonlyArray<{ slug: string; name: string }> = []): string {
  if (audience === 'public') return 'All students';
  if (audience === 'members') return 'All members';
  return usableBy.map(slug => names.find(p => p.slug === slug)?.name ?? positionName(slug)).join(', ');
}
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
