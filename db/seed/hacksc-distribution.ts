import { now } from '@/lib/clock';
import { agentInstallations, agentTemplates, agentTemplateVersions, usgClubPolicy } from '@/lib/db/schema';
import type { SeedDb } from './index';
import { INSTALLATION, ORG, TEMPLATE, USER } from './ids';

/** Additive fixtures use the same version and installation representation as normal distribution. */
export async function seedHackscDistribution(db: SeedDb): Promise<void> {
  const createdAt = now();
  const agents = [
    { id: TEMPLATE.hackscHandoff, installationId: INSTALLATION.hackscHandoff, slug: 'hacksc-handoff',
      name: 'HackSC organizer handoff', purpose: 'Briefs first-time organizers on the previous president’s lessons, meeting decisions and the next event’s process.' },
    { id: TEMPLATE.hackscMeetingSummary, installationId: INSTALLATION.hackscMeetingSummary, slug: 'hacksc-meeting-summary',
      name: 'HackSC meeting summary', purpose: 'Summarizes organizing decisions, assigned owners and next steps from member meeting records.' },
  ];
  await db.insert(usgClubPolicy).values({ orgId: ORG.hacksc, allowedModelClasses: ['economy', 'standard'], allowPublicAgents: true, createdAt }).onConflictDoNothing();
  await db.insert(agentTemplates).values(agents.map((agent) => ({
    id: agent.id, slug: agent.slug, name: agent.name, publisherOrgId: ORG.hacksc,
    scope: 'org' as const, distribution: 'optional' as const, target: 'all', latestVersion: 1, createdAt,
  }))).onConflictDoNothing();
  await db.insert(agentTemplateVersions).values(agents.map((agent) => ({
    templateId: agent.id, version: 1, purpose: agent.purpose, audience: 'members' as const,
    usableBy: [], maxTier: 'members' as const, sourceKinds: ['minutes', 'archive'], tools: [],
    modelClasses: ['economy' as const], defaultModelClass: 'economy' as const,
    systemPrompt: 'Use only the permitted operational records. Cite the source for each fact. Explain prior problems, each planning stage and the recorded updated process. If no readable finance source is supplied, explain the access limitation and refer the user to an authorized officer.',
    publishedBy: USER.sam, publishedAt: createdAt, createdAt,
  }))).onConflictDoNothing();
  await db.insert(agentInstallations).values([
    ...agents.map((agent) => ({ id: agent.installationId, templateId: agent.id, orgId: ORG.hacksc,
      enabled: true, track: 'latest' as const, installedBy: USER.sam, installedAt: createdAt, createdAt })),
    { id: INSTALLATION.hackscFundingPrecheck, templateId: TEMPLATE.fundingPrecheck, orgId: ORG.hacksc,
      enabled: true, track: 'latest' as const, installedBy: USER.avery, installedAt: createdAt, createdAt },
  ]).onConflictDoNothing();
}
