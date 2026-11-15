import { inArray } from 'drizzle-orm';
import { ORG } from '@db/seed/ids';
import { capGrants, grantLabels, grantsFor } from '../authz';
import type { Actor } from '../contracts';
import { getDb } from '../db/client';
import { sources } from '../db/schema';
import type { ResolvedAgent } from '../distribution/compose';
import { quotaLine } from '../gateway/quota-line';
import { quotaMessage } from '../gateway/quota-messages';
import { priceMicro } from '../gateway/prices';
import { STARTERS } from './fixtures';
import type { ChatConfig } from './run-config';
import { tierLabels } from './library-view';

export async function buildRunConfig(actor: Actor, agent: ResolvedAgent, display: { club: string; audience: string }): Promise<ChatConfig> {
  const grants = capGrants(await grantsFor(actor.userId, agent.orgId), agent.orgId, agent.maxTier);
  const labels = [...new Set((await grantLabels(grants)).map((g) => g.label))];
  const sourceRows = agent.sourceIds.length ? await getDb().select({ name: sources.name }).from(sources).where(inArray(sources.id, agent.sourceIds)) : [];
  const quota = await quotaLine(actor, agent);
  return {
    orgId: agent.orgId,
    scope: { sentence: `${agent.name} reads its permitted sources up to ${tierLabels[agent.maxTier]}. It runs as you.`, grantLabels: labels, sources: sourceRows.map((s) => s.name), billedClub: display.club },
    models: { allowed: agent.allowedModelClasses.map((modelClass) => ({ modelClass, priceMicro: priceMicro(modelClass) })), defaultClass: agent.modelClass, fixedByClub: agent.fixedByClub, limitedByTemplate: agent.limitedByTemplate },
    quota,
    blockedMessage: quota.remainingMicro < Math.min(...agent.allowedModelClasses.map(priceMicro)) ? quotaMessage(quota.scope, { club: display.club, agent: agent.name, ...quota }) : null,
    starters: STARTERS[agent.templateSlug === 'funding-precheck' && agent.orgId === ORG.hacksc ? 'hacksc-funding-precheck' : agent.templateSlug] ?? [],
    audienceLabel: display.audience,
    templateVersion: agent.templateVersion,
  };
}
