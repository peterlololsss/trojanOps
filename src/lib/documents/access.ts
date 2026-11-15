// Owner: C (WP-8). listAccessibleDocuments is the RLS query behind gateway step 5 (§10), read inside
// withActor. explainAccess is the §10 rule and stays pure; tests/documents.test.ts holds them together.
import { asc } from 'drizzle-orm';
import type { AccessCell, AccessibleDocument, Actor, EffectiveAgent, Grant, Tier } from '../contracts';
import { documents } from '../db/schema';
import { withActor } from '../db/with-actor';

/** The documents a run may read: read_grants overlap runGrants and the source is one of the agent's
 * (gateway step 5). Oldest first, then by title: the order is stable across runs, and the mock
 * runtime cites the first three. */
export async function listAccessibleDocuments(
  actor: Actor,
  runGrants: Grant[],
  sourceIds: string[],
): Promise<AccessibleDocument[]> {
  // No where clause: the documents_read policy is the filter, and a copy of it here would hide an RLS failure.
  return withActor(actor, { grants: runGrants, sourceIds }, async (tx) =>
    tx.select({ id: documents.id, title: documents.title, tier: documents.tier, bodyMd: documents.bodyMd })
      .from(documents)
      .orderBy(asc(documents.createdAt), asc(documents.title)));
}

export interface AccessDocument {
  sourceId: string;
  tier: Tier;
  readGrants: string[];
}

const TIER_RANK: Record<Tier, number> = { public: 0, members: 1, officers: 2, usg_internal: 3 };

/** Why a subject can or can't read a document through an agent, checked in §10 order. */
export function explainAccess(
  subjectGrants: Grant[],
  agent: Pick<EffectiveAgent, 'sourceIds' | 'maxTier'>,
  doc: AccessDocument,
): AccessCell {
  if (!agent.sourceIds.includes(doc.sourceId)) return 'outside_sources';
  if (TIER_RANK[doc.tier] > TIER_RANK[agent.maxTier]) return 'above_max_tier';
  if (!doc.readGrants.some((g) => subjectGrants.includes(g as Grant))) return 'not_granted';
  return 'allowed';
}
