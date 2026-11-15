// Navigation only: services still authorize every request.
import type { Actor, MyAgentsClub } from '@/lib/contracts';

export interface NavItem { href: string; label: string; exact?: boolean; activePaths?: readonly string[] }
export interface Scope { href: string; label: string; match: string; items?: NavItem[] }

export function matchesPath(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  return (item.exact ? pathname === item.href : matchesPath(pathname, item.href))
    || (item.activePaths?.some((path) => matchesPath(pathname, path)) ?? false);
}

/** `activeOrgIsUsg` is the kind of the actor's active org (read by the shell), not a seed id. */
export function navigationFor(actor: Actor, clubs: readonly Pick<MyAgentsClub, 'orgId' | 'orgName'>[], activeOrgIsUsg: boolean): Scope[] {
  // Directory is the org directory: a member acting in a club sees its departments first; USG and
  // students outside a club see the clubs (§14).
  const inClub = Boolean(actor.userId && actor.activeOrgId && !activeOrgIsUsg && actor.positions.length > 0);
  const directoryItems: NavItem[] = inClub
    ? [{ href: '/directory/departments', label: 'Departments' }, { href: '/directory/clubs', label: 'All clubs' }]
    : [{ href: '/directory/clubs', label: 'Clubs' }];
  const scopes: Scope[] = [
    { href: '/me/agents', label: 'My agents', match: '/me', items: [{ href: '/me/agents', label: 'My agents' }] },
    { href: '/directory', label: 'Directory', match: '/directory', items: directoryItems },
  ];
  if (!actor.userId) return scopes;
  const club = clubs.find((c) => c.orgId === actor.activeOrgId && !activeOrgIsUsg);
  if (club) {
    const base = `/org/${club.orgId}`;
    const president = actor.positions.includes('president');
    scopes.push({ href: base, label: `Club: ${club.orgName}`, match: base, items: [
      { href: base, label: 'Overview', exact: true },
      { href: `${base}/catalog`, label: 'Catalog' },
      { href: `${base}/documents`, label: 'Documents' },
      ...(president ? [
        { href: `${base}/preview`, label: 'Permission preview' },
        { href: `${base}/admin`, label: 'Administration' },
        { href: `${base}/audit`, label: 'Audit' },
      ] : []),
    ] });
  }
  if (activeOrgIsUsg && actor.positions.includes('admin')) {
    scopes.push({ href: '/usg/templates', label: 'USG admin', match: '/usg', items: [
      { href: '/usg/templates', label: 'Templates' },
      { href: '/usg/documents', label: 'Documents' },
      { href: '/usg/integrations', label: 'Management', activePaths: ['/usg/clubs'] },
      { href: '/usg/audit', label: 'Audit' },
    ] });
  }
  return scopes;
}
