// Owner: B (WP-7). The club admin page's data: the roster a transfer acts on (D7) and the member
// budgets a president sets (D5). It is president-only, because it carries everyone's spend.
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { clubAdmin, transferCandidates } from '@/lib/distribution';
import { transferPosition } from '@/lib/lifecycle/transfer';
import { setLimit } from '@/lib/gateway/quota';
import { ORG, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp } from './db';

const probe = await appSql();
await probe?.end();
afterAll(async () => {
  if (probe) await closeAppDb();
});

const sam = () => actorFor(USER.sam, ORG.startup);
const member = (data: Awaited<ReturnType<typeof clubAdmin>>, userId: string) =>
  data!.members.find((m) => m.userId === userId);
const position = (data: Awaited<ReturnType<typeof clubAdmin>>, slug: string) =>
  data!.positions.find((p) => p.slug === slug);

describe.skipIf(!probe)('clubAdmin · who may open it', () => {
  it('refuses a plain member: the page carries everyone’s budget', async () => {
    await expect(clubAdmin(await actorFor(USER.casey, ORG.startup), ORG.startup))
      .rejects.toMatchObject({ error: { code: 'forbidden' } });
  });

  // Even USG does not manage a club's roster and budgets from here: §14 gives USG its own
  // console, and this page acts as the club.
  it('refuses a USG admin, who has their own console', async () => {
    await expect(clubAdmin(await actorFor(USER.avery, ORG.usg), ORG.startup))
      .rejects.toMatchObject({ error: { code: 'forbidden' } });
  });

  it('refuses the president of a different club', async () => {
    await expect(clubAdmin(await sam(), ORG.dance))
      .rejects.toMatchObject({ error: { code: 'forbidden' } });
  });

  it('returns null for a club that does not exist, rather than refusing', async () => {
    expect(await clubAdmin(await sam(), crypto.randomUUID())).toBeNull();
  });
});

describe.skipIf(!probe)('clubAdmin · the roster a transfer acts on (D7)', () => {
  it('lists the club’s members with the positions they hold here', async () => {
    const data = await clubAdmin(await sam(), ORG.startup);
    expect(member(data, USER.taylor)!.positions.map((p) => p.slug).sort()).toEqual(['member', 'treasurer']);
    expect(member(data, USER.casey)!.positions.map((p) => p.slug)).toEqual(['member']);
    // Morgan is a plain member here and Archery's treasurer: the position must not follow her.
    expect(member(data, USER.morgan)!.positions.map((p) => p.slug)).toEqual(['member']);
  });

  it('names who holds each position, officers first', async () => {
    const data = await clubAdmin(await sam(), ORG.startup);
    expect(position(data, 'treasurer')!.holders.map((h) => h.userId)).toEqual([USER.taylor]);
    expect(data!.positions[0].isOfficer).toBe(true);
  });

  it('offers as candidates everyone who does not already hold the position', async () => {
    const data = await clubAdmin(await sam(), ORG.startup);
    const ids = transferCandidates(data!, 'treasurer').map((m) => m.userId);
    expect(ids).toContain(USER.jordan);
    expect(ids).not.toContain(USER.taylor);
  });

  it('follows a transfer: the position moves and the roster says so', () =>
    inRolledBackApp(async () => {
      await transferPosition(await sam(), ORG.startup, 'treasurer', USER.jordan);
      const data = await clubAdmin(await sam(), ORG.startup);
      expect(position(data, 'treasurer')!.holders.map((h) => h.userId)).toEqual([USER.jordan]);
      expect(member(data, USER.taylor)!.positions.map((p) => p.slug)).not.toContain('treasurer');
    }));
});

describe.skipIf(!probe)('clubAdmin · the budgets a president sets (D5)', () => {
  it('marks a member on the club’s limit as inheriting it', async () => {
    const data = await clubAdmin(await sam(), ORG.startup);
    // Casey is seeded with a limit of her own; Taylor has none and reads the club's.
    expect(member(data, USER.casey)!.inherited).toBe(false);
    expect(member(data, USER.taylor)!.inherited).toBe(true);
    expect(member(data, USER.taylor)!.limitMicro).toBe(data!.clubLimitMicro);
  });

  it('shows a limit the president has just set as the member’s own', () =>
    inRolledBackApp(async () => {
      await setLimit(await sam(), { scope: 'member', orgId: ORG.startup, userId: USER.taylor, limitMicro: 250_000 });
      const data = await clubAdmin(await sam(), ORG.startup);
      expect(member(data, USER.taylor)).toMatchObject({ limitMicro: 250_000, inherited: false });
    }));

  // D5: Sam sets Casey to $0 and her next run is blocked. The page has to show the zero as a
  // limit she owns, not as "no limit set".
  it('shows a zero limit as hers, not as the club’s', () =>
    inRolledBackApp(async () => {
      await setLimit(await sam(), { scope: 'member', orgId: ORG.startup, userId: USER.casey, limitMicro: 0 });
      expect(member(await clubAdmin(await sam(), ORG.startup), USER.casey))
        .toMatchObject({ limitMicro: 0, inherited: false });
    }));

  it('carries the club’s own limit and spend for the header', () =>
    inRolledBackApp(async (tx) => {
      const data = await clubAdmin(await sam(), ORG.startup);
      const [row] = await tx.execute<{ limit_micro: string }>(
        sql`select limit_micro from quota_limits where scope = 'org' and org_id = ${ORG.startup}`,
      );
      expect(data!.clubLimitMicro).toBe(Number(row.limit_micro));
    }));
});

describe.skipIf(!probe)('clubAdmin · the club’s agents', () => {
  it('carries the catalog, so the page can manage installations too', async () => {
    const data = await clubAdmin(await sam(), ORG.startup);
    expect(data!.agents.map((a) => a.templateSlug).sort()).toEqual([
      'funding-precheck', 'handoff', 'recruiting-qa',
    ]);
  });
});
