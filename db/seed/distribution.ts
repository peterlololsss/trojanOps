// Owner: B (WP-5). Templates, versions, installations, rule packs and club policy (§8, §15).
import {
  agentInstallations,
  agentTemplates,
  agentTemplateVersions,
  rulePacks,
  usgClubPolicy,
} from '@/lib/db/schema';
import { now } from '@/lib/clock';
import type { ModelClass } from '@/lib/contracts';
import type { SeedDb } from './index';
import { INSTALLATION, ORG, RULE_PACK, TEMPLATE, USER } from './ids';
import pack from '../../rules/packs/usg-funding.v1.json';

// The rows WP-5 resolves from the database (src/lib/distribution/queries.ts).
// Ids come from db/seed/ids.ts, which tests address these rows by.
//
// TODO(verify): every version seeds `tools: []`, matching the fixtures. §7 step 7 and C's WP-9
// (pending actions) need at least one write tool — probably `submit_to_queue` on funding-precheck.
// Adding it here changes what A's gateway sees, so it is a team call, not a quiet edit.

export async function seedDistribution(db: SeedDb): Promise<void> {
  const createdAt = now();

  await db.insert(rulePacks).values([
    {
      id: RULE_PACK.usgFundingV1,
      slug: pack.slug,
      version: pack.version,
      status: 'published',
      label: pack.label,
      content: pack.content,
      publishedBy: USER.avery,
      publishedAt: createdAt,
      createdAt,
    },
  ]);

  await db.insert(agentTemplates).values([
    {
      id: TEMPLATE.fundingPrecheck,
      slug: 'funding-precheck',
      name: 'Funding pre-check',
      publisherOrgId: ORG.usg,
      scope: 'global',
      distribution: 'required',
      target: 'all',
      status: 'active',
      latestVersion: 1,
      // Already distributed in the seed, so provisionOrg installs it into a club the
      // roster brings in (D1). event-planning is not: D2 distributes it on stage.
      distributedAt: createdAt,
      createdAt,
    },
    {
      id: TEMPLATE.eventPlanning,
      slug: 'event-planning',
      name: 'Event planning',
      publisherOrgId: ORG.usg,
      scope: 'global',
      distribution: 'default',
      target: 'all',
      status: 'active',
      latestVersion: 1,
      distributedAt: null,
      createdAt,
    },
    {
      id: TEMPLATE.recruitingQa,
      slug: 'recruiting-qa',
      name: 'Recruiting Q&A',
      publisherOrgId: ORG.startup,
      scope: 'org',
      distribution: 'optional',
      target: 'all',
      status: 'active',
      latestVersion: 1,
      distributedAt: null,
      createdAt,
    },
    {
      id: TEMPLATE.showcaseQa,
      slug: 'showcase-qa',
      name: 'Showcase Q&A',
      publisherOrgId: ORG.dance,
      scope: 'org',
      distribution: 'optional',
      target: 'all',
      status: 'active',
      latestVersion: 1,
      distributedAt: null,
      createdAt,
    },
    {
      id: TEMPLATE.handoff,
      slug: 'handoff',
      name: 'Club handoff',
      publisherOrgId: ORG.startup,
      scope: 'org',
      distribution: 'optional',
      target: 'all',
      status: 'active',
      latestVersion: 1,
      distributedAt: null,
      createdAt,
    },
    {
      id: TEMPLATE.usgReviewAssistant,
      slug: 'usg-review-assistant',
      name: 'USG review assistant',
      publisherOrgId: ORG.usg,
      scope: 'org',
      distribution: 'optional',
      target: 'all',
      status: 'active',
      latestVersion: 1,
      distributedAt: null,
      createdAt,
    },
  ]);

  await db.insert(agentTemplateVersions).values([
    {
      templateId: TEMPLATE.fundingPrecheck,
      version: 1,
      purpose: 'Checks a funding request against the USG funding rules before you submit it.',
      audience: 'positions',
      usableBy: ['treasurer', 'president'],
      maxTier: 'officers',
      sourceKinds: ['rulebook', 'finance'],
      tools: [],
      modelClasses: ['standard', 'economy'],
      defaultModelClass: 'standard',
      systemPrompt: 'You check club funding requests against the USG rule pack.',
      rulePackSlug: 'usg-funding',
      changelog: 'First version.',
      publishedBy: USER.avery,
      publishedAt: createdAt,
      createdAt,
    },
    {
      templateId: TEMPLATE.eventPlanning,
      version: 1,
      purpose: 'Walks an officer through booking a venue and getting an event approved.',
      audience: 'positions',
      usableBy: ['president', 'secretary'],
      maxTier: 'members',
      sourceKinds: ['archive', 'minutes'],
      tools: [],
      // §15: this version allows economy only — D2's rejected widening is a club
      // trying to give it the standard class.
      modelClasses: ['economy'],
      defaultModelClass: 'economy',
      systemPrompt: 'You help club officers plan and get approval for events.',
      rulePackSlug: null,
      changelog: 'First version.',
      publishedBy: USER.avery,
      publishedAt: createdAt,
      createdAt,
    },
    {
      templateId: TEMPLATE.recruitingQa,
      version: 1,
      purpose: 'Answers questions about joining Startup Club.',
      audience: 'public',
      usableBy: [],
      maxTier: 'public',
      sourceKinds: ['public'],
      tools: [],
      modelClasses: ['standard', 'economy'],
      defaultModelClass: 'economy',
      systemPrompt: 'You answer prospective members’ questions about Startup Club.',
      rulePackSlug: null,
      changelog: 'First version.',
      publishedBy: USER.sam,
      publishedAt: createdAt,
      createdAt,
    },
    {
      templateId: TEMPLATE.showcaseQa,
      version: 1,
      purpose: 'Answers questions about the Dance Club spring showcase.',
      audience: 'public',
      usableBy: [],
      maxTier: 'public',
      sourceKinds: ['public'],
      tools: [],
      modelClasses: ['standard', 'economy'],
      defaultModelClass: 'economy',
      systemPrompt: 'You answer questions about the spring showcase.',
      rulePackSlug: null,
      changelog: 'First version.',
      publishedBy: null,
      publishedAt: createdAt,
      createdAt,
    },
    {
      templateId: TEMPLATE.handoff,
      version: 1,
      purpose: 'Helps incoming officers catch up on decisions, events and budgets.',
      audience: 'members',
      usableBy: [],
      maxTier: 'officers',
      sourceKinds: ['public', 'minutes', 'archive', 'finance'],
      tools: [],
      modelClasses: ['standard', 'economy'],
      defaultModelClass: 'standard',
      systemPrompt: 'You brief club members on what happened before they joined.',
      rulePackSlug: null,
      changelog: 'First version.',
      publishedBy: USER.sam,
      publishedAt: createdAt,
      createdAt,
    },
    {
      templateId: TEMPLATE.usgReviewAssistant,
      version: 1,
      purpose: 'Helps USG reviewers check funding applications against the rules.',
      audience: 'positions',
      usableBy: ['reviewer', 'admin'],
      maxTier: 'usg_internal',
      sourceKinds: ['rulebook', 'usg_internal'],
      tools: [],
      modelClasses: ['standard', 'economy'],
      defaultModelClass: 'standard',
      systemPrompt: 'You help USG reviewers apply the funding rules.',
      // §8 attaches the usg-funding pack to funding-precheck only, and the mock runtime prints
      // the pack's label and cap into the reply, so giving it to this agent too would show up
      // on stage in D4 and D8.
      rulePackSlug: null,
      changelog: 'First version.',
      publishedBy: USER.avery,
      publishedAt: createdAt,
      createdAt,
    },
  ]);

  // No override columns are set: every installation inherits its version, so the
  // effective config equals the version and matches the fixtures.
  await db.insert(agentInstallations).values([
    {
      id: INSTALLATION.startupFundingPrecheck,
      templateId: TEMPLATE.fundingPrecheck,
      orgId: ORG.startup,
      enabled: true,
      track: 'latest',
      installedBy: USER.avery,
      installedAt: createdAt,
      createdAt,
    },
    {
      id: INSTALLATION.archeryFundingPrecheck,
      templateId: TEMPLATE.fundingPrecheck,
      orgId: ORG.archery,
      enabled: true,
      track: 'latest',
      installedBy: USER.avery,
      installedAt: createdAt,
      createdAt,
    },
    {
      id: INSTALLATION.danceFundingPrecheck,
      templateId: TEMPLATE.fundingPrecheck,
      orgId: ORG.dance,
      enabled: true,
      track: 'latest',
      installedBy: USER.avery,
      installedAt: createdAt,
      createdAt,
    },
    {
      // D3 publishes this one on stage, so it starts turned off.
      id: INSTALLATION.startupRecruitingQa,
      templateId: TEMPLATE.recruitingQa,
      orgId: ORG.startup,
      enabled: false,
      track: 'latest',
      installedBy: USER.sam,
      installedAt: createdAt,
      createdAt,
    },
    {
      id: INSTALLATION.startupHandoff,
      templateId: TEMPLATE.handoff,
      orgId: ORG.startup,
      enabled: true,
      track: 'latest',
      installedBy: USER.sam,
      installedAt: createdAt,
      createdAt,
    },
    {
      id: INSTALLATION.danceShowcaseQa,
      templateId: TEMPLATE.showcaseQa,
      orgId: ORG.dance,
      enabled: true,
      track: 'latest',
      installedBy: null,
      installedAt: createdAt,
      createdAt,
    },
    {
      id: INSTALLATION.usgReviewAssistant,
      templateId: TEMPLATE.usgReviewAssistant,
      orgId: ORG.usg,
      enabled: true,
      track: 'latest',
      installedBy: USER.avery,
      installedAt: createdAt,
      createdAt,
    },
  ]);

  // §15: every club may use both model classes and may publish public agents. USG gets a row too,
  // because usg-review-assistant is installed in USG and the clamps look policy up by org id.
  await db.insert(usgClubPolicy).values(
    [ORG.usg, ORG.startup, ORG.archery, ORG.dance].map((orgId) => ({
      orgId,
      allowedModelClasses: ['standard', 'economy'] as ModelClass[],
      allowPublicAgents: true,
      createdAt,
    })),
  );
}
