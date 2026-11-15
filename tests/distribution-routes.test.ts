// Owner: B. Stream B's §14 routes. The services are tested elsewhere; this covers what the HTTP
// layer adds — who may call, that an answer is about the caller and nobody else, that the path's
// club has to match the row, and that a write without application/json is refused.
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { ACTIVE_ORG_COOKIE, PERSONA_COOKIE } from '@/lib/identity';
import type { AgentListing, MyAgentsClub } from '@/lib/contracts';
import { effectiveAgent, myAgents } from '@/lib/distribution';
import * as directoryRoute from '@/app/api/directory/route';
import * as myAgentsRoute from '@/app/api/me/agents/route';
import * as publishRoute from '@/app/api/orgs/[orgId]/installations/[installationId]/publish/route';
import * as installationRoute from '@/app/api/orgs/[orgId]/installations/[installationId]/route';
import * as transferRoute from '@/app/api/orgs/[orgId]/positions/[positionSlug]/transfer/route';
import * as distributeRoute from '@/app/api/usg/templates/[templateId]/distribute/route';
import * as retireRoute from '@/app/api/usg/templates/[templateId]/retire/route';
import * as versionsRoute from '@/app/api/templates/[templateId]/versions/route';
import * as rulePacksRoute from '@/app/api/usg/rule-packs/[slug]/versions/route';
import { INSTALLATION, ORG, TEMPLATE, USER } from '@db/seed/ids';
import { appSql, closeAppDb, inRolledBackApp } from './db';

const probe = await appSql();
await probe?.end();
afterAll(async () => {
  if (probe) await closeAppDb();
});

const cookie = (userId?: string, orgId?: string) =>
  [userId && `${PERSONA_COOKIE}=${userId}`, orgId && `${ACTIVE_ORG_COOKIE}=${orgId}`]
    .filter(Boolean)
    .join('; ');

const get = (
  handler: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>,
  url: string,
  headers: Record<string, string> = {},
) => handler(new Request(url, { headers }), { params: Promise.resolve({}) });

describe.skipIf(!probe)('GET /api/directory', () => {
  it('serves every club’s public agents to a student with no club at all', async () => {
    // D3: Lee belongs to nothing and still opens Dance's showcase Q&A from the directory.
    const res = await get(directoryRoute.GET, 'http://localhost/api/directory', {
      cookie: cookie(USER.lee),
    });
    expect(res.status).toBe(200);

    const listings = (await res.json()) as AgentListing[];
    expect(listings.map((a) => a.templateSlug)).toContain('showcase-qa');
    // Startup's recruiting-qa is seeded disabled; it must not appear until D3 publishes it.
    expect(listings.map((a) => a.templateSlug)).not.toContain('recruiting-qa');
  });

  it('refuses a caller with no persona', async () => {
    const res = await get(directoryRoute.GET, 'http://localhost/api/directory');
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'unauthenticated' });
  });
});

