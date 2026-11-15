// Owner: B. Creation publishes v1; the existing distribution service grants club access later.
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { now } from '../clock';
import type { Actor } from '../contracts';
import { getDb } from '../db/client';
import { agentTemplates, agentTemplateVersions, orgCohorts, orgs } from '../db/schema';
import { audit } from '../gateway/audit';
import { versionDraftSchema, withModelClasses } from './versions';
import { checkedWrite, event, invalid, usgAdmin } from './write-support';

const createTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Enter a template name.').max(120),
  distribution: z.enum(['required', 'default', 'optional']),
  target: z.string().trim().min(1),
  version: versionDraftSchema,
}).strict();

export async function createUsgTemplate(actor: Actor, input: unknown): Promise<{ readonly templateId: string }> {
  const templateId = randomUUID();
  return checkedWrite(actor, 'template', templateId, () => getDb().transaction(async tx => {
    await usgAdmin(actor);
    const parsed = createTemplateSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues[0].message);
    const { name, target, distribution, version } = parsed.data;
    const [publisher] = await tx.select().from(orgs).where(eq(orgs.id, actor.activeOrgId ?? ''));
    if (!publisher || publisher.kind !== 'usg' || publisher.status !== 'active') throw invalid('Choose an active USG organization.');
    if (version.maxTier === 'usg_internal') throw invalid('Club-distributed agents cannot read USG internal documents.');
    if (target !== 'all') {
      const [cohort] = await tx.select().from(orgCohorts).where(eq(orgCohorts.cohortSlug, target)).limit(1);
      if (!cohort) throw invalid('Choose all clubs or an existing cohort.');
    }
    const at = now();
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent'}-${templateId}`;
    await tx.insert(agentTemplates).values({ id: templateId, slug, name, publisherOrgId: publisher.id,
      scope: 'global', distribution, target, status: 'active', latestVersion: 1, distributedAt: null, createdAt: at });
    await tx.insert(agentTemplateVersions).values({ ...withModelClasses(version), templateId, version: 1,
      publishedBy: actor.userId, publishedAt: at, createdAt: at });
    await audit('template.publish', { ...event(actor, 'template', templateId), details: { version: 1, created: true } }, tx);
    return { templateId };
  }), 'template.publish');
}
