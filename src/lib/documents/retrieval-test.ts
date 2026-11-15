import { asc } from 'drizzle-orm';
import { z } from 'zod';
import { AppError, type AccessCell, type Actor, type Tier } from '../contracts';
import { now } from '../clock';
import { documents } from '../db/schema';
import { withActor } from '../db/with-actor';
import { effectiveAgent } from '../distribution';
import { clubSourceIds } from './access';
import { demoChunks, demoScore, type DemoChunk } from './fixtures';
import { previewAccess, requirePreviewPresident } from './preview';

export const retrievalInput = z.object({ installationId: z.uuid(), question: z.string().trim().min(1).max(200), subject: z.string().min(1).max(100), topK: z.number().int().min(1).max(10).default(3), scoreThreshold: z.number().min(0).max(1).default(0.3) });
export interface RetrievalHit {
  readonly documentId: string; readonly title: string; readonly tier: Tier; readonly chunk: DemoChunk;
  readonly score: number; readonly matched: string[]; readonly reason: AccessCell;
}

export async function testRetrieval(viewer: Actor, orgId: string, raw: unknown) {
  const grants = await requirePreviewPresident(viewer, orgId);
  const parsed = retrievalInput.safeParse(raw);
  if (!parsed.success) throw new AppError({ code: 'invalid', message: 'Choose an agent and position, write up to 200 characters, and use Top K 1–10 with a score threshold from 0 to 1.' });
  const input = parsed.data;
  const agent = await effectiveAgent(input.installationId);
  if (agent.orgId !== orgId) throw new AppError({ code: 'not_found', message: 'This agent is not installed in this club.' });
  const matrix = await previewAccess(viewer, input.installationId);
  const subject = matrix.subjects.find((s) => s.key === input.subject);
  if (!subject) throw new AppError({ code: 'invalid', message: 'Choose a position from this club.' });
  const sourceIds = [...new Set([...(await clubSourceIds(orgId)), ...agent.sourceIds])];
  const rows = await withActor(viewer, { grants, sourceIds }, (tx) => tx.select({ id: documents.id, title: documents.title, tier: documents.tier, bodyMd: documents.bodyMd }).from(documents).orderBy(asc(documents.title)));
  const candidates = rows.flatMap((doc) => demoChunks(doc.bodyMd).map((chunk) => ({ documentId: doc.id, title: doc.title, tier: doc.tier, chunk, ...demoScore(input.question, chunk) })))
    .filter((h) => h.score >= input.scoreThreshold).sort((a, b) => b.score - a.score || b.matched.length - a.matched.length || a.title.localeCompare(b.title) || a.chunk.n - b.chunk.n);
  const scored: RetrievalHit[] = candidates.map((h) => ({ ...h, reason: matrix.cells[subject.key]?.[h.documentId] ?? 'not_granted' }));
  return { agent: { id: agent.installationId, name: agent.name }, subject, testedAt: now().toISOString(),
    hits: scored.filter((h) => h.reason === 'allowed').slice(0, input.topK), keptOut: scored.filter((h) => h.reason !== 'allowed'),
    byPosition: matrix.subjects.map((s) => ({ ...s, count: candidates.filter((h) => matrix.cells[s.key]?.[h.documentId] === 'allowed').length })),
  };
}
