// Owner: D (WP-11). The org directory (§14): clubs for USG and for students, a club's departments
// for its members. Real orgs, people, memberships, quotas, policies and public agents, joined to
// the demo content in `content.ts` (profiles, departments, events, updates).
//
// Who sees what is decided here, not in the pages. A student outside a club gets the public
// profile: officers, events without their department or funding, public updates by officers or the
// club, and public agents. The club's members and USG also get the roster, the departments, every
// update and each event's department and funding. USG also gets quota, policy and the funding
// totals. Only the president acting in the club gets department budgets.
import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/api';
import { allActiveMemberships, isUsgAdmin, isUuid } from '@/lib/authz';
import { now } from '@/lib/clock';
import { AppError, type Actor } from '@/lib/contracts';
import { getDb } from '@/lib/db/client';
import { orgCohorts, orgs, positions, usgClubPolicy } from '@/lib/db/schema';
import { directory } from '@/lib/distribution';
import { latestPublishedPack, loadAgents } from '@/lib/distribution/queries';
import { remaining } from '@/lib/gateway/quota';
import { clubContent, type ClubContent, type DepartmentContent, type EventContent, type UpdateContent } from './content';
import type {
  ClubDashboard, ClubOversight, ClubRow, ClubsDirectoryView, ClubSummary, DepartmentDashboard, DepartmentRow,
  DepartmentsDirectoryView, DirectoryEvent, DirectoryPerson, DirectoryUpdate, DirectoryViewer, FundingSummary, OfficerSeat, QuotaUse,
} from './types';

const MICRO = 1_000_000;
/** Used only while no `usg-funding` pack is published. */
const DEFAULT_LIMITS = { capMicro: 8000 * MICRO, eventLimit: 4 };
/** President first, then the other officer seats by name. */
const SEAT_ORDER = ['president', 'vice-president', 'treasurer', 'secretary'];

type Membership = Awaited<ReturnType<typeof allActiveMemberships>>[number];
type Club = { id: string; slug: string; name: string; status: 'active' | 'inactive' };
type FundingLimits = { capMicro: number; eventLimit: number };

// ---------------------------------------------------------------- landing

/** Where "Directory" opens: a member acting in a club sees its departments; everyone else, the clubs. */
export async function directoryLanding(actor: Actor): Promise<'/directory/departments' | '/directory/clubs'> {
  return (await activeClub(actor)) ? '/directory/departments' : '/directory/clubs';
}

// ---------------------------------------------------------------- clubs

export async function clubsDirectory(actor: Actor): Promise<ClubsDirectoryView> {
  requireUser(actor);
  const [clubs, people, publicAgents, cohorts, usg, usgAdmin] = await Promise.all([
    getDb().select({ id: orgs.id, slug: orgs.slug, name: orgs.name, status: orgs.status }).from(orgs).where(eq(orgs.kind, 'rso')).orderBy(orgs.name),
    allActiveMemberships(),
    directory(),
    cohortsByOrg(),
    actsInUsg(actor),
    isUsgAdmin(actor),
  ]);
  const limits = usg ? await fundingLimits() : null;
  const at = now();

  const rows: ClubRow[] = [];
  // In sequence: each quota read opens its own transaction (see `clubAdmin`).
  for (const club of clubs) {
    const content = clubContent(club.slug);
    const events = content.events.map((e) => toEvent(e, content, at, true));
    rows.push({
      ...summary(club, content, cohorts.get(club.id) ?? []),
      memberCount: rosterOf(people, club.id).length,
      publicAgentCount: publicAgents.filter((a) => a.orgId === club.id).length,
      nextEvent: nextEvent(events),
      oversight: limits ? { quota: await quotaOf(club.id), funding: fundingOf(events, limits, at) } : null,
    });
  }
  return { viewer: { usg, usgAdmin }, clubs: rows };
}

