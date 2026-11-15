// Owner: B. D7 succession uses real memberships and immediately changes distribution access.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { transferPosition } from '@/lib/lifecycle/transfer';
import { myAgents, canUse, effectiveAgent } from '@/lib/distribution';
import { grantsFor } from '@/lib/authz';
import * as client from '@/lib/db/client';
import { memberships } from '@/lib/db/schema';
import type { Db, Tx } from '@/lib/db/client';
import { ORG, POSITION, USER, INSTALLATION } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp, ts } from './db';

const probe = await appSql(); await probe?.end();
afterAll(async () => { if (probe) await closeAppDb(); });
const sam = () => actorFor(USER.sam, ORG.startup);
const fromAudit = async (tx: Tx) => Number((await tx.execute(sql`select coalesce(max(id), 0) as id from audit_events`))[0].id);
const active = (tx: Tx, slug = 'treasurer') => tx.execute<{ user_id: string; source: string; started_at: Date; id: string }>(sql`
  select m.* from memberships m join positions p on p.id = m.position_id and p.org_id = m.org_id
  where m.org_id = ${ORG.startup} and p.slug = ${slug} and m.ended_at is null order by m.id`);
const baselineRoster = (tx: Tx) => tx.execute(sql`select * from roster_state order by org_id, position_slug, external_user_id`);

