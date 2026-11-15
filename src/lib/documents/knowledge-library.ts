import { eq, inArray } from 'drizzle-orm';
import { capGrants, grantsFor } from '../authz';
import type { AccessCell, Actor, EffectiveAgent, LibraryDocument, Tier } from '../contracts';
import { getDb } from '../db/client';
import { documents, positions } from '../db/schema';
import { withActor } from '../db/with-actor';
import { canUseWithGrants } from '../distribution/effective-config';
import { loadAgents } from '../distribution/queries';
import { citedCounts } from '../gateway/usage';
import { now } from '../clock';
import { explainAccess, type AccessDocument } from './access';
import { demoChunks, demoStatus, type IndexStatus } from './fixtures';
import { getLibraryPageData, type LibraryPageData } from './library-page';
import { previewSubjects, type PreviewSubject } from './preview-subjects';

export interface DocumentAgentAccess {
  readonly id: string; readonly name: string; readonly status: EffectiveAgent['status'];
  readonly reason: AccessCell; readonly positions: string[]; readonly cells: Record<string, AccessCell>;
}
export interface KnowledgeDocument extends LibraryDocument {
  readonly whoCanRead: string; readonly index: IndexStatus; readonly chunkCount: number;
  readonly agents: DocumentAgentAccess[]; readonly citedCount: number | null;
}
export interface KnowledgeLibrary extends Omit<LibraryPageData, 'documents'> {
  readonly documents: KnowledgeDocument[]; readonly canSeeCited: boolean; readonly member: boolean;
  readonly subjects: Array<{ key: string; label: string }>;
}

export function documentAudience(tier: Tier, allowed: readonly string[], names: ReadonlyMap<string, string>): string {
  switch (tier) {
    case 'public': return 'All students';
    case 'members': return 'All members';
    case 'officers': return [...new Set(allowed.filter((p) => p !== 'president').map((p) => names.get(p) ?? p)), names.get('president') ?? 'President'].join(', ');
    case 'usg_internal': return 'Reviewer, Admin';
    default: { const exhaustive: never = tier; return exhaustive; }
  }
}

export function documentAgentAccess(doc: AccessDocument, agents: EffectiveAgent[], subjects: PreviewSubject[]): DocumentAgentAccess[] {
  return agents.map((agent) => {
    const cells = Object.fromEntries(subjects.map((s) => [s.key, explainAccess(capGrants(s.grants, agent.orgId, agent.maxTier), agent, doc)]));
    const allowed = subjects.filter((s) => cells[s.key] === 'allowed' && canUseWithGrants(agent, s.grants).ok);
    const reason = allowed.length ? 'allowed' : Object.values(cells).find((c) => c !== 'allowed') ?? 'not_granted';
    return { id: agent.installationId, name: agent.name, status: agent.status, reason, positions: allowed.map((s) => s.label), cells };
  });
}

export async function getKnowledgeLibrary(actor: Actor, orgId: string): Promise<KnowledgeLibrary | null> {
  const data = await getLibraryPageData(actor, orgId);
  if (!data) return null;
  const grants = await grantsFor(actor.userId, orgId);
  const member = grants.includes(`${orgId}:*`);
  const canUpload = actor.activeOrgId === orgId && grants.includes(`${orgId}:president`);
  const subjects = await previewSubjects(orgId);
  const names = new Map((await getDb().select({ slug: positions.slug, name: positions.name }).from(positions).where(eq(positions.orgId, orgId))).map((p) => [p.slug, p.name]));
  const agents = (await loadAgents({ orgIds: [orgId] })).map((a) => a.agent).filter((a) => member || (a.audience === 'public' && a.status === 'enabled'));
  const counts = await citedCounts(actor, orgId);
  const rows = data.documents.length ? await withActor(actor, { grants, sourceIds: [...new Set(data.documents.map((d) => d.sourceId))] }, (tx) =>
    tx.select().from(documents).where(inArray(documents.id, data.documents.map((d) => d.id)))) : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const at = now();
  return { ...data, canUpload, member, canSeeCited: counts !== null, subjects: canUpload ? subjects.map(({ key, label }) => ({ key, label })) : [],
    documents: data.documents.flatMap((d) => {
      const row = byId.get(d.id);
      if (!row) return [];
      const index = demoStatus(row, at);
      return [{ ...d, whoCanRead: documentAudience(row.tier, row.allowedPositions, names), index, chunkCount: index.state === 'error' ? 0 : demoChunks(row.bodyMd).length, agents: documentAgentAccess(row, agents, subjects), citedCount: counts === null ? null : counts[d.id] ?? 0 }];
    }),
  };
}
