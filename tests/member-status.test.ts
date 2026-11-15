import { describe, expect, it } from 'vitest';
import { identityMembershipPreview, type IdentityMembershipRow } from '@/lib/connectors/identity/member-status';

const past = new Date('2026-10-01T12:00:00Z');
const row = (patch: Partial<IdentityMembershipRow> = {}): IdentityMembershipRow => ({
  personId: 'private-person-id', person: 'Casey', orgId: 'private-club-id', organization: 'Startup Club',
  position: 'Member', endedAt: null, ...patch,
});

describe('membership status by person and organization', () => {
  it('shows active and left clubs separately for the same person', () => {
    const preview = identityMembershipPreview([
      row(), row({ orgId: 'other-club', organization: 'Archery Club', endedAt: past }),
    ]);
    expect(preview.rows).toEqual([
      ['Casey', 'Archery Club', 'Member', 'Left organization', '2026-10-01'],
      ['Casey', 'Startup Club', 'Member', 'Active member', '—'],
    ]);
    expect(preview.summary).toContain('1 person');
    expect(preview.summary).toContain('1 person–organization');
    expect(JSON.stringify(preview)).not.toContain('private-');
  });

  it('does not treat ending one office as leaving a club while another position is active', () => {
    expect(identityMembershipPreview([row(), row({ position: 'Treasurer', endedAt: past })]).rows)
      .toEqual([['Casey', 'Startup Club', 'Member', 'Active member', '—']]);
  });

  it('treats a rejoined membership as active and deduplicates current position labels', () => {
    const preview = identityMembershipPreview([row({ endedAt: past }), row(), row()]);
    expect(preview.rows).toEqual([['Casey', 'Startup Club', 'Member', 'Active member', '—']]);
  });

  it('uses the last ended position to date departure from an organization', () => {
    expect(identityMembershipPreview([
      row({ endedAt: past }), row({ position: 'Treasurer', endedAt: new Date('2026-10-10T23:00:00Z') }),
    ]).rows).toEqual([['Casey', 'Startup Club', 'Member; Treasurer', 'Left organization', '2026-10-10']]);
  });

  it('distinguishes accounts without membership history and people with identical names', () => {
    const preview = identityMembershipPreview([
      row({ orgId: null, organization: null, position: null }), row({ personId: 'another-person-id' }),
    ]);
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows.find(record => record[1] === 'No organization')?.[3]).toBe('No membership');
    expect(preview.summary).toContain('2 people');
  });
});
