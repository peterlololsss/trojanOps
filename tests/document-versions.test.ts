// Publishing a new version of a document (demo beat D6): a USG admin replaces the funding guidelines'
// text as v2, a club president does the same for the club's documents, nobody else can, and the next
// funding-precheck run reads v2. Every case runs in a rolled-back transaction as trojanops_app.
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { Actor } from '@/lib/contracts';
import { auditEvents, documents } from '@/lib/db/schema';
import { withActor } from '@/lib/db/with-actor';
import { runAgent } from '@/lib/gateway';
import { getLibraryDocument, managesLibrary, publishDocumentVersion } from '@/lib/documents/library';
import { usgDocumentsView, usgDocumentView } from '@/lib/documents/usg-documents';
import * as versionsRoute from '@/app/api/orgs/[orgId]/documents/[documentId]/versions/route';
import { ACTIVE_ORG_COOKIE, PERSONA_COOKIE } from '@/lib/identity';
import { DOCUMENT, INSTALLATION, ORG, SOURCE, TEMPLATE, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp } from './db';

const probe = await appSql();
await probe?.end();
afterAll(async () => { if (probe) await closeAppDb(); });

const avery = () => actorFor(USER.avery, ORG.usg);
const sam = () => actorFor(USER.sam, ORG.startup);
const amend = (body: string) => body.replace('maximum of $8,000 from the USG Funding Department', 'maximum of $10,000 from the USG Funding Department');
const v2 = async (actor: Actor) => {
  const doc = await getLibraryDocument(actor, ORG.usg, DOCUMENT.usgFundingRules);
  return publishDocumentVersion(actor, ORG.usg, DOCUMENT.usgFundingRules, { bodyMd: amend(doc!.bodyMd), baseVersion: 1 });
};
const manageOrg = (actor: Actor) => withActor(actor, {}, async (tx) =>
  ((await tx.execute(sql`select current_setting('app.manage_org', true) as m`)) as unknown as Array<{ m: string }>)[0]?.m);
/** A raw update under the actor's RLS settings, bypassing the service's checks. */
const rawUpdate = (actor: Actor, id: string, sourceId: string) => withActor(actor, { grants: ['*', ...actor.grants], sourceIds: [sourceId] }, (tx) =>
  tx.update(documents).set({ bodyMd: 'Overwritten.' }).where(eq(documents.id, id)).returning({ id: documents.id }));

