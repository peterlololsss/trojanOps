// Owner: D (WP-11). Which tabs a dashboard offers its viewer and which one a `?tab=` names. Pure, so
// pages and the render tests agree. A tab the viewer may not see is never offered, and asking for it
// by URL falls back to About.
import type { ClubDashboard, ClubRow, DepartmentDashboard } from '@/lib/directory/types';

export type SearchParams = Record<string, string | string[] | undefined>;
export type ClubTab = 'about' | 'events' | 'members' | 'officers' | 'departments' | 'agents';
export type DepartmentTab = 'about' | 'events' | 'members';
export type EventsWhen = 'upcoming' | 'past';

export interface TabLink<T extends string = string> { key: T; label: string; href: string; count?: number }

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const tabHref = (base: string, key: string) => (key === 'about' ? base : `${base}?tab=${key}`);

export const clubPath = (orgId: string) => `/directory/clubs/${orgId}`;

export function clubTabs(data: ClubDashboard): TabLink<ClubTab>[] {
  const base = clubPath(data.club.id);
  const tab = (key: ClubTab, label: string, count?: number): TabLink<ClubTab> => ({ key, label, href: tabHref(base, key), count });
  return [
    tab('about', 'About'),
    tab('events', 'Events'),
    ...(data.members ? [tab('members', 'Members', data.members.length)] : []),
    tab('officers', 'Officers'),
    ...(data.departments ? [tab('departments', 'Departments', data.departments.length)] : []),
    tab('agents', 'Agents', data.publicAgents.length),
  ];
}

export function departmentTabs(data: DepartmentDashboard, base: string): TabLink<DepartmentTab>[] {
  return [
    { key: 'about', label: 'About', href: tabHref(base, 'about') },
    { key: 'events', label: 'Events', href: tabHref(base, 'events') },
    { key: 'members', label: 'Members', href: tabHref(base, 'members'), count: data.members.length },
  ];
}

/** The tab `?tab=` names, when this viewer has it; otherwise the first tab (About). */
export function pickTab<T extends string>(tabs: readonly TabLink<T>[], requested: string | string[] | undefined): T {
  const value = first(requested);
  return (tabs.find((t) => t.key === value) ?? tabs[0]!).key;
}

export const pickWhen = (requested: string | string[] | undefined): EventsWhen => (first(requested) === 'past' ? 'past' : 'upcoming');

export const showAllUpdates = (requested: string | string[] | undefined) => first(requested) === 'all';

/** `?tab=events`, or `?tab=events&when=past`. */
export const eventsHref = (base: string, when: EventsWhen) => `${base}?tab=events${when === 'past' ? '&when=past' : ''}`;

export interface ClubFilters { search: string; category: string; status: string }
export const ALL = 'all';
export const NO_FILTERS: ClubFilters = { search: '', category: ALL, status: ALL };

/** The clubs list's filters: words in the name, tagline or categories; one category; one status. */
export function filterClubs(clubs: readonly ClubRow[], filters: ClubFilters): ClubRow[] {
  const query = filters.search.trim().toLocaleLowerCase();
  return clubs.filter((club) => (filters.category === ALL || club.categories.includes(filters.category))
    && (filters.status === ALL || club.status === filters.status)
    && `${club.name} ${club.tagline} ${club.categories.join(' ')}`.toLocaleLowerCase().includes(query));
}
