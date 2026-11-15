// Owner: B. Immutable template versions; latest installations propagate only after I7 passes.
import { and, eq, or, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Actor } from '../contracts';
import { now } from '../clock';
import { getDb } from '../db/client';
import { agentInstallations, agentTemplates, agentTemplateVersions, orgs } from '../db/schema';
import { active, audited, checkedWrite, clampWrite, ensurePublicBudget, invalid, lockClub, lockTemplate, president, usgAdmin } from './write-support';

export const versionDraftSchema = z.object({
  purpose: z.string().trim().min(1), audience: z.enum(['public', 'members', 'positions']), usableBy: z.array(z.string().min(1)).default([]),
  maxTier: z.enum(['public', 'members', 'officers', 'usg_internal']),
  sourceKinds: z.array(z.enum(['public', 'minutes', 'finance', 'archive', 'rulebook', 'usg_internal'])), tools: z.array(z.string().min(1)),
  modelClasses: z.array(z.enum(['standard', 'economy'])).min(1), defaultModelClass: z.enum(['standard', 'economy']),
  systemPrompt: z.string().min(1), rulePackSlug: z.string().min(1).nullable().optional(), changelog: z.string().default(''),
}).strict().superRefine((v, ctx) => {
  if (!v.modelClasses.includes(v.defaultModelClass)) ctx.addIssue({ code: 'custom', message: 'The default model must be allowed.' });
  if (v.audience === 'public' && v.maxTier !== 'public') ctx.addIssue({ code: 'custom', message: 'A public agent can read only public documents.' });
  if ((v.audience === 'positions') !== (v.usableBy.length > 0)) ctx.addIssue({ code: 'custom', message: 'Name positions only for a positions audience.' });
});
export type VersionDraft = z.input<typeof versionDraftSchema>;
export async function publishVersion(actor: Actor, templateId: string, input: VersionDraft): Promise<{ version: number }> {
  const version = await checkedWrite(actor, 'template', templateId, () => getDb().transaction(async tx => {
    const template = await lockTemplate(tx, templateId);
    if (template.scope === 'global') await usgAdmin(tx, actor); else president(actor, template.publisherOrgId);
    active(template);
    const parsed = versionDraftSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues[0].message);
    const draft = parsed.data;
    const [publisher] = await tx.select().from(orgs).where(eq(orgs.id, template.publisherOrgId));
    if (publisher?.status !== 'active') throw invalid('This publisher is inactive.');
    // USG-internal reads belong only to USG's own template installations, never RSO agents (I4).
    if ((template.scope === 'global' || publisher.kind !== 'usg') && draft.maxTier === 'usg_internal') throw invalid('Club-distributed agents cannot read USG internal documents.');
    const followers = await tx.select().from(agentInstallations).where(and(eq(agentInstallations.templateId, templateId),
      or(eq(agentInstallations.track, 'latest'), and(eq(agentInstallations.track, 'pinned'), isNull(agentInstallations.pinnedVersion))))).orderBy(agentInstallations.orgId);
    const publicFollowers = [];
    for (const installation of followers) {
      await lockClub(tx, installation.orgId, false);
      const effective = await clampWrite(tx, installation.orgId, draft, installation);
      if (effective.audience === 'public') publicFollowers.push(installation);
    }
    const at = now(); const next = template.latestVersion + 1;
    await tx.insert(agentTemplateVersions).values({ ...draft, templateId, version: next, publishedBy: actor.userId, publishedAt: at, createdAt: at });
    for (const i of publicFollowers) await ensurePublicBudget(tx, actor, i.id, i.orgId);
    await tx.update(agentTemplates).set({ latestVersion: next }).where(eq(agentTemplates.id, templateId));
    return next;
  }));
  await audited(actor, 'template.publish', 'template', templateId, { version });
  return { version };
}
export async function retire(actor: Actor, templateId: string): Promise<void> {
  await checkedWrite(actor, 'template', templateId, () => getDb().transaction(async tx => {
    await usgAdmin(tx, actor); await lockTemplate(tx, templateId);
    await tx.update(agentTemplates).set({ status: 'retired' }).where(eq(agentTemplates.id, templateId));
  }));
  await audited(actor, 'template.retire', 'template', templateId);
}
