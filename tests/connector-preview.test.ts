import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { connectorKind, loadConnectorPreview } from '@/lib/connectors/preview';
import { getConnectors } from '@/lib/connectors/registry';
import { memberships, users } from '@/lib/db/schema';
import { grantsFor } from '@/lib/authz';
import { now } from '@/lib/clock';
import { departedMembershipSeeds } from '@db/seed/personas';
import { withActor } from '@/lib/db/with-actor';
import { INSTALLATION, ORG, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, ensureDocumentFixture, inRolledBackApp, ts } from './db';

const probe = await appSql();
await probe?.end();
afterAll(async () => { if (probe) await closeAppDb(); });
afterEach(() => vi.restoreAllMocks());

it('accepts only the five known connector selections', () => {
  expect(['identity', 'roster', 'documents', 'llm', 'applications'].map(connectorKind))
    .toEqual(['identity', 'roster', 'documents', 'llm', 'applications']);
  for (const invalid of ['constructor', '__proto__', '../documents', '', ['identity'], undefined]) {
    expect(connectorKind(invalid)).toBeNull();
  }
});

describe.skipIf(!probe)('current connector CSV projections', () => {
  it('authorizes every dataset before reading its source', async () => {
    await inRolledBackApp(async () => {
      const actor = await actorFor(USER.sam, ORG.startup);
      const fetch = vi.spyOn(getConnectors().roster, 'fetch');
      for (const kind of ['identity', 'roster', 'documents', 'llm', 'applications'] as const) {
        await expect(loadConnectorPreview(actor, kind)).rejects.toMatchObject({ error: { code: 'forbidden' } });
      }
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  it('reads current account names and memberships rather than CSV fixture accounts', async () => {
    await inRolledBackApp(async tx => {
      await tx.update(users).set({ displayName: 'Current account name' }).where(eq(users.id, USER.sam));
      const preview = await loadConnectorPreview(await actorFor(USER.avery, ORG.usg), 'identity');
      expect(preview.status).toBe('ready');
      if (preview.status !== 'ready') return;
      expect(preview.data.columns).toEqual(['Person', 'Organization', 'Positions', 'Member status', 'Left on (UTC)']);
      expect(preview.data.rows.some(row => row[0] === 'Current account name' && row[1] === 'Startup Club')).toBe(true);
      expect(JSON.stringify(preview)).not.toContain(USER.sam);
      expect(preview.data.isDemo).toBe(true); // Summary only; rows are actual platform data.
    });
  });

  it('reports leaving one club separately from membership in another, without restoring access', async () => {
    await inRolledBackApp(async tx => {
      await tx.insert(memberships).values(departedMembershipSeeds(now()));
      const preview = await loadConnectorPreview(await actorFor(USER.avery, ORG.usg), 'identity');
      expect(preview.status).toBe('ready');
      if (preview.status !== 'ready') return;
      const casey = preview.data.rows.filter(row => row[0] === 'Casey');
      expect(casey.find(row => row[1] === 'Startup Club')?.[3]).toBe('Active member');
      expect(casey.find(row => row[1] === 'Archery Club')?.[3]).toBe('Left organization');
      expect(casey.find(row => row[1] === 'Archery Club')?.[4]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(await grantsFor(USER.casey, ORG.archery)).toEqual(['*']);
      expect((await actorFor(USER.lee, null)).positions).toEqual([]);
    });
  });

  it('shows the real roster source and isolates a source read failure', async () => {
    await inRolledBackApp(async () => {
      const actor = await actorFor(USER.avery, ORG.usg);
      const ready = await loadConnectorPreview(actor, 'roster');
      expect(ready.status).toBe('ready');
      if (ready.status === 'ready') {
        expect(ready.data.rows).toHaveLength(10);
        expect(ready.data.summary).toContain('8 people across 3 clubs');
      }
      vi.spyOn(getConnectors().roster, 'fetch').mockRejectedValue(new Error('private source path'));
      expect(await loadConnectorPreview(actor, 'roster')).toEqual({ status: 'unavailable', title: 'Roster' });
    });
  });

  it('uses document-library RLS and returns no restricted titles or document bodies', async () => {
    await inRolledBackApp(async tx => {
      await ensureDocumentFixture(tx);
      const preview = await loadConnectorPreview(await actorFor(USER.avery, ORG.usg), 'documents');
      expect(preview.status).toBe('ready');
      if (preview.status !== 'ready') return;
      expect(preview.data.rows.some(row => row[1] === 'Recruiting FAQ')).toBe(true);
      const text = JSON.stringify(preview);
      expect(text).not.toContain('Spring 2026 budget');
      expect(text).not.toContain('Meeting minutes 2026-10-08');
      expect(text).not.toContain('Demo text for');
      expect(preview.data.rows.map(row => row[1]).filter(title => title === 'USG Funding Department Guidelines')).toHaveLength(1);
    });
  });

  it('reads actual model run metadata while keeping another user’s input and output private', async () => {
    await inRolledBackApp(async () => {
      const taylor = await actorFor(USER.taylor, ORG.startup);
      await withActor(taylor, {}, tx => tx.execute(sql`
        insert into agent_runs (installation_id, template_version, org_id, billed_org_id, user_id,
          input, output, model, cost_micro, status, started_at, created_at)
        values (${INSTALLATION.startupFundingPrecheck}, 1, ${ORG.startup}, ${ORG.startup}, ${USER.taylor},
          ${'private prompt sentinel'}, ${JSON.stringify({ reply: 'private output sentinel' })}::jsonb,
          ${'actual-preview-model'}, 1234, 'completed', ${ts()}, ${ts()})
      `));
      const preview = await loadConnectorPreview(await actorFor(USER.avery, ORG.usg), 'llm');
      expect(preview.status).toBe('ready');
      if (preview.status !== 'ready') return;
      expect(preview.data.rows.some(row => row[0] === 'Taylor' && row[2] === 'actual-preview-model' && row[4] === '0.001234')).toBe(true);
      expect(JSON.stringify(preview)).not.toContain('private prompt sentinel');
      expect(JSON.stringify(preview)).not.toContain('private output sentinel');
    });
  });

  it('shows only actual internal submission references, never application payloads', async () => {
    await inRolledBackApp(async () => {
      const actor = await actorFor(USER.avery, ORG.usg);
      const before = await loadConnectorPreview(actor, 'applications');
      expect(before.status).toBe('ready');
      const submitted = await getConnectors().applications.submit({ privateText: 'private application sentinel' });
      const after = await loadConnectorPreview(actor, 'applications');
      expect(after.status).toBe('ready');
      if (before.status !== 'ready' || after.status !== 'ready') return;
      expect(after.data.rows).toHaveLength(before.data.rows.length + 1);
      expect(after.data.rows.some(row => row[0] === submitted.externalId)).toBe(true);
      expect(JSON.stringify(after)).not.toContain('private application sentinel');
    });
  });
});
