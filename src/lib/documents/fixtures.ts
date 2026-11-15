// Owner: C. STUB data behind previewAccess only (until WP-9); delete it once preview reads the
// database. Mirrors the seed in db/seed/documents.ts, and tests/documents.test.ts checks that it does;
// readGrants are what the documents_read_grants trigger computes.
import type { Tier } from '../contracts';
import { DOCUMENT, ORG, SOURCE } from '@db/seed/ids';

export interface FixtureDocument {
  id: string;
  orgId: string;
  sourceId: string;
  sourceName: string;
  title: string;
  tier: Tier;
  readGrants: string[];
  bodyMd: string;
}

export const FIXTURE_DOCUMENTS: FixtureDocument[] = [
  {
    id: DOCUMENT.usgFundingRules, orgId: ORG.usg, sourceId: SOURCE.usg.rulebook, sourceName: 'USG rulebook',
    title: 'USG funding rules (demo text)', tier: 'public', readGrants: ['*'],
    bodyMd: 'Each club may receive up to $8,000 in USG funding per year. Clubs may hold 4 funded events per semester. Approved vendors need 6 instructional weeks of lead time. Requests are due Wednesday at 11:59 PM PT.',
  },
  {
    id: DOCUMENT.reviewerNotes, orgId: ORG.usg, sourceId: SOURCE.usg.usg_internal, sourceName: 'USG internal',
    title: 'Reviewer notes', tier: 'usg_internal', readGrants: [`${ORG.usg}:reviewer`, `${ORG.usg}:admin`],
    bodyMd: 'Reviewers check the event count before the budget. Flag requests that split one event into two.',
  },
  {
    id: DOCUMENT.recruitingFaq, orgId: ORG.startup, sourceId: SOURCE.startup.public, sourceName: 'Startup Club · Public',
    title: 'Recruiting FAQ', tier: 'public', readGrants: ['*'],
    bodyMd: 'Startup Club recruits every fall and spring. Anyone can attend the info session; no experience is needed.',
  },
  {
    id: DOCUMENT.minutes20261008, orgId: ORG.startup, sourceId: SOURCE.startup.minutes, sourceName: 'Startup Club · Minutes',
    title: 'Meeting minutes 2026-10-08', tier: 'members', readGrants: [`${ORG.startup}:*`],
    bodyMd: 'The board agreed to hold the pitch night on Nov 20. Jordan will shadow the treasurer this month.',
  },
  {
    id: DOCUMENT.pastEvents, orgId: ORG.startup, sourceId: SOURCE.startup.archive, sourceName: 'Startup Club · Archive',
    title: 'Past events and venues', tier: 'members', readGrants: [`${ORG.startup}:*`],
    bodyMd: 'Pitch night 2025 was held in the Ronald Tutor Campus Center. Attendance was 80 students.',
  },
  {
    id: DOCUMENT.spring2026Budget, orgId: ORG.startup, sourceId: SOURCE.startup.finance, sourceName: 'Startup Club · Finance',
    title: 'Spring 2026 budget', tier: 'officers', readGrants: [`${ORG.startup}:president`, `${ORG.startup}:treasurer`],
    bodyMd: 'The spring budget is $6,200 across three events. Catering is the largest line at $2,400.',
  },
  {
    id: DOCUMENT.sponsorContacts, orgId: ORG.startup, sourceId: SOURCE.startup.finance, sourceName: 'Startup Club · Finance',
    title: 'Sponsor contacts', tier: 'officers', readGrants: [`${ORG.startup}:president`, `${ORG.startup}:treasurer`],
    bodyMd: 'Two local sponsors have pledged support for pitch night. Contact details are kept by the treasurer.',
  },
  {
    id: DOCUMENT.archeryBudget2026, orgId: ORG.archery, sourceId: SOURCE.archery.finance, sourceName: 'Archery Club · Finance',
    title: 'Archery budget 2026', tier: 'officers', readGrants: [`${ORG.archery}:president`, `${ORG.archery}:treasurer`],
    bodyMd: 'The archery budget covers range fees and new targets. Range fees are $1,100 for the year.',
  },
  {
    id: DOCUMENT.springShowcaseInfo, orgId: ORG.dance, sourceId: SOURCE.dance.public, sourceName: 'Dance Club · Public',
    title: 'Spring showcase info', tier: 'public', readGrants: ['*'],
    bodyMd: 'The spring showcase is on April 18 at Bovard Auditorium. Tickets are free for students.',
  },
];

export const FIXTURE_CLUB_POSITIONS: Record<string, string[]> = {
  [ORG.usg]: ['admin', 'reviewer'],
  [ORG.startup]: ['president', 'treasurer', 'secretary'],
  [ORG.archery]: ['president', 'treasurer'],
  [ORG.dance]: ['president'],
};
