// Owner: B. Additive examples for the My agents workspace, using the normal distribution rows.
import { now } from '@/lib/clock';
import { agentInstallations, agentTemplates, agentTemplateVersions } from '@/lib/db/schema';
import type { Audience, Tier } from '@/lib/contracts';
import { modelFields } from '@/lib/gateway/models';
import type { SeedDb } from './index';
import { INSTALLATION, ORG, TEMPLATE, USER } from './ids';

export const SAMPLE_AGENTS = [
  {
    templateId: TEMPLATE.meetingRecap, installationId: INSTALLATION.startupMeetingRecap,
    orgId: ORG.startup, publishedBy: USER.sam,
    slug: 'meeting-recap', name: 'Meeting recap',
    purpose: 'Summarizes club decisions and action items from meeting minutes.',
    audience: 'members', maxTier: 'members', sourceKinds: ['minutes'],
    systemPrompt: 'Summarize decisions, owners and next steps from the club meeting minutes. Cite each document. If an owner or date is missing, say so.',
  },
  {
    templateId: TEMPLATE.eventRetrospective, installationId: INSTALLATION.startupEventRetrospective,
    orgId: ORG.startup, publishedBy: USER.sam,
    slug: 'event-retrospective', name: 'Event retrospective',
    purpose: 'Finds lessons from past club events for the next organizing team.',
    audience: 'members', maxTier: 'members', sourceKinds: ['archive'],
    systemPrompt: 'Use the club event archive to explain what happened and what the next organizing team can learn. Cite documents and separate recorded facts from suggestions.',
  },
  {
    templateId: TEMPLATE.archeryGettingStarted, installationId: INSTALLATION.archeryGettingStarted,
    orgId: ORG.archery, publishedBy: null,
    slug: 'archery-getting-started', name: 'Archery getting started',
    purpose: 'Answers beginner questions about joining Archery Club and attending practice.',
    audience: 'public', maxTier: 'public', sourceKinds: ['public'],
    systemPrompt: 'Answer questions about joining Archery Club and attending practice using only public club documents. If a detail is missing, ask the student to contact the club. Do not invent schedules or safety instructions.',
  },
  {
    templateId: TEMPLATE.auditionGuide, installationId: INSTALLATION.danceAuditionGuide,
    orgId: ORG.dance, publishedBy: null,
    slug: 'audition-guide', name: 'Audition guide',
    purpose: 'Helps students find audition and showcase information from Dance Club.',
    audience: 'public', maxTier: 'public', sourceKinds: ['public'],
    systemPrompt: 'Answer questions about Dance Club auditions and its showcase using public club documents. Cite the source. If dates, requirements or signup details are absent, say so and point students to the club.',
  },
] satisfies readonly {
  readonly templateId: string; readonly installationId: string; readonly orgId: string;
  readonly publishedBy: string | null; readonly slug: string; readonly name: string;
  readonly purpose: string; readonly audience: Audience; readonly maxTier: Tier;
  readonly sourceKinds: string[]; readonly systemPrompt: string;
}[];

/** Run inside the caller's transaction so a failed insertion never leaves a partial example. */
export async function seedSampleAgents(db: SeedDb): Promise<void> {
  const createdAt = now();
  await db.insert(agentTemplates).values(SAMPLE_AGENTS.map((agent) => ({
    id: agent.templateId, slug: agent.slug, name: agent.name, publisherOrgId: agent.orgId,
    scope: 'org' as const, distribution: 'optional' as const, target: 'all',
    status: 'active' as const, latestVersion: 1, distributedAt: null, createdAt,
  }))).onConflictDoNothing();
  await db.insert(agentTemplateVersions).values(SAMPLE_AGENTS.map((agent) => ({
    templateId: agent.templateId, version: 1, purpose: agent.purpose,
    audience: agent.audience, usableBy: [], maxTier: agent.maxTier,
    sourceKinds: agent.sourceKinds, tools: [], ...modelFields(['gpt-6-luna', 'claude-haiku-5-5', 'gemini-4-hydrogen'], 'gpt-6-luna'),
    systemPrompt: agent.systemPrompt,
    rulePackSlug: null, changelog: 'First version.', publishedBy: agent.publishedBy,
    publishedAt: createdAt, createdAt,
  }))).onConflictDoNothing();
  await db.insert(agentInstallations).values(SAMPLE_AGENTS.map((agent) => ({
    id: agent.installationId, templateId: agent.templateId, orgId: agent.orgId,
    enabled: true, track: 'latest' as const, installedBy: agent.publishedBy,
    installedAt: createdAt, createdAt,
  }))).onConflictDoNothing();
}
