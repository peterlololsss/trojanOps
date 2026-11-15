// Owner: C (WP-8, WP-9). listAccessibleDocuments is the RLS query behind gateway step 5 (§10), read
// inside withActor. explainAccess is the §10 rule and stays pure; tests/documents.test.ts holds them
// together. listBlockedDocuments fills RunInspector.blocked (§7 step 8); tests/inspector.test.ts.
import { and, asc, eq, inArray, or } from 'drizzle-orm';
import { grantsFor, isUsgAdmin } from '../authz';
import type { AccessCell, AccessibleDocument, Actor, EffectiveAgent, Grant, RunInspector, Tier } from '../contracts';
import { getDb } from '../db/client';
import { documents, orgs, sources } from '../db/schema';
import { withActor } from '../db/with-actor';

/** The documents a run may read: read_grants overlap runGrants and the source is one of the agent's
 * (gateway step 5), with the agent's max tier enforced by RLS. Oldest first, then by title: the
 * order is stable across runs, and the mock runtime cites the first three. */
export async function listAccessibleDocuments(
  actor: Actor,
  runGrants: Grant[],
  agent: Pick<EffectiveAgent, 'sourceIds' | 'maxTier'>,
): Promise<AccessibleDocument[]> {
  // No where clause: the documents_read policy is the filter, and a copy of it here would hide an RLS failure.
  return withActor(actor, { grants: runGrants, sourceIds: agent.sourceIds, maxTier: agent.maxTier }, async (tx) =>
    tx.select({ id: documents.id, title: documents.title, tier: documents.tier, bodyMd: documents.bodyMd, version: documents.version })
      .from(documents)
      .orderBy(asc(documents.createdAt), asc(documents.title)));
}

export interface AccessDocument {
  sourceId: string;
  tier: Tier;
  readGrants: string[];
}

export const TIER_RANK: Record<Tier, number> = { public: 0, members: 1, officers: 2, usg_internal: 3 };

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

/** A club's sources plus the USG rulebook: the scope of the permission preview's columns and of the
 * inspector's blocked list. sources and orgs have no RLS. */
export async function clubSourceIds(orgId: string): Promise<string[]> {
  const rows = await getDb().select({ id: sources.id }).from(sources)
    .innerJoin(orgs, eq(orgs.id, sources.orgId))
    .where(or(eq(sources.orgId, orgId), and(eq(orgs.kind, 'usg'), eq(sources.kind, 'rulebook'))));
  return rows.map((row) => row.id);
}

const sameGrants = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((g) => b.includes(g));

/**
 * RunInspector.blocked (§7 step 8): the documents a run couldn't read, with the §10 reason. Only the
 * club's president or a USG admin gets a list; anyone else gets undefined, and the inspector hides
 * the section.
 *
 * RLS can't reveal a row the viewer can't read, so candidates are the documents the viewer reads
 * through their own memberships in the agent's club (I3, as the library does), over the club's
 * sources, the USG rulebook and the agent's sources. Titles are then resolved under the viewer's own
 * grants (actor.grants); a candidate those grants can't read keeps its id with a null title
 * ("Restricted document"). A document the viewer can't read at all never appears.
 */
export async function listBlockedDocuments(
  viewer: Actor,
  agent: Pick<EffectiveAgent, 'orgId' | 'sourceIds' | 'maxTier'>,
  runGrants: Grant[],
  accessibleIds: string[],
): Promise<RunInspector['blocked']> {
  if (!viewer.userId) return undefined;
  // Recomputed per call: an ended presidency stops showing the list at once.
  const clubGrants = await grantsFor(viewer.userId, agent.orgId);
  if (!clubGrants.includes(`${agent.orgId}:president`) && !(await isUsgAdmin(viewer))) return undefined;

  const sourceIds = [...new Set([...(await clubSourceIds(agent.orgId)), ...agent.sourceIds])];
  // No where clause: the documents_read policy is the filter (as in listAccessibleDocuments).
  // Reads run one after another, never nested or in parallel (tests/db.ts).
  const candidates = await withActor(viewer, { grants: clubGrants, sourceIds }, (tx) =>
    tx.select({ id: documents.id, title: documents.title, tier: documents.tier,
      sourceId: documents.sourceId, readGrants: documents.readGrants })
      .from(documents));
  const accessible = new Set(accessibleIds);
  const blocked = candidates.flatMap((doc) => {
    if (accessible.has(doc.id)) return [];
    const reason = explainAccess(runGrants, agent, doc);
    // 'allowed' but not read: added after gateway step 5. Not blocked by a rule.
    return reason === 'allowed' ? [] : [{ doc, reason }];
  });
  if (blocked.length === 0) return [];

  let titles = new Map(blocked.map(({ doc }) => [doc.id, doc.title]));
  if (!sameGrants(viewer.grants, clubGrants)) {
    const ids = blocked.map(({ doc }) => doc.id);
    const own = await withActor(viewer, { sourceIds }, (tx) =>
      tx.select({ id: documents.id, title: documents.title }).from(documents).where(inArray(documents.id, ids)));
    titles = new Map(own.map((row) => [row.id, row.title]));
  }

  return blocked
    .map(({ doc, reason }) => ({ id: doc.id, title: titles.get(doc.id) ?? null, reason }))
    .sort((a, b) => (a.title === null) !== (b.title === null) ? (a.title === null ? 1 : -1)
      : (a.title ?? '').localeCompare(b.title ?? '') || a.id.localeCompare(b.id));
}