export async function clubDashboard(actor: Actor, orgId: string): Promise<ClubDashboard | null> {
  const userId = requireUser(actor);
  const club = await findClub(orgId);
  if (!club) return null;
  const [people, publicAgents, cohorts, seats, usg, usgAdmin] = await Promise.all([
    allActiveMemberships(), directory(), cohortsByOrg(), officerSeats(club.id), actsInUsg(actor), isUsgAdmin(actor),
  ]);
  const content = clubContent(club.slug);
  const roster = rosterOf(people, club.id);
  const viewer = viewerFor(actor, userId, club.id, roster, usg, usgAdmin);
  const insider = viewer.member || viewer.usg;
  const at = now();
  const events = content.events.map((e) => toEvent(e, content, at, insider));
  const officerIds = new Set(roster.filter((p) => p.slugs.some((s) => seats.some((seat) => seat.slug === s))).map((p) => p.userId));

  return {
    club: {
      ...summary(club, content, cohorts.get(club.id) ?? []),
      about: content.about,
      contactEmail: content.contactEmail || null,
      meets: content.meets || null,
    },
    viewer,
    officers: seats.map((seat) => ({
      ...seat,
      holders: roster.filter((p) => p.slugs.includes(seat.slug)).map(({ userId: id, name }) => ({ userId: id, name })),
    })),
    memberCount: roster.length,
    members: insider ? roster.map(({ userId: id, name, positions: held }) => ({ userId: id, name, positions: held })) : null,
    events,
    updates: updatesFor(content.updates, content, roster, insider ? null : officerIds),
    departments: insider ? content.departments.map((d) => departmentRow(d, content, roster, events, viewer)) : null,
    publicAgents: publicAgents.filter((a) => a.orgId === club.id),
    oversight: usg ? await oversightOf(club.id, events, at) : null,
  };
}

// ---------------------------------------------------------------- departments

/** The departments of the club the actor is acting in. Null when the actor is not acting in a club. */
export async function departmentsDirectory(actor: Actor): Promise<DepartmentsDirectoryView | null> {
  const userId = requireUser(actor);
  const club = await activeClub(actor);
  if (!club) return null;
  const people = await allActiveMemberships();
  const content = clubContent(club.slug);
  const roster = rosterOf(people, club.id);
  const viewer = viewerFor(actor, userId, club.id, roster, false, false);
  const events = content.events.map((e) => toEvent(e, content, now(), true));
  return {
    club: { id: club.id, name: club.name },
    viewer,
    departments: content.departments.map((d) => departmentRow(d, content, roster, events, viewer)),
  };
}

/**
 * One department's dashboard. Throws `forbidden` for a viewer who is neither a member of the club
 * nor acting in USG, before the department is looked up, so a refusal says nothing about which
 * departments exist. Null when there is no such club or department.
 */
export async function departmentDashboard(actor: Actor, orgId: string, slug: string): Promise<DepartmentDashboard | null> {
  const userId = requireUser(actor);
  const club = await findClub(orgId);
  if (!club) return null;
  const [people, usg, usgAdmin] = await Promise.all([allActiveMemberships(), actsInUsg(actor), isUsgAdmin(actor)]);
  const roster = rosterOf(people, club.id);
  const viewer = viewerFor(actor, userId, club.id, roster, usg, usgAdmin);
  if (!viewer.member && !viewer.usg) {
    throw new AppError({ code: 'forbidden', message: `Only members of ${club.name} and USG can see its departments.` });
  }
  const content = clubContent(club.slug);
  const department = content.departments.find((d) => d.slug === slug);
  if (!department) return null;
  const at = now();
  const team = teamOf(department, roster);
  return {
    club: { id: club.id, name: club.name, slug: club.slug },
    department: { slug: department.slug, name: department.name, purpose: department.purpose, about: department.about },
    viewer,
    lead: team.lead,
    members: team.members,
    events: content.events.filter((e) => e.department === slug).map((e) => toEvent(e, content, at, true)),
    updates: updatesFor(content.updates.filter((u) => u.department === slug), content, roster, null),
    budget: viewer.president ? {
      allocatedMicro: allocated(department),
      committedMicro: department.budget.committedUsd * MICRO,
      lines: department.budget.lines.map((l) => ({ label: l.label, amountMicro: l.amountUsd * MICRO })),
    } : null,
  };
}

// ---------------------------------------------------------------- helpers

async function findClub(orgId: string): Promise<Club | null> {
  if (!isUuid(orgId)) return null;
  const [club] = await getDb().select({ id: orgs.id, slug: orgs.slug, name: orgs.name, status: orgs.status })
    .from(orgs).where(and(eq(orgs.id, orgId), eq(orgs.kind, 'rso')));
  return club ?? null;
}

/** The club the actor is acting in, when it is a club (not USG) and they hold a position there. */
async function activeClub(actor: Actor): Promise<Club | null> {
  if (!actor.userId || !actor.activeOrgId || actor.positions.length === 0) return null;
  return findClub(actor.activeOrgId);
}

async function actsInUsg(actor: Actor): Promise<boolean> {
  if (!actor.userId || !actor.activeOrgId || actor.positions.length === 0 || !isUuid(actor.activeOrgId)) return false;
  const [org] = await getDb().select({ kind: orgs.kind }).from(orgs).where(eq(orgs.id, actor.activeOrgId));
  return org?.kind === 'usg';
}

