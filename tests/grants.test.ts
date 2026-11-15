// Owner: A (WP-3). Identity, active org and grants from the seeded DB (I3), and the §5 cap table
// (I4), run as trojanops_app. Writes happen inside inRolledBackApp and are never committed.
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { capGrants, grantLabels, grantsFor } from '@/lib/authz';
import type { Actor } from '@/lib/contracts';
import { ACTIVE_ORG_COOKIE, getActor, PERSONA_COOKIE } from '@/lib/identity';
import { chooseActiveOrg, choosePersona } from '@/lib/identity/session';
import { POST as postActiveOrg } from '@/app/api/session/active-org/route';
import { POST as postPersona } from '@/app/api/session/persona/route';
import { ORG, POSITION, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp, ts } from './db';

// The session routes write cookies through next/headers; record what they write.
const jar = vi.hoisted(() => ({
  set: [] as Array<{ name: string; value: string; options: unknown }>,
  deleted: [] as string[],
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    set: (name: string, value: string, options: unknown) => jar.set.push({ name, value, options }),
    delete: (name: string) => jar.deleted.push(name),
  }),
}));

const probe = await appSql();
await probe?.end();
afterAll(async () => {
  if (probe) await closeAppDb();
});

const S = ORG.startup;
const A = ORG.archery;

