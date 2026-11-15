// Owner: D (WP-11). The My agents rail: grouping by source, de-duplication, default choice and tags.
// Pure functions over fixtures shaped like the seed (no database).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { agentTags } from '@/app/me/agents/agent-tags';
import { AgentRail } from '@/app/me/agents/agent-rail';
import { defaultAgent, findAgent, groupAgents, needsSwitch, PUBLIC_GROUP_LABEL, type GroupInput } from '@/app/me/agents/groups';
import type { AgentListing, MyAgentsClub } from '@/lib/contracts';
import { INSTALLATION, ORG } from '@db/seed/ids';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const listing = (over: Partial<AgentListing> & Pick<AgentListing, 'installationId' | 'orgId' | 'orgName' | 'templateSlug' | 'name'>): AgentListing => ({
  purpose: `${over.name} purpose.`, audience: 'members', reasonLabel: 'All members', templateVersion: 1, ...over,
});

const startupHandoff = listing({ installationId: INSTALLATION.startupHandoff, orgId: ORG.startup, orgName: 'Startup Club', templateSlug: 'handoff', name: 'Club handoff' });
const archeryFunding = listing({ installationId: INSTALLATION.archeryFundingPrecheck, orgId: ORG.archery, orgName: 'Archery Club', templateSlug: 'funding-precheck', name: 'Funding pre-check', audience: 'positions', reasonLabel: 'Treasurer, President' });
const usgReview = listing({ installationId: INSTALLATION.usgReviewAssistant, orgId: ORG.usg, orgName: 'USG', templateSlug: 'usg-review-assistant', name: 'USG review assistant', audience: 'positions', reasonLabel: 'Admin, Reviewer' });
const danceShowcase = listing({ installationId: INSTALLATION.danceShowcaseQa, orgId: ORG.dance, orgName: 'Dance Club', templateSlug: 'showcase-qa', name: 'Showcase Q&A', audience: 'public', reasonLabel: 'All students', templateVersion: 2 });
const startupRecruiting = listing({ installationId: INSTALLATION.startupRecruitingQa, orgId: ORG.startup, orgName: 'Startup Club', templateSlug: 'recruiting-qa', name: 'Recruiting Q&A', audience: 'public', reasonLabel: 'All students' });

const club = (orgId: string, orgName: string, agents: AgentListing[]): MyAgentsClub => ({ orgId, orgName, positionNames: [], agents });
// myAgents() lists a user's orgs by name.
const morganClubs = [club(ORG.archery, 'Archery Club', [archeryFunding]), club(ORG.startup, 'Startup Club', [startupHandoff])];
const input = (over: Partial<GroupInput>): GroupInput => ({ clubs: [], usgOrgIds: new Set([ORG.usg]), publicAgents: [danceShowcase], activeOrgId: null, ...over });
const shape = (groups: ReturnType<typeof groupAgents>) => groups.map((g) => [g.label, g.kind, g.agents.map((a) => a.name)]);

describe('groupAgents', () => {
  it('gives Morgan her two clubs, the active one first, then other clubs’ public agents', () => {
    expect(shape(groupAgents(input({ clubs: morganClubs, activeOrgId: ORG.archery })))).toEqual([
      ['Archery Club', 'club', ['Funding pre-check']],
      ['Startup Club', 'club', ['Club handoff']],
      [PUBLIC_GROUP_LABEL, 'public', ['Showcase Q&A']],
    ]);
    expect(shape(groupAgents(input({ clubs: morganClubs, activeOrgId: ORG.startup }))).map(([label]) => label))
      .toEqual(['Startup Club', 'Archery Club', PUBLIC_GROUP_LABEL]);
  });

  it('gives a USG member a USG group, after their clubs unless USG is active', () => {
    const avery = groupAgents(input({ clubs: [club(ORG.usg, 'USG', [usgReview])], activeOrgId: ORG.usg }));
    expect(shape(avery)).toEqual([['USG', 'usg', ['USG review assistant']], [PUBLIC_GROUP_LABEL, 'public', ['Showcase Q&A']]]);
    const both = [club(ORG.startup, 'Startup Club', [startupHandoff]), club(ORG.usg, 'USG', [usgReview])].reverse();
    expect(shape(groupAgents(input({ clubs: both, activeOrgId: ORG.startup }))).map(([label]) => label)).toEqual(['Startup Club', 'USG', PUBLIC_GROUP_LABEL]);
    expect(shape(groupAgents(input({ clubs: both, activeOrgId: ORG.usg }))).map(([label]) => label)).toEqual(['USG', 'Startup Club', PUBLIC_GROUP_LABEL]);
  });

  it('gives a student with no club only All students', () => {
    expect(shape(groupAgents(input({})))).toEqual([[PUBLIC_GROUP_LABEL, 'public', ['Showcase Q&A']]]);
    expect(groupAgents(input({ publicAgents: [] }))).toEqual([]);
  });

  it('lists a public agent of the user’s own club once, under that club', () => {
    const casey = [club(ORG.startup, 'Startup Club', [startupHandoff, startupRecruiting])];
    const groups = groupAgents(input({ clubs: casey, publicAgents: [startupRecruiting, danceShowcase, danceShowcase], activeOrgId: ORG.startup }));
    expect(shape(groups)).toEqual([
      ['Startup Club', 'club', ['Club handoff', 'Recruiting Q&A']],
      [PUBLIC_GROUP_LABEL, 'public', ['Showcase Q&A']],
    ]);
    // Even if myAgents() missed it, the club's public agent joins the club, not All students.
    const missed = groupAgents(input({ clubs: [club(ORG.startup, 'Startup Club', [startupHandoff])], publicAgents: [startupRecruiting], activeOrgId: ORG.startup }));
    expect(shape(missed)).toEqual([['Startup Club', 'club', ['Club handoff', 'Recruiting Q&A']]]);
  });

  it('leaves out a club with no agents for the user', () => {
    expect(shape(groupAgents(input({ clubs: [club(ORG.archery, 'Archery Club', []), ...morganClubs.slice(1)], activeOrgId: ORG.archery }))).map(([l]) => l))
      .toEqual(['Startup Club', PUBLIC_GROUP_LABEL]);
  });
});

