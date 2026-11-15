// Owner: A. Helpers for DB integration tests. They connect as trojanops_app (DATABASE_URL), never as
// the owner. When the database is unreachable, DB suites are skipped with a notice instead of failing,
// so `pnpm check` still runs without Docker; CI and the H-sync runs keep Docker up.
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { now } from '@/lib/clock';
import type { Actor } from '@/lib/contracts';
import { getDb, type Db, type Tx } from '@/lib/db/client';
import { pgTextArray, withActor } from '@/lib/db/with-actor';
import { ACTIVE_ORG_COOKIE, getActor, PERSONA_COOKIE } from '@/lib/identity';
import { DOCUMENT, INSTALLATION, ORG, SOURCE, TEMPLATE, USER } from '@db/seed/ids';

export async function appSql(): Promise<postgres.Sql | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const sql = postgres(url, { max: 2, connect_timeout: 2, onnotice: () => {} });
  try {
    await sql`select 1`;
    return sql;
  } catch {
    await sql.end({ timeout: 1 });
    console.warn('DB integration tests skipped: database unreachable (run pnpm db:up && pnpm db:reset)');
    return null;
  }
}

/** Ends the app's getDb() pool, for a suite's afterAll. drizzle() keeps the postgres-js pool on
 * $client; Db's type omits it. */
export async function closeAppDb(): Promise<void> {
  await (getDb() as unknown as { $client: { end: (o: { timeout: number }) => Promise<void> } }).$client.end({ timeout: 1 });
}

/** Runs fn in a transaction that is always rolled back. */
export async function rolledBack(sql: postgres.Sql, fn: (tx: postgres.TransactionSql) => Promise<void>): Promise<void> {
  const rollback = new Error('rollback');
  await sql.begin(async (tx) => {
    await fn(tx);
    throw rollback;
  }).catch((err) => {
    if (err !== rollback) throw err;
  });
}

const globalForDb = globalThis as unknown as { trojanopsDb?: Db };

/** Clears the four RLS settings, as a fresh pooled connection would have them. */
const RESET_SETTINGS = sql`select set_config('app.user_id', '', true), set_config('app.grants', '', true),
  set_config('app.agent_sources', '', true), set_config('app.manage_org', '', true),
  set_config('app.max_tier', '', true)`;

/**
 * Runs fn inside one app-role transaction that is always rolled back. While it runs, getDb() returns
 * a wrapper around that transaction (same global handle as src/lib/db/client.ts), so each withActor
 * call inside fn becomes a savepoint of it. Nothing is committed; the app role has no DELETE to clean
 * up with. fn gets the wrapper too.
 *
 * Two differences from production, handled by the wrapper:
 * - set_config(..., true) survives a released savepoint until the outer transaction ends, so the
 *   wrapper clears the settings when each inner transaction finishes. A read outside withActor then
 *   sees what a fresh pooled connection sees.
 * - In production a nested or concurrent withActor gets its own connection and can't see the other's
 *   uncommitted rows. Here they would share one, so the wrapper throws instead. Don't nest withActor
 *   or run several at once (Promise.all) inside this harness.
 */
