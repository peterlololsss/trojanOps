// Owner: D (WP-11). Markup of the org directory's dashboards: the header, the tab links, event rows,
// the hidden roster, USG's oversight strip, the president's budget and the clubs list. Rendered to
// static HTML in node (no browser, no database) from fixture view models, so it checks what each
// viewer is shown once the service has decided what they may see.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ClubDashboardView } from '@/app/directory/_dashboard/club-dashboard';
import { DepartmentDashboardView, DepartmentForbidden } from '@/app/directory/_dashboard/department-dashboard';
import { filterClubs, NO_FILTERS, type SearchParams } from '@/app/directory/_dashboard/model';
import { ClubsList } from '@/app/directory/clubs/clubs-list';
import type {
  ClubDashboard, ClubOversight, ClubRow, DepartmentDashboard, DirectoryEvent, DirectoryViewer, OfficerSeat,
} from '@/lib/directory/types';
import { INSTALLATION, ORG, USER } from '@db/seed/ids';

const MICRO = 1_000_000;
const STARTUP = `/directory/clubs/${ORG.startup}`;

const event = (patch: Partial<DirectoryEvent> & Pick<DirectoryEvent, 'id' | 'title' | 'startsAt' | 'endsAt'>): DirectoryEvent => ({
  location: 'Ronald Tutor Campus Center',
  summary: '',
  department: { slug: 'events', name: 'Events' },
  rsvps: 0,
  funding: { status: 'none', amountMicro: 0 },
  past: false,
  ...patch,
});

const events: DirectoryEvent[] = [
  event({
    id: 'startup-fall-kickoff', title: 'Fall kickoff', startsAt: '2026-09-16T02:00:00.000Z', endsAt: '2026-09-16T04:00:00.000Z',
    rsvps: 48, funding: { status: 'approved', amountMicro: 600 * MICRO }, past: true,
  }),
  event({
    id: 'startup-pitch-night', title: 'Pitch night', startsAt: '2026-11-21T02:30:00.000Z', endsAt: '2026-11-21T05:00:00.000Z',
    rsvps: 84, funding: { status: 'approved', amountMicro: 1200 * MICRO },
  }),
  event({
    id: 'startup-founder-fireside', title: 'Founder fireside chat', startsAt: '2026-12-02T03:00:00.000Z', endsAt: '2026-12-02T04:30:00.000Z',
    location: 'Taper Hall, room 101', rsvps: 37, funding: { status: 'pending', amountMicro: 500 * MICRO },
  }),
  event({
    id: 'startup-spring-kickoff', title: 'Spring kickoff', startsAt: '2027-01-22T03:00:00.000Z', endsAt: '2027-01-22T05:00:00.000Z',
    rsvps: 12,
  }),
];

const officers: OfficerSeat[] = [
  { slug: 'president', name: 'President', holders: [{ userId: USER.sam, name: 'Sam' }] },
  { slug: 'treasurer', name: 'Treasurer', holders: [{ userId: USER.taylor, name: 'Taylor' }] },
  { slug: 'secretary', name: 'Secretary', holders: [] },
];

const oversight: ClubOversight = {
  quota: { limitMicro: 5 * MICRO, spentMicro: 4_200_000, remainingMicro: 800_000 },
  installedAgents: 3,
  enabledAgents: 2,
  policy: { hasPolicy: true, allowPublicAgents: true, allowedModelClasses: ['economy'] },
  funding: { approvedMicro: 1800 * MICRO, pendingMicro: 500 * MICRO, capMicro: 8000 * MICRO, fundedEvents: 2, eventLimit: 4 },
};

const viewer = (patch: Partial<DirectoryViewer> = {}): DirectoryViewer => ({ usg: false, usgAdmin: false, member: false, president: false, ...patch });