function viewerFor(actor: Actor, userId: string, orgId: string, roster: RosterEntry[], usg: boolean, usgAdmin: boolean): DirectoryViewer {
  return {
    usg,
    usgAdmin,
    member: roster.some((p) => p.userId === userId),
    president: actor.activeOrgId === orgId && actor.positions.includes('president'),
  };
}

interface RosterEntry { userId: string; name: string; netId: string; slugs: string[]; positions: string[] }

/** The club's active members, each once, with the positions they hold there; ordered by name. */
function rosterOf(people: Membership[], orgId: string): RosterEntry[] {
  return people.flatMap((p) => {
    const held = p.held.filter((m) => m.orgId === orgId);
    if (held.length === 0) return [];
    const ranked = [...held].sort((a, b) => rank(a.positionSlug) - rank(b.positionSlug));
    return [{ userId: p.userId, name: p.displayName, netId: p.netId, slugs: ranked.map((m) => m.positionSlug), positions: ranked.map((m) => m.positionName) }];
  });
}

const rank = (slug: string) => {
  const i = SEAT_ORDER.indexOf(slug);
  return i === -1 ? (slug === 'member' ? 99 : SEAT_ORDER.length) : i;
};

async function officerSeats(orgId: string): Promise<Array<Omit<OfficerSeat, 'holders'>>> {
  const rows = await getDb().select({ slug: positions.slug, name: positions.name })
    .from(positions).where(and(eq(positions.orgId, orgId), eq(positions.isOfficer, true)));
  return rows.sort((a, b) => rank(a.slug) - rank(b.slug) || a.name.localeCompare(b.name));
}

async function cohortsByOrg(): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  for (const r of await getDb().select().from(orgCohorts).orderBy(orgCohorts.cohortSlug)) {
    map.set(r.orgId, [...(map.get(r.orgId) ?? []), r.cohortSlug]);
  }
  return map;
}

function summary(club: Club, content: ClubContent, cohorts: string[]): ClubSummary {
  return { ...club, tagline: content.tagline, categories: content.categories, cohorts };
}

/** `detail` adds the department and the USG funding, for the club's members and USG. */
function toEvent(e: EventContent, content: ClubContent, at: Date, detail: boolean): DirectoryEvent {
  const department = detail && e.department ? content.departments.find((d) => d.slug === e.department) : undefined;
  return {
    id: e.id,
    title: e.title,
    startsAt: new Date(e.startsAt).toISOString(),
    endsAt: new Date(e.endsAt).toISOString(),
    location: e.location,
    summary: e.summary,
    department: department ? { slug: department.slug, name: department.name } : null,
    rsvps: e.rsvps,
    funding: detail ? { status: e.funding.status, amountMicro: e.funding.amountUsd * MICRO } : null,
    past: new Date(e.endsAt).getTime() < at.getTime(),
  };
}

/**
 * Updates with their authors resolved against the club's current roster: a post by someone who has
 * left reads as the club's. `publicOfficers` set means an outside viewer: only public posts by the
 * club or by one of these officers, with no department.
 */
function updatesFor(updates: UpdateContent[], content: ClubContent, roster: RosterEntry[], publicOfficers: Set<string> | null): DirectoryUpdate[] {
  return updates.flatMap((u) => {
    const author = u.author ? roster.find((p) => p.netId === u.author) : undefined;
    if (publicOfficers && (u.visibility !== 'public' || (author && !publicOfficers.has(author.userId)) || (u.author && !author))) return [];
    return [{
      id: u.id,
      author: author?.name ?? null,
      department: !publicOfficers && u.department ? content.departments.find((d) => d.slug === u.department)?.name ?? null : null,
      postedAt: new Date(u.postedAt).toISOString(),
      text: u.text,
    }];
  });
}

const nextEvent = (events: DirectoryEvent[]) => {
  const next = events.filter((e) => !e.past).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  return next ? { title: next.title, startsAt: next.startsAt } : null;
};

const allocated = (d: DepartmentContent) => d.budget.lines.reduce((sum, l) => sum + l.amountUsd, 0) * MICRO;

