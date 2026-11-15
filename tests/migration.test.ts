// Owner: A. The roles/RLS migration (db/migrations/0001_roles_rls.sql) as seen by trojanops_app, with
// raw set_config. tests/rls.test.ts checks the same policies through withActor.
import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ORG, SOURCE } from '@db/seed/ids';
import { appSql, rolledBack } from './db';

const sql = await appSql();
afterAll(async () => { await sql?.end(); });

const set = (tx: Parameters<Parameters<typeof rolledBack>[1]>[0], name: string, value: string) =>
  tx`select set_config(${name}, ${value}, true)`;

describe.skipIf(!sql)('roles and RLS migration', () => {
  const db = sql!;

  it('connects as a non-superuser without BYPASSRLS', async () => {
    const [r] = await db`select current_user as role, rolsuper, rolbypassrls from pg_roles where rolname = current_user`;
    expect(r).toMatchObject({ role: 'trojanops_app', rolsuper: false, rolbypassrls: false });
  });

  it('shows no documents without set_config', async () => {
    await rolledBack(db, async (tx) => {
      await tx`insert into sources (id, org_id, slug, name, kind, created_at)
               values (${SOURCE.startup.public}, ${ORG.startup}, 'public', 'Public', 'public', now())
               on conflict do nothing`;
      await set(tx, 'app.manage_org', ORG.startup);
      await tx`insert into documents (org_id, source_id, title, tier, body_md, created_at)
               values (${ORG.startup}, ${SOURCE.startup.public}, 'FAQ', 'public', 'x', now())`;
      await set(tx, 'app.manage_org', '');
      expect((await tx`select count(*)::int as n from documents`)[0].n).toBe(0);
      // Control: the row is there once grants and sources are set.
      await set(tx, 'app.grants', '{"*"}');
      await set(tx, 'app.agent_sources', `{"${SOURCE.startup.public}"}`);
      expect((await tx`select count(*)::int as n from documents`)[0].n).toBeGreaterThan(0);
    });
  });

  it('keeps audit_events and ai_usage append-only and agent_runs_meta read-only', async () => {
    const [r] = await db`select
      has_table_privilege('audit_events', 'UPDATE') or has_table_privilege('audit_events', 'DELETE') as audit_mutable,
      has_table_privilege('ai_usage', 'UPDATE') or has_table_privilege('ai_usage', 'DELETE') as usage_mutable,
      has_table_privilege('agent_runs_meta', 'SELECT') as meta_read,
      has_table_privilege('agent_runs_meta', 'INSERT') or has_table_privilege('agent_runs_meta', 'UPDATE') as meta_write`;
    expect(r).toEqual({ audit_mutable: false, usage_mutable: false, meta_read: true, meta_write: false });
  });

  it('lets the app role delete from roster_state and from no other table', async () => {
    const rows = await db<{ table_name: string }[]>`
      with app_tables as materialized (select tablename from pg_tables where schemaname = 'public')
      select tablename as table_name from app_tables
      where has_table_privilege(format('public.%I', tablename), 'DELETE') order by tablename`;
    expect(rows.map((r) => r.table_name)).toEqual(['roster_state']);
  });

  it('lets only the managing president insert documents, into their own sources', async () => {
    const financeSource = randomUUID();
    const rulebookSource = randomUUID();
    await rolledBack(db, async (tx) => {
      await tx`insert into sources (id, org_id, slug, name, kind, created_at)
               values (${financeSource}, ${ORG.startup}, ${financeSource}, 'Finance', 'finance', now()),
                      (${rulebookSource}, ${ORG.usg}, ${rulebookSource}, 'Rulebook', 'rulebook', now())`;
      await set(tx, 'app.manage_org', ORG.startup);
      await expect(tx`insert into documents (org_id, source_id, title, tier, body_md, created_at)
                      values (${ORG.startup}, ${rulebookSource}, 'Planted', 'public', 'x', now())`)
        .rejects.toThrow(/documents_source_org_fk/);
    });
    await rolledBack(db, async (tx) => {
      await tx`insert into sources (id, org_id, slug, name, kind, created_at)
               values (${financeSource}, ${ORG.startup}, ${financeSource}, 'Finance', 'finance', now())`;
      await expect(tx`insert into documents (org_id, source_id, title, tier, body_md, created_at)
                      values (${ORG.startup}, ${financeSource}, 'x', 'members', 'x', now())`)
        .rejects.toThrow(/row-level security/);
    });
  });

  it('computes read_grants in the trigger and filters by grants and sources', async () => {
    const financeSource = randomUUID();
    await rolledBack(db, async (tx) => {
      await tx`insert into sources (id, org_id, slug, name, kind, created_at)
               values (${financeSource}, ${ORG.startup}, ${financeSource}, 'Finance', 'finance', now())`;
      await set(tx, 'app.manage_org', ORG.startup);
      await tx`insert into documents (org_id, source_id, title, tier, allowed_positions, read_grants, body_md, created_at) values
        (${ORG.startup}, ${financeSource}, 'Budget', 'officers', '{treasurer}', '{*}', 'x', now()),
        (${ORG.startup}, ${financeSource}, 'Minutes', 'members', '{}', '{}', 'x', now())`;
      await set(tx, 'app.agent_sources', `{"${financeSource}"}`);
      await set(tx, 'app.grants', `{"*","${ORG.startup}:*","${ORG.startup}:treasurer"}`);
      const all = await tx`select title, read_grants from documents order by title`;
      expect(all).toEqual([
        { title: 'Budget', read_grants: [`${ORG.startup}:president`, `${ORG.startup}:treasurer`] },
        { title: 'Minutes', read_grants: [`${ORG.startup}:*`] },
      ]);
      await set(tx, 'app.grants', `{"*","${ORG.startup}:*"}`);
      expect((await tx`select title from documents`).map((r) => r.title)).toEqual(['Minutes']);
      await set(tx, 'app.agent_sources', '{}');
      expect(await tx`select title from documents`).toEqual([]);
    });
  });

  it('caps document tiers in RLS even when the same role grants both tiers', async () => {
    const sourceId = randomUUID();
    await rolledBack(db, async (tx) => {
      await tx`insert into sources (id, org_id, slug, name, kind, created_at)
               values (${sourceId}, ${ORG.usg}, ${sourceId}, 'Tier test', 'usg_internal', now())`;
      await set(tx, 'app.manage_org', ORG.usg);
      await tx`insert into documents (org_id, source_id, title, tier, allowed_positions, body_md, created_at) values
        (${ORG.usg}, ${sourceId}, 'Officers', 'officers', '{reviewer,admin}', 'x', now()),
        (${ORG.usg}, ${sourceId}, 'Internal', 'usg_internal', '{}', 'x', now())`;
      await set(tx, 'app.agent_sources', `{"${sourceId}"}`);
      for (const role of ['reviewer', 'admin']) {
        await set(tx, 'app.grants', `{"*","${ORG.usg}:${role}"}`);
        for (const [tier, titles] of [
          ['public', []], ['members', []], ['officers', ['Officers']],
          ['usg_internal', ['Internal', 'Officers']], ['', ['Internal', 'Officers']], ['invalid', []],
        ] as const) {
          await set(tx, 'app.max_tier', tier);
          expect((await tx`select title from documents order by title`).map((r) => r.title)).toEqual(titles);
        }
      }
      await set(tx, 'app.max_tier', 'usg_internal');
      await set(tx, 'app.grants', '{}');
      expect(await tx`select title from documents`).toEqual([]);
      await set(tx, 'app.grants', `{"${ORG.usg}:reviewer"}`);
      await set(tx, 'app.agent_sources', '{}');
      expect(await tx`select title from documents`).toEqual([]);
    });
  });
});
