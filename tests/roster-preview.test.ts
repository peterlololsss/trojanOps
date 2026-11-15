import { describe, expect, it } from 'vitest';
import { buildRosterPreview } from '@/lib/connectors/roster/preview';
import { csvRoster } from '@/lib/connectors/roster/mock';

describe('roster preview summary', () => {
  it('summarizes the actual CSV without counting multiple positions as different people', async () => {
    const preview = buildRosterPreview(await csvRoster.fetch());
    expect(preview.summary).toMatchObject({ assignmentCount: 10, personCount: 8, clubCount: 3 });
    expect(preview.summary.clubs).toEqual([
      { name: 'Archery Club', assignmentCount: 1 },
      { name: 'Robotics Club', assignmentCount: 3 },
      { name: 'Startup Club', assignmentCount: 6 },
    ]);
    expect(preview.summary.positions).toEqual([
      { name: 'member', count: 5 }, { name: 'president', count: 2 }, { name: 'treasurer', count: 3 },
    ]);
    expect(preview.rows[0]).toEqual({ club: 'Archery Club', person: 'Morgan', position: 'treasurer' });
  });

  it('uses source identities for counts and exposes only display fields', () => {
    const preview = buildRosterPreview([
      { orgSlug: 'club-a', orgName: 'Same name', externalUserId: 'private-id-1', userDisplayName: 'Alex', position: 'member' },
      { orgSlug: 'club-b', orgName: 'Same name', externalUserId: 'private-id-1', userDisplayName: 'Alex', position: 'president' },
      { orgSlug: 'club-b', orgName: 'Same name', externalUserId: 'private-id-2', userDisplayName: 'Alex', position: 'member' },
    ]);
    expect(preview.summary).toMatchObject({ assignmentCount: 3, personCount: 2, clubCount: 2 });
    expect(preview.summary.clubs.map(club => club.assignmentCount).sort()).toEqual([1, 2]);
    expect(preview.rows.every(row => Object.keys(row).sort().join(',') === 'club,person,position')).toBe(true);
    expect(JSON.stringify(preview)).not.toContain('private-id');
    expect(JSON.stringify(preview)).not.toContain('club-a');
  });

  it('returns zero counts for an empty source without inventing members or clubs', () => {
    expect(buildRosterPreview([])).toEqual({
      status: 'ready', rows: [],
      summary: { assignmentCount: 0, personCount: 0, clubCount: 0, clubs: [], positions: [] },
    });
  });
});