/** Startup Club as Lee (a student in no club) sees it: no roster, no departments, no oversight. */
const asStudent: ClubDashboard = {
  club: {
    id: ORG.startup, slug: 'startup', name: 'Startup Club', status: 'active',
    tagline: 'Build companies with other Trojans, from first idea to demo day.',
    categories: ['Entrepreneurship', 'Career'],
    cohorts: ['pilot'],
    about: ['Startup Club brings together students from every major who want to start something.'],
    contactEmail: 'startup@demo.trojanops.test',
    meets: 'Tuesdays, 7:00 PM, Ronald Tutor Campus Center',
  },
  viewer: viewer(),
  officers,
  memberCount: 5,
  members: null,
  events,
  updates: [
    { id: 'u4', author: 'Sam', department: 'Events', postedAt: '2026-11-14T00:20:00.000Z', text: 'Pitch night is confirmed for Nov 20.' },
    { id: 'u3', author: 'Taylor', department: 'Finance', postedAt: '2026-11-10T19:05:00.000Z', text: 'USG approved $1,200 for Pitch night.' },
    { id: 'u2', author: null, department: null, postedAt: '2026-11-04T17:40:00.000Z', text: 'The interest form for spring project teams is open.' },
    { id: 'u1', author: 'Jordan', department: 'Finance', postedAt: '2026-10-10T01:15:00.000Z', text: 'I am shadowing Taylor on the budget.' },
  ],
  departments: null,
  publicAgents: [{
    installationId: INSTALLATION.startupRecruitingQa, orgId: ORG.startup, orgName: 'Startup Club', templateSlug: 'recruiting-qa',
    name: 'Recruiting Q&A', purpose: 'Answers questions about joining Startup Club.', audience: 'public', reasonLabel: 'All students', templateVersion: 1,
  }],
  oversight: null,
};

/** The same club as Avery (USG admin) sees it. */
const asUsg: ClubDashboard = {
  ...asStudent,
  viewer: viewer({ usg: true, usgAdmin: true }),
  members: [
    { userId: USER.sam, name: 'Sam', positions: ['President'] },
    { userId: USER.taylor, name: 'Taylor', positions: ['Treasurer', 'Member'] },
    { userId: USER.casey, name: 'Casey', positions: ['Member'] },
  ],
  departments: [{
    slug: 'events', name: 'Events', purpose: 'Plans Pitch night.', lead: { userId: USER.casey, name: 'Casey' }, memberCount: 2,
    nextEvent: { title: 'Pitch night', startsAt: '2026-11-21T02:30:00.000Z' }, budget: null,
  }],
  oversight,
};

const club = (data: ClubDashboard, searchParams: SearchParams = {}) =>
  renderToStaticMarkup(createElement(ClubDashboardView, { data, searchParams }));

/** The links in the tab bar, in order, and the one marked current. */
function tabBar(html: string) {
  const nav = html.match(/<nav aria-label="Startup Club sections"[^]*?<\/nav>/)?.[0] ?? '';
  const labels = [...nav.matchAll(/<a [^>]*>([A-Za-z]+)/g)].map((m) => m[1]);
  const current = nav.match(/<a [^>]*aria-current="page"[^>]*>([A-Za-z]+)/)?.[1];
  return { labels, current };
}

