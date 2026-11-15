import { afterAll, describe, expect, it } from 'vitest';
import { capGrants, grantsFor } from '@/lib/authz';
import { listAccessibleDocuments } from '@/lib/documents/access';
import { DOCUMENT, ORG, SOURCE, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb } from './db';

const sql = await appSql();
afterAll(async () => {
  await sql?.end();
  if (sql) await closeAppDb();
});

const scope = {
  sourceIds: Object.values(SOURCE.hacksc),
  maxTier: 'officers',
} as const;

describe.skipIf(!sql)('HackSC demo document isolation', () => {
  it('gives an organizing member the historical records while withholding finance', async () => {
    // Given a member and every HackSC source, so finance depends on RLS grants.
    const actor = await actorFor(USER.casey, ORG.hacksc);
    const grants = capGrants(await grantsFor(USER.casey, ORG.hacksc), ORG.hacksc, scope.maxTier);

    // When reading through the same access service as the gateway.
    const readable = await listAccessibleDocuments(actor, grants, scope);

    // Then the historical sources are available and the private worksheet is absent.
    expect(readable.map((doc) => doc.id)).toEqual(expect.arrayContaining([
      DOCUMENT.hackscMinutes2026, DOCUMENT.hackscHandoff2026,
    ]));
    expect(readable.map((doc) => doc.id)).not.toContain(DOCUMENT.hackscBudget);
  });

  it('does not carry an Archery treasurer position into HackSC', async () => {
    // Given a treasurer in another organization with no HackSC membership.
    const actor = await actorFor(USER.morgan, ORG.archery);
    const grants = capGrants(await grantsFor(USER.morgan, ORG.hacksc), ORG.hacksc, scope.maxTier);

    // When HackSC sources are queried with the recomputed club grants.
    const readable = await listAccessibleDocuments(actor, grants, scope);

    // Then only the public guide is returned.
    expect(readable.map((doc) => doc.id)).toEqual([DOCUMENT.hackscGuide]);
  });

  it('allows the HackSC treasurer to read finance with an officer-scoped agent', async () => {
    // Given a current HackSC treasurer and an officer-tier source scope.
    const actor = await actorFor(USER.taylor, ORG.hacksc);
    const grants = capGrants(await grantsFor(USER.taylor, ORG.hacksc), ORG.hacksc, scope.maxTier);

    // When the gateway document service evaluates RLS.
    const readable = await listAccessibleDocuments(actor, grants, scope);

    // Then the authorized financial worksheet is readable.
    expect(readable.map((doc) => doc.id)).toContain(DOCUMENT.hackscBudget);
  });
});
