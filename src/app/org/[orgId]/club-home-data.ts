// Owner: B (WP-7). The club home's data (§14: "my agents in this club, recent documents, my usage
// this month"), loaded through the services that own each half: distribution for the agents, C's
// library for the documents, A's quota ledger for the spend. Nothing here touches the database.
//
// `clubProfile()` is the club lookup — §14 scopes the catalog itself to the club's members, and
// this page has a state for a student who is not one, so it must not depend on the catalog to
// learn the club's name.
import { requireUser } from '@/lib/api';
import type { Actor, LibraryDocument, MyAgentsClub, QuotaRemaining } from '@/lib/contracts';
import { clubProfile, myAgents } from '@/lib/distribution';
import { loadAgents } from '@/lib/distribution/queries';
import { listLibraryDocuments } from '@/lib/documents/library';
import { remaining } from '@/lib/gateway/quota';

/** How many documents the club home lists before sending the reader to the library. */
export const RECENT_DOCUMENT_COUNT = 5;

export interface ClubHome {
  org: { id: string; name: string };
  /** The viewer is this club's president, acting in it (§8). */
  canManage: boolean;
  /** This club's agents the viewer may use, with the audience label that says why — or null when
   * the viewer holds no active membership here, which is a different page. */
  mine: MyAgentsClub | null;
  /** Everything installed in the club, usable or not: the catalog's own count. */
  agentCount: number;
}

export async function getClubHome(actor: Actor, orgId: string): Promise<ClubHome | null> {
  const userId = requireUser(actor);
  const org = await clubProfile(orgId);
  if (!org) return null;
  const [clubs, installed] = await Promise.all([myAgents(userId), loadAgents({ orgIds: [orgId] })]);
  return {
    org,
    canManage: actor.activeOrgId === orgId && actor.positions.includes('president'),
    mine: clubs.find((club) => club.orgId === orgId) ?? null,
    agentCount: installed.length,
  };
}

/** The newest documents the viewer may read in this club, and how many there are in all. RLS in
 * `listLibraryDocuments` is the filter, so a title the viewer cannot read never arrives. */
export async function getRecentDocuments(
  actor: Actor, orgId: string,
): Promise<{ documents: LibraryDocument[]; total: number }> {
  const documents = await listLibraryDocuments(actor, orgId);
  return { documents: documents.slice(0, RECENT_DOCUMENT_COUNT), total: documents.length };
}

/** The viewer's own spend in this club this month. A member with no limit of their own inherits the
 * club's monthly limit (§11), so this reads as a limit either way. */
export async function getMyUsage(actor: Actor, orgId: string): Promise<QuotaRemaining> {
  const userId = requireUser(actor);
  return remaining({ scope: 'member', orgId, userId });
}
