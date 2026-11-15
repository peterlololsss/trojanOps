import type { ClubContent } from './content';

/** Constructed judge-demo scenario, not records from the real HackSC organization. */
export const HACKSC_CONTENT: ClubContent = {
  tagline: 'Student organizers building a repeatable hackathon, one handoff at a time.',
  about: [
    'A new organizing team is preparing the next hackathon. Last year’s meeting notes and the 2025–2026 president’s handoff preserve what worked and what caused delays.',
    'The club organizes its work across Events, Finance and Participant experience.',
  ],
  categories: ['Technology', 'Engineering'],
  contactEmail: 'hacksc@demo.trojanops.test',
  meets: 'Thursdays, 6:00 PM, Ronald Tutor Campus Center',
  departments: [
    {
      slug: 'events', name: 'Events', lead: 'sam', members: ['sam', 'jordan'],
      purpose: 'Owns venue reservations, the organizer checklist and the event run of show.',
      about: ['Events turns the previous team’s handoff into a reservation checklist, named owners and a rehearsal before doors open.'],
      budget: { lines: [{ label: 'Venue and operations', amountUsd: 1800 }], committedUsd: 0 },
    },
    {
      slug: 'finance', name: 'Finance', lead: 'taylor', members: ['taylor'],
      purpose: 'Tracks approvals and expenses; financial documents remain limited to authorized officers.',
      about: ['Finance prepares funding requests and reconciles receipts. Department membership alone does not grant access to financial documents.'],
      budget: { lines: [{ label: 'Finance contingency', amountUsd: 400 }], committedUsd: 0 },
    },
    {
      slug: 'participant-experience', name: 'Participant experience', lead: 'casey', members: ['casey', 'jordan'],
      purpose: 'Coordinates registration, check-in volunteers and separate help queues.',
      about: ['Participant experience practices the arrival flow with Events and documents issues for the next team.'],
      budget: { lines: [{ label: 'Signage and check-in supplies', amountUsd: 200 }], committedUsd: 0 },
    },
  ],
  events: [
    {
      id: 'hacksc-handoff-workshop', title: 'Organizer handoff workshop',
      startsAt: '2026-11-19T18:00:00-08:00', endsAt: '2026-11-19T19:30:00-08:00',
      location: 'Ronald Tutor Campus Center', department: 'events', rsvps: 4,
      summary: 'Review last year’s reservation and check-in lessons, then assign the next event’s owners.',
      funding: { status: 'none', amountUsd: 0 },
    },
    {
      id: 'hacksc-check-in-rehearsal', title: 'Check-in rehearsal',
      startsAt: '2026-12-03T18:00:00-08:00', endsAt: '2026-12-03T19:00:00-08:00',
      location: 'Ronald Tutor Campus Center', department: 'participant-experience', rsvps: 3,
      summary: 'Walk through registered arrivals, walk-ins and the help desk before publishing the final plan.',
      funding: { status: 'none', amountUsd: 0 },
    },
  ],
  updates: [
    {
      id: 'hacksc-handoff-update', visibility: 'members', author: 'sam', department: 'events',
      postedAt: '2026-11-14T16:00:00-08:00',
      text: 'Read the 2025–2026 president’s handoff before the workshop. Bring a proposed reservation owner and a check-in queue plan based on last year’s records.',
    },
    {
      id: 'hacksc-volunteer-update', visibility: 'public', author: 'sam', department: 'participant-experience',
      postedAt: '2026-11-12T12:00:00-08:00',
      text: 'New organizers are welcome. Our next handoff workshop covers planning, participant support and documenting lessons for the next team.',
    },
  ],
};
