// Owner: B. D6: immutable published packs resolve on the next agent read.
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { now } from '../clock';
import type { Actor } from '../contracts';
import { getDb } from '../db/client';
import { orgs, rulePacks } from '../db/schema';
import { audited, checkedWrite, invalid, usgAdmin } from './write-support';

export const rulePackDraftSchema = z.object({ label: z.string().trim().min(1), content: z.record(z.string(), z.json()) }).strict();
export async function publishRulePack(actor: Actor, slug: string, input: z.infer<typeof rulePackDraftSchema>): Promise<{ version: number }> {
  const version = await checkedWrite(actor, 'rule_pack', slug, () => getDb().transaction(async tx => {
    await usgAdmin(actor);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw invalid('Use a lowercase rule-pack slug.');
    const parsed = rulePackDraftSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues[0].message);
    // Serialize publication using the USG publisher row, including a pack's first version.
    await tx.select().from(orgs).where(eq(orgs.id, actor.activeOrgId!)).for('update');
    const [latest] = await tx.select().from(rulePacks).where(eq(rulePacks.slug, slug)).orderBy(desc(rulePacks.version)).limit(1);
    const next = (latest?.version ?? 0) + 1; const at = now();
    await tx.insert(rulePacks).values({ slug, version: next, status: 'published', ...parsed.data,
      publishedBy: actor.userId, publishedAt: at, createdAt: at });
    return next;
  }), 'rule_pack.publish');
  await audited(actor, 'rule_pack.publish', 'rule_pack', slug, { version });
  return { version };
}
