// Owner: C (WP-9). The run page's data (getRunPageData) against the seed as trojanops_app, and the
// run workspace's state (run-state.ts). The DB suite needs a seeded database (pnpm db:reset) and is
// skipped when it is unreachable. Markup tests are in tests/run-page-render.test.ts.
import { afterAll, describe, expect, it } from 'vitest';
import {
  apiErrorFrom, canConfirm, citedSources, initialRunState, latestInspector, requestConfirm, requestReject, requestRun, runReducer,
  type FetchJson, type RunEvent, type RunState,
} from '@/components/inspector/run-state';
import { AppError, type RunResult } from '@/lib/contracts';
import { effectiveAgent } from '@/lib/distribution';
import { getRunPageData } from '@/lib/documents/run-page';
import { runAgent } from '@/lib/gateway';
import { DOCUMENT, INSTALLATION, ORG, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp } from './db';

const sql = await appSql();
afterAll(async () => { await sql?.end(); if (sql) await closeAppDb(); });

describe.skipIf(!sql)('getRunPageData', () => {
  const page = async (userId: string, activeOrgId: string | null, orgId: string, installationId: string) =>
    getRunPageData(await actorFor(userId, activeOrgId), orgId, installationId);

  it('lets a member run a members agent in the active club', async () => {
    const data = await page(USER.sam, ORG.startup, ORG.startup, INSTALLATION.startupHandoff);
    expect(data?.access).toEqual({ kind: 'ok' });
    expect(data?.org.id).toBe(ORG.startup);
    expect(data?.agent).toMatchObject({ installationId: INSTALLATION.startupHandoff, audience: 'members', audienceLabel: 'All members' });
    expect(data?.demoRuntime).toBe(true);
  });

  it('names the positions of a positions agent, in its club', async () => {
    const data = await page(USER.taylor, ORG.startup, ORG.startup, INSTALLATION.startupFundingPrecheck);
    expect(data?.access).toEqual({ kind: 'ok' });
    expect(data?.agent?.audienceLabel).toBe('Treasurer, President');
  });

  it('reports a member outside the audience', async () => {
    const data = await page(USER.casey, ORG.startup, ORG.startup, INSTALLATION.startupFundingPrecheck);
    expect(data?.access).toEqual({ kind: 'not_in_audience' });
  });

  it('asks a member to switch clubs for an internal agent', async () => {
    // Morgan is a Startup member, acting in Archery.
    const data = await page(USER.morgan, ORG.archery, ORG.startup, INSTALLATION.startupHandoff);
    expect(data?.access).toEqual({ kind: 'switch_org' });
  });

  it('shows a non-member nothing about an internal agent', async () => {
    for (const installationId of [INSTALLATION.startupHandoff, INSTALLATION.startupFundingPrecheck]) {
      const data = await page(USER.lee, null, ORG.startup, installationId);
      expect(data).toEqual({ org: { id: ORG.startup, name: expect.any(String) }, demoRuntime: true, access: { kind: 'not_member' }, agent: null });
    }
    // A USG admin is not a Startup member either.
    expect((await page(USER.avery, ORG.usg, ORG.startup, INSTALLATION.startupHandoff))?.access).toEqual({ kind: 'not_member' });
  });

  it('describes a public agent to anyone, even when it is turned off', async () => {
    const data = await page(USER.lee, null, ORG.startup, INSTALLATION.startupRecruitingQa);
    expect(data?.access).toMatchObject({ kind: 'unavailable', reason: 'disabled' });
  });

  it('lets any signed-in student run a public agent from no club', async () => {
    const data = await page(USER.lee, null, ORG.dance, INSTALLATION.danceShowcaseQa);
    expect(data?.access).toEqual({ kind: 'ok' });
    expect(data?.agent?.audienceLabel).toBe('All students');
  });

  it('reports an installation that is turned off', async () => {
    const data = await page(USER.sam, ORG.startup, ORG.startup, INSTALLATION.startupRecruitingQa);
    expect(data?.access).toMatchObject({ kind: 'unavailable', reason: 'disabled' });
    expect(data?.access.kind === 'unavailable' && data.access.message).toMatch(/is turned off in Startup/);
  });

  it('returns null for another club’s installation, an unknown one, or a bad id', async () => {
    expect(await page(USER.sam, ORG.startup, ORG.archery, INSTALLATION.startupHandoff)).toBeNull();
    expect(await page(USER.sam, ORG.startup, ORG.startup, DOCUMENT.recruitingFaq)).toBeNull();
    expect(await page(USER.sam, ORG.startup, ORG.startup, 'not-a-uuid')).toBeNull();
    expect(await page(USER.sam, ORG.startup, 'not-a-uuid', INSTALLATION.startupHandoff)).toBeNull();
  });

  it('needs a signed-in user', async () => {
    const signedOut = { userId: null, activeOrgId: null, positions: [], grants: [] };
    await expect(getRunPageData(signedOut, ORG.startup, INSTALLATION.startupHandoff)).rejects.toBeInstanceOf(AppError);
  });

  it('returns no run input or output', async () => {
    const data = await page(USER.sam, ORG.startup, ORG.startup, INSTALLATION.startupHandoff);
    expect(Object.keys(data ?? {}).sort()).toEqual(['access', 'agent', 'demoRuntime', 'org']);
  });

  // The page's pre-check repeats gateway steps 1–2. It must say `ok` exactly when runAgent gets past
  // them; a quota block (step 4) still counts as past them.
  it('agrees with runAgent on who may run what', async () => {
    const cases: Array<[keyof typeof USER, keyof typeof ORG | null, keyof typeof INSTALLATION]> = [
      ['sam', 'startup', 'startupHandoff'],
      ['sam', 'startup', 'startupRecruitingQa'],
      ['taylor', 'startup', 'startupFundingPrecheck'],
      ['casey', 'startup', 'startupFundingPrecheck'],
      ['casey', 'startup', 'startupHandoff'],
      ['morgan', 'archery', 'startupHandoff'],
      ['morgan', 'startup', 'startupFundingPrecheck'],
      ['lee', null, 'startupHandoff'],
      ['lee', null, 'startupRecruitingQa'],
      ['lee', null, 'danceShowcaseQa'],
      ['avery', 'usg', 'usgReviewAssistant'],
      ['avery', 'usg', 'startupHandoff'],
    ];
    for (const [user, org, installation] of cases) {
      await inRolledBackApp(async () => {
        const actor = await actorFor(USER[user], org ? ORG[org] : null);
        const orgId = (await effectiveAgent(INSTALLATION[installation])).orgId;
        const data = await getRunPageData(actor, orgId, INSTALLATION[installation]);
        const refused = await runAgent(actor, INSTALLATION[installation], 'x').then(
          () => false,
          (error: unknown) => {
            if (error instanceof AppError && error.error.code === 'quota_exceeded') return false;
            if (error instanceof AppError && error.error.code === 'forbidden') return true;
            throw error;
          },
        );
        expect({ user, installation, ok: data?.access.kind === 'ok' }).toEqual({ user, installation, ok: !refused });
      });
    }
  });
});

