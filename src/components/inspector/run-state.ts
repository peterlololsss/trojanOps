// Owner: C (WP-9). State for <RunWorkspace />: the transcript, the run in flight, its error and each
// pending action's status. Pure, so tests cover it without a browser.
// The transcript lives in memory only: no browser storage and no history reload, because a run's
// input and output are private to the user who ran it (I15).
import type { ApiError, RunInspector, RunResult } from '@/lib/contracts';

export type Turn =
  | { kind: 'you'; key: string; text: string }
  | { kind: 'agent'; key: string; result: RunResult };

/** A pending write action (I6) as the run page shows it. `rejected` is dismissed in this browser only:
 * the row stays pending on the server, so nothing ever runs.
 * TODO(verify): switch Reject to POST /api/pending-actions/:id/reject once stream A adds it (requested). */
export type ActionStatus =
  | { status: 'pending' }
  | { status: 'confirming' }
  | { status: 'confirmed' }
  | { status: 'rejected' }
  /** `retry` is false when the gateway refused for good (forbidden, already handled, not found): the
   * card then drops Confirm. It is true for network errors and server failures. */
  | { status: 'failed'; message: string; retry: boolean };

export interface RunState {
  turns: Turn[];
  /** A run is in flight: the progress region reads "Checking access". */
  running: boolean;
  error: ApiError | null;
  actions: Record<string, ActionStatus>;
}

export type RunEvent =
  | { type: 'submit'; text: string }
  | { type: 'succeeded'; result: RunResult }
  | { type: 'failed'; error: ApiError }
  | { type: 'dismiss_error' }
  | { type: 'confirm_started'; id: string }
  | { type: 'confirmed'; id: string }
  | { type: 'confirm_failed'; id: string; message: string; retry: boolean }
  | { type: 'rejected'; id: string };

export const initialRunState: RunState = { turns: [], running: false, error: null, actions: {} };

function setAction(state: RunState, id: string, next: ActionStatus, from: Array<ActionStatus['status']>): RunState {
  const current = state.actions[id];
  if (!current || !from.includes(current.status)) return state;
  return { ...state, actions: { ...state.actions, [id]: next } };
}

/** Confirm is offered while the action is pending, or after a failure worth retrying. */
export function canConfirm(status: ActionStatus | undefined): boolean {
  return status?.status === 'pending' || (status?.status === 'failed' && status.retry);
}

export function runReducer(state: RunState, event: RunEvent): RunState {
  switch (event.type) {
    case 'submit':
      if (state.running) return state;
      return {
        ...state,
        turns: [...state.turns, { kind: 'you', key: `you-${state.turns.length}`, text: event.text }],
        running: true,
        error: null,
      };
    case 'succeeded': {
      const actions = { ...state.actions };
      for (const a of event.result.pendingActions) actions[a.id] = { status: 'pending' };
      return {
        ...state,
        turns: [...state.turns, { kind: 'agent', key: event.result.runId, result: event.result }],
        running: false,
        actions,
      };
    }
    case 'failed':
      return { ...state, running: false, error: event.error };
    case 'dismiss_error':
      return { ...state, error: null };
    case 'confirm_started':
      return canConfirm(state.actions[event.id]) ? setAction(state, event.id, { status: 'confirming' }, ['pending', 'failed']) : state;
    case 'confirmed':
      return setAction(state, event.id, { status: 'confirmed' }, ['confirming']);
    case 'confirm_failed':
      return setAction(state, event.id, { status: 'failed', message: event.message, retry: event.retry }, ['confirming']);
    case 'rejected':
      return setAction(state, event.id, { status: 'rejected' }, ['pending', 'failed']);
  }
}

/** The inspector of the most recent run, or null before the first one. */
export function latestInspector(state: RunState): RunInspector | null {
  for (let i = state.turns.length - 1; i >= 0; i--) {
    const turn = state.turns[i];
    if (turn.kind === 'agent') return turn.result.inspector;
  }
  return null;
}

const CODES: ReadonlyArray<ApiError['code']> = ['unauthenticated', 'forbidden', 'quota_exceeded', 'clamp_violation', 'not_found', 'invalid'];

/** The ApiError in a failed response body, or a generic one when the body is not an ApiError. */
export function apiErrorFrom(body: unknown, fallback: string): ApiError {
  if (typeof body === 'object' && body !== null) {
    const { code, message, cap } = body as Record<string, unknown>;
    if (typeof code === 'string' && (CODES as string[]).includes(code) && typeof message === 'string') {
      return { code: code as ApiError['code'], message, ...(typeof cap === 'object' && cap !== null ? { cap: cap as ApiError['cap'] } : {}) };
    }
  }
  return { code: 'invalid', message: fallback };
}

/** The response a request needs: `fetch`, or a stub in tests. */
export type FetchJson = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

async function postJson(fetchFn: FetchJson, url: string, body: unknown): Promise<{ ok: boolean; body: unknown }> {
  const res = await fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const parsed: unknown = await res.json().catch(() => undefined);
  return { ok: res.ok, body: parsed };
}

function isRunResult(body: unknown): body is RunResult {
  if (typeof body !== 'object' || body === null) return false;
  const r = body as Partial<RunResult>;
  return typeof r.runId === 'string' && typeof r.reply === 'string' && Array.isArray(r.citations)
    && Array.isArray(r.pendingActions) && typeof r.inspector === 'object' && r.inspector !== null;
}

/** One run through the gateway's route (I5): POST /api/agents/:installationId/runs { input }. */
export async function requestRun(fetchFn: FetchJson, installationId: string, input: string, fallback: string): Promise<RunEvent> {
  try {
    const res = await postJson(fetchFn, `/api/agents/${encodeURIComponent(installationId)}/runs`, { input });
    if (res.ok && isRunResult(res.body)) return { type: 'succeeded', result: res.body };
    return { type: 'failed', error: apiErrorFrom(res.ok ? undefined : res.body, fallback) };
  } catch {
    return { type: 'failed', error: apiErrorFrom(undefined, fallback) };
  }
}

/** A human confirms a pending write action (I6): POST /api/pending-actions/:id/confirm with `{}`.
 * An ApiError from the gateway is final; a network error or a non-JSON failure can be retried. */
export async function requestConfirm(fetchFn: FetchJson, id: string, fallback: string): Promise<RunEvent> {
  try {
    const res = await postJson(fetchFn, `/api/pending-actions/${encodeURIComponent(id)}/confirm`, {});
    if (res.ok) return { type: 'confirmed', id };
    const error = apiErrorFrom(res.body, '');
    return error.message
      ? { type: 'confirm_failed', id, message: error.message, retry: false }
      : { type: 'confirm_failed', id, message: fallback, retry: true };
  } catch {
    return { type: 'confirm_failed', id, message: fallback, retry: true };
  }
}

/** Citations of one run with document titles from its inspector. A citation whose document is not
 * in the run's permitted list is dropped (the gateway already filters them, §7 step 8). */
export function citedSources(result: RunResult): Array<{ documentId: string; title: string; quote: string }> {
  const titles = new Map<string, string>([
    ...result.inspector.permitted.map((d) => [d.id, d.title] as const),
    ...result.inspector.readInRun.map((d) => [d.id, d.title] as const),
  ]);
  return result.citations.flatMap((c) => {
    const title = titles.get(c.documentId);
    return title === undefined ? [] : [{ documentId: c.documentId, title, quote: c.quote }];
  });
}
