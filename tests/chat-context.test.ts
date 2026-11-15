import { afterAll, describe, expect, it } from 'vitest';
import { getRunPageData } from '@/lib/documents/run-page';
import { INSTALLATION, ORG, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb } from './db';

const probe = await appSql();
await probe?.end();
afterAll(async () => { if (probe) await closeAppDb(); });

describe.skipIf(!probe)('chat context before the first run', () => {
  it('shows Casey the binding member allowance and deduplicated scope without document titles', async () => {
    const data = await getRunPageData(await actorFor(USER.casey, ORG.startup), ORG.startup, INSTALLATION.startupHandoff);
    expect(data?.workspace?.quota).toMatchObject({ scope: 'member', limitMicro: 500_000 });
    expect(data?.workspace?.models.allowed.map((m) => m.modelClass).sort()).toEqual(['economy', 'standard']);
    expect(data?.workspace?.scope.grantLabels.filter((label) => label === 'Startup Club · Member')).toHaveLength(1);
    expect(JSON.stringify(data?.workspace)).not.toContain('Meeting minutes 2026-10-08');
    expect(data?.workspace?.starters).toHaveLength(3);
  });
  it('never exposes internal run context to a nonmember', async () => {
    const data = await getRunPageData(await actorFor(USER.lee, null), ORG.startup, INSTALLATION.startupHandoff);
    expect(data?.agent).toBeNull();
    expect(data?.workspace).toBeUndefined();
  });
});
