// Owner: A (WP-4). Quota limits and Lee's $0.04 of public-agent usage today (§15).
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { now } from '@/lib/clock';
import { aiUsage, quotaLimits } from '@/lib/db/schema';
import type { SeedDb } from './index';
import { INSTALLATION, ORG, USER } from './ids';

const USD = 1_000_000;
const RUN_COST = 10_000; // the mock's flat $0.01
const LEE_RUNS = 4;

export async function seedQuota(db: SeedDb): Promise<void> {
  const at = now();
  const row = (
    scope: 'platform' | 'org' | 'member' | 'installation' | 'student_daily',
    limitMicro: number,
    setBy: string,
    ids: { orgId?: string; userId?: string; installationId?: string } = {},
  ) => ({
    scope, limitMicro, setBy, setAt: at, createdAt: at,
    orgId: ids.orgId ?? null, userId: ids.userId ?? null, installationId: ids.installationId ?? null,
  });

  await db.insert(quotaLimits).values([
    row('platform', 50 * USD, USER.avery),
    row('org', 5 * USD, USER.avery, { orgId: ORG.startup }),
    row('org', 5 * USD, USER.avery, { orgId: ORG.archery }),
    row('org', 5 * USD, USER.avery, { orgId: ORG.dance }),
    row('student_daily', 0.05 * USD, USER.avery),
    row('member', 0.5 * USD, USER.sam, { orgId: ORG.startup, userId: USER.casey }),
    row('installation', 2.5 * USD, USER.sam, { orgId: ORG.startup, installationId: INSTALLATION.startupRecruitingQa }),
    // §11: every public installation has a limit.
    row('installation', 2.5 * USD, USER.avery, { orgId: ORG.dance, installationId: INSTALLATION.danceShowcaseQa }),
  ]);

  // Lee ran Startup's public recruiting-qa four times today: a hold and a settle of the same cost each.
  const usage = (runId: string, kind: 'hold' | 'settle', amountMicro: number) => ({
    runId, kind, amountMicro, billedOrgId: ORG.startup, userId: USER.lee,
    installationId: INSTALLATION.startupRecruitingQa, isPublic: true, model: kind === 'settle' ? 'mock' : null, createdAt: at,
  });
  await db.insert(aiUsage).values(Array.from({ length: LEE_RUNS }, () => randomUUID()).flatMap((runId) => [
    usage(runId, 'hold', RUN_COST),
    usage(runId, 'settle', 0),
  ]));
  await seedSampleAgentQuota(db);
  await seedHackscQuota(db);
}

export async function seedHackscQuota(db: SeedDb): Promise<void> {
  const [existing] = await db.select({ id: quotaLimits.id }).from(quotaLimits)
    .where(and(eq(quotaLimits.scope, 'org'), eq(quotaLimits.orgId, ORG.hacksc))).limit(1);
  if (existing) return;
  const at = now();
  await db.insert(quotaLimits).values({ id: '00000090-0000-4000-8000-000000000005',
    scope: 'org', orgId: ORG.hacksc, limitMicro: 5 * USD, setBy: USER.avery, setAt: at, createdAt: at,
  }).onConflictDoNothing();
}

/** Stable row ids let additive demo setup be retried without replacing an edited budget. */
export async function seedSampleAgentQuota(db: SeedDb): Promise<void> {
  const at = now();
  await db.insert(quotaLimits).values([
    {
      id: '00000090-0000-4000-8000-000000000302',
      orgId: ORG.archery,
      installationId: INSTALLATION.archeryGettingStarted,
    },
    {
      id: '00000090-0000-4000-8000-000000000403',
      orgId: ORG.dance,
      installationId: INSTALLATION.danceAuditionGuide,
    },
  ].map((agent) => ({
    ...agent,
    scope: 'installation' as const,
    limitMicro: 2.5 * USD,
    setBy: USER.avery,
    setAt: at,
    createdAt: at,
  }))).onConflictDoNothing();
}
