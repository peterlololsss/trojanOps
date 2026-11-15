// Owner: D. Pure navigation inputs; independent of whether A/B currently use fixtures or the DB.
import { describe, expect, it } from 'vitest';
import { navigationFor, matchesPath, isNavItemActive } from '@/components/shell/navigation';
import type { Actor, MyAgentsClub } from '@/lib/contracts';
import { ORG, USER } from '@db/seed/ids';

const clubs: MyAgentsClub[] = [
  { orgId: ORG.startup, orgName: 'Startup Club', positionNames: [], agents: [] },
  { orgId: ORG.archery, orgName: 'Archery Club', positionNames: [], agents: [] },
];
const actor = (userId: string | null, activeOrgId: string | null, positions: string[]): Actor =>
  ({ userId, activeOrgId, positions, grants: [] });

describe('WP-2 app shell', () => {
  it('gives students without a club only student scopes', () => {
    expect(navigationFor(actor(USER.lee, null, []), []).map((s) => s.label)).toEqual(['My agents', 'Directory']);
    expect(navigationFor(actor(null, null, []), [])).toHaveLength(2);
  });

  it('shows club management links only to the president', () => {
    const member = navigationFor(actor(USER.casey, ORG.startup, ['member']), clubs).find((s) => s.match.startsWith('/org/'))!;
    const president = navigationFor(actor(USER.sam, ORG.startup, ['president']), clubs).find((s) => s.match.startsWith('/org/'))!;
    expect(member.items?.map((i) => i.label)).toEqual(['Overview', 'Catalog', 'Documents']);
    expect(president.items?.map((i) => i.label)).toEqual([
      'Overview', 'Catalog', 'Documents', 'Permission preview', 'Administration', 'Audit',
    ]);
  });

  it('keeps the club scope on the active club for a cross-club member', () => {
    const scopes = navigationFor(actor(USER.morgan, ORG.startup, ['member']), clubs);
    const club = scopes.find((s) => s.match.startsWith('/org/'))!;
    expect(club.label).toBe('Club: Startup Club');
    expect(club.match).toBe('/org/' + ORG.startup);
    expect(club.items?.some((i) => i.label === 'Administration')).toBe(false);
  });

  it('does not show USG admin navigation to a reviewer or an admin role in another club', () => {
    expect(navigationFor(actor(USER.riley, ORG.usg, ['reviewer']), []).some((s) => s.match === '/usg')).toBe(false);
    expect(navigationFor(actor(USER.sam, ORG.startup, ['admin']), clubs).some((s) => s.match === '/usg')).toBe(false);
    expect(navigationFor(actor(USER.avery, ORG.usg, ['admin']), []).find((s) => s.match === '/usg')?.items?.map((i) => i.label)).toEqual([
      'Templates', 'Clubs and quotas', 'Rule packs', 'Integrations', 'Audit',
    ]);
  });

  it('matches nested routes on segment boundaries without selecting the overview twice', () => {
    expect(matchesPath('/directory/installation', '/directory')).toBe(true);
    expect(matchesPath('/directory-other', '/directory')).toBe(false);
    expect(matchesPath('/meant', '/me')).toBe(false);
    expect(isNavItemActive('/usg/templates/version', { href: '/usg/templates', label: 'Templates' })).toBe(true);
    expect(isNavItemActive('/org/startup/catalog', { href: '/org/startup', label: 'Overview', exact: true })).toBe(false);
  });
});