describe('club dashboard', () => {
  it('heads the page with the name, the parent, the tagline and the chips', () => {
    const html = club(asStudent);
    expect(html).toMatch(/<h1[^>]*>Startup Club<\/h1>/);
    expect(html).toContain('Registered student organization');
    expect(html).toContain('Build companies with other Trojans, from first idea to demo day.');
    for (const chip of ['Entrepreneurship', 'Career', 'Pilot cohort']) expect(html).toContain(`>${chip}</span>`);
    expect(html).toContain('href="mailto:startup@demo.trojanops.test"');
    expect(html).not.toContain('Inactive');
  });

  it('marks the active tab and hides Members and Departments from a student outside the club', () => {
    expect(tabBar(club(asStudent))).toEqual({ labels: ['About', 'Events', 'Officers', 'Agents'], current: 'About' });
    expect(tabBar(club(asUsg, { tab: 'events' }))).toEqual({
      labels: ['About', 'Events', 'Members', 'Officers', 'Departments', 'Agents'], current: 'Events',
    });
    // A tab the viewer does not have, or one that does not exist, opens About.
    expect(tabBar(club(asStudent, { tab: 'members' })).current).toBe('About');
    expect(tabBar(club(asStudent, { tab: 'nope' })).current).toBe('About');
    expect(club(asStudent)).toContain(`href="${STARTUP}?tab=agents"`);
  });

  it('gives a student outside the club the member count but no roster', () => {
    const html = club(asStudent);
    expect(html).toContain('5 members');
    expect(html).not.toContain('?tab=members');
    const members = club(asUsg, { tab: 'members' });
    expect(members).toContain('Treasurer, Member');
    expect(members).toContain('3 members');
  });

  it('shows USG oversight to USG only', () => {
    const student = club(asStudent);
    expect(student).not.toContain('USG oversight');
    expect(student).not.toContain('Manage quota and policy');
    const usg = club(asUsg);
    expect(usg).toContain('USG oversight');
    expect(usg).toContain('$4.20</span><span class="text-muted-foreground"> of $5.00 used');
    expect(usg).toContain('84% used');
    expect(usg).toContain('3 installed · 2 enabled');
    expect(usg).toContain('Models: Economy');
    expect(usg).toContain('Public agents allowed');
    expect(usg).toContain('$1,800 of $8,000 this year');
    expect(usg).toContain('2 of 4 funded events this semester');
    expect(usg).toContain('$500 pending');
    expect(usg).toContain('href="/usg/clubs"');
  });

  it('says when a club has no policy and when its quota is used up', () => {
    const html = club({ ...asUsg, oversight: {
      ...oversight,
      quota: { limitMicro: 5 * MICRO, spentMicro: 5 * MICRO, remainingMicro: 0 },
      policy: { hasPolicy: false, allowPublicAgents: false, allowedModelClasses: [] },
    } });
    expect(html).toContain('Policy missing');
    expect(html).toContain('Startup Club has used its monthly AI quota ($5.00 of $5.00). USG can raise it.');
  });

  it('lays out About: contact, officer avatars, the description, updates and the next events', () => {
    const html = club(asStudent);
    expect(html).toContain('Tuesdays, 7:00 PM, Ronald Tutor Campus Center');
    const visible = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    expect(visible).toContain('Sam President');
    expect(visible).toContain('Taylor Treasurer');
    expect(html).toContain('Startup Club brings together students');
    // Three of four updates, newest first, and a link to the rest; a club post carries the club name.
    expect(html).toContain('Pitch night is confirmed');
    expect(html).not.toContain('I am shadowing Taylor');
    expect(html).toContain(`href="${STARTUP}?updates=all#recent-updates"`);
    expect(html).toContain('Nov 13, 2026, 4:20 PM PT');
    expect(club(asStudent, { updates: 'all' })).toContain('I am shadowing Taylor');
    // Upcoming events: the next three, never a past one.
    expect(html).toContain(`href="${STARTUP}?tab=events"`);
    expect(html).not.toContain('Fall kickoff');
  });

  it('folds officers past the limit into a "+N" link to the Officers tab', () => {
    const many: OfficerSeat[] = Array.from({ length: 8 }, (_, i) => ({
      slug: `seat-${i}`, name: `Seat ${i}`, holders: [{ userId: `user-${i}`, name: `Officer ${i}` }],
    }));
    const html = club({ ...asStudent, officers: many });
    expect(html).toContain('aria-label="+2 more officers"');
    expect(html).toContain('+2');
    expect(html).toContain('Officer 5');
    expect(html).not.toContain('Officer 6');
  });

  it('lists officer seats, vacant ones included', () => {
    const html = club(asStudent, { tab: 'officers' });
    expect(html).toContain('Secretary');
    expect(html).toContain('Vacant');
  });

  it('lists public agents with Open, or says the club has none', () => {
    const html = club(asStudent, { tab: 'agents' });
    expect(html).toContain('Recruiting Q&amp;A');
    expect(html).toContain('All students');
    expect(html).toContain(`href="/directory/${INSTALLATION.startupRecruitingQa}"`);
    expect(club({ ...asStudent, publicAgents: [] }, { tab: 'agents' })).toContain('Startup Club has no public agents yet.');
  });

  it('links departments to the club-scoped department dashboard', () => {
    const html = club(asUsg, { tab: 'departments' });
    expect(html).toContain(`href="${STARTUP}/departments/events"`);
    expect(html).toContain('Casey');
    expect(html).not.toContain('Semester budget');
  });
});