const result = (runId: string, overrides: Partial<RunResult> = {}): RunResult => ({
  runId,
  reply: 'I can read 2 documents.',
  citations: [{ documentId: 'doc-1', quote: 'First sentence.' }, { documentId: 'doc-x', quote: 'Not readable.' }],
  pendingActions: [],
  inspector: {
    runGrants: [{ grant: `${ORG.startup}:*`, label: 'Startup Club · Member' }],
    sources: [{ id: 'src-1', name: 'Minutes' }],
    permitted: [{ id: 'doc-1', title: 'Fall kickoff minutes', tier: 'members' }, { id: 'doc-2', title: 'Recruiting FAQ', tier: 'public' }],
    readInRun: [{ id: 'doc-1', title: 'Fall kickoff minutes' }],
    templateVersion: 1,
    billedClub: 'Startup Club',
    costMicro: 10_000,
    quotaRemainingMicro: { 'Startup Club': 490_000 },
    auditEventId: 42,
  },
  ...overrides,
});

const play = (...events: RunEvent[]): RunState => events.reduce(runReducer, initialRunState);

describe('run workspace state', () => {
  it('records the question, runs, then records the answer and its inspector', () => {
    const asked = play({ type: 'submit', text: 'What did we decide?' });
    expect(asked.running).toBe(true);
    expect(asked.turns).toEqual([{ kind: 'you', key: 'you-0', text: 'What did we decide?' }]);
    expect(latestInspector(asked)).toBeNull();

    const answered = runReducer(asked, { type: 'succeeded', result: result('run-1') });
    expect(answered.running).toBe(false);
    expect(answered.turns.map((t) => t.kind)).toEqual(['you', 'agent']);
    expect(latestInspector(answered)?.auditEventId).toBe(42);
  });

  it('ignores a second submit while a run is in flight', () => {
    const state = play({ type: 'submit', text: 'one' }, { type: 'submit', text: 'two' });
    expect(state.turns).toHaveLength(1);
  });

  it('shows the latest run’s inspector', () => {
    const second = result('run-2');
    second.inspector = { ...second.inspector, auditEventId: 43 };
    const state = play(
      { type: 'submit', text: 'a' }, { type: 'succeeded', result: result('run-1') },
      { type: 'submit', text: 'b' }, { type: 'succeeded', result: second },
    );
    expect(latestInspector(state)?.auditEventId).toBe(43);
  });

  it('keeps a quota block as an error and clears it on the next submit', () => {
    const blocked = play(
      { type: 'submit', text: 'a' },
      { type: 'failed', error: { code: 'quota_exceeded', message: 'Your monthly AI quota in Startup Club is used up ($0.00 of $0.00). Ask your president to raise it.', cap: { scope: 'member' } } },
    );
    expect(blocked.running).toBe(false);
    expect(blocked.error?.code).toBe('quota_exceeded');
    expect(blocked.turns.map((t) => t.kind)).toEqual(['you']);
    expect(runReducer(blocked, { type: 'submit', text: 'b' }).error).toBeNull();
    expect(runReducer(blocked, { type: 'dismiss_error' }).error).toBeNull();
  });

  it('tracks each pending action through confirm, failure and reject', () => {
    const run = result('run-1', { pendingActions: [{ id: 'pa-1', tool: 'submit_to_queue' }, { id: 'pa-2', tool: 'submit_to_queue' }] });
    let state = play({ type: 'submit', text: 'a' }, { type: 'succeeded', result: run });
    expect(state.actions).toEqual({ 'pa-1': { status: 'pending' }, 'pa-2': { status: 'pending' } });

    state = runReducer(state, { type: 'confirm_started', id: 'pa-1' });
    state = runReducer(state, { type: 'confirm_failed', id: 'pa-1', message: 'Could not confirm this action.', retry: true });
    expect(state.actions['pa-1']).toEqual({ status: 'failed', message: 'Could not confirm this action.', retry: true });
    expect(canConfirm(state.actions['pa-1'])).toBe(true);
    state = runReducer(state, { type: 'confirm_started', id: 'pa-1' });
    state = runReducer(state, { type: 'confirmed', id: 'pa-1' });
    expect(state.actions['pa-1']).toEqual({ status: 'confirmed' });

    state = runReducer(state, { type: 'rejected', id: 'pa-2' });
    expect(state.actions['pa-2']).toEqual({ status: 'rejected' });
    // Settled actions don't move again, and unknown ids change nothing.
    expect(runReducer(state, { type: 'confirm_started', id: 'pa-2' })).toBe(state);
    expect(runReducer(state, { type: 'rejected', id: 'pa-1' })).toBe(state);
    expect(runReducer(state, { type: 'confirmed', id: 'pa-9' })).toBe(state);
  });

  it('offers no second confirm after a refusal from the gateway', () => {
    const run = result('run-1', { pendingActions: [{ id: 'pa-1', tool: 'submit_to_queue' }] });
    let state = play({ type: 'submit', text: 'a' }, { type: 'succeeded', result: run }, { type: 'confirm_started', id: 'pa-1' });
    state = runReducer(state, { type: 'confirm_failed', id: 'pa-1', message: 'You cannot confirm this action.', retry: false });
    expect(canConfirm(state.actions['pa-1'])).toBe(false);
    expect(runReducer(state, { type: 'confirm_started', id: 'pa-1' })).toBe(state);
    expect(runReducer(state, { type: 'rejected', id: 'pa-1' }).actions['pa-1']).toEqual({ status: 'rejected' });
  });

  it('reads an ApiError body and falls back for anything else', () => {
    expect(apiErrorFrom({ code: 'forbidden', message: 'Switch to Startup Club to use Club handoff.' }, 'x'))
      .toEqual({ code: 'forbidden', message: 'Switch to Startup Club to use Club handoff.' });
    expect(apiErrorFrom({ code: 'quota_exceeded', message: 'm', cap: { scope: 'member' } }, 'x').cap).toEqual({ scope: 'member' });
    expect(apiErrorFrom({ code: 'teapot', message: 'm' }, 'Could not run.')).toEqual({ code: 'invalid', message: 'Could not run.' });
    expect(apiErrorFrom(null, 'Could not run.')).toEqual({ code: 'invalid', message: 'Could not run.' });
  });

  it('titles citations from the run’s inspector and drops unknown documents', () => {
    expect(citedSources(result('run-1'))).toEqual([{ documentId: 'doc-1', title: 'Fall kickoff minutes', quote: 'First sentence.' }]);
  });
});

