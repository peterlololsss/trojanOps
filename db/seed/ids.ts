// Fixed ids for the seed data (docs/architecture.md §15). Stubs and tests use these, so fixtures
// match the real seed. Shared and append-only: add ids for your area; never change an existing one.

const id = (kind: number, n: number) =>
  `${kind.toString(16).padStart(8, '0')}-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

// Orgs and people (D seeds them)
export const ORG = {
  usg: id(0x10, 1),
  startup: id(0x10, 2),
  archery: id(0x10, 3),
  dance: id(0x10, 4),
  hacksc: id(0x10, 5),
} as const;

export const USER = {
  avery: id(0x20, 1),   // USG admin
  riley: id(0x20, 2),   // USG reviewer
  sam: id(0x20, 3),     // Startup president
  taylor: id(0x20, 4),  // Startup treasurer + member
  jordan: id(0x20, 5),  // Startup member, incoming treasurer
  casey: id(0x20, 6),   // Startup member
  morgan: id(0x20, 7),  // Archery treasurer + Startup member
  lee: id(0x20, 8),     // no club
} as const;

export const POSITION = {
  usg: { admin: id(0x30, 0x101), reviewer: id(0x30, 0x102) },
  startup: {
    president: id(0x30, 0x201),
    treasurer: id(0x30, 0x202),
    secretary: id(0x30, 0x203),
    member: id(0x30, 0x204),
  },
  archery: { president: id(0x30, 0x301), treasurer: id(0x30, 0x302), member: id(0x30, 0x303) },
  dance: { president: id(0x30, 0x401), member: id(0x30, 0x402) },
  hacksc: { president: id(0x30, 0x501), treasurer: id(0x30, 0x502), member: id(0x30, 0x503) },
} as const;

// Documents (C seeds them)
export const SOURCE = {
  usg: { rulebook: id(0x40, 0x101), usg_internal: id(0x40, 0x102) },
  startup: {
    public: id(0x40, 0x201),
    minutes: id(0x40, 0x202),
    finance: id(0x40, 0x203),
    archive: id(0x40, 0x204),
  },
  archery: {
    public: id(0x40, 0x301),
    minutes: id(0x40, 0x302),
    finance: id(0x40, 0x303),
    archive: id(0x40, 0x304),
  },
  dance: {
    public: id(0x40, 0x401),
    minutes: id(0x40, 0x402),
    finance: id(0x40, 0x403),
    archive: id(0x40, 0x404),
  },
  hacksc: {
    public: id(0x40, 0x501),
    minutes: id(0x40, 0x502),
    finance: id(0x40, 0x503),
    archive: id(0x40, 0x504),
  },
} as const;

export const DOCUMENT = {
  usgFundingRules: id(0x50, 1),
  reviewerNotes: id(0x50, 2),
  recruitingFaq: id(0x50, 3),
  minutes20261008: id(0x50, 4),
  pastEvents: id(0x50, 5),
  spring2026Budget: id(0x50, 6),
  sponsorContacts: id(0x50, 7),
  archeryBudget2026: id(0x50, 8),
  springShowcaseInfo: id(0x50, 9),
  hackscGuide: id(0x50, 10),
  hackscMinutes2026: id(0x50, 11),
  hackscHandoff2026: id(0x50, 12),
  hackscBudget: id(0x50, 13),
} as const;

// Distribution (B seeds them)
export const TEMPLATE = {
  fundingPrecheck: id(0x60, 1),
  eventPlanning: id(0x60, 2),
  recruitingQa: id(0x60, 3),
  showcaseQa: id(0x60, 4),
  handoff: id(0x60, 5),
  usgReviewAssistant: id(0x60, 6),
  meetingRecap: id(0x60, 7),
  eventRetrospective: id(0x60, 8),
  archeryGettingStarted: id(0x60, 9),
  auditionGuide: id(0x60, 10),
  hackscHandoff: id(0x60, 11),
  hackscMeetingSummary: id(0x60, 12),
} as const;

export const INSTALLATION = {
  startupFundingPrecheck: id(0x70, 0x201),
  startupRecruitingQa: id(0x70, 0x202),
  startupHandoff: id(0x70, 0x203),
  archeryFundingPrecheck: id(0x70, 0x301),
  danceFundingPrecheck: id(0x70, 0x401),
  danceShowcaseQa: id(0x70, 0x402),
  usgReviewAssistant: id(0x70, 0x101),
  startupMeetingRecap: id(0x70, 0x204),
  startupEventRetrospective: id(0x70, 0x205),
  archeryGettingStarted: id(0x70, 0x302),
  danceAuditionGuide: id(0x70, 0x403),
  hackscFundingPrecheck: id(0x70, 0x501),
  hackscHandoff: id(0x70, 0x502),
  hackscMeetingSummary: id(0x70, 0x503),
} as const;

export const RULE_PACK = {
  usgFundingV1: id(0x80, 1),
} as const;
