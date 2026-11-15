import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, type Actor } from '@/lib/contracts';
import { INSTALLATION, USER } from '@db/seed/ids';

vi.mock('@/lib/identity', () => ({ getActor: vi.fn() }));
vi.mock('@/lib/gateway', () => ({ runAgent: vi.fn() }));

import { getActor } from '@/lib/identity';
import { runAgent } from '@/lib/gateway';
import { submitPublicRun } from '@/app/directory/[installationId]/actions';

const lee: Actor = { userId: USER.lee, activeOrgId: null, positions: [], grants: ['*'] };
const question = () => {
  const data = new FormData();
  data.set('question', 'When is the showcase?');
  return data;
};
const submit = (id: string, data = question()) => submitPublicRun(id, USER.lee, { status: 'idle' }, data);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getActor).mockResolvedValue(lee);
});

describe('public run submission boundary', () => {
  it('rejects a signed-out submission before invoking the gateway', async () => {
    vi.mocked(getActor).mockResolvedValue({ ...lee, userId: null, grants: [] });

    const state = await submit(INSTALLATION.danceShowcaseQa);

    expect(state).toMatchObject({ status: 'error', code: 'unauthenticated' });
    expect(runAgent).not.toHaveBeenCalled();
  });

  it('rejects a stale persona form before invoking the gateway', async () => {
    vi.mocked(getActor).mockResolvedValue({ ...lee, userId: USER.casey });

    const state = await submit(INSTALLATION.danceShowcaseQa);

    expect(state).toMatchObject({ status: 'error', code: 'unauthenticated' });
    expect(runAgent).not.toHaveBeenCalled();
  });

  it.each([INSTALLATION.startupHandoff, INSTALLATION.startupRecruitingQa, '00000000-0000-4000-8000-000000000000'])(
    'refuses an installation absent from the current public directory (%s)', async (id) => {
      const state = await submit(id);

      expect(state).toMatchObject({ status: 'error', code: 'not_found' });
      expect(runAgent).not.toHaveBeenCalled();
    },
  );

  it.each(['   ', 'q'.repeat(8001)])('refuses an empty or oversized question', async (input) => {
    const data = question();
    data.set('question', input);

    const state = await submit(INSTALLATION.danceShowcaseQa, data);

    expect(state).toMatchObject({ status: 'error', code: 'invalid' });
    expect(runAgent).not.toHaveBeenCalled();
  });

  it('preserves the gateway quota error and fresh actor at the public boundary', async () => {
    vi.mocked(runAgent).mockRejectedValue(new AppError({
      code: 'quota_exceeded', message: "You've reached today's limit for public agents ($0.05). It resets at midnight PT.",
    }));

    const state = await submit(INSTALLATION.danceShowcaseQa);

    expect(state).toEqual({ status: 'error', code: 'quota_exceeded', message: "You've reached today's limit for public agents ($0.05). It resets at midnight PT." });
    expect(runAgent).toHaveBeenCalledWith(lee, INSTALLATION.danceShowcaseQa, 'When is the showcase?');
  });
});
