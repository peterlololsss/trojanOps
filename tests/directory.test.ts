// Owner: D (WP-11). The org directory: who sees which part of a club or department dashboard, and
// the numbers USG sees (quota, policy, funding against the published rule pack).
import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetClockForTests, setDemoNow } from '@/lib/clock';
import { AppError } from '@/lib/contracts';
import {
  clubDashboard, clubsDirectory, departmentDashboard, departmentsDirectory, directoryLanding, fundingOf, fundingPeriod,
} from '@/lib/directory/service';
import type { DirectoryEvent } from '@/lib/directory/types';
import { ORG, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp, ts } from './db';

const probe = await appSql();
await probe?.end();
afterAll(async () => {
  if (probe) await closeAppDb();
});

// The demo's Saturday: Pitch night (Nov 20) is upcoming, Fall kickoff (Sep 15) is past.
const DEMO_DAY = new Date('2026-11-15T10:00:00-08:00');
const demoMode = process.env.DEMO_MODE;
beforeEach(() => {
  process.env.DEMO_MODE = '1';
  setDemoNow(DEMO_DAY);
});
afterEach(() => {
  if (demoMode === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = demoMode;
  resetClockForTests();
});

const MICRO = 1_000_000;

describe('fundingOf · year and semester windows', () => {
  const event = (startsAt: string, status: 'approved' | 'pending' | 'none', amountUsd: number): DirectoryEvent => ({
    id: startsAt, title: 'e', startsAt, endsAt: startsAt, location: '', summary: '', department: null, rsvps: 0,
    funding: { status, amountMicro: amountUsd * MICRO }, past: false,
  });

  const limits = { capMicro: 8000 * MICRO, eventLimit: 4 };

  it('counts the academic year from August and the fall semester to December only', () => {
    const summary = fundingOf([
      event('2026-05-01T00:00:00Z', 'approved', 900), // last academic year
      event('2026-09-15T00:00:00Z', 'approved', 600),
      event('2026-11-20T00:00:00Z', 'approved', 1200),
      event('2026-12-01T00:00:00Z', 'pending', 500),
      event('2027-02-10T00:00:00Z', 'approved', 300), // this year, next semester
    ], limits, DEMO_DAY);
    expect(summary).toEqual({
      approvedMicro: 2100 * MICRO, pendingMicro: 500 * MICRO, capMicro: 8000 * MICRO, fundedEvents: 2, eventLimit: 4,
    });
  });

  it('cuts semesters and years on the Pacific calendar, not UTC', () => {
    expect(fundingPeriod(new Date('2026-12-31T18:00:00-08:00'))).toEqual({ year: 2026, semester: '2026-fall' }); // Jan 1 in UTC
    expect(fundingPeriod(new Date('2027-07-31T20:00:00-07:00'))).toEqual({ year: 2026, semester: '2027-spring' }); // Aug 1 in UTC
    expect(fundingPeriod(new Date('2026-08-01T00:30:00-07:00'))).toEqual({ year: 2026, semester: '2026-fall' });
  });
});

describe.skipIf(!probe)('directory · landing', () => {
  it('opens departments for someone acting in a club and clubs for everyone else', async () => {
    expect(await directoryLanding(await actorFor(USER.taylor, ORG.startup))).toBe('/directory/departments');
    expect(await directoryLanding(await actorFor(USER.avery, ORG.usg))).toBe('/directory/clubs');
    expect(await directoryLanding(await actorFor(USER.lee, null))).toBe('/directory/clubs');
  });
});

describe.skipIf(!probe)('directory · clubs', () => {
  it('gives a student outside every club the public profile only', async () => {
    const lee = await actorFor(USER.lee, null);
    const list = await clubsDirectory(lee);
    expect(list.viewer).toEqual({ usg: false, usgAdmin: false });
    expect(list.clubs.map((c) => c.name)).toEqual(expect.arrayContaining(['Archery Club', 'Dance Club', 'Startup Club']));
    expect(list.clubs.every((c) => c.oversight === null)).toBe(true);

    const startup = (await clubDashboard(lee, ORG.startup))!;
    expect(startup.viewer).toMatchObject({ usg: false, member: false, president: false });
    expect(startup.members).toBeNull();
    expect(startup.departments).toBeNull();
    expect(startup.oversight).toBeNull();
    expect(startup.memberCount).toBeGreaterThan(0);
    expect(startup.officers.find((s) => s.slug === 'president')?.holders.map((h) => h.name)).toEqual(['Sam']);
    expect(startup.officers[0].slug).toBe('president');

    // D3: Dance's showcase Q&A is public from the seed and reachable from its club page.
    const dance = (await clubDashboard(lee, ORG.dance))!;
    expect(dance.publicAgents.map((a) => a.templateSlug)).toContain('showcase-qa');
  });

  it('shows a student outside the club no department, funding or member-only update', async () => {
    const startup = (await clubDashboard(await actorFor(USER.lee, null), ORG.startup))!;
    const pitch = startup.events.find((e) => e.title === 'Pitch night')!;
    expect(pitch).toMatchObject({ past: false, department: null, funding: null });
    expect(startup.events.find((e) => e.title === 'Fall kickoff')?.past).toBe(true);
    expect(startup.updates).toEqual([expect.objectContaining({ author: 'Sam', department: null })]);
    const text = JSON.stringify(startup);
    for (const hidden of ['Jordan', 'Morgan', 'Marketing and recruiting', 'Finance', 'shadowing']) expect(text).not.toContain(hidden);
  });

  it('gives members every update and each event’s department and funding', async () => {
    const startup = (await clubDashboard(await actorFor(USER.casey, ORG.startup), ORG.startup))!;
    expect(startup.updates.map((u) => u.author)).toEqual(['Sam', 'Taylor', 'Morgan', 'Jordan']);
    expect(startup.updates[0].department).toBe('Events');
    expect(startup.events.find((e) => e.title === 'Pitch night')).toMatchObject({
      department: { slug: 'events', name: 'Events' }, funding: { status: 'approved', amountMicro: 1200 * MICRO },
    });
  });

  it('gives USG the roster, departments, quota, policy and funding', async () => {
    const avery = await actorFor(USER.avery, ORG.usg);
    const list = await clubsDirectory(avery);
    expect(list.viewer).toEqual({ usg: true, usgAdmin: true });
    const row = list.clubs.find((c) => c.slug === 'startup')!;
    expect(row.oversight?.funding).toMatchObject({ approvedMicro: 1800 * MICRO, pendingMicro: 500 * MICRO, fundedEvents: 2, eventLimit: 4 });
    expect(row.oversight?.quota.limitMicro).toBeGreaterThan(0);

    const startup = (await clubDashboard(avery, ORG.startup))!;
    expect(startup.viewer).toMatchObject({ usg: true, usgAdmin: true, member: false, president: false });
    expect(startup.members?.map((m) => m.name)).toEqual(expect.arrayContaining(['Sam', 'Taylor']));
    expect(startup.members?.find((m) => m.name === 'Taylor')?.positions).toEqual(['Treasurer', 'Member']);
    expect(startup.departments?.map((d) => d.name)).toEqual(['Events', 'Finance', 'Marketing and recruiting']);
    expect(startup.departments?.every((d) => d.budget === null)).toBe(true);
    expect(startup.oversight).toMatchObject({ policy: { hasPolicy: true } });
    expect(startup.oversight!.installedAgents).toBeGreaterThan(0);
  });

  it('reads the annual cap from the latest published usg-funding pack', () => inRolledBackApp(async (tx) => {
    await tx.execute(sql`insert into rule_packs (slug, version, status, label, content, published_at, created_at)
      values ('usg-funding', 999, 'published', 'Test amendment', ${JSON.stringify({ annualCapUsd: 10000 })}::jsonb, ${ts()}, ${ts()})`);
    const startup = (await clubDashboard(await actorFor(USER.riley, ORG.usg), ORG.startup))!;
    expect(startup.viewer).toMatchObject({ usg: true, usgAdmin: false });
    expect(startup.oversight?.funding.capMicro).toBe(10000 * MICRO);
  }));

  it('gives a club member the roster and departments but not the oversight', async () => {
    const startup = (await clubDashboard(await actorFor(USER.casey, ORG.startup), ORG.startup))!;
    expect(startup.viewer).toMatchObject({ usg: false, member: true, president: false });
    expect(startup.members).not.toBeNull();
    expect(startup.departments).not.toBeNull();
    expect(startup.oversight).toBeNull();
  });

  it('returns null for an unknown club, a malformed id and USG itself', async () => {
    const avery = await actorFor(USER.avery, ORG.usg);
    expect(await clubDashboard(avery, ORG.usg)).toBeNull();
    expect(await clubDashboard(avery, 'not-a-uuid')).toBeNull();
    expect(await clubDashboard(avery, '00000000-0000-4000-8000-00000000ffff')).toBeNull();
  });
});

describe.skipIf(!probe)('directory · departments', () => {
  it('lists the active club’s departments, with budgets for the president only', async () => {
    const taylor = (await departmentsDirectory(await actorFor(USER.taylor, ORG.startup)))!;
    expect(taylor.club.name).toBe('Startup Club');
    const finance = taylor.departments.find((d) => d.slug === 'finance')!;
    expect(finance).toMatchObject({ lead: { name: 'Taylor' }, memberCount: 2, budget: null });

    const sam = (await departmentsDirectory(await actorFor(USER.sam, ORG.startup)))!;
    expect(sam.departments.find((d) => d.slug === 'events')?.budget).toEqual({ allocatedMicro: 2600 * MICRO, committedMicro: 1650 * MICRO });
  });

  it('is null outside a club', async () => {
    expect(await departmentsDirectory(await actorFor(USER.lee, null))).toBeNull();
    expect(await departmentsDirectory(await actorFor(USER.avery, ORG.usg))).toBeNull();
  });

  it('opens a department dashboard for members and USG and refuses everyone else', async () => {
    const events = (await departmentDashboard(await actorFor(USER.jordan, ORG.startup), ORG.startup, 'events'))!;
    expect(events.lead?.name).toBe('Casey');
    expect(events.members.map((m) => m.name)).toEqual(['Casey', 'Jordan']);
    expect(events.events.map((e) => e.title)).toContain('Pitch night');
    expect(events.budget).toBeNull();

    const sam = (await departmentDashboard(await actorFor(USER.sam, ORG.startup), ORG.startup, 'events'))!;
    expect(sam.budget?.lines.map((l) => l.label)).toContain('Pitch night');

    expect(await departmentDashboard(await actorFor(USER.avery, ORG.usg), ORG.startup, 'finance')).not.toBeNull();
    const lee = await actorFor(USER.lee, null);
    for (const slug of ['events', 'no-such-department']) {
      await expect(departmentDashboard(lee, ORG.startup, slug))
        .rejects.toSatisfy((e: unknown) => e instanceof AppError && e.error.code === 'forbidden');
    }
  });

  it('returns null for a department another club has', async () => {
    const avery = await actorFor(USER.avery, ORG.usg);
    expect(await departmentDashboard(avery, ORG.archery, 'marketing')).toBeNull();
    expect(await departmentDashboard(avery, ORG.startup, 'range')).toBeNull();
  });
});
