import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/demo/clock/route';
import { clock, resetClockForTests } from '@/lib/clock';

vi.mock('@/lib/identity', () => ({ getActor: async () => ({ userId: null, activeOrgId: null, positions: [], grants: [] }) }));
const context = { params: Promise.resolve({}) };
function request(body: string, type = 'application/json') {
  return new Request('http://localhost/api/demo/clock', { method: 'POST', headers: { 'content-type': type }, body });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-14T00:00:00Z'));
  vi.stubEnv('DEMO_MODE', '1');
  vi.stubEnv('DEMO_NOW', '2026-11-15T10:00:00-08:00');
  resetClockForTests();
});
afterEach(() => { resetClockForTests(); vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('demo clock HTTP boundary', () => {
  it('sets the shared clock from an offset timestamp and keeps it advancing', async () => {
    const response = await POST(request(JSON.stringify({ now: '2026-12-01T00:00:00-08:00' })), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ now: '2026-12-01T08:00:00.000Z' });
    vi.advanceTimersByTime(1500);
    expect(clock.now().toISOString()).toBe('2026-12-01T08:00:01.500Z');
  });
  it.each(['0', '', 'true'])('refuses mutation with DEMO_MODE=%s', async (mode) => {
    const original = clock.now().toISOString();
    vi.stubEnv('DEMO_MODE', mode);
    const response = await POST(request('{"now":"2026-12-01T08:00:00Z"}'), context);
    expect(response.status).toBe(404);
    expect(clock.now().toISOString()).toBe(original);
  });
  it.each([
    ['{"now":"2026-02-30T10:00:00Z"}', 'application/json'],
    ['{"now":"2026-11-15T10:00:00"}', 'application/json'],
    ['{"now":"tomorrow"}', 'application/json'],
    ['{"now":"2026-11-15T10:00:00Z","reset":true}', 'application/json'],
    ['{}', 'application/json'], ['{', 'application/json'],
    ['{"now":"2026-11-15T10:00:00Z"}', 'text/plain'],
  ])('rejects invalid input without moving the clock: %s', async (body, type) => {
    const original = clock.now().toISOString();
    const response = await POST(request(body, type), context);
    expect(response.status).toBe(400);
    expect(clock.now().toISOString()).toBe(original);
  });
});