export async function inRolledBackApp(fn: (tx: Tx) => Promise<void>): Promise<void> {
  const db = getDb();
  const rollback = new Error('rollback');
  try {
    await db.transaction(async (tx) => {
      let open = false;
      const transaction = async <T>(f: (inner: Tx) => Promise<T>): Promise<T> => {
        if (open) {
          throw new Error('inRolledBackApp: nested or concurrent transactions would share one connection; production uses separate ones');
        }
        open = true;
        try {
          return await tx.transaction(async (inner) => {
            const result = await f(inner);
            await inner.execute(RESET_SETTINGS); // on failure the savepoint rollback undoes them
            return result;
          });
        } finally {
          open = false;
        }
      };
      const harness = new Proxy(tx, {
        get(target, prop) {
          if (prop === 'transaction') return transaction;
          const value = Reflect.get(target, prop, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      globalForDb.trojanopsDb = harness as unknown as Db;
      try {
        await fn(harness);
      } finally {
        globalForDb.trojanopsDb = db;
      }
      throw rollback;
    });
  } catch (err) {
    if (err !== rollback) throw err;
  }
}

/** The Postgres message behind a failed drizzle query (drizzle wraps it as `cause`). */
export async function pgError(query: Promise<unknown>): Promise<string> {
  try {
    await query;
  } catch (err) {
    const e = err as { message: string; cause?: { message?: string } };
    return e.cause?.message ?? e.message;
  }
  throw new Error('expected the query to fail');
}

/** The actor for a persona acting in orgId, from the real request path: persona and active-org
 * cookies through getActor (I3: grants recomputed, never stored). orgId null = no club. */
export async function actorFor(userId: string, orgId: string | null): Promise<Actor> {
  const cookie = [`${PERSONA_COOKIE}=${userId}`, ...(orgId ? [`${ACTIVE_ORG_COOKIE}=${orgId}`] : [])].join('; ');
  const actor = await getActor(new Request('http://localhost/', { headers: { cookie } }));
  if (actor.userId !== userId || actor.activeOrgId !== orgId) {
    throw new Error(`actorFor: getActor resolved ${actor.userId} in ${actor.activeOrgId}, wanted ${userId} in ${orgId}`);
  }
  return actor;
}

const text = (values: readonly string[]) => sql`${pgTextArray(values)}::text[]`;
/** clock.now() as a timestamptz parameter (raw drizzle sql doesn't serialize a Date). */
export const ts = () => sql`${now().toISOString()}::timestamptz`;

interface FixtureDoc {
  id: string;
  orgId: string;
  sourceId: string;
  title: string;
  tier: 'public' | 'members' | 'officers' | 'usg_internal';
  allowedPositions?: string[];
}

// §15 documents. read_grants is left to the trigger.
const FIXTURE_DOCS: FixtureDoc[] = [
  { id: DOCUMENT.usgFundingRules, orgId: ORG.usg, sourceId: SOURCE.usg.rulebook, title: 'USG Funding Department Guidelines', tier: 'public' },
  { id: DOCUMENT.reviewerNotes, orgId: ORG.usg, sourceId: SOURCE.usg.usg_internal, title: 'Reviewer notes', tier: 'usg_internal' },
  { id: DOCUMENT.recruitingFaq, orgId: ORG.startup, sourceId: SOURCE.startup.public, title: 'Recruiting FAQ', tier: 'public' },
  { id: DOCUMENT.minutes20261008, orgId: ORG.startup, sourceId: SOURCE.startup.minutes, title: 'Meeting minutes 2026-10-08', tier: 'members' },
  { id: DOCUMENT.pastEvents, orgId: ORG.startup, sourceId: SOURCE.startup.archive, title: 'Past events and venues', tier: 'members' },
  { id: DOCUMENT.spring2026Budget, orgId: ORG.startup, sourceId: SOURCE.startup.finance, title: 'Spring 2026 budget', tier: 'officers', allowedPositions: ['treasurer'] },
  { id: DOCUMENT.sponsorContacts, orgId: ORG.startup, sourceId: SOURCE.startup.finance, title: 'Sponsor contacts', tier: 'officers', allowedPositions: ['treasurer'] },
  { id: DOCUMENT.archeryBudget2026, orgId: ORG.archery, sourceId: SOURCE.archery.finance, title: 'Archery budget 2026', tier: 'officers', allowedPositions: ['treasurer'] },
  { id: DOCUMENT.springShowcaseInfo, orgId: ORG.dance, sourceId: SOURCE.dance.public, title: 'Spring showcase info', tier: 'public' },
];

const insertDoc = (tx: Tx, d: FixtureDoc) => tx.execute(sql`
  insert into documents (id, org_id, source_id, title, tier, allowed_positions, body_md, created_at)
  values (${d.id}, ${d.orgId}, ${d.sourceId}, ${d.title}, ${d.tier}, ${text(d.allowedPositions ?? [])},
          ${`Demo text for ${d.title}.`}, ${ts()})
  on conflict do nothing`);

/**
 * Inserts any §15 source or document the seed doesn't have yet (stream C seeds them in WP-8); rows
 * the seed already has are kept (on conflict do nothing), so tests run against the real seed. Startup's documents go in through
 * withActor as Sam, its president; the other clubs and USG have no president persona, so their
 * documents go in with app.manage_org set directly.
 */
export async function ensureDocumentFixture(tx: Tx): Promise<void> {
  for (const [club, orgId] of [['usg', ORG.usg], ['startup', ORG.startup], ['archery', ORG.archery], ['dance', ORG.dance]] as const) {
    for (const [slug, id] of Object.entries(SOURCE[club])) {
      await tx.execute(sql`insert into sources (id, org_id, slug, name, kind, created_at)
                           values (${id}, ${orgId}, ${slug}, ${slug}, ${slug}, ${ts()})
                           on conflict do nothing`);
    }
  }

  const sam = await actorFor(USER.sam, ORG.startup);
  await withActor(sam, {}, async (inner) => {
    for (const d of FIXTURE_DOCS.filter((d) => d.orgId === ORG.startup)) await insertDoc(inner, d);
  });
  for (const orgId of [ORG.usg, ORG.archery, ORG.dance]) {
    await tx.transaction(async (inner) => {
      await inner.execute(sql`select set_config('app.manage_org', ${orgId}, true)`);
      for (const d of FIXTURE_DOCS.filter((d) => d.orgId === orgId)) await insertDoc(inner, d);
    });
  }
}

/** Startup's handoff installation (§8: "Club handoff", an org template published by Startup), for
 * agent_runs rows. Rows stream B already seeds are kept. */
export async function ensureHandoffInstallation(tx: Tx): Promise<string> {
  await tx.execute(sql`insert into agent_templates (id, slug, name, publisher_org_id, scope, distribution, created_at)
                       values (${TEMPLATE.handoff}, 'handoff', 'Club handoff', ${ORG.startup}, 'org', 'optional', ${ts()})
                       on conflict do nothing`);
  await tx.execute(sql`insert into agent_installations (id, template_id, org_id, installed_at, created_at)
                       values (${INSTALLATION.startupHandoff}, ${TEMPLATE.handoff}, ${ORG.startup}, ${ts()}, ${ts()})
                       on conflict do nothing`);
  return INSTALLATION.startupHandoff;
}
