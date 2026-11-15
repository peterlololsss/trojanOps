'use server';

import { eq } from 'drizzle-orm';
import { capGrants, grantLabels, grantsFor, isUuid } from '../authz';
import { requireUser } from '../api';
import { documents } from '../db/schema';
import { withActor } from '../db/with-actor';
import { canUse, effectiveAgent } from '../distribution';
import { getActor } from '../identity';
import { explainAccess } from './access';
import { getRunPageData } from './run-page';

export async function refreshRunContext(installationId: string) {
  const actor = await getActor();
  requireUser(actor);
  const agent = await effectiveAgent(installationId);
  const data = await getRunPageData(actor, agent.orgId, installationId);
  return data?.workspace ?? null;
}

export async function citationAccess(installationId: string, documentId: string): Promise<{ allowed: boolean; reason: string }> {
  const actor = await getActor();
  const userId = requireUser(actor);
  const refused = { allowed: false, reason: 'Your access has changed. This document is no longer readable through this agent.' };
  if (!isUuid(documentId) || !isUuid(installationId)) return refused;
  const agent = await effectiveAgent(installationId);
  if (!(await canUse(userId, agent)).ok || (agent.audience !== 'public' && actor.activeOrgId !== agent.orgId)) return refused;
  const grants = capGrants(await grantsFor(userId, agent.orgId), agent.orgId, agent.maxTier);
  const [doc] = await withActor(actor, { grants, sourceIds: agent.sourceIds, maxTier: agent.maxTier }, (tx) =>
    tx.select({ sourceId: documents.sourceId, tier: documents.tier, readGrants: documents.readGrants }).from(documents).where(eq(documents.id, documentId)));
  if (!doc || explainAccess(grants, agent, doc) !== 'allowed') return refused;
  if (doc.tier === 'public') return { allowed: true, reason: 'Public: readable by any signed-in student.' };
  const matched = (await grantLabels(grants.filter((g) => doc.readGrants.includes(g)))).map((g) => g.label);
  return { allowed: true, reason: `Readable through ${[...new Set(matched)].join(', ')}.` };
}