describe.skipIf(!probe)('GET /api/me/agents', () => {
  it('answers with the caller’s own clubs', async () => {
    const res = await get(myAgentsRoute.GET, 'http://localhost/api/me/agents', {
      cookie: cookie(USER.taylor, ORG.startup),
    });
    expect(res.status).toBe(200);

    const clubs = (await res.json()) as MyAgentsClub[];
    expect(clubs.map((c) => c.orgId)).toEqual([ORG.startup]);
    expect(clubs[0].agents.map((a) => a.templateSlug).sort()).toEqual(['funding-precheck', 'handoff']);
  });

  // The user id comes from the session, never the query string: one student must not be able to
  // read another's clubs by asking for them.
  it('ignores a user id in the query string', async () => {
    const res = await get(
      myAgentsRoute.GET,
      `http://localhost/api/me/agents?userId=${USER.taylor}`,
      { cookie: cookie(USER.casey, ORG.startup) },
    );
    const clubs = (await res.json()) as MyAgentsClub[];
    // Casey is a plain member, so she never sees the treasurer's pre-check.
    expect(clubs[0].agents.map((a) => a.templateSlug)).toEqual(['handoff']);
  });

  it('answers a student with no club with an empty list, not an error', async () => {
    const res = await get(myAgentsRoute.GET, 'http://localhost/api/me/agents', {
      cookie: cookie(USER.lee),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('refuses a caller with no persona', async () => {
    const res = await get(myAgentsRoute.GET, 'http://localhost/api/me/agents');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// The write routes behind the demo beats. Every case runs rolled back.
// ---------------------------------------------------------------------------

const post = <P extends Record<string, string>>(
  handler: (req: Request, ctx: { params: Promise<P> }) => Promise<Response>,
  url: string,
  params: P,
  opts: { body?: unknown; userId?: string; orgId?: string } = {},
) =>
  handler(
    new Request(url, {
      method: 'POST',
      ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
      headers: {
        ...(opts.body === undefined ? {} : { 'content-type': 'application/json' }),
        cookie: cookie(opts.userId, opts.orgId),
      },
    }),
    { params: Promise.resolve(params) },
  );

describe.skipIf(!probe)('POST /api/orgs/:orgId/installations/:id/publish (D3)', () => {
  const url = `http://localhost/api/orgs/${ORG.startup}/installations/${INSTALLATION.startupRecruitingQa}/publish`;
  const params = { orgId: ORG.startup, installationId: INSTALLATION.startupRecruitingQa };

  it('lets the president publish, and the agent reaches the directory', () =>
    inRolledBackApp(async () => {
      const res = await post(publishRoute.POST, url, params, { userId: USER.sam, orgId: ORG.startup, body: {} });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ audience: 'public', maxTier: 'public', status: 'enabled' });

      const listed = await get(directoryRoute.GET, 'http://localhost/api/directory', {
        cookie: cookie(USER.lee),
      });
      expect(((await listed.json()) as AgentListing[]).map((a) => a.templateSlug)).toContain('recruiting-qa');
    }));

  it('refuses a plain member with 403', () =>
    inRolledBackApp(async () => {
      const res = await post(publishRoute.POST, url, params, { userId: USER.casey, orgId: ORG.startup, body: {} });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: 'forbidden' });
    }));

  // parseBody's content-type check is the cross-site write guard (src/lib/api.ts), so the widest
  // write in the product must not be reachable without it.
  it('refuses a write that is not application/json', () =>
    inRolledBackApp(async () => {
      const res = await post(publishRoute.POST, url, params, { userId: USER.sam, orgId: ORG.startup });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: 'invalid' });
    }));

  // The path names a club; it must not publish an installation belonging to a different one.
  it('refuses when the path names a club the installation is not in', () =>
    inRolledBackApp(async () => {
      const res = await post(
        publishRoute.POST,
        `http://localhost/api/orgs/${ORG.dance}/installations/${INSTALLATION.startupRecruitingQa}/publish`,
        { orgId: ORG.dance, installationId: INSTALLATION.startupRecruitingQa },
        { userId: USER.sam, orgId: ORG.startup, body: {} },
      );
      expect(res.status).toBe(403);
    }));
});

describe.skipIf(!probe)('distribute and narrow an installation (D2)', () => {
  it('distributes to every club, then rejects a club widening the model class', () =>
    inRolledBackApp(async (tx) => {
      // Avery distributes event-planning, which the seed leaves undistributed.
      const distributed = await post(
        distributeRoute.POST,
        `http://localhost/api/usg/templates/${TEMPLATE.eventPlanning}/distribute`,
        { templateId: TEMPLATE.eventPlanning },
        { body: {}, userId: USER.avery, orgId: ORG.usg },
      );
      expect(distributed.status).toBe(200);
      // The seed has exactly three active RSOs and event-planning targets them all.
      expect(await distributed.json()).toMatchObject({ count: 3 });

      const [row] = await tx.execute<{ id: string }>(
        sql`select i.id from agent_installations i join agent_templates t on t.id = i.template_id
            where t.slug = 'event-planning' and i.org_id = ${ORG.startup}`,
      );
      expect(row).toBeDefined();

      // event-planning v1 allows economy only, so Sam asking for standard is capped.
      const rejected = await fetchPatch(row.id);
      expect(rejected.status).toBe(422);
      expect(await rejected.json()).toMatchObject({
        code: 'clamp_violation',
        cap: { field: 'modelClass' },
      });
    }));

  const fetchPatch = (installationId: string) =>
    installationRoute.PATCH(
      new Request(`http://localhost/api/orgs/${ORG.startup}/installations/${installationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ modelClass: 'standard' }),
        headers: { 'content-type': 'application/json', cookie: cookie(USER.sam, ORG.startup) },
      }),
      { params: Promise.resolve({ orgId: ORG.startup, installationId }) },
    );

  it('refuses a club president distributing a USG template', () =>
    inRolledBackApp(async () => {
      const res = await post(
        distributeRoute.POST,
        `http://localhost/api/usg/templates/${TEMPLATE.eventPlanning}/distribute`,
        { templateId: TEMPLATE.eventPlanning },
        { body: {}, userId: USER.sam, orgId: ORG.startup },
      );
      expect(res.status).toBe(403);
    }));

  it('refuses a distribute request without a JSON body (cross-site form guard)', () =>
    inRolledBackApp(async () => {
      const res = await post(
        distributeRoute.POST,
        `http://localhost/api/usg/templates/${TEMPLATE.eventPlanning}/distribute`,
        { templateId: TEMPLATE.eventPlanning },
        { userId: USER.avery, orgId: ORG.usg },
      );
      expect(res.status).toBe(400);
    }));

  const patch = (installationId: string, userId: string, orgId: string, pathOrgId = ORG.startup) =>
    installationRoute.PATCH(
      new Request(`http://localhost/api/orgs/${pathOrgId}/installations/${installationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ promptAddendum: 'We are a dance club.' }),
        headers: { 'content-type': 'application/json', cookie: cookie(userId, orgId) },
      }),
      { params: Promise.resolve({ orgId: pathOrgId, installationId }) },
    );

  it('refuses a plain member patching an installation', () =>
    inRolledBackApp(async () => {
      const res = await patch(INSTALLATION.startupHandoff, USER.casey, ORG.startup);
      expect(res.status).toBe(403);
    }));

  it("refuses a president acting in another club", () =>
    inRolledBackApp(async () => {
      // Morgan is Archery's treasurer, not Startup's president, and is acting in Archery.
      const res = await patch(INSTALLATION.startupHandoff, USER.morgan, ORG.archery);
      expect(res.status).toBe(403);
    }));

  it('refuses when the path names a club the installation is not in', () =>
    inRolledBackApp(async () => {
      const res = await patch(INSTALLATION.startupHandoff, USER.sam, ORG.startup, ORG.dance);
      expect(res.status).toBe(404);
    }));
});

describe.skipIf(!probe)('POST /api/usg/rule-packs/:slug/versions (D6)', () => {
  it('publishes the next version as the latest published pack', () =>
    inRolledBackApp(async (tx) => {
      const res = await post(
        rulePacksRoute.POST,
        'http://localhost/api/usg/rule-packs/usg-funding/versions',
        { slug: 'usg-funding' },
        {
          userId: USER.avery,
          orgId: ORG.usg,
          body: { label: 'USG Funding Guidelines 2026–27', content: { annualCapUsd: 10_000 } },
        },
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ version: 2 });

      // No seeded template names the pack any more, so read the stored row.
      const [latest] = await tx.execute<{ version: number; status: string; content: { annualCapUsd: number } }>(
        sql`select version, status, content from rule_packs where slug = 'usg-funding' order by version desc limit 1`);
      expect(latest).toMatchObject({ version: 2, status: 'published', content: { annualCapUsd: 10_000 } });
    }));

  // isUsgAdmin needs position `admin` in a usg-kind org; Riley is a reviewer, Sam is a club
  // president. Neither may rewrite the rules every club is judged against.
  it.each([
    ['a USG reviewer', USER.riley, ORG.usg],
    ['a club president', USER.sam, ORG.startup],
  ])('refuses %s', (_who, userId, orgId) =>
    inRolledBackApp(async () => {
      const res = await post(
        rulePacksRoute.POST,
        'http://localhost/api/usg/rule-packs/usg-funding/versions',
        { slug: 'usg-funding' },
        { userId, orgId, body: { label: 'USG Funding Guidelines 2026–27', content: { annualCapUsd: 10_000 } } },
      );
      expect(res.status).toBe(403);
    }));
});

describe.skipIf(!probe)('template versions and retirement (§8)', () => {
  it('lets USG publish the next version, and installations on `latest` pick it up', () =>
    inRolledBackApp(async () => {
      const res = await post(
        versionsRoute.POST,
        `http://localhost/api/templates/${TEMPLATE.fundingPrecheck}/versions`,
        { templateId: TEMPLATE.fundingPrecheck },
        {
          userId: USER.avery,
          orgId: ORG.usg,
          body: {
            purpose: 'Checks a funding request against the USG funding rules before you submit it.',
            audience: 'positions',
            usableBy: ['treasurer', 'president'],
            maxTier: 'officers',
            sourceKinds: ['rulebook', 'finance'],
            tools: [],
            modelClasses: ['standard', 'economy'],
            defaultModelClass: 'standard',
            systemPrompt: 'You check club funding requests against the USG rule pack.',
            rulePackSlug: 'usg-funding',
            changelog: 'Second version.',
          },
        },
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ version: 2 });
      expect((await effectiveAgent(INSTALLATION.startupFundingPrecheck)).templateVersion).toBe(2);
    }));

  it('retires a template, which drops it out of the directory rather than failing on open', () =>
    inRolledBackApp(async () => {
      const res = await post(
        retireRoute.POST,
        `http://localhost/api/usg/templates/${TEMPLATE.showcaseQa}/retire`,
        { templateId: TEMPLATE.showcaseQa },
        { userId: USER.avery, orgId: ORG.usg, body: {} },
      );
      expect(res.status).toBe(200);

      const listed = await get(directoryRoute.GET, 'http://localhost/api/directory', {
        cookie: cookie(USER.lee),
      });
      expect(((await listed.json()) as AgentListing[]).map((a) => a.templateSlug)).not.toContain('showcase-qa');
    }));

  it('refuses a club president retiring a USG template', () =>
    inRolledBackApp(async () => {
      const res = await post(
        retireRoute.POST,
        `http://localhost/api/usg/templates/${TEMPLATE.showcaseQa}/retire`,
        { templateId: TEMPLATE.showcaseQa },
        { userId: USER.sam, orgId: ORG.startup, body: {} },
      );
      expect(res.status).toBe(403);
    }));
});

describe.skipIf(!probe)('POST /api/orgs/:orgId/positions/:slug/transfer (D7)', () => {
  it('moves the treasurer, and the agents that follow the position move with it', () =>
    inRolledBackApp(async () => {
      const res = await post(
        transferRoute.POST,
        `http://localhost/api/orgs/${ORG.startup}/positions/treasurer/transfer`,
        { orgId: ORG.startup, positionSlug: 'treasurer' },
        { userId: USER.sam, orgId: ORG.startup, body: { toUserId: USER.jordan } },
      );
      expect(res.status).toBe(200);

      const slugs = async (userId: string) =>
        (await myAgents(userId)).flatMap((c) => c.agents.map((a) => a.templateSlug));
      expect(await slugs(USER.taylor)).not.toContain('funding-precheck');
      expect(await slugs(USER.jordan)).toContain('funding-precheck');
    }));
});