describe.skipIf(!probe)('document versions', () => {
  it('lets a USG admin publish the guidelines as v2 and audits it', () => inRolledBackApp(async (tx) => {
    const actor = await avery();
    expect(await getLibraryDocument(actor, ORG.usg, DOCUMENT.usgFundingRules)).toMatchObject({ version: 1, sourceKind: 'rulebook' });
    expect(await v2(actor)).toEqual({ version: 2 });
    const [row] = await withActor(actor, { grants: ['*'], sourceIds: [SOURCE.usg.rulebook] }, (t) =>
      t.select({ version: documents.version, body: documents.bodyMd, tier: documents.tier, readGrants: documents.readGrants })
        .from(documents).where(eq(documents.id, DOCUMENT.usgFundingRules)));
    expect(row).toMatchObject({ version: 2, tier: 'public', readGrants: ['*'] });
    expect(row?.body).toContain('maximum of $10,000');
    const audits = await tx.select().from(auditEvents)
      .where(and(eq(auditEvents.action, 'document.upload'), eq(auditEvents.targetId, DOCUMENT.usgFundingRules)));
    expect(audits.at(-1)?.details).toEqual({ version: 2 });
  }));

  it('keeps tier, positions and grants when a president versions an officers document', () => inRolledBackApp(async () => {
    const actor = await sam();
    const before = await getLibraryDocument(actor, ORG.startup, DOCUMENT.spring2026Budget);
    const read = () => withActor(actor, { grants: actor.grants, sourceIds: [SOURCE.startup.finance] }, (t) =>
      t.select({ tier: documents.tier, allowed: documents.allowedPositions, readGrants: documents.readGrants, version: documents.version })
        .from(documents).where(eq(documents.id, DOCUMENT.spring2026Budget)));
    const [old] = await read();
    expect(await publishDocumentVersion(actor, ORG.startup, DOCUMENT.spring2026Budget, { bodyMd: `${before!.bodyMd}\n- Updated.`, baseVersion: 1 }))
      .toEqual({ version: 2 });
    const [now] = await read();
    expect(now).toEqual({ ...old, version: 2 });
  }));

  it('refuses everyone who does not manage USG at the service', () => inRolledBackApp(async () => {
    const body = { bodyMd: 'Replaced.', baseVersion: 1 };
    for (const actor of [await sam(), await actorFor(USER.taylor, ORG.startup), await actorFor(USER.riley, ORG.usg)]) {
      await expect(publishDocumentVersion(actor, ORG.usg, DOCUMENT.usgFundingRules, body)).rejects.toMatchObject({ error: { code: 'forbidden' } });
    }
    // Sam manages Startup, not USG: naming Startup as the org does not reach USG's document.
    await expect(publishDocumentVersion(await sam(), ORG.startup, DOCUMENT.usgFundingRules, body))
      .rejects.toMatchObject({ error: { code: 'not_found' } });
    // Avery manages USG, not Startup.
    await expect(publishDocumentVersion(await avery(), ORG.startup, DOCUMENT.spring2026Budget, body))
      .rejects.toMatchObject({ error: { code: 'forbidden' } });
  }));

  it('lets RLS refuse updates across orgs even without the service checks', () => inRolledBackApp(async () => {
    expect(await rawUpdate(await sam(), DOCUMENT.usgFundingRules, SOURCE.usg.rulebook)).toEqual([]);
    expect(await rawUpdate(await avery(), DOCUMENT.spring2026Budget, SOURCE.startup.finance)).toEqual([]);
  }));

  it('gives an "admin" position manage rights only in USG', () => inRolledBackApp(async () => {
    const clubAdmin: Actor = { ...(await sam()), positions: ['admin'] };
    expect(await manageOrg(clubAdmin)).toBe('');
    expect(await managesLibrary(clubAdmin, ORG.startup)).toBe(false);
    await expect(publishDocumentVersion(clubAdmin, ORG.startup, DOCUMENT.spring2026Budget, { bodyMd: 'x', baseVersion: 1 }))
      .rejects.toMatchObject({ error: { code: 'forbidden' } });
    expect(await manageOrg(await avery())).toBe(ORG.usg);
    expect(await manageOrg(await actorFor(USER.riley, ORG.usg))).toBe('');
    expect(await manageOrg(await sam())).toBe(ORG.startup);
  }));

  it('rejects a stale base version and unchanged text', () => inRolledBackApp(async () => {
    const actor = await avery();
    const doc = await getLibraryDocument(actor, ORG.usg, DOCUMENT.usgFundingRules);
    await expect(publishDocumentVersion(actor, ORG.usg, DOCUMENT.usgFundingRules, { bodyMd: doc!.bodyMd, baseVersion: 1 }))
      .rejects.toMatchObject({ error: { code: 'invalid' } });
    await v2(actor);
    await expect(publishDocumentVersion(actor, ORG.usg, DOCUMENT.usgFundingRules, { bodyMd: 'Other text.', baseVersion: 1 }))
      .rejects.toMatchObject({ error: { code: 'invalid', message: expect.stringContaining('version 2') } });
  }));

  it('the next funding-precheck run reads v2', () => inRolledBackApp(async () => {
    await v2(await avery());
    const run = await runAgent(await actorFor(USER.taylor, ORG.startup), INSTALLATION.startupFundingPrecheck, 'Check our Demo day request.');
    expect(run.reply).toContain('USG Funding Department Guidelines (v2)');
    expect(run.reply).not.toContain('(v1)');
    expect(run.inspector.permitted.find((d) => d.id === DOCUMENT.usgFundingRules)?.version).toBe(2);
    expect(run.inspector.rulePack).toBeUndefined();
  }));

  it('lists USG documents with the agents that read them, for USG admins only', () => inRolledBackApp(async (tx) => {
    const view = await usgDocumentsView(await avery());
    const rules = view?.documents.find((d) => d.id === DOCUMENT.usgFundingRules);
    expect(rules).toMatchObject({ sourceKind: 'rulebook', version: 1 });
    expect(rules?.usedBy.map((u) => u.templateId)).toContain(TEMPLATE.fundingPrecheck);
    // Reviewer notes are usg_internal: only agents whose max tier reaches it are listed.
    const notes = view?.documents.find((d) => d.id === DOCUMENT.reviewerNotes);
    expect(notes?.usedBy.map((u) => u.templateId)).toEqual([TEMPLATE.usgReviewAssistant]);
    expect((await usgDocumentView(await avery(), DOCUMENT.usgFundingRules))?.document.bodyMd).toContain('Section 3');
    expect(await usgDocumentView(await avery(), DOCUMENT.spring2026Budget)).toBeNull();
    await expect(usgDocumentsView(await sam())).rejects.toMatchObject({ error: { code: 'forbidden' } });
    const denied = await tx.select().from(auditEvents).where(and(eq(auditEvents.action, 'authz.denied'), eq(auditEvents.actorUserId, USER.sam)));
    expect(denied.at(-1)?.targetType).toBe('usg_console');
  }));

  it('POST /versions validates the body and returns the version', () => inRolledBackApp(async () => {
    const url = `http://localhost/api/orgs/${ORG.usg}/documents/${DOCUMENT.usgFundingRules}/versions`;
    const headers = { cookie: `${PERSONA_COOKIE}=${USER.avery}; ${ACTIVE_ORG_COOKIE}=${ORG.usg}`, 'content-type': 'application/json' };
    const ctx = { params: Promise.resolve({ orgId: ORG.usg, documentId: DOCUMENT.usgFundingRules }) };
    const post = (body: unknown) => versionsRoute.POST(new Request(url, { method: 'POST', headers, body: JSON.stringify(body) }), ctx);
    expect((await post({ bodyMd: '   ', baseVersion: 1 })).status).toBe(400);
    expect((await post({ bodyMd: 'New text.' })).status).toBe(400);
    const ok = await post({ bodyMd: 'New text.', baseVersion: 1 });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ version: 2 });
  }));
});