describe('events', () => {
  it('shows a date block, the Pacific time range and a funding chip per event', () => {
    const html = club(asStudent, { tab: 'events' });
    expect(html).toMatch(/data-date-block[^>]*><span[^>]*>NOV<\/span><span[^>]*>20<\/span>/);
    expect(html).toContain('Fri, Nov 20, 2026, 6:30–9:00 PM PT');
    expect(html).toContain('USG funded · $1,200');
    expect(html).toContain('Funding pending · $500');
    expect(html).toContain('No USG funding');
    expect(html).toContain('84');
    expect(html).toContain('RSVPs');
  });

  it('splits upcoming from past with links, soonest first and most recent first', () => {
    const upcoming = club(asStudent, { tab: 'events' });
    expect(upcoming).toContain('Upcoming events');
    expect(upcoming).not.toContain('Fall kickoff');
    expect(upcoming.indexOf('Pitch night')).toBeLessThan(upcoming.indexOf('Spring kickoff'));
    expect(upcoming).toMatch(/aria-current="page"[^>]*>Upcoming \(3\)/);
    expect(upcoming).toContain(`href="${STARTUP}?tab=events&amp;when=past"`);

    const past = club(asStudent, { tab: 'events', when: 'past' });
    expect(past).toContain('Past events');
    expect(past).toContain('Fall kickoff');
    expect(past).not.toContain('Pitch night');
    expect(past).toMatch(/aria-current="page"[^>]*>Past \(1\)/);
  });

  it('says so when there are no events', () => {
    expect(club({ ...asStudent, events: [] }, { tab: 'events' })).toContain('No events yet.');
  });
});

describe('department dashboard', () => {
  const department = (budget: DepartmentDashboard['budget'], president: boolean): DepartmentDashboard => ({
    club: { id: ORG.startup, name: 'Startup Club', slug: 'startup' },
    department: { slug: 'events', name: 'Events', purpose: 'Plans Pitch night, the speaker series and Demo day.', about: ['Events books rooms four weeks ahead.'] },
    viewer: viewer({ member: true, president }),
    lead: { userId: USER.casey, name: 'Casey' },
    members: [{ userId: USER.casey, name: 'Casey', positions: ['Member'] }, { userId: USER.jordan, name: 'Jordan', positions: ['Member'] }],
    events: events.filter((e) => e.department?.slug === 'events'),
    updates: [],
    budget,
  });
  const render = (data: DepartmentDashboard, searchParams: SearchParams = {}) => renderToStaticMarkup(createElement(DepartmentDashboardView, {
    data, base: '/directory/departments/events', searchParams,
  }));
  const budget = {
    allocatedMicro: 2600 * MICRO, committedMicro: 1650 * MICRO,
    lines: [{ label: 'Pitch night', amountMicro: 1500 * MICRO }, { label: 'Founder fireside chat', amountMicro: 700 * MICRO }],
  };

  it('heads the page with the department and links its club', () => {
    const html = render(department(null, false));
    expect(html).toMatch(/<h1[^>]*>Events<\/h1>/);
    expect(html).toContain(`href="${STARTUP}"`);
    expect(html).toContain('Plans Pitch night, the speaker series and Demo day.');
    expect(html).toContain('Lead: Casey');
    expect(html).toMatch(/<nav aria-label="Events sections"/);
    expect(html).toContain('href="/directory/departments/events?tab=members"');
  });

  it('shows the budget to the president only', () => {
    const member = render(department(null, false));
    expect(member).not.toContain('Semester budget');
    expect(member).not.toContain('Administration');
    const president = render(department(budget, true));
    expect(president).toContain('Semester budget');
    expect(president).toContain('$1,650 of $2,600 committed');
    expect(president).toContain('$1,500');
    expect(president).toContain(`href="/org/${ORG.startup}/admin"`);
  });

  it('marks the lead on the Members tab', () => {
    const html = render(department(null, false), { tab: 'members' });
    expect(html).toMatch(/Casey<\/span><span[^>]*>Lead<\/span>/);
    expect(html).toContain('Jordan');
  });

  it('tells a student outside the club who can see departments and who to ask', () => {
    const html = renderToStaticMarkup(createElement(DepartmentForbidden, {
      message: 'Only members of Startup Club and USG can see its departments.', orgId: ORG.startup,
    }));
    expect(html).toContain('Only members of Startup Club and USG can see its departments.');
    expect(html).toContain(`href="${STARTUP}?tab=officers"`);
  });
});