describe('run workspace requests', () => {
  type Call = { url: string; init: Parameters<FetchJson>[1] };
  const stub = (ok: boolean, body: unknown, calls: Call[] = []): FetchJson => async (url, init) => {
    calls.push({ url, init });
    return { ok, json: async () => (body === undefined ? Promise.reject(new SyntaxError('not JSON')) : body) };
  };

  it('posts the input as JSON to the gateway route', async () => {
    const calls: Call[] = [];
    const event = await requestRun(stub(true, result('run-1'), calls), INSTALLATION.startupHandoff, 'What did we decide?', 'fallback');
    expect(calls).toEqual([{
      url: `/api/agents/${INSTALLATION.startupHandoff}/runs`,
      init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: 'What did we decide?' }) },
    }]);
    expect(event).toMatchObject({ type: 'succeeded', result: { runId: 'run-1' } });
  });

  it('turns an ApiError, a non-RunResult 200 and a network failure into errors', async () => {
    const quota = { code: 'quota_exceeded', message: 'Your monthly AI quota in Startup Club is used up ($0.00 of $0.00). Ask your president to raise it.', cap: { scope: 'member' } };
    expect(await requestRun(stub(false, quota), 'i', 'x', 'fallback')).toEqual({ type: 'failed', error: quota });
    expect(await requestRun(stub(true, { runId: 'r' }), 'i', 'x', 'fallback')).toEqual({ type: 'failed', error: { code: 'invalid', message: 'fallback' } });
    expect(await requestRun(stub(false, undefined), 'i', 'x', 'fallback')).toEqual({ type: 'failed', error: { code: 'invalid', message: 'fallback' } });
    const down: FetchJson = async () => { throw new TypeError('Failed to fetch'); };
    expect(await requestRun(down, 'i', 'x', 'fallback')).toEqual({ type: 'failed', error: { code: 'invalid', message: 'fallback' } });
  });

  it('confirms with an empty JSON body; a gateway refusal is final, a failed request can be retried', async () => {
    const calls: Call[] = [];
    expect(await requestConfirm(stub(true, { id: 'pa-1', tool: 't', status: 'confirmed' }, calls), 'pa-1', 'fallback'))
      .toEqual({ type: 'confirmed', id: 'pa-1' });
    expect(calls[0]).toEqual({ url: '/api/pending-actions/pa-1/confirm', init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' } });

    expect(await requestConfirm(stub(false, { code: 'forbidden', message: 'You cannot confirm this action.' }), 'pa-1', 'fallback'))
      .toEqual({ type: 'confirm_failed', id: 'pa-1', message: 'You cannot confirm this action.', retry: false });
    expect(await requestConfirm(stub(false, undefined), 'pa-1', 'fallback'))
      .toEqual({ type: 'confirm_failed', id: 'pa-1', message: 'fallback', retry: true });
  });

  it('rejects through the gateway route with an empty JSON body', async () => {
    const calls: Call[] = [];
    expect(await requestReject(stub(true, { id: 'pa-1', tool: 't', status: 'rejected' }, calls), 'pa-1', 'fallback'))
      .toEqual({ type: 'rejected', id: 'pa-1' });
    expect(calls[0]).toEqual({ url: '/api/pending-actions/pa-1/reject', init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' } });
    expect(await requestReject(stub(false, { code: 'forbidden', message: 'You cannot reject this action.' }), 'pa-1', 'fallback'))
      .toEqual({ type: 'reject_failed', id: 'pa-1', message: 'You cannot reject this action.', retry: false });
    const pending: RunState = { ...initialRunState, actions: { 'pa-1': { status: 'pending' } } };
    expect(runReducer(pending, { type: 'reject_failed', id: 'pa-1', message: 'm', retry: true }).actions['pa-1'])
      .toEqual({ status: 'failed', message: 'm', retry: true });
  });
});
