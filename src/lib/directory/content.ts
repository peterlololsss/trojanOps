// Owner: D (WP-11). Demo content for the org directory: club profiles, departments, events and
// updates. Clubs are keyed by org slug and people by seed `externalId`, so the pages join this to
// real orgs, users and memberships. Fictional people and placeholder text only (I13); dates and
// amounts agree with the seed documents (minutes 2026-10-08, past events, the budgets).
import type { FundingStatus } from './types';

export interface DepartmentContent {
  slug: string;
  name: string;
  purpose: string;
  about: string[];
  /** Seed `externalId` of the lead, or null while the role is open. */
  lead: string | null;
  members: string[];
  budget: { lines: Array<{ label: string; amountUsd: number }>; committedUsd: number };
}

export interface EventContent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  summary: string;
  department: string | null;
  rsvps: number;
  funding: { status: FundingStatus; amountUsd: number };
}

export interface UpdateContent {
  id: string;
  /** `members`: only the club's members and USG see it. */
  visibility: 'public' | 'members';
  /** Seed `externalId`, or null for a post from the club itself. */
  author: string | null;
  department: string | null;
  postedAt: string;
  text: string;
}

export interface ClubContent {
  tagline: string;
  about: string[];
  categories: string[];
  contactEmail: string;
  meets: string;
  departments: DepartmentContent[];
  events: EventContent[];
  updates: UpdateContent[];
}

/** A club provisioned by the roster import has no profile yet. */
export const EMPTY_CLUB: ClubContent = {
  tagline: '',
  about: [],
  categories: [],
  contactEmail: '',
  meets: '',
  departments: [],
  events: [],
  updates: [],
};

