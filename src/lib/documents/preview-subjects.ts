import { asc, eq } from 'drizzle-orm';
import type { Grant } from '../contracts';
import { getDb } from '../db/client';
import { positions } from '../db/schema';

export interface PreviewSubject { readonly key: string; readonly label: string; readonly grants: Grant[] }

export async function previewSubjects(orgId: string): Promise<PreviewSubject[]> {
  const rows = await getDb().select({ slug: positions.slug, name: positions.name }).from(positions)
    .where(eq(positions.orgId, orgId)).orderBy(asc(positions.name), asc(positions.slug));
  return [
    { key: 'student', label: 'Any signed-in student', grants: ['*'] },
    { key: 'member', label: 'Member', grants: ['*', `${orgId}:*`] },
    ...rows.filter((p) => p.slug !== 'member').map((p) => ({ key: p.slug === 'student' ? 'position:student' : p.slug, label: p.name, grants: ['*', `${orgId}:*`, `${orgId}:${p.slug}`] satisfies Grant[] })),
  ];
}
