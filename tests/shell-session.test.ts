import { afterEach, describe, expect, it, vi } from 'vitest';
import { changeSession, SessionChangeError, type SessionChange } from '@/components/shell/session-request';

afterEach(() => vi.unstubAllGlobals());

describe('shell session confirmation', () => {
  const cases: readonly { change: SessionChange; response: unknown }[] = [
    { change: { kind: 'persona', userId: 'taylor' }, response: { userId: 'taylor' } },
    { change: { kind: 'persona', userId: null }, response: { userId: null } },
    { change: { kind: 'org', orgId: 'archery' }, response: { activeOrgId: 'archery' } },
  ];

  it.each(cases)('accepts a matching server confirmation for $change', async ({ change, response }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(response)));
    await expect(changeSession(change)).resolves.toBeUndefined();
  });

  it.each([
    { change: { kind: 'persona', userId: 'taylor' }, response: { userId: 'sam' } },
    { change: { kind: 'org', orgId: 'archery' }, response: { activeOrgId: 'startup' } },
    { change: { kind: 'persona', userId: null }, response: { userId: 'sam' } },
  ] satisfies readonly { change: SessionChange; response: unknown }[])(
    'rejects a success response that confirms a different session', async ({ change, response }) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(response)));
      await expect(changeSession(change)).rejects.toMatchObject({ code: 'invalid_response' });
    },
  );

  it('surfaces the server denial instead of treating a rejected club change as success', async () => {
    const message = 'Membership has ended.';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message }, { status: 403 })));
    await expect(changeSession({ kind: 'org', orgId: 'archery' })).rejects.toMatchObject({ code: 'rejected', message });
  });

  it('makes a network failure retryable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('connection closed')));
    await expect(changeSession({ kind: 'persona', userId: 'taylor' })).rejects.toMatchObject({ code: 'network' });
  });

  it('rejects malformed success JSON without authorizing navigation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>not JSON</html>')));
    await expect(changeSession({ kind: 'persona', userId: 'taylor' })).rejects.toBeInstanceOf(SessionChangeError);
  });

  it('makes a response interrupted after headers retryable', async () => {
    const body = new ReadableStream({ start(controller) { controller.error(new DOMException('Timed out', 'AbortError')); } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
    await expect(changeSession({ kind: 'persona', userId: 'taylor' })).rejects.toMatchObject({ code: 'network' });
  });

  it('handles a plain-text server failure as a session error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Unavailable', { status: 503 })));
    await expect(changeSession({ kind: 'persona', userId: 'taylor' })).rejects.toMatchObject({ code: 'rejected' });
  });
});
