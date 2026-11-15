import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getActor } from '@/lib/identity';
import type { Actor } from '@/lib/contracts';
import PublicAgentPage from '@/app/directory/[installationId]/page';
import { INSTALLATION, USER } from '@db/seed/ids';
import { appSql, closeAppDb } from './db';

vi.mock('@/lib/identity', async (original) => ({ ...await original<typeof import('@/lib/identity')>(), getActor: vi.fn() }));
const lee: Actor = { userId: USER.lee, activeOrgId: null, positions: [], grants: ['*'] };
const probe = await appSql();
await probe?.end();
afterAll(async () => { if (probe) await closeAppDb(); });
beforeEach(() => vi.mocked(getActor).mockResolvedValue(lee));
const renderPage = async (installationId: string) => renderToStaticMarkup(await PublicAgentPage({ params: Promise.resolve({ installationId }) }));

describe.skipIf(!probe)('shared directory chat', () => {
  it('asks a signed-out viewer to sign in', async () => {
    vi.mocked(getActor).mockResolvedValue({ ...lee, userId: null });
    expect(await renderPage(INSTALLATION.danceShowcaseQa)).toContain('Sign in to run an agent');
  });
  it('loads the real public scope, models and allowance into the shared workspace', async () => {
    const html = await renderPage(INSTALLATION.danceShowcaseQa);
    expect(html).toMatch(/<h1[^>]*>Showcase Q&amp;A<\/h1>/);
    expect(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).toMatch(/Dance Club · v\d+ · Events Performances/);
    expect(html).toContain('Demo model: gpt-6-luna');
    expect(html).toContain('Run details');
    expect(html).not.toMatch(/All students|Template v|Only you can see/);
    expect(html).not.toContain('Sponsor contacts');
  });
  it.each([INSTALLATION.startupHandoff, INSTALLATION.startupRecruitingQa])('does not expose a nonpublic or disabled agent (%s)', async (id) => {
    const html = await renderPage(id);
    expect(html).toContain('Agent unavailable');
    expect(html).not.toContain('name="input"');
    expect(html).not.toContain('Club handoff');
  });
});