describe('clubs list', () => {
  const row = (patch: Partial<ClubRow> & Pick<ClubRow, 'id' | 'slug' | 'name'>): ClubRow => ({
    status: 'active', tagline: '', categories: [], cohorts: [], memberCount: 0, publicAgentCount: 0,
    nextEvent: null, oversight: null, ...patch,
  });
  const clubs: ClubRow[] = [
    row({ id: ORG.archery, slug: 'archery', name: 'Archery Club', categories: ['Sports', 'Recreation'], memberCount: 1,
      nextEvent: { title: 'Beginner range day', startsAt: '2026-11-21T17:00:00.000Z' } }),
    row({ id: ORG.startup, slug: 'startup', name: 'Startup Club', categories: ['Entrepreneurship', 'Career'], memberCount: 5, publicAgentCount: 1,
      tagline: 'Build companies with other Trojans.', nextEvent: { title: 'Pitch night', startsAt: '2026-11-21T02:30:00.000Z' } }),
    row({ id: ORG.dance, slug: 'dance', name: 'Dance Club', status: 'inactive', categories: ['Performing arts'] }),
  ];
  const withOversight = clubs.map((c) => ({ ...c, oversight: { quota: oversight.quota, funding: oversight.funding } }));
  const render = (usg: boolean) => renderToStaticMarkup(createElement(ClubsList, {
    view: { viewer: { usg, usgAdmin: usg }, clubs: usg ? withOversight : clubs },
  }));

  it('lists clubs as rows that link to their dashboards', () => {
    const html = render(false);
    expect(html).toContain('3 clubs');
    expect(html).toContain(`href="${STARTUP}"`);
    expect(html).toContain('Nov 20');
    expect(html).toContain('Pitch night');
    expect(html).not.toContain('Monthly quota');
    expect(html).not.toContain('Status');
  });

  it('adds status, the quota meter and USG funding for USG', () => {
    const html = render(true);
    expect(html).toContain('Monthly quota');
    expect(html).toContain('role="meter"');
    expect(html).toContain('$1,800 of $8,000');
    expect(html).toContain('Inactive');
    expect(html).toContain('Status');
  });

  it('filters by words, category and status', () => {
    expect(filterClubs(clubs, { ...NO_FILTERS, search: 'trojans' }).map((c) => c.slug)).toEqual(['startup']);
    expect(filterClubs(clubs, { ...NO_FILTERS, category: 'Sports' }).map((c) => c.slug)).toEqual(['archery']);
    expect(filterClubs(clubs, { ...NO_FILTERS, status: 'inactive' }).map((c) => c.slug)).toEqual(['dance']);
  });

  it('says when there are no clubs yet, with the roster import for a USG admin', () => {
    const html = renderToStaticMarkup(createElement(ClubsList, { view: { viewer: { usg: true, usgAdmin: true }, clubs: [] } }));
    expect(html).toContain('No clubs yet.');
    expect(html).toContain('href="/usg/integrations"');
  });
});
