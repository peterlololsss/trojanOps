import { asc, eq } from 'drizzle-orm';
import { requireUser } from '../api';
import { grantsFor } from '../authz';
import { AppError, type Actor, type EffectiveAgent, type Grant, type PreviewMatrix } from '../contracts';
import { documents, sources } from '../db/schema';
import { withActor } from '../db/with-actor';
import { effectiveAgent } from '../distribution';
import { clubSourceIds, explainAccess } from './access';
import { previewSubjects } from './preview-subjects';

export async function requirePreviewPresident(viewer: Actor, orgId: string): Promise<Grant[]> {
  requireUser(viewer);
  const grants = await grantsFor(viewer.userId, orgId);
  if (viewer.activeOrgId !== orgId || !grants.includes(`${orgId}:president`)) {
    throw new AppError({ code: 'forbidden', message: 'Only the club president can preview agent access. Switch to that club first.' });
  }
  return grants;
}

async function buildMatrix(viewer: Actor, agent: EffectiveAgent): Promise<PreviewMatrix> {
  const grants = await requirePreviewPresident(viewer, agent.orgId);
  const sourceIds = await clubSourceIds(agent.orgId);
  const subjects = await previewSubjects(agent.orgId);
  const rows = await withActor(viewer, { grants, sourceIds }, (tx) =>
    tx.select({ id: documents.id, title: documents.title, tier: documents.tier,
      sourceId: documents.sourceId, source: sources.name, readGrants: documents.readGrants })
      .from(documents).innerJoin(sources, eq(sources.id, documents.sourceId))
      .orderBy(asc(documents.title), asc(documents.id)));
  return {
    subjects: subjects.map(({ key, label }) => ({ key, label })),
    documents: rows.map(({ id, title, tier, source }) => ({ id, title, tier, source })),
    cells: Object.fromEntries(subjects.map((subject) => [subject.key,
      Object.fromEntries(rows.map((doc) => [doc.id, explainAccess(subject.grants, agent, doc)])),
    ])),
  };
}

export async function previewAccess(viewer: Actor, installationId: string): Promise<PreviewMatrix> {
  requireUser(viewer);
  return buildMatrix(viewer, await effectiveAgent(installationId));
}

export async function previewForOrg(viewer: Actor, orgId: string, installationId: string | null): Promise<PreviewMatrix> {
  requireUser(viewer);
  if (!installationId) throw new AppError({ code: 'invalid', message: 'Choose an agent to preview.' });
  const agent = await effectiveAgent(installationId);
  if (agent.orgId !== orgId) throw new AppError({ code: 'not_found', message: 'This agent is not installed in this club.' });
  return buildMatrix(viewer, agent);
}
