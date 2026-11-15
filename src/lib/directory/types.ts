// Owner: D (WP-11). Serializable models for the org directory: clubs for USG and for students, a
// club's departments for its members. Type-only, so client components can import them.
import type { AgentListing, ModelClass } from '@/lib/contracts';

export type FundingStatus = 'approved' | 'pending' | 'none';

/** Who is looking, which decides the tabs and the numbers a page shows. */
export interface DirectoryViewer {
  /** Acting in USG (any position). */
  usg: boolean;
  /** A USG admin acting in USG: may manage quota and policy. */
  usgAdmin: boolean;
  /** Holds an active membership in the club on the page. */
  member: boolean;
  /** The club's president, acting in it: sees department budgets and Administration. */
  president: boolean;
}

export interface DirectoryPerson { userId: string; name: string; positions: string[] }

export interface OfficerSeat { slug: string; name: string; holders: Array<{ userId: string; name: string }> }

export interface DirectoryEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  summary: string;
  /** null for a viewer outside the club and USG. */
  department: { slug: string; name: string } | null;
  rsvps: number;
  /** null for a viewer outside the club and USG. */
  funding: { status: FundingStatus; amountMicro: number } | null;
  /** Ended before `now()`. */
  past: boolean;
}

export interface DirectoryUpdate {
  id: string;
  /** The person who posted, or null for a post from the club itself. */
  author: string | null;
  department: string | null;
  postedAt: string;
  text: string;
}

export interface DepartmentRow {
  slug: string;
  name: string;
  purpose: string;
  lead: { userId: string; name: string } | null;
  memberCount: number;
  nextEvent: { title: string; startsAt: string } | null;
  /** The semester budget; null unless the viewer is the club's president. */
  budget: { allocatedMicro: number; committedMicro: number } | null;
}

/** USG funding against the latest published `usg-funding` rule pack. */
export interface FundingSummary {
  approvedMicro: number;
  pendingMicro: number;
  capMicro: number;
  /** Approved events in the current semester, against the per-semester limit. */
  fundedEvents: number;
  eventLimit: number;
}

export interface QuotaUse { limitMicro: number; spentMicro: number; remainingMicro: number }

/** What USG sees about a club and students do not. */
export interface ClubOversight {
  quota: QuotaUse;
  installedAgents: number;
  enabledAgents: number;
  policy: { hasPolicy: boolean; allowPublicAgents: boolean; allowedModelClasses: ModelClass[] };
  funding: FundingSummary;
}

export interface ClubSummary {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'inactive';
  tagline: string;
  categories: string[];
  cohorts: string[];
}

export interface ClubRow extends ClubSummary {
  memberCount: number;
  publicAgentCount: number;
  nextEvent: { title: string; startsAt: string } | null;
  /** USG viewers only. */
  oversight: { quota: QuotaUse; funding: FundingSummary } | null;
}

export interface ClubsDirectoryView {
  viewer: { usg: boolean; usgAdmin: boolean };
  clubs: ClubRow[];
}

export interface ClubDashboard {
  club: ClubSummary & { about: string[]; contactEmail: string | null; meets: string | null };
  viewer: DirectoryViewer;
  officers: OfficerSeat[];
  memberCount: number;
  /** null when the viewer may not see the roster (not a member and not USG). */
  members: DirectoryPerson[] | null;
  events: DirectoryEvent[];
  updates: DirectoryUpdate[];
  /** null when the viewer may not see departments (not a member and not USG). */
  departments: DepartmentRow[] | null;
  publicAgents: AgentListing[];
  oversight: ClubOversight | null;
}

export interface DepartmentsDirectoryView {
  club: { id: string; name: string };
  viewer: DirectoryViewer;
  departments: DepartmentRow[];
}

export interface DepartmentDashboard {
  club: { id: string; name: string; slug: string };
  department: { slug: string; name: string; purpose: string; about: string[] };
  viewer: DirectoryViewer;
  lead: { userId: string; name: string } | null;
  members: DirectoryPerson[];
  events: DirectoryEvent[];
  updates: DirectoryUpdate[];
  budget: { allocatedMicro: number; committedMicro: number; lines: Array<{ label: string; amountMicro: number }> } | null;
}