/** getActor from raw cookie values, for forged or missing cookies. */
const actorFromCookies = (cookies: Record<string, string>): Promise<Actor> =>
  getActor(new Request('http://localhost/', {
    headers: { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ') },
  }));

const orgsIn = (grants: string[]) => [...new Set(grants.filter((g) => g !== '*').map((g) => g.split(':')[0]))];

describe.skipIf(!probe)('grantsFor and getActor (I3)', () => {
  it('gives Morgan in Startup no Archery grants, and in Archery no Startup grants', async () => {
    const inStartup = await actorFor(USER.morgan, S);
    expect(inStartup.grants).toEqual(['*', `${S}:*`, `${S}:member`]);
    expect(inStartup.positions).toEqual(['member']);
    expect(orgsIn(inStartup.grants)).toEqual([S]);

    const inArchery = await actorFor(USER.morgan, A);
    expect(inArchery.grants).toEqual(['*', `${A}:*`, `${A}:treasurer`]);
    expect(orgsIn(inArchery.grants)).toEqual([A]);

    expect(await grantsFor(USER.morgan, S)).toEqual(inStartup.grants);
  });

  it('grants every position held in the active org', async () => {
    const taylor = await actorFor(USER.taylor, S);
    expect([...taylor.grants].sort()).toEqual(['*', `${S}:*`, `${S}:member`, `${S}:treasurer`].sort());
    expect([...taylor.positions].sort()).toEqual(['member', 'treasurer']);
  });

  it("gives a student outside any club only '*', and an unknown user nothing", async () => {
    const lee = await actorFor(USER.lee, null);
    expect(lee).toEqual({ userId: USER.lee, activeOrgId: null, positions: [], grants: ['*'] });
    expect(await grantsFor(USER.lee, S)).toEqual(['*']);
    expect(await grantsFor(randomUUID(), S)).toEqual([]);
    expect(await grantsFor('not-a-uuid', S)).toEqual([]);
    expect(await grantsFor(null, S)).toEqual([]);
  });

  it('grants nothing from an ended membership', async () => {
    await inRolledBackApp(async (tx) => {
      await tx.execute(sql`update memberships set ended_at = ${ts()}
                           where user_id = ${USER.taylor} and position_id = ${POSITION.startup.treasurer}`);
      expect(await grantsFor(USER.taylor, S)).toEqual(['*', `${S}:*`, `${S}:member`]);
      expect((await actorFor(USER.taylor, S)).positions).toEqual(['member']);

      await tx.execute(sql`update memberships set ended_at = ${ts()}
                           where user_id = ${USER.morgan} and org_id = ${A}`);
      expect(await grantsFor(USER.morgan, A)).toEqual(['*']);
      const morgan = await actorFromCookies({ [PERSONA_COOKIE]: USER.morgan, [ACTIVE_ORG_COOKIE]: A });
      expect(morgan.activeOrgId).toBe(S);
      expect(orgsIn(morgan.grants)).toEqual([S]);
    });
  });

  it('falls back from a forged active-org cookie', async () => {
    for (const forged of [A, ORG.usg, randomUUID(), 'not-a-uuid', `${A}:treasurer`]) {
      const casey = await actorFromCookies({ [PERSONA_COOKIE]: USER.casey, [ACTIVE_ORG_COOKIE]: forged });
      expect(casey).toEqual({ userId: USER.casey, activeOrgId: ORG.hacksc, positions: ['member'], grants: ['*', `${ORG.hacksc}:*`, `${ORG.hacksc}:member`] });
    }
    const malformed = await getActor(new Request('http://localhost/', {
      headers: { cookie: `${PERSONA_COOKIE}=${USER.casey}; ${ACTIVE_ORG_COOKIE}=%E0%A4%A` },
    }));
    expect(malformed.activeOrgId).toBe(ORG.hacksc);
    const lee = await actorFromCookies({ [PERSONA_COOKIE]: USER.lee, [ACTIVE_ORG_COOKIE]: S });
    expect(lee).toEqual({ userId: USER.lee, activeOrgId: null, positions: [], grants: ['*'] });
  });

  it('is signed out without a persona, or with one that is not a user', async () => {
    const signedOut = { userId: null, activeOrgId: null, positions: [], grants: [] };
    expect(await actorFromCookies({})).toEqual(signedOut);
    expect(await actorFromCookies({ [ACTIVE_ORG_COOKIE]: S })).toEqual(signedOut);
    expect(await actorFromCookies({ [PERSONA_COOKIE]: 'not-a-uuid' })).toEqual(signedOut);
    expect(await actorFromCookies({ [PERSONA_COOKIE]: randomUUID(), [ACTIVE_ORG_COOKIE]: S })).toEqual(signedOut);
    expect(await getActor(new Request('http://localhost/', { headers: { cookie: `${PERSONA_COOKIE}=%E0%A4%A` } }))).toEqual(signedOut);
  });

  it('ignores any grants cookie', async () => {
    const casey = await actorFromCookies({ [PERSONA_COOKIE]: USER.casey, trojanops_grants: `{"${S}:president"}` });
    expect(casey.grants).not.toContain(`${S}:president`);
  });

  it('labels grants with club and position names from the DB', async () => {
    expect(await grantLabels(['*', `${S}:*`, `${S}:treasurer`, `${randomUUID()}:member`])).toEqual([
      { grant: '*', label: 'Any signed-in student' },
      { grant: `${S}:*`, label: 'Startup Club · Member' },
      { grant: `${S}:treasurer`, label: 'Startup Club · Treasurer' },
      { grant: expect.any(String), label: 'Unknown club · member' },
    ]);
  });
});

describe.skipIf(!probe)('capGrants on real grants (I4)', () => {
  it('members cap = userGrants ∩ [*, <org>:*]', async () => {
    const taylor = await actorFor(USER.taylor, S);
    expect(capGrants(taylor.grants, S, 'members')).toEqual(['*', `${S}:*`]);
    const morgan = await actorFor(USER.morgan, S);
    expect(capGrants(morgan.grants, A, 'members')).toEqual(['*']);
    const lee = await actorFor(USER.lee, null);
    expect(capGrants(lee.grants, S, 'members')).toEqual(['*']);
  });

  it("public cap = ['*'] whatever the user holds", async () => {
    const taylor = await actorFor(USER.taylor, S);
    expect(capGrants(taylor.grants, S, 'public')).toEqual(['*']);
    expect(capGrants((await actorFor(USER.sam, S)).grants, S, 'public')).toEqual(['*']);
    expect(capGrants((await actorFor(USER.lee, null)).grants, S, 'public')).toEqual(['*']);
  });

  it('officers keeps the user grants', async () => {
    const taylor = await actorFor(USER.taylor, S);
    expect(capGrants(taylor.grants, S, 'officers')).toEqual(taylor.grants);
  });
});

describe.skipIf(!probe)('session services', () => {
  const demoMode = process.env.DEMO_MODE;
  afterEach(() => {
    if (demoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = demoMode;
  });

  it('choosePersona accepts a user or null in demo mode only', async () => {
    process.env.DEMO_MODE = '1';
    await expect(choosePersona(USER.sam)).resolves.toEqual({ userId: USER.sam });
    await expect(choosePersona(null)).resolves.toEqual({ userId: null });
    await expect(choosePersona(randomUUID())).rejects.toMatchObject({ status: 404 });
    await expect(choosePersona('not-a-uuid')).rejects.toMatchObject({ status: 404 });
    delete process.env.DEMO_MODE;
    await expect(choosePersona(USER.sam)).rejects.toMatchObject({ status: 403 });
  });

  it("chooseActiveOrg allows only the actor's active clubs", async () => {
    const morgan = await actorFor(USER.morgan, S);
    await expect(chooseActiveOrg(morgan, A)).resolves.toEqual({ activeOrgId: A });
    const casey = await actorFor(USER.casey, S);
    await expect(chooseActiveOrg(casey, A)).rejects.toMatchObject({ status: 403 });
    await expect(chooseActiveOrg(casey, 'not-a-uuid')).rejects.toMatchObject({ status: 403 });
    const signedOut = await actorFromCookies({});
    await expect(chooseActiveOrg(signedOut, S)).rejects.toMatchObject({ status: 401 });
  });
});

describe.skipIf(!probe)('session routes', () => {
  const demoMode = process.env.DEMO_MODE;
  beforeEach(() => {
    jar.set.length = 0;
    jar.deleted.length = 0;
    process.env.DEMO_MODE = '1';
  });
  afterEach(() => {
    if (demoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = demoMode;
  });

  const post = (handler: typeof postPersona, body: unknown, cookie = '', type = 'application/json') =>
    handler(new Request('http://localhost/api/session', {
      method: 'POST', headers: { 'content-type': type, cookie }, body: JSON.stringify(body),
    }), { params: Promise.resolve({}) });
  const options = { httpOnly: true, sameSite: 'lax', path: '/', secure: false };

  it('persona: sets the user id only and clears the active org', async () => {
    const res = await post(postPersona, { userId: USER.morgan });
    expect(res.status).toBe(200);
    expect(jar.set).toEqual([{ name: PERSONA_COOKIE, value: USER.morgan, options }]);
    expect(jar.deleted).toEqual([ACTIVE_ORG_COOKIE]);
  });

  it('persona: null signs out, even outside demo mode', async () => {
    delete process.env.DEMO_MODE;
    const res = await post(postPersona, { userId: null }, `${PERSONA_COOKIE}=${USER.sam}`);
    expect(res.status).toBe(200);
    expect(jar.set).toEqual([]);
    expect([...jar.deleted].sort()).toEqual([ACTIVE_ORG_COOKIE, PERSONA_COOKIE].sort());
  });

  it('persona: refuses a non-JSON body (cross-site form) and writes no cookie', async () => {
    const res = await post(postPersona, { userId: USER.avery }, '', 'text/plain');
    expect(res.status).toBe(400);
    expect(jar.set).toEqual([]);
  });

  it('active-org: sets the org id only, and refuses a club the actor is not in', async () => {
    const ok = await post(postActiveOrg, { orgId: A }, `${PERSONA_COOKIE}=${USER.morgan}`);
    expect(ok.status).toBe(200);
    expect(jar.set).toEqual([{ name: ACTIVE_ORG_COOKIE, value: A, options }]);
    jar.set.length = 0;
    const forged = await post(postActiveOrg, { orgId: A }, `${PERSONA_COOKIE}=${USER.casey}`);
    expect(forged.status).toBe(403);
    expect(jar.set).toEqual([]);
  });
});
