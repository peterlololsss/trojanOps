// Navigation only: services still authorize every request.
import type { Actor, MyAgentsClub } from '@/lib/contracts';
import { ORG } from '@db/seed/ids';

export interface NavItem { href: string; label: string; exact?: boolean }
export interface Scope { href: string; label: string; match: string; items?: NavItem[] }

export function matchesPath(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : matchesPath(pathname, item.href);
}

export function navigationFor(actor: Actor, clubs: readonly Pick<MyAgentsClub, 'orgId' | 'orgName'>[]): Scope[] {
  const scopes: Scope[] = [
    { href: '/me/agents', label: 'My agents', match: '/me', items: [{ href: '/me/agents', label: 'My agents' }] },
    { href: '/directory', label: 'Directory', match: '/directory', items: [{ href: '/directory', label: 'All public agents' }] },
  ];
  if (!actor.userId) return scopes;
  const club = clubs.find((c) => c.orgId === actor.activeOrgId && c.orgId !== ORG.usg);
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
  if (actor.activeOrgId === ORG.usg && actor.positions.includes('admin')) {
    scopes.push({ href: '/usg/templates', label: 'USG admin', match: '/usg', items: [
      { href: '/usg/templates', label: 'Templates' },
      { href: '/usg/clubs', label: 'Clubs and quotas' },
      { href: '/usg/rule-packs', label: 'Rule packs' },
      { href: '/usg/integrations', label: 'Integrations' },
      { href: '/usg/audit', label: 'Audit' },
    ] });
  }
  return scopes;
}
