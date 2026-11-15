// Owner: B. §8 distribution is an atomic, idempotent upsert, retaining club overrides.
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Actor } from '../contracts';
import { now } from '../clock';
import { getDb } from '../db/client';
import { agentInstallations, agentTemplates, orgCohorts, orgs } from '../db/schema';
import { active, audited, checkedWrite, clampWrite, ensurePublicBudget, invalid, lockClub, lockTemplate, usgAdmin, versionFor } from './write-support';

export async function distribute(actor: Actor, templateId: string): Promise<{ count: number }> {
  const count = await checkedWrite(actor, 'template', templateId, () => getDb().transaction(async tx => {
    await usgAdmin(tx, actor);
    const template = await lockTemplate(tx, templateId); active(template);
    if (template.scope !== 'global' || template.distribution === 'optional') throw invalid('Only required or default global templates can be distributed.');
    const clubs = await tx.select().from(orgs).where(and(eq(orgs.kind, 'rso'), eq(orgs.status, 'active'))).orderBy(orgs.id);
    const cohort = template.target === 'all' ? null : await tx.select().from(orgCohorts).where(eq(orgCohorts.cohortSlug, template.target));
    const targets = clubs.filter(c => !cohort || cohort.some(m => m.orgId === c.id));
    // All candidates are checked before any installation or distributed_at is written.
    const plans = [];
    for (const club of targets) {
      await lockClub(tx, club.id);
      const [existing] = await tx.select().from(agentInstallations).where(and(eq(agentInstallations.orgId, club.id), eq(agentInstallations.templateId, templateId)));
      const version = await versionFor(tx, template, existing);
      const effective = await clampWrite(tx, club.id, version, existing ?? {});
      plans.push({ orgId: club.id, existing, effective });
    }
    let changed = 0;
    const at = now();
    for (const { orgId, existing, effective } of plans) {
      const id = existing?.id ?? randomUUID();
      if (!existing) {
        await tx.insert(agentInstallations).values({ id, templateId, orgId, enabled: true, track: 'latest', installedBy: actor.userId, installedAt: at, createdAt: at });
        changed++;
      } else if (template.distribution === 'required' && !existing.enabled) {
        await tx.update(agentInstallations).set({ enabled: true }).where(eq(agentInstallations.id, id)); changed++;
      }
      if (effective.audience === 'public') await ensurePublicBudget(tx, actor, id, orgId);
    }
    if (!template.distributedAt) await tx.update(agentTemplates).set({ distributedAt: at }).where(eq(agentTemplates.id, templateId));
    return changed;
  }));
  await audited(actor, 'template.distribute', 'template', templateId, { count });
  return { count };
}
