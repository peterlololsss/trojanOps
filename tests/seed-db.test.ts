// Owner: D. Read-only acceptance against a freshly reset database, using the app role.
import { afterAll, describe, expect, it } from 'vitest';
import { appSql } from './db';

const sql = await appSql();
if (!sql) console.warn('WP-2 seed database checks skipped: run pnpm db:up and pnpm db:reset first.');
afterAll(async () => { await sql?.end(); });

describe.skipIf(!sql)('WP-2 seeded database', () => {
  it('has the fictional personas and exact initial memberships', async () => {
    const people = await sql!`select external_id from users order by external_id`;
    expect(people.map((u) => u.external_id)).toEqual(['avery', 'casey', 'jordan', 'lee', 'morgan', 'riley', 'sam', 'taylor']);
    const memberships = await sql!`select u.external_id || ':' || o.slug || ':' || p.slug as membership
      from memberships m join users u on u.id = m.user_id
      join orgs o on o.id = m.org_id join positions p on p.id = m.position_id
      where m.ended_at is null order by membership`;
    expect(memberships.map((m) => m.membership)).toEqual([
      'avery:usg:admin', 'casey:startup:member', 'jordan:startup:member',
      'morgan:archery:treasurer', 'morgan:startup:member', 'riley:usg:reviewer',
      'sam:startup:president', 'taylor:startup:member', 'taylor:startup:treasurer',
    ]);
    expect((await sql!`select slug from orgs order by slug`).map((o) => o.slug)).toEqual(['archery', 'dance', 'startup', 'usg']);
    expect((await sql!`select o.slug from org_cohorts c join orgs o on o.id = c.org_id
      where c.cohort_slug = 'pilot' order by o.slug`).map((o) => o.slug)).toEqual(['archery', 'startup']);
  });

  it('has a roster baseline for every imported holder and no Robotics before sync', async () => {
    const state = await sql!`select o.slug || ':' || r.position_slug || ':' || r.external_user_id as holder
      from roster_state r join orgs o on o.id = r.org_id order by holder`;
    expect(state.map((r) => r.holder)).toEqual([
      'archery:treasurer:morgan', 'startup:member:casey', 'startup:member:jordan',
      'startup:member:morgan', 'startup:member:taylor', 'startup:president:sam', 'startup:treasurer:taylor',
    ]);
  });
});
