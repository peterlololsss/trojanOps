import { eq } from 'drizzle-orm';
import { requireUser } from '../api';
import { isUuid } from '../authz';
import { AppError, type Actor, type PreviewMatrix, type Tier } from '../contracts';
import { getDb } from '../db/client';
import { orgs } from '../db/schema';
import { loadAgents } from '../distribution/queries';
import { previewAccess, requirePreviewPresident } from './preview';

export interface PreviewPageData {
  org: { id: string; name: string };
  agents: Array<{ id: string; name: string; status: 'enabled' | 'disabled' | 'retired' }>;
  selectedAgent: { id: string; name: string; maxTier: Tier } | null;
  matrix: PreviewMatrix | null;
}

export async function getPreviewPageData(viewer: Actor, orgId: string, installationId?: string): Promise<PreviewPageData | null> {
  requireUser(viewer);
  if (!isUuid(orgId)) return null;
  const [org] = await getDb().select({ id: orgs.id, name: orgs.name }).from(orgs).where(eq(orgs.id, orgId));
  if (!org) return null;
  await requirePreviewPresident(viewer, orgId);
  const loaded = await loadAgents({ orgIds: [orgId] });
  const selected = installationId === undefined ? loaded[0]?.agent : loaded.find(({ agent }) => agent.installationId === installationId)?.agent;
  if (installationId !== undefined && !selected) {
    throw new AppError({ code: 'not_found', message: 'This agent is not installed in this club.' });
  }
  return {
    org,
    agents: loaded.map(({ agent }) => ({ id: agent.installationId, name: agent.name, status: agent.status })),
    selectedAgent: selected ? { id: selected.installationId, name: selected.name, maxTier: selected.maxTier } : null,
    matrix: selected ? await previewAccess(viewer, selected.installationId) : null,
  };
}