describe.skipIf(!probe)('transferPosition · D7', () => {
  it('hands Treasurer from Taylor to Jordan atomically, retaining other memberships and installations', () => inRolledBackApp(async tx => {
    const before = await tx.execute(sql`select * from agent_installations order by id`);
    const unaffected = await tx.execute(sql`select * from memberships where position_id <> ${POSITION.startup.treasurer} order by id`);
    const [{ id: oldId }] = await active(tx);
    const auditId = await fromAudit(tx);
    await transferPosition(await sam(), ORG.startup, 'treasurer', USER.jordan);
    const current = await active(tx);
    expect(current).toHaveLength(1);
    expect(current[0]).toMatchObject({ user_id: USER.jordan, source: 'manual' });
    const [old] = await tx.execute(sql`select ended_at, source from memberships where id = ${oldId}`);
    expect(old.source).toBe('roster');
    expect(old.ended_at).toEqual(current[0].started_at);
    expect(await tx.execute(sql`select * from agent_installations order by id`)).toEqual(before);
    expect(await tx.execute(sql`select * from memberships where position_id <> ${POSITION.startup.treasurer} order by id`)).toEqual(unaffected);
    const events = await tx.execute(sql`select * from audit_events where id > ${auditId} and action = 'position.transfer'`);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actor_user_id: USER.sam, acting_org_id: ORG.startup, target_type: 'position', target_id: POSITION.startup.treasurer });
    expect(events[0].details).toMatchObject({ fromUserIds: [USER.taylor], toUserId: USER.jordan, changed: true });
  }));
  it('immediately removes Taylor’s funding access and grants Jordan’s without affecting Morgan’s other club', () => inRolledBackApp(async () => {
    const agent = await effectiveAgent(INSTALLATION.startupFundingPrecheck);
    expect((await canUse(USER.taylor, agent)).ok).toBe(true);
    expect((await canUse(USER.jordan, agent)).ok).toBe(false);
    await transferPosition(await sam(), ORG.startup, 'treasurer', USER.jordan);
    expect((await canUse(USER.taylor, agent)).ok).toBe(false);
    expect((await canUse(USER.jordan, agent)).ok).toBe(true);
    const taylor = (await myAgents(USER.taylor)).find(c => c.orgId === ORG.startup)!;
    const jordan = (await myAgents(USER.jordan)).find(c => c.orgId === ORG.startup)!;
    expect(taylor.agents.map(a => a.templateSlug)).not.toContain('funding-precheck');
    expect(taylor.agents.map(a => a.templateSlug)).toContain('handoff');
    expect(jordan.agents.map(a => a.templateSlug)).toContain('funding-precheck');
    expect(await grantsFor(USER.taylor, ORG.startup)).not.toContain(`${ORG.startup}:treasurer`);
    expect(await grantsFor(USER.morgan, ORG.archery)).toContain(`${ORG.archery}:treasurer`);
  }));
  it('preserves the imported roster baseline so an unchanged roster must not undo the manual assignment', () => inRolledBackApp(async tx => {
    const before = await baselineRoster(tx);
    const csv = readFileSync(new URL('../db/seed/roster.csv', import.meta.url), 'utf8');
    expect(csv).toContain('startup,Startup Club,taylor,Taylor,treasurer');
    await transferPosition(await sam(), ORG.startup, 'treasurer', USER.jordan);
    expect(await baselineRoster(tx)).toEqual(before);
    expect((await active(tx))[0]).toMatchObject({ user_id: USER.jordan, source: 'manual' });
    // D's importRoster does not exist yet. This asserts B's side of the precedence contract;
    // do not simulate an importer here and mistake that for an end-to-end roster-sync test.
  }));
  it('is idempotent for an already-current holder and can fill a vacant office', () => inRolledBackApp(async tx => {
    const actor = await sam();
    await transferPosition(actor, ORG.startup, 'treasurer', USER.jordan);
    const first = await active(tx);
    await transferPosition(actor, ORG.startup, 'treasurer', USER.jordan);
    expect(await active(tx)).toEqual(first);
    await transferPosition(actor, ORG.startup, 'secretary', USER.jordan);
    expect(await active(tx, 'secretary')).toHaveLength(1);
  }));
  it('rejects anonymous, non-president, cross-club and stale presidential authority', () => inRolledBackApp(async tx => {
    const actor = await sam();
    const before = await active(tx);
    await expect(transferPosition({ userId: null, activeOrgId: null, positions: [], grants: [] }, ORG.startup, 'treasurer', USER.jordan))
      .rejects.toMatchObject({ error: { code: 'unauthenticated' } });
    for (const other of [await actorFor(USER.taylor, ORG.startup), await actorFor(USER.avery, ORG.usg)]) {
      await expect(transferPosition(other, ORG.startup, 'treasurer', USER.jordan)).rejects.toMatchObject({ error: { code: 'forbidden' } });
    }
    await expect(transferPosition(actor, ORG.archery, 'treasurer', USER.jordan)).rejects.toMatchObject({ error: { code: 'forbidden' } });
    await transferPosition(actor, ORG.startup, 'president', USER.jordan);
    await expect(transferPosition(actor, ORG.startup, 'treasurer', USER.jordan)).rejects.toMatchObject({ error: { code: 'forbidden' } });
    expect(await active(tx)).toEqual(before);
  }));
  it('rejects invalid ids, missing positions, non-members, inactive clubs and bulk membership replacement', () => inRolledBackApp(async tx => {
    const actor = await sam();
    const before = await active(tx);
    for (const id of ['bad-id', randomUUID(), USER.lee]) {
      await expect(transferPosition(actor, ORG.startup, 'treasurer', id)).rejects.toMatchObject({ error: { code: 'not_found' } });
    }
    await expect(transferPosition(actor, ORG.startup, 'missing', USER.jordan)).rejects.toMatchObject({ error: { code: 'not_found' } });
    await expect(transferPosition(actor, ORG.startup, 'member', USER.jordan)).rejects.toMatchObject({ error: { code: 'invalid' } });
    await tx.execute(sql`update orgs set status = 'inactive' where id = ${ORG.startup}`);
    await expect(transferPosition(actor, ORG.startup, 'treasurer', USER.jordan)).rejects.toMatchObject({ error: { code: 'not_found' } });
    expect(await active(tx)).toEqual(before);
  }));
  it('refuses expired recipients and ambiguous offices without changing history', () => inRolledBackApp(async tx => {
    const actor = await sam(); const before = await active(tx);
    await tx.execute(sql`insert into memberships (user_id, org_id, position_id, source, started_at, ended_at, created_at)
      values (${USER.lee}, ${ORG.startup}, ${POSITION.startup.member}, 'roster', ${ts()}, ${ts()}, ${ts()})`);
    await expect(transferPosition(actor, ORG.startup, 'treasurer', USER.lee)).rejects.toMatchObject({ error: { code: 'not_found' } });
    expect(await active(tx)).toEqual(before);
    await tx.execute(sql`insert into memberships (user_id, org_id, position_id, source, started_at, created_at)
      values (${USER.jordan}, ${ORG.startup}, ${POSITION.startup.treasurer}, 'manual', ${ts()}, ${ts()})`);
    const ambiguous = await active(tx);
    await expect(transferPosition(actor, ORG.startup, 'treasurer', USER.casey)).rejects.toMatchObject({ error: { code: 'invalid' } });
    expect(await active(tx)).toEqual(ambiguous);
  }));
  it('rolls back the old membership ending when insertion of the replacement fails', () => inRolledBackApp(async harness => {
    const actor = await sam(); const before = await active(harness); const auditId = await fromAudit(harness);
    const failure = new Error('replacement insertion failed');
    const spy = vi.spyOn(client, 'getDb').mockReturnValue(new Proxy(harness as unknown as Db, {
      get(target, prop) {
        if (prop === 'transaction') return (fn: (tx: Tx) => Promise<unknown>) => harness.transaction(tx => fn(new Proxy(tx, {
          get(inner, key) {
            if (key === 'insert') return (table: unknown) => { if (table === memberships) throw failure; return inner.insert(table as typeof memberships); };
            const value = Reflect.get(inner, key, inner); return typeof value === 'function' ? value.bind(inner) : value;
          },
        })));
        const value = Reflect.get(target, prop, target); return typeof value === 'function' ? value.bind(target) : value;
      },
    }));
    try { await expect(transferPosition(actor, ORG.startup, 'treasurer', USER.jordan)).rejects.toBe(failure); }
    finally { spy.mockRestore(); }
    expect(await active(harness)).toEqual(before);
    expect(await harness.execute(sql`select id from audit_events where id > ${auditId} and action = 'position.transfer'`)).toHaveLength(0);
  }));
});