describe('defaultAgent', () => {
  it('opens the first agent of the active club', () => {
    expect(defaultAgent(groupAgents(input({ clubs: morganClubs, activeOrgId: ORG.startup })), ORG.startup)?.name).toBe('Club handoff');
    expect(defaultAgent(groupAgents(input({ clubs: [club(ORG.usg, 'USG', [usgReview])], activeOrgId: ORG.usg })), ORG.usg)?.name).toBe('USG review assistant');
  });
  it('falls back to the first public agent, then the first agent listed, then nothing', () => {
    expect(defaultAgent(groupAgents(input({})), null)?.name).toBe('Showcase Q&A');
    const noActiveAgents = groupAgents(input({ clubs: morganClubs, activeOrgId: ORG.dance }));
    expect(defaultAgent(noActiveAgents, ORG.dance)?.name).toBe('Showcase Q&A');
    const noPublic = groupAgents(input({ clubs: morganClubs, publicAgents: [], activeOrgId: null }));
    expect(defaultAgent(noPublic, null)?.name).toBe('Funding pre-check');
    expect(defaultAgent([], null)).toBeNull();
  });
  it('finds a requested agent only among the listed ones', () => {
    const groups = groupAgents(input({ clubs: morganClubs, activeOrgId: ORG.archery }));
    expect(findAgent(groups, INSTALLATION.startupHandoff)?.orgName).toBe('Startup Club');
    expect(findAgent(groups, INSTALLATION.startupFundingPrecheck)).toBeNull();
  });
  it('switches clubs only for an internal agent of another club', () => {
    expect(needsSwitch(startupHandoff, ORG.archery)).toBe(true);
    expect(needsSwitch(startupHandoff, ORG.startup)).toBe(false);
    expect(needsSwitch(danceShowcase, ORG.archery)).toBe(false);
    expect(needsSwitch(danceShowcase, null)).toBe(false);
  });
});

describe('agent tags', () => {
  it('maps the seed templates to topics and gives an unmapped slug none', () => {
    expect(agentTags('handoff')).toEqual(['Onboarding', 'Minutes']);
    expect(agentTags('funding-precheck')).toEqual(['Funding', 'Budget']);
    expect(agentTags('showcase-qa')).toEqual(['Events', 'Performances']);
    for (const slug of ['event-planning', 'recruiting-qa', 'usg-review-assistant']) expect(agentTags(slug).length).toBeGreaterThan(0);
    expect(agentTags('club-made-template')).toEqual([]);
    expect(agentTags('constructor')).toEqual([]);
    const custom = listing({ installationId: 'x', orgId: ORG.dance, orgName: 'Dance Club', templateSlug: 'club-made-template', name: 'Costume swap', audience: 'public' });
    expect(groupAgents(input({ publicAgents: [custom] }))[0].agents[0].tags).toEqual([]);
  });
});

describe('<AgentRail />', () => {
  const html = renderToStaticMarkup(createElement(AgentRail, {
    userId: 'morgan',
    groups: groupAgents(input({ clubs: morganClubs, activeOrgId: ORG.archery })), selectedId: INSTALLATION.archeryFundingPrecheck, activeOrgId: ORG.archery,
  }));
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  it('shows name, purpose, version and tags, and never the access reason', () => {
    expect(text).toContain('Funding pre-check v1 Funding pre-check purpose. Funding Budget');
    expect(text).toContain('Showcase Q&amp;A v2 Showcase Q&amp;A purpose. Dance Club Events Performances');
    expect(text).not.toMatch(/All members|Treasurer, President|Admin, Reviewer|Your positions/);
  });

  it('is a nav of links with the selected agent marked current, and keeps Usage', () => {
    expect(html).toMatch(/^<nav aria-label="My agents"/);
    expect(html).toMatch(/<h2[^>]*>My agents<\/h2>/);
    expect(html).toMatch(/<h3[^>]*>Archery Club<\/h3>/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html.match(/<a [^>]*aria-current="page"[^>]*>/)?.[0]).toContain(`href="/me/agents?agent=${INSTALLATION.archeryFundingPrecheck}"`);
    expect(html).toContain('href="/me/usage"');
    expect(html).toMatch(/>Projects<\/button>/);
    expect(html).toMatch(/>Project files<\/button>/);
  });

  it('renders inset agent cards with a Cardinal border on the selected card', () => {
    const cards = html.match(/<a [^>]*href="\/me\/agents\?agent=[^"]*"[^>]*>/g) ?? [];
    expect(cards).toHaveLength(3);
    for (const card of cards) expect(card).toContain('rounded-md border');
    expect(cards.find((card) => card.includes('aria-current="page"'))).toContain('border-primary');
    expect(cards.filter((card) => !card.includes('aria-current="page"')).every((card) => card.includes('border-sidebar-border'))).toBe(true);
  });
});
