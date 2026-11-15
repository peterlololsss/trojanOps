import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, describe, expect, it } from 'vitest';
import { UsageView } from '@/app/me/usage/usage-view';
import Loading from '@/app/me/usage/loading';
import UsageError from '@/app/me/usage/error';
import { myUsage } from '@/lib/gateway/usage';
import { runAgent } from '@/lib/gateway';
import { navigationFor } from '@/components/shell/navigation';
import { INSTALLATION, ORG, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp } from './db';

const probe = await appSql();
await probe?.end();
afterAll(async () => { if (probe) await closeAppDb(); });

describe('Usage page states', () => {
  it('offers My agents when there are no runs', () => {
    const html = renderToStaticMarkup(createElement(UsageView, { data: { runs: [], allowances: [], monthlyMicro: 0, blockedAttempts: 0 } }));
    expect(html).toContain('No runs yet.');
    expect(html).toContain('href="/me/agents"');
  });
  it('renders loading and retryable error states', () => {
    expect(renderToStaticMarkup(createElement(Loading))).toContain('Loading usage');
    expect(renderToStaticMarkup(createElement(UsageError, { reset: () => {} }))).toContain('Try again');
  });
});

describe.skipIf(!probe)('real usage rendering', () => {
  it('shows the model, club and credits without the question or answer', () => inRolledBackApp(async () => {
    const actor = await actorFor(USER.casey, ORG.startup);
    const run = await runAgent(actor, INSTALLATION.startupHandoff, 'private usage page question', { modelClass: 'standard' });
    const html = renderToStaticMarkup(createElement(UsageView, { data: await myUsage(actor) }));
    expect(html).toContain('claude-sonnet-5-5');
    expect(html).toContain('Startup Club');
    expect(html).toContain('−3 credits');
    expect(html).toContain('title="$0.03"');
    expect(html).not.toContain('private usage page question');
    expect(html).not.toContain(run.reply);
    expect(navigationFor(actor, [], false)[0].items?.some((i) => i.href === '/me/usage')).toBe(true);
  }));
});