export const CLUB_CONTENT: Readonly<Record<string, ClubContent>> = {
  startup: {
    tagline: 'Build companies with other Trojans, from first idea to Demo day.',
    about: [
      'Startup Club brings together students from every major who want to start something. Members form project teams each semester, pitch them at Pitch night and present at Demo day.',
      'You do not need a startup idea or a team to join. Recruiting runs in the first three weeks of fall and spring, and anyone can come to an info session.',
    ],
    categories: ['Entrepreneurship', 'Career', 'Pre-professional'],
    contactEmail: 'startup@demo.trojanops.test',
    meets: 'Tuesdays, 7:00 PM, Ronald Tutor Campus Center',
    departments: [
      {
        slug: 'events',
        name: 'Events',
        purpose: 'Plans Pitch night, the speaker series and Demo day: rooms, catering and the run of show.',
        about: [
          'Events books rooms at least four weeks ahead, runs check-in and keeps the timer on pitch nights.',
          'Catering needs a named officer on site to receive the order, so every event lists one in its run of show.',
        ],
        lead: 'casey',
        members: ['casey', 'jordan'],
        budget: {
          lines: [{ label: 'Pitch night', amountUsd: 1500 }, { label: 'Founder fireside chat', amountUsd: 700 }, { label: 'Spring kickoff', amountUsd: 400 }],
          committedUsd: 1650,
        },
      },
      {
        slug: 'finance',
        name: 'Finance',
        purpose: 'Keeps the budget, files USG funding requests and settles invoices after each event.',
        about: [
          'Finance drafts each USG funding request and runs it through Funding pre-check before the Wednesday deadline.',
          'Receipts and final invoices go to the treasurer within three business days of each event.',
        ],
        lead: 'taylor',
        members: ['taylor', 'jordan'],
        budget: { lines: [{ label: 'Contingency', amountUsd: 400 }, { label: 'Bank and card fees', amountUsd: 100 }], committedUsd: 40 },
      },
      {
        slug: 'marketing',
        name: 'Marketing and recruiting',
        purpose: 'Runs info sessions, the interest form and the posters for every event.',
        about: [
          'Marketing and recruiting runs the info sessions in the first three weeks of each semester and keeps the interest form open between them.',
        ],
        lead: 'morgan',
        members: ['morgan', 'casey'],
        budget: { lines: [{ label: 'Printing and signage', amountUsd: 350 }, { label: 'Info session snacks', amountUsd: 150 }], committedUsd: 210 },
      },
    ],
    events: [
      {
        id: 'startup-fall-info-session', title: 'Fall info session', startsAt: '2026-09-02T19:00:00-07:00', endsAt: '2026-09-02T20:00:00-07:00',
        location: 'Ronald Tutor Campus Center', summary: 'What Startup Club does, how project teams form and how to join this semester.',
        department: 'marketing', rsvps: 62, funding: { status: 'none', amountUsd: 0 },
      },
      {
        id: 'startup-fall-kickoff', title: 'Fall kickoff', startsAt: '2026-09-15T19:00:00-07:00', endsAt: '2026-09-15T21:00:00-07:00',
        location: 'Ronald Tutor Campus Center', summary: 'New members meet the project teams and choose one in the room.',
        department: 'events', rsvps: 48, funding: { status: 'approved', amountUsd: 600 },
      },
      {
        id: 'startup-pitch-night', title: 'Pitch night', startsAt: '2026-11-20T18:30:00-08:00', endsAt: '2026-11-20T21:00:00-08:00',
        location: 'Ronald Tutor Campus Center', summary: 'Each team pitches for five minutes and takes three minutes of questions. Check-in opens 30 minutes before the first pitch.',
        department: 'events', rsvps: 84, funding: { status: 'approved', amountUsd: 1200 },
      },
      {
        id: 'startup-founder-fireside', title: 'Founder fireside chat', startsAt: '2026-12-01T19:00:00-08:00', endsAt: '2026-12-01T20:30:00-08:00',
        location: 'Taper Hall, room 101', summary: 'An alum who started a company as a student talks about the first year, followed by questions.',
        department: 'events', rsvps: 37, funding: { status: 'pending', amountUsd: 500 },
      },
      {
        id: 'startup-spring-kickoff', title: 'Spring kickoff', startsAt: '2027-01-21T19:00:00-08:00', endsAt: '2027-01-21T21:00:00-08:00',
        location: 'Ronald Tutor Campus Center', summary: 'Spring project teams form. Bring an idea or join one.',
        department: 'events', rsvps: 12, funding: { status: 'none', amountUsd: 0 },
      },
    ],
    updates: [
      {
        id: 'startup-update-4', visibility: 'public', author: 'sam', department: 'events', postedAt: '2026-11-13T16:20:00-08:00',
        text: 'Pitch night is confirmed for Nov 20 in the Ronald Tutor Campus Center. Teams, send your deck to Casey by Nov 18.',
      },
      {
        id: 'startup-update-3', visibility: 'members', author: 'taylor', department: 'finance', postedAt: '2026-11-10T11:05:00-08:00',
        text: 'USG approved $1,200 for Pitch night. Receipts go to me within three business days of the event.',
      },
      {
        id: 'startup-update-2', visibility: 'members', author: 'morgan', department: 'marketing', postedAt: '2026-11-04T09:40:00-08:00',
        text: 'The interest form for spring project teams is open. Share it with friends who missed the fall info session.',
      },
      {
        id: 'startup-update-1', visibility: 'members', author: 'jordan', department: 'finance', postedAt: '2026-10-09T18:15:00-07:00',
        text: 'I am shadowing Taylor on the budget and the Pitch night funding request this month, ahead of taking over as treasurer.',
      },
    ],
  },
  archery: {
    tagline: 'Recurve and compound archery for beginners and competitors.',
    about: [
      'Archery Club shoots every Saturday morning at a partner range. Beginners borrow club bows and safety gear; no experience needed.',
      'The competition team travels to collegiate tournaments in the spring.',
    ],
    categories: ['Sports', 'Recreation'],
    contactEmail: 'archery@demo.trojanops.test',
    meets: 'Saturdays, 9:00 AM, partner range',
    departments: [
      {
        slug: 'range',
        name: 'Range operations',
        purpose: 'Books range time, keeps the equipment log and runs the safety briefing.',
        about: ['Range operations runs the safety briefing at the start of every session and checks out club bows.'],
        lead: null,
        members: [],
        budget: { lines: [{ label: 'Range fees', amountUsd: 1100 }, { label: 'New targets', amountUsd: 450 }], committedUsd: 1100 },
      },
      {
        slug: 'finance',
        name: 'Finance',
        purpose: 'Keeps the budget and pays range fees.',
        about: ['Finance pays range fees for the year up front and tracks equipment purchases.'],
        lead: 'morgan',
        members: ['morgan'],
        budget: { lines: [{ label: 'Arrows and spare strings', amountUsd: 300 }, { label: 'Safety gear for beginners', amountUsd: 150 }], committedUsd: 150 },
      },
    ],
    events: [
      {
        id: 'archery-equipment-night', title: 'Equipment night', startsAt: '2026-10-03T18:00:00-07:00', endsAt: '2026-10-03T20:00:00-07:00',
        location: 'Lyon Center, room 2', summary: 'Fit a club bow, learn to string it and sign the range waiver.',
        department: 'range', rsvps: 21, funding: { status: 'none', amountUsd: 0 },
      },
      {
        id: 'archery-beginner-day', title: 'Beginner range day', startsAt: '2026-11-21T09:00:00-08:00', endsAt: '2026-11-21T12:00:00-08:00',
        location: 'Partner range', summary: 'Three hours of coached shooting for new members. Bows and safety gear provided.',
        department: 'range', rsvps: 18, funding: { status: 'approved', amountUsd: 350 },
      },
      {
        id: 'archery-winter-league', title: 'Winter league opener', startsAt: '2027-01-23T09:00:00-08:00', endsAt: '2027-01-23T13:00:00-08:00',
        location: 'Partner range', summary: 'Scored rounds for the winter league. Open to members who passed the safety briefing.',
        department: null, rsvps: 9, funding: { status: 'none', amountUsd: 0 },
      },
    ],
    updates: [
      {
        id: 'archery-update-1', visibility: 'members', author: 'morgan', department: 'finance', postedAt: '2026-11-09T10:30:00-08:00',
        text: 'Range fees for the year are paid. USG approved $350 toward Beginner range day.',
      },
    ],
  },
  dance: {
    tagline: 'Contemporary, hip-hop and K-pop dance, with open rehearsals every week.',
    about: [
      'Dance Club rehearses twice a week and puts on a showcase every spring. Every level is welcome at open rehearsals.',
    ],
    categories: ['Performing arts', 'Cultural'],
    contactEmail: 'dance@demo.trojanops.test',
    meets: 'Mondays and Thursdays, 8:00 PM, Physical Education building',
    departments: [
      {
        slug: 'choreography', name: 'Choreography', purpose: 'Sets the pieces and runs rehearsals for the showcase.',
        about: ['Choreography sets each showcase piece and runs the weekly rehearsals.'], lead: null, members: [],
        budget: { lines: [{ label: 'Studio time', amountUsd: 600 }], committedUsd: 0 },
      },
      {
        slug: 'production', name: 'Production', purpose: 'Lighting, sound, costumes and the showcase run of show.',
        about: ['Production works with the venue on lighting and sound and keeps the costume inventory.'], lead: null, members: [],
        budget: { lines: [{ label: 'Costumes', amountUsd: 900 }, { label: 'Lighting and sound', amountUsd: 1200 }], committedUsd: 0 },
      },
    ],
    events: [
      {
        id: 'dance-open-rehearsal', title: 'Open rehearsal', startsAt: '2026-11-19T20:00:00-08:00', endsAt: '2026-11-19T22:00:00-08:00',
        location: 'Physical Education building, studio B', summary: 'Learn a short piece from this year’s showcase. All levels.',
        department: 'choreography', rsvps: 26, funding: { status: 'none', amountUsd: 0 },
      },
      {
        id: 'dance-spring-showcase', title: 'Spring showcase', startsAt: '2027-04-18T19:00:00-07:00', endsAt: '2027-04-18T20:30:00-07:00',
        location: 'Bovard Auditorium', summary: 'About 90 minutes with one intermission. Free for students with a student ID.',
        department: 'production', rsvps: 140, funding: { status: 'pending', amountUsd: 2000 },
      },
    ],
    updates: [
      {
        id: 'dance-update-1', visibility: 'public', author: null, department: null, postedAt: '2026-11-12T12:00:00-08:00',
        text: 'Showcase auditions open after Thanksgiving. Come to an open rehearsal first to learn the audition piece.',
      },
    ],
  },
};

export function clubContent(slug: string): ClubContent {
  return Object.hasOwn(CLUB_CONTENT, slug) ? CLUB_CONTENT[slug] : EMPTY_CLUB;
}
