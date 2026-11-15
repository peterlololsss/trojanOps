// Owner: B (WP-7). The club home and the catalog: the copy the pages promise (who gains access
// before D3's publish, what the quota meter says) and the data each page loads for one viewer.
import { afterAll, describe, expect, it } from 'vitest';
import {
  getClubHome, getMyUsage, getRecentDocuments, RECENT_DOCUMENT_COUNT,
} from '@/app/org/[orgId]/club-home-data';
import { usageSummary } from '@/app/org/[orgId]/club-home-view';
import {
  accessLabel, audienceLabel, publishBudget, publishConfirmation, publishErrorMessage, publishState,
} from '@/app/org/[orgId]/catalog/catalog-view';
import type { Actor, QuotaRemaining } from '@/lib/contracts';
import { catalog, type CatalogEntry } from '@/lib/distribution';
import { ORG, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb } from './db';

const USD = 1_000_000;
const signedOut: Actor = { userId: null, activeOrgId: null, positions: [], grants: [] };

const entry = (patch: Partial<CatalogEntry> = {}): CatalogEntry => ({
  installationId: 'i1',
  templateSlug: 'recruiting-qa',
  name: 'Recruiting Q&A',
  purpose: 'Answers questions about joining Startup Club.',
  audience: 'public',
  usableBy: [],
  maxTier: 'public',
  status: 'disabled',
  canPublishPublic: true,
  limitMicro: null,
  templateVersion: 1,
  distribution: 'optional',
  updateAvailable: false,
  reasonLabel: null,
  isPublic: true,
  ...patch,
});

const usage = (spentMicro: number, limitMicro: number): QuotaRemaining => ({
  scope: 'member', spentMicro, limitMicro, remainingMicro: Math.max(0, limitMicro - spentMicro),
});

const probe = await appSql();
await probe?.end();
afterAll(async () => {
  if (probe) await closeAppDb();
});

describe('catalog rows · what each row says', () => {
  it('names the audience without claiming the viewer may use it', () => {
    expect(audienceLabel(entry())).toBe('All students');
    expect(audienceLabel(entry({ audience: 'members' }))).toBe('All members');
    expect(audienceLabel(entry({ audience: 'positions', usableBy: ['treasurer', 'president'] })))
      .toBe('Treasurer, President');
    expect(audienceLabel(entry({ audience: 'positions' }))).toBe('No positions');
  });

  it('explains a row the viewer cannot run instead of leaving it blank', () => {
    expect(accessLabel(entry({ reasonLabel: 'Treasurer, President', status: 'enabled' }))).toBe('Treasurer, President');
    expect(accessLabel(entry({ status: 'disabled' }))).toBe('Turned off in this club');
    expect(accessLabel(entry({ status: 'retired' }))).toBe('Retired by USG');
    expect(accessLabel(entry({ status: 'enabled' }))).toBe('Not available to you');
  });
});

describe('catalog · when D3’s publish action is offered', () => {
  it('offers it for a public template the club keeps turned off, as the seed has it', () => {
    expect(publishState(entry(), true)).toBe('available');
  });

  it('calls an enabled public agent published, and never offers it to a member', () => {
    expect(publishState(entry({ status: 'enabled' }), true)).toBe('published');
    expect(publishState(entry(), false)).toBeNull();
  });

  it('says a retired template cannot be published rather than offering it', () => {
    expect(publishState(entry({ status: 'retired' }), true)).toBe('retired');
  });

  it('never offers it on an agent the service says could not be published', () => {
    // `handoff`: a members-wide template version, so publishing could only return a clamp violation.
    const internal = entry({
      templateSlug: 'handoff', name: 'Club handoff', audience: 'members', status: 'enabled',
      isPublic: false, canPublishPublic: false,
    });
    expect(publishState(internal, true)).toBe('unavailable');
  });
});

describe('catalog · the publish confirmation (§8)', () => {
  const confirmation = publishConfirmation(entry(), 'Startup Club', 5 * USD);

  it('names who gains access, the tier it may read and the budget it gets', () => {
    expect(confirmation.title).toBe('Publish Recruiting Q&A to all students?');
    expect(confirmation.points[0]).toContain('Anyone signed in with a USC account');
    expect(confirmation.points[1]).toContain('Public tier');
    // No budget of its own yet: half of the club's $5.00 quota, as a figure.
    expect(confirmation.points[2])
      .toBe('Its runs are billed to Startup Club, on a monthly budget of $2.50: half of the club\'s $5.00 quota.');
  });

  it('names the budget the agent already carries instead of the default', () => {
    expect(publishConfirmation(entry({ limitMicro: 2.5 * USD }), 'Startup Club', 5 * USD).points[2])
      .toBe('Its runs are billed to Startup Club, against the monthly budget of $2.50 it already has.');
  });

  it('says a club with no quota cannot publish, rather than offering a $0.00 budget', () => {
    expect(publishConfirmation(entry(), 'Robotics Club', 0).points[2])
      .toBe('Robotics Club has no monthly AI quota yet, so publishing is refused until USG sets one.');
  });

  it('works out the budget from the agent, then from half the club quota', () => {
    expect(publishBudget(entry({ limitMicro: 2.5 * USD }), 5 * USD)).toEqual({ micro: 2.5 * USD, source: 'own' });
    expect(publishBudget(entry(), 5 * USD)).toEqual({ micro: 2.5 * USD, source: 'half' });
  });

  it('warns that publishing also turns a switched-off agent on', () => {
    expect(confirmation.points.at(-1)).toBe('Recruiting Q&A is turned off today. Publishing turns it on.');
    expect(publishConfirmation(entry({ status: 'enabled' }), 'Startup Club', 5 * USD).points).toHaveLength(3);
  });

  it('shows the service’s own message when a publish is refused', async () => {
    const clamp = new Response(JSON.stringify({ code: 'clamp_violation', message: 'Startup Club may not publish agents.' }), { status: 422 });
    await expect(publishErrorMessage(clamp)).resolves.toBe('Startup Club may not publish agents.');
    await expect(publishErrorMessage(new Response('<html>', { status: 500 }))).resolves.toContain('Publishing failed (500)');
  });
});