/** The department's lead and members, as current members of the club: someone who left drops out. */
function teamOf(department: DepartmentContent, roster: RosterEntry[]): { lead: DepartmentRow['lead']; members: DirectoryPerson[] } {
  const person = (netId: string) => roster.find((p) => p.netId === netId);
  const lead = department.lead ? person(department.lead) : undefined;
  const members = department.members.map(person).filter((p): p is RosterEntry => Boolean(p))
    .map(({ userId, name, positions: held }) => ({ userId, name, positions: held }));
  return { lead: lead ? { userId: lead.userId, name: lead.name } : null, members };
}

function departmentRow(d: DepartmentContent, content: ClubContent, roster: RosterEntry[], events: DirectoryEvent[], viewer: DirectoryViewer): DepartmentRow {
  const team = teamOf(d, roster);
  return {
    slug: d.slug,
    name: d.name,
    purpose: d.purpose,
    lead: team.lead,
    memberCount: team.members.length,
    nextEvent: nextEvent(events.filter((e) => e.department?.slug === d.slug)),
    budget: viewer.president ? { allocatedMicro: allocated(d), committedMicro: d.budget.committedUsd * MICRO } : null,
  };
}

async function quotaOf(orgId: string): Promise<QuotaUse> {
  const q = await remaining({ scope: 'org', orgId });
  return { limitMicro: q.limitMicro, spentMicro: q.spentMicro, remainingMicro: q.remainingMicro };
}

/**
 * The annual cap and the funded-events limit from the latest published `usg-funding` pack, so a
 * published amendment shows here. Reads either pack shape: top-level values, or rule values by id.
 */
async function fundingLimits(): Promise<FundingLimits> {
  const pack = await latestPublishedPack('usg-funding');
  const content = (pack?.content ?? {}) as { annualCapUsd?: unknown; fundedEventsPerSemester?: unknown; rules?: unknown };
  const rules = Array.isArray(content.rules) ? content.rules as Array<{ id?: unknown; value?: unknown }> : [];
  const value = (top: unknown, id: string): number | null => {
    const v = typeof top === 'number' ? top : rules.find((r) => r.id === id)?.value;
    return typeof v === 'number' && v >= 0 ? v : null;
  };
  const cap = value(content.annualCapUsd, 'annual-cap');
  const events = value(content.fundedEventsPerSemester, 'events-per-semester');
  return {
    capMicro: cap === null ? DEFAULT_LIMITS.capMicro : cap * MICRO,
    eventLimit: events ?? DEFAULT_LIMITS.eventLimit,
  };
}

const ptMonth = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric' });

/** The academic year (Aug–Jul) and semester (fall Aug–Dec, spring Jan–Jul) of an instant, on the PT calendar. */
export function fundingPeriod(at: Date): { year: number; semester: string } {
  const parts = Object.fromEntries(ptMonth.formatToParts(at).map((p) => [p.type, Number(p.value)]));
  const fall = parts.month >= 8;
  return { year: fall ? parts.year : parts.year - 1, semester: `${parts.year}-${fall ? 'fall' : 'spring'}` };
}

/** USG funding this academic year and approved events this semester. Events without funding detail count as none. */
export function fundingOf(events: DirectoryEvent[], limits: FundingLimits, at: Date): FundingSummary {
  const current = fundingPeriod(at);
  const funded = events.flatMap((e) => (e.funding ? [{ funding: e.funding, period: fundingPeriod(new Date(e.startsAt)) }] : []));
  const thisYear = funded.filter((e) => e.period.year === current.year);
  const sum = (status: 'approved' | 'pending') =>
    thisYear.filter((e) => e.funding.status === status).reduce((total, e) => total + e.funding.amountMicro, 0);
  return {
    approvedMicro: sum('approved'),
    pendingMicro: sum('pending'),
    capMicro: limits.capMicro,
    fundedEvents: funded.filter((e) => e.funding.status === 'approved' && e.period.semester === current.semester).length,
    eventLimit: limits.eventLimit,
  };
}

async function oversightOf(orgId: string, events: DirectoryEvent[], at: Date): Promise<ClubOversight> {
  const [agents, [policy], limits] = await Promise.all([
    loadAgents({ orgIds: [orgId], excludeRetired: true }),
    getDb().select().from(usgClubPolicy).where(eq(usgClubPolicy.orgId, orgId)),
    fundingLimits(),
  ]);
  return {
    quota: await quotaOf(orgId),
    installedAgents: agents.length,
    enabledAgents: agents.filter((a) => a.agent.status === 'enabled').length,
    policy: {
      hasPolicy: Boolean(policy),
      allowPublicAgents: policy?.allowPublicAgents ?? false,
      allowedModelClasses: policy?.allowedModelClasses ?? [],
    },
    funding: fundingOf(events, limits, at),
  };
}
