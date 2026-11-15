// Owner: A (WP-1). The §10 visibility contract, run as trojanops_app through withActor, plus the
// RLS guarantees withActor relies on (§5): settings are transaction-local, only the managing
// president writes documents, RETURNING needs read access, and runs are private to their user.
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { capGrants } from '@/lib/authz';
import type { Tier } from '@/lib/contracts';
import { getDb, type Tx } from '@/lib/db/client';
import { withActor } from '@/lib/db/with-actor';
import { DOCUMENT, ORG, SOURCE, USER } from '@db/seed/ids';
import {
  actorFor, appSql, closeAppDb, ensureDocumentFixture, ensureHandoffInstallation, inRolledBackApp, pgError, ts,
} from './db';

const probe = await appSql();
await probe?.end();
afterAll(async () => {
  if (probe) await closeAppDb();
});

interface Agent { orgId: string; maxTier: Tier; sourceIds: string[] }

// §8/§15 agents installed in Startup Club.
const AGENTS = {
  'recruiting-qa': { orgId: ORG.startup, maxTier: 'public', sourceIds: [SOURCE.startup.public] },
  handoff: {
    orgId: ORG.startup, maxTier: 'officers',
    sourceIds: [SOURCE.startup.public, SOURCE.startup.minutes, SOURCE.startup.archive, SOURCE.startup.finance],
  },
  'funding-precheck': { orgId: ORG.startup, maxTier: 'officers', sourceIds: [SOURCE.startup.finance, SOURCE.usg.rulebook] },
} satisfies Record<string, Agent>;

const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id).sort();
const visible = (tx: Tx) => tx.execute<{ id: string }>(sql`select id from documents`).then(ids);

/** The documents a run sees: the user's grants in the agent's org, capped by its max tier (I4). */
async function runVisibility(userId: string, activeOrgId: string | null, agent: Agent): Promise<string[]> {
  const actor = await actorFor(userId, activeOrgId);
  const grants = capGrants(actor.grants, agent.orgId, agent.maxTier);
  return withActor(actor, { grants, sourceIds: agent.sourceIds, maxTier: agent.maxTier }, visible);
}

const { recruitingFaq: faq, minutes20261008: minutes, spring2026Budget: budget, usgFundingRules: rules } = DOCUMENT;

// §10 table: [actor · agent, user, active org, agent, FAQ, Minutes, Spring budget, USG rules, every visible doc].
const CONTRACT: Array<[string, string, string | null, keyof typeof AGENTS, boolean, boolean, boolean, boolean, string[]]> = [
  ['Lee (no club) · recruiting-qa', USER.lee, null, 'recruiting-qa', true, false, false, false, [faq]],
  ['Taylor (treasurer) · recruiting-qa', USER.taylor, ORG.startup, 'recruiting-qa', true, false, false, false, [faq]],
  ['Casey (member) · handoff', USER.casey, ORG.startup, 'handoff', true, true, false, false,
    [faq, minutes, DOCUMENT.pastEvents]],
  ['Taylor (treasurer) · handoff', USER.taylor, ORG.startup, 'handoff', true, true, true, false,
    [faq, minutes, DOCUMENT.pastEvents, budget, DOCUMENT.sponsorContacts]],
  ['Morgan (Archery treasurer, Startup member) · handoff', USER.morgan, ORG.startup, 'handoff', true, true, false, false,
    [faq, minutes, DOCUMENT.pastEvents]],
  ['Taylor (treasurer) · funding-precheck', USER.taylor, ORG.startup, 'funding-precheck', false, false, true, true,
    [budget, DOCUMENT.sponsorContacts, rules]],
];

describe.skipIf(!probe)('§10 visibility contract as trojanops_app', () => {
  it.each(CONTRACT)('%s', async (_label, userId, orgId, agent, seesFaq, seesMinutes, seesBudget, seesRules, all) => {
    await inRolledBackApp(async (tx) => {
      await ensureDocumentFixture(tx);
      const seen = await runVisibility(userId, orgId, AGENTS[agent]);
      expect({
        faq: seen.includes(faq), minutes: seen.includes(minutes), budget: seen.includes(budget), rules: seen.includes(rules),
      }).toEqual({ faq: seesFaq, minutes: seesMinutes, budget: seesBudget, rules: seesRules });
      expect(seen).toEqual([...all].sort());
    });
  });
});