describe('club home · the quota meter', () => {
  it('reads as spend against a limit, with no chip while there is room', () => {
    const summary = usageSummary(usage(0, 0.5 * USD), 'Startup Club');
    expect(summary).toMatchObject({ percent: 0, spent: '$0.00', limit: '$0.50', left: '$0.50' });
    expect(summary.attention).toBeNull();
    expect(summary.blocked).toBeNull();
  });

  it('earns an attention chip at 80% used', () => {
    expect(usageSummary(usage(0.4 * USD, 0.5 * USD), 'Startup Club').attention).toBe('80% used');
    expect(usageSummary(usage(0.39 * USD, 0.5 * USD), 'Startup Club').attention).toBeNull();
  });

  it('blocks with §11’s member copy once nothing is left, including a $0.00 limit (D5)', () => {
    expect(usageSummary(usage(0, 0), 'Startup Club')).toMatchObject({
      percent: 100,
      attention: null,
      blocked: 'Your monthly AI quota in Startup Club is used up ($0.00 of $0.00). Ask your president to raise it.',
    });
    expect(usageSummary(usage(0.5 * USD, 0.5 * USD), 'Startup Club').blocked)
      .toContain('($0.50 of $0.50)');
  });
});

describe('club home · signed out', () => {
  it('refuses to load page data without a user', async () => {
    await expect(getClubHome(signedOut, ORG.startup)).rejects.toMatchObject({ status: 401 });
    await expect(getMyUsage(signedOut, ORG.startup)).rejects.toMatchObject({ status: 401 });
  });
});

describe.skipIf(!probe)('club home · page data', () => {
  it('gives a member their positions, their own agents and the club’s documents', async () => {
    const home = await getClubHome(await actorFor(USER.casey, ORG.startup), ORG.startup);
    expect(home?.org).toEqual({ id: ORG.startup, name: 'Startup Club' });
    expect(home?.canManage).toBe(false);
    expect(home?.mine?.positionNames).toEqual(['Member']);
    // D4: a member sees the members-wide agent, not the officers' funding pre-check.
    expect(home?.mine?.agents.map((agent) => agent.templateSlug)).toEqual(['handoff']);
    expect(home?.agentCount).toBeGreaterThan(1);

    const recent = await getRecentDocuments(await actorFor(USER.casey, ORG.startup), ORG.startup);
    expect(recent.documents.length).toBeLessThanOrEqual(RECENT_DOCUMENT_COUNT);
    expect(recent.documents.length).toBeLessThanOrEqual(recent.total);
    expect(JSON.stringify(recent.documents)).not.toContain('Spring 2026 budget');
  });

  it('marks the president as able to manage, and the treasurer’s own agents', async () => {
    const sam = await getClubHome(await actorFor(USER.sam, ORG.startup), ORG.startup);
    expect(sam?.canManage).toBe(true);
    const taylor = await getClubHome(await actorFor(USER.taylor, ORG.startup), ORG.startup);
    expect(taylor?.mine?.agents.map((agent) => agent.templateSlug).sort())
      .toEqual(['funding-precheck', 'handoff']);
  });

  it('has no club membership to show a student outside the club', async () => {
    const home = await getClubHome(await actorFor(USER.lee, null), ORG.startup);
    expect(home?.mine).toBeNull();
    expect(home?.canManage).toBe(false);
  });

  it('is not found for an unknown club', async () => {
    expect(await getClubHome(await actorFor(USER.sam, ORG.startup), crypto.randomUUID())).toBeNull();
  });

  it('offers D3’s publish row on the seeded recruiting Q&A alone, and nothing to a non-president', async () => {
    const sam = await actorFor(USER.sam, ORG.startup);
    const startup = await catalog(sam, ORG.startup);
    const offered = startup!.agents
      .filter((agent) => publishState(agent, startup!.canManage) === 'available')
      .map((agent) => agent.templateSlug);
    // Only the template version USG published campus-wide: `handoff` is members-wide, so a button on
    // it could only ever return a clamp violation.
    expect(offered).toEqual(['recruiting-qa']);
    expect(publishState(startup!.agents.find((a) => a.templateSlug === 'handoff')!, true)).toBe('unavailable');

    const dance = await catalog(sam, ORG.dance);
    expect(dance!.agents.every((agent) => publishState(agent, dance!.canManage) === null)).toBe(true);
  });

  it('names the seeded $2.50 budget in the confirmation, not the rule that sets it', async () => {
    const startup = await catalog(await actorFor(USER.sam, ORG.startup), ORG.startup);
    expect(startup!.clubLimitMicro).toBe(5 * USD);
    const recruiting = startup!.agents.find((agent) => agent.templateSlug === 'recruiting-qa')!;
    expect(publishConfirmation(recruiting, startup!.orgName, startup!.clubLimitMicro).points[2])
      .toContain('$2.50');
  });
});
