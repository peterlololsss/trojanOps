import { and, asc, eq } from 'drizzle-orm';
import { requireUser } from '../api';
import { isUuid } from '../authz';
import type { Actor, LibraryDocument } from '../contracts';
import { getDb } from '../db/client';
import { orgs, positions, sources } from '../db/schema';
import { listLibraryDocuments, managesLibrary } from './library';

export interface LibraryPageData {
  org: { id: string; name: string; kind: 'usg' | 'rso' };
  documents: LibraryDocument[];
  canUpload: boolean;
  sources: Array<{ id: string; name: string }>;
  positions: Array<{ slug: string; name: string }>;
}

export async function getLibraryPageData(actor: Actor, orgId: string): Promise<LibraryPageData | null> {
  requireUser(actor);
  if (!isUuid(orgId)) return null;
  const db = getDb();
  const [org] = await db.select({ id: orgs.id, name: orgs.name, kind: orgs.kind })
    .from(orgs).where(eq(orgs.id, orgId));
  if (!org) return null;

  const canUpload = await managesLibrary(actor, orgId);
  const [documents, uploadSources, officerPositions] = await Promise.all([
    listLibraryDocuments(actor, orgId),
    canUpload
      ? db.select({ id: sources.id, name: sources.name }).from(sources)
        .where(eq(sources.orgId, orgId)).orderBy(asc(sources.name))
      : Promise.resolve([]),
    canUpload
      ? db.select({ slug: positions.slug, name: positions.name }).from(positions)
        .where(and(eq(positions.orgId, orgId), eq(positions.isOfficer, true))).orderBy(asc(positions.name))
      : Promise.resolve([]),
  ]);
  return { org, documents, canUpload, sources: uploadSources, positions: officerPositions };
}
