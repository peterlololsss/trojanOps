// Owner: C (WP-8). The document library (§10 "Library") and president-only upload (§10 "Upload").
// Sources, orgs and positions have no RLS and are read with getDb(); documents are read and written
// only inside withActor (I1), and the documents_read / documents_insert policies are the filter.
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '../api';
import { grantsFor, isUuid } from '../authz';
import { now } from '../clock';
import { AppError, type Actor, type LibraryDocument } from '../contracts';
import { getDb } from '../db/client';
import { documents, orgs, positions, sources } from '../db/schema';
import { withActor } from '../db/with-actor';
import { audit } from '../gateway/audit';

/** The sources a club's library shows: all of its own, plus USG's public ones (rulebook, public). */
async function librarySourceIds(orgId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ id: sources.id })
    .from(sources)
    .innerJoin(orgs, eq(orgs.id, sources.orgId))
    .where(or(
      eq(sources.orgId, orgId),
      and(eq(orgs.kind, 'usg'), inArray(sources.kind, ['public', 'rulebook'])),
    ));
  return rows.map((r) => r.id);
}

/** The documents the actor can read in one club's library, newest first, then by title. Sources are
 * all of the viewed org's (`orgId`) plus USG public ones; grants come from the actor's memberships in
 * `orgId` (recomputed here, I3), not from the active org. See docs/decisions.md #16. */
export async function listLibraryDocuments(actor: Actor, orgId: string): Promise<LibraryDocument[]> {
  if (!isUuid(orgId)) return [];
  const sourceIds = await librarySourceIds(orgId);
  const grants = await grantsFor(actor.userId, orgId);
  // No where clause: the documents_read policy is the filter (as in access.ts).
  return withActor(actor, { grants, sourceIds }, async (tx) =>
    tx.select({
      id: documents.id,
      title: documents.title,
      tier: documents.tier,
      sourceId: documents.sourceId,
      sourceName: sources.name,
      version: documents.version,
      createdAt: documents.createdAt,
    })
      .from(documents)
      .innerJoin(sources, eq(sources.id, documents.sourceId))
      .orderBy(desc(documents.createdAt), asc(documents.title)));
}

export const uploadDocumentInput = z.object({
  sourceId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  tier: z.enum(['public', 'members', 'officers', 'usg_internal']),
  allowedPositions: z.array(z.string().regex(/^[a-z0-9_-]+$/)).default([]),
  bodyMd: z.string().min(1).max(100_000),
});
export type UploadDocumentInput = z.infer<typeof uploadDocumentInput>;

const invalid = (message: string) => new AppError({ code: 'invalid', message });

/** A club president uploads a document to one of the club's sources. read_grants is computed by the
 * documents_read_grants trigger; the documents_insert policy checks app.manage_org. */
export async function uploadDocument(actor: Actor, orgId: string, input: UploadDocumentInput): Promise<LibraryDocument> {
  const userId = requireUser(actor);
  // The same condition withActor uses to set app.manage_org.
  if (actor.activeOrgId !== orgId || !actor.positions.includes('president')) {
    throw new AppError({ code: 'forbidden', message: 'Only the club president can upload documents. Switch to that club first.' });
  }

  const db = getDb();
  const [source] = await db.select({ id: sources.id, name: sources.name }).from(sources)
    .where(and(eq(sources.id, input.sourceId), eq(sources.orgId, orgId)));
  if (!source) throw invalid('Choose one of this club’s sources.');

  if (input.tier === 'usg_internal') {
    const [org] = await db.select({ kind: orgs.kind }).from(orgs).where(eq(orgs.id, orgId));
    if (org?.kind !== 'usg') throw invalid('Only USG can upload USG-internal documents.');
  }

  const allowedPositions = [...new Set(input.allowedPositions)];
  if (allowedPositions.length > 0) {
    if (input.tier !== 'officers') throw invalid('Positions can be chosen only for officers documents.');
    // Only officer positions: an officers document is never opened to plain members this way.
    const known = new Set((await db.select({ slug: positions.slug }).from(positions)
      .where(and(eq(positions.orgId, orgId), eq(positions.isOfficer, true), inArray(positions.slug, allowedPositions))))
      .map((p) => p.slug));
    const unknown = allowedPositions.filter((s) => !known.has(s));
    if (unknown.length > 0) throw invalid(`This club has no officer position "${unknown[0]}".`);
  }

  const id = randomUUID();
  const createdAt = now();
  // No RETURNING: it would need SELECT on the new row (§5). Never write read_grants. The audit row
  // commits with the document: details hold ids and numbers only (I8).
  await withActor(actor, {}, async (tx) => {
    await tx.insert(documents).values({
      id, orgId, sourceId: source.id, title: input.title, tier: input.tier, allowedPositions,
      version: 1, bodyMd: input.bodyMd, uploadedBy: userId, createdAt,
    });
    await audit('document.upload', {
      actorUserId: userId, actingOrgId: orgId, targetType: 'document', targetId: id,
      details: { sourceId: source.id, tier: input.tier, version: 1 },
    }, tx);
  });

  return { id, title: input.title, tier: input.tier, sourceId: source.id, sourceName: source.name, version: 1, createdAt };
}
