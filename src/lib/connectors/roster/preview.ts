// Owner: D. Presentation-only source snapshot; this never reconciles or writes memberships.
import type { RosterRow } from '@/lib/contracts';

export type RosterPreview =
  | {
    readonly status: 'ready';
    readonly rows: readonly { readonly club: string; readonly person: string; readonly position: string }[];
    readonly summary: {
      readonly assignmentCount: number;
      readonly personCount: number;
      readonly clubCount: number;
      readonly clubs: readonly { readonly name: string; readonly assignmentCount: number }[];
      readonly positions: readonly { readonly name: string; readonly count: number }[];
    };
  }
  | { readonly status: 'unavailable' };

/** Compute demo summary facts before stripping source identities from the client projection. */
export function buildRosterPreview(source: readonly RosterRow[]): Extract<RosterPreview, { status: 'ready' }> {
  const clubs = new Map<string, { name: string; assignmentCount: number }>();
  const positions = new Map<string, number>();
  for (const row of source) {
    const club = clubs.get(row.orgSlug) ?? { name: row.orgName, assignmentCount: 0 };
    club.assignmentCount++;
    clubs.set(row.orgSlug, club);
    positions.set(row.position, (positions.get(row.position) ?? 0) + 1);
  }
  return {
    status: 'ready',
    rows: source.map(row => ({ club: row.orgName, person: row.userDisplayName, position: row.position }))
      .sort((a, b) => a.club.localeCompare(b.club) || a.person.localeCompare(b.person) || a.position.localeCompare(b.position)),
    summary: {
      assignmentCount: source.length,
      personCount: new Set(source.map(row => row.externalUserId)).size,
      clubCount: clubs.size,
      clubs: [...clubs.values()].sort((a, b) => a.name.localeCompare(b.name)),
      positions: [...positions].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
}