describe.skipIf(!probe)('withActor and RLS', () => {
  it('shows no documents without set_config', async () => {
    await inRolledBackApp(async (tx) => {
      await ensureDocumentFixture(tx);
      // The harness cleared the fixture's settings, as on a fresh connection: nothing is visible,
      // though the same transaction holds the documents (control: Taylor through withActor).
      expect(await visible(tx)).toEqual([]);
      const taylor = await actorFor(USER.taylor, ORG.startup);
      expect(await withActor(taylor, { sourceIds: AGENTS.handoff.sourceIds }, visible)).toContain(minutes);
    });
  });

  it('keeps every setting local to its transaction', async () => {
    type Settings = { pid: number; u: string | null; g: string | null; s: string | null; m: string | null; t: string | null };
    const read = sql`select pg_backend_pid() as pid, current_setting('app.user_id', true) as u,
      current_setting('app.grants', true) as g, current_setting('app.agent_sources', true) as s,
      current_setting('app.manage_org', true) as m, current_setting('app.max_tier', true) as t`;
    // Sam is president, so all five settings are non-empty inside withActor.
    const sam = await actorFor(USER.sam, ORG.startup);
    const inside = await withActor(sam, { sourceIds: AGENTS.handoff.sourceIds, maxTier: 'officers' }, (tx) =>
      tx.execute<Settings>(read).then(([r]) => r));
    expect([inside.u, inside.g, inside.s, inside.m].every(Boolean)).toBe(true);
    expect(inside.t).toBe('officers');

    // Read from the pool until a query lands on the backend that ran withActor; no read may carry
    // Sam's settings.
    let sameBackend = 0;
    for (let burst = 0; burst < 20 && sameBackend === 0; burst++) {
      const rows = await Promise.all(Array.from({ length: 5 }, () => getDb().execute<Settings>(read).then(([r]) => r)));
      for (const r of rows) {
        expect([r.u, r.g, r.s, r.m, r.t].every((v) => v === null || v === '')).toBe(true);
        if (r.pid === inside.pid) sameBackend++;
      }
    }
    expect(sameBackend).toBeGreaterThan(0);
  });

  it("lets only the club's president insert and update its documents", async () => {
    await inRolledBackApp(async (tx) => {
      await ensureDocumentFixture(tx);
      const taylor = await actorFor(USER.taylor, ORG.startup);
      const sam = await actorFor(USER.sam, ORG.startup);
      const scope = { sourceIds: AGENTS.handoff.sourceIds };

      expect(await pgError(withActor(taylor, scope, (t) => t.execute(sql`
        insert into documents (id, org_id, source_id, title, tier, body_md, created_at)
        values (${randomUUID()}, ${ORG.startup}, ${SOURCE.startup.minutes}, 'Planted', 'members', 'x', ${ts()})`))))
        .toMatch(/row-level security/);

      const updated = await withActor(taylor, scope, (t) =>
        t.execute(sql`update documents set title = 'Changed' where id = ${minutes}`));
      expect(updated.count).toBe(0);

      // Sam moves the budget down to members; the trigger recomputes read_grants.
      const grants = await withActor(sam, scope, async (t) => {
        const r = await t.execute(sql`update documents set tier = 'members', allowed_positions = '{}' where id = ${budget}`);
        expect(r.count).toBe(1);
        return t.execute<{ read_grants: string[] }>(sql`select read_grants from documents where id = ${budget}`);
      });
      expect(grants[0].read_grants).toEqual([`${ORG.startup}:*`]);

      // Sam can't plant a document in another club's org.
      expect(await pgError(withActor(sam, scope, (t) => t.execute(sql`
        insert into documents (id, org_id, source_id, title, tier, body_md, created_at)
        values (${randomUUID()}, ${ORG.archery}, ${SOURCE.archery.finance}, 'Planted', 'public', 'x', ${ts()})`))))
        .toMatch(/row-level security/);
    });
  });

  it('rejects INSERT ... RETURNING when the inserter cannot read the new row', async () => {
    await inRolledBackApp(async (tx) => {
      await ensureDocumentFixture(tx);
      const sam = await actorFor(USER.sam, ORG.startup);
      // Sam manages Startup but runs with public grants only, so a new officers row is unreadable.
      const scope = { grants: ['*' as const], sourceIds: [SOURCE.startup.finance] };
      const insert = (id: string, returning: boolean) => sql`
        insert into documents (id, org_id, source_id, title, tier, allowed_positions, body_md, created_at)
        values (${id}, ${ORG.startup}, ${SOURCE.startup.finance}, 'Q', 'officers', '{treasurer}', 'x', ${ts()})
        ${returning ? sql`returning id` : sql``}`;
      // Control: the same insert without RETURNING passes the insert policy.
      expect((await withActor(sam, scope, (t) => t.execute(insert(randomUUID(), false)))).count).toBe(1);
      expect(await pgError(withActor(sam, scope, (t) => t.execute(insert(randomUUID(), true)))))
        .toMatch(/row-level security/);
    });
  });

  it('keeps agent_runs private to the user who ran them; agent_runs_meta lists them without input', async () => {
    await inRolledBackApp(async (tx) => {
      const installationId = await ensureHandoffInstallation(tx);
      const casey = await actorFor(USER.casey, ORG.startup);
      const taylor = await actorFor(USER.taylor, ORG.startup);
      const runId = randomUUID();
      const insertRun = (t: Tx, id: string, userId: string) => t.execute(sql`
        insert into agent_runs (id, installation_id, template_version, org_id, billed_org_id, user_id, input, status, started_at, created_at)
        values (${id}, ${installationId}, 1, ${ORG.startup}, ${ORG.startup}, ${userId}, 'private question', 'succeeded', ${ts()}, ${ts()})`);

      await withActor(casey, {}, (t) => insertRun(t, runId, USER.casey));
      const runIds = (t: Tx) => t.execute<{ id: string }>(sql`select id from agent_runs`).then(ids);
      expect(await withActor(casey, {}, runIds)).toEqual([runId]);
      expect(await withActor(taylor, {}, runIds)).toEqual([]);
      expect(await pgError(withActor(casey, {}, (t) => insertRun(t, randomUUID(), USER.taylor)))).toMatch(/row-level security/);

      const meta = await withActor(taylor, {}, (t) =>
        t.execute<Record<string, unknown>>(sql`select * from agent_runs_meta where id = ${runId}`));
      expect(meta).toHaveLength(1);
      expect(meta[0]).not.toHaveProperty('input');
      expect(meta[0]).not.toHaveProperty('output');
    });
  });

  it('harness: clears settings after each withActor and refuses nested ones', async () => {
    await inRolledBackApp(async (tx) => {
      const sam = await actorFor(USER.sam, ORG.startup);
      await withActor(sam, { sourceIds: [SOURCE.startup.public] }, async () => {});
      const [r] = await tx.execute<{ g: string; m: string; t: string }>(
        sql`select current_setting('app.grants', true) as g, current_setting('app.manage_org', true) as m,
                   current_setting('app.max_tier', true) as t`);
      expect(r).toEqual({ g: '', m: '', t: '' });
      await expect(withActor(sam, {}, () => withActor(sam, {}, async () => {}))).rejects.toThrow(/nested or concurrent/);
    });
  });

  it('keeps the owner URL out of app code', () => {
    const files = readdirSync('src', { recursive: true, withFileTypes: true })
      .filter((f) => f.isFile())
      .map((f) => join(f.parentPath, f.name));
    expect(files.filter((f) => readFileSync(f, 'utf8').includes('DATABASE_OWNER_URL'))).toEqual([]);
  });
});
