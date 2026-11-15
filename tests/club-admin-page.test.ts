// Owner: B (WP-7). The club admin page's view logic: what a budget row says before and after D5,
// and what the succession confirmation promises before D7 is sent.
import { afterAll, describe, expect, it } from 'vitest';
import {
  agentsForPosition, budgetExplanation, budgetSaved, clubBudget, dollars, holderLabel, memberBudget,
  parseDollars, transferConfirmation, transferState, transferUnavailable,
} from '@/app/org/[orgId]/admin/admin-view';
import {
  clubAdmin, transferCandidates,
  type CatalogEntry, type ClubAdmin, type ClubMember, type ClubPosition,
} from '@/lib/distribution';
import { ORG, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb } from './db';

const USD = 1_000_000;

const member = (patch: Partial<ClubMember> = {}): ClubMember => ({
  userId: 'u-taylor',
  displayName: 'Taylor Brooks',
  positions: [{ slug: 'member', name: 'Member' }, { slug: 'treasurer', name: 'Treasurer' }],
  limitMicro: 5 * USD,
  spentMicro: 0,
  inherited: true,
  ...patch,
});

const position = (patch: Partial<ClubPosition> = {}): ClubPosition => ({
  slug: 'treasurer',
  name: 'Treasurer',
  isOfficer: true,
  holders: [{ userId: 'u-taylor', displayName: 'Taylor Brooks' }],
  ...patch,
});

const agent = (patch: Partial<CatalogEntry> = {}): CatalogEntry => ({
  installationId: 'i-funding',
  templateSlug: 'funding-precheck',
  name: 'Funding pre-check',
  purpose: 'Checks a funding request against USG rules.',
  audience: 'positions',
  usableBy: ['treasurer', 'president'],
  maxTier: 'officers',
  status: 'enabled',
  canPublishPublic: false,
  limitMicro: null,
  templateVersion: 1,
  distribution: 'required',
  updateAvailable: false,
  reasonLabel: null,
  isPublic: false,
  ...patch,
});

const jordan = member({
  userId: 'u-jordan',
  displayName: 'Jordan Reyes',
  positions: [{ slug: 'member', name: 'Member' }],
});

const club = (patch: Partial<ClubAdmin> = {}): ClubAdmin => ({
  org: { id: 'o-startup', name: 'Startup Club' },
  clubLimitMicro: 5 * USD,
  clubSpentMicro: 0,
  positions: [position(), position({ slug: 'member', name: 'Member', isOfficer: false, holders: [
    { userId: 'u-taylor', displayName: 'Taylor Brooks' },
    { userId: 'u-jordan', displayName: 'Jordan Reyes' },
  ] })],
  members: [jordan, member()],
  agents: [agent()],
  ...patch,
});

const probe = await appSql();
await probe?.end();
afterAll(async () => {
  if (probe) await closeAppDb();
});

describe('member budgets · what a row says (D5)', () => {
  it('tells an inherited limit from one set to the same figure', () => {
    expect(memberBudget(member()).limitLabel).toBe('Inheriting $5.00');
    expect(memberBudget(member({ inherited: false })).limitLabel).toBe('Set to $5.00');
  });

  it('reads a $0.00 limit as hers, with no budget left', () => {
    const casey = memberBudget(member({ limitMicro: 0, spentMicro: 0, inherited: false }));
    expect(casey.limitLabel).toBe('Set to $0.00');
    expect(casey).toMatchObject({ percent: 100, left: '$0.00', status: 'blocked', statusLabel: 'No budget left' });
    expect(casey.attention).toBeNull();
  });

  it('earns an attention chip at 80% used, and not before', () => {
    expect(memberBudget(member({ limitMicro: 0.5 * USD, spentMicro: 0.4 * USD })).statusLabel).toBe('80% used');
    expect(memberBudget(member({ limitMicro: 0.5 * USD, spentMicro: 0.39 * USD })).status).toBe('ok');
    expect(memberBudget(member({ limitMicro: 0.5 * USD, spentMicro: 0.39 * USD })).statusLabel).toBe('Within budget');
  });

  it('spells out where the limit comes from before it is changed', () => {
    expect(budgetExplanation(member(), club())[0])
      .toBe("Taylor Brooks has no limit of their own in Startup Club, so every month they may spend the club's whole quota of $5.00.");
    expect(budgetExplanation(member({ inherited: false, limitMicro: 0.5 * USD }), club())[0])
      .toBe("Taylor Brooks's own monthly limit in Startup Club is $0.50.");
    expect(budgetExplanation(member(), club())[2]).toContain('cannot exceed Startup Club');
  });

  it('says what a saved limit of $0.00 does, rather than only the figure', () => {
    expect(budgetSaved(member(), club(), 0))
      .toBe("Taylor Brooks's monthly limit in Startup Club is $0.00. Their next agent run is blocked before the runtime is called.");
    expect(budgetSaved(member(), club(), 0.5 * USD))
      .toBe("Taylor Brooks's monthly limit in Startup Club is $0.50.");
  });
});

describe('the limit field', () => {
  it('reads dollars as micro-USD, zero included', () => {
    expect(parseDollars('0')).toEqual({ micro: 0 });
    expect(parseDollars('0.00')).toEqual({ micro: 0 });
    expect(parseDollars('0.50')).toEqual({ micro: 0.5 * USD });
    expect(parseDollars(' $2.5 ')).toEqual({ micro: 2.5 * USD });
    expect(parseDollars('10')).toEqual({ micro: 10 * USD });
  });

  it('explains an empty field instead of reading it as $0.00', () => {
    expect(parseDollars('')).toEqual({
      error: 'Enter an amount in dollars, such as 0.50. Enter 0.00 to stop this member from running agents.',
    });
  });

  it('says how to fix every other refusal', () => {
    expect(parseDollars('-1')).toMatchObject({ error: expect.stringContaining('cannot be negative') });
    expect(parseDollars('0.123')).toMatchObject({ error: expect.stringContaining('at most two decimal places') });
    expect(parseDollars('a lot')).toMatchObject({ error: expect.stringContaining('dollars and cents') });
  });

  it('prefills the field with the current limit, to the cent', () => {
    expect(dollars(0)).toBe('0.00');
    expect(dollars(5 * USD)).toBe('5.00');
    expect(dollars(0.5 * USD)).toBe('0.50');
  });
});

describe("the club's own quota", () => {
  it('reads as spend against the limit USG set', () => {
    expect(clubBudget(club({ clubSpentMicro: 0.5 * USD }))).toMatchObject({
      percent: 10, spent: '$0.50', limit: '$5.00', left: '$4.50', attention: null, blocked: null,
    });
  });

  it("uses §11's club copy once the club's quota is gone", () => {
    expect(clubBudget(club({ clubSpentMicro: 5 * USD })).blocked)
      .toBe('Startup Club has used its monthly AI quota ($5.00 of $5.00). USG can raise it.');
  });
});

describe('positions · when a transfer is offered (D7)', () => {
  /** The row the page builds: a position and the members the service offers for it. */
  const rowFor = (data: ClubAdmin, p: ClubPosition) =>
    ({ position: p, candidates: transferCandidates(data, p.slug) });

  it('offers it on an officer position someone else could take', () => {
    expect(transferState(rowFor(club(), position()))).toBe('available');
    expect(holderLabel(position())).toBe('Taylor Brooks');
  });

  it('says why it is missing rather than showing a button that would fail', () => {
    const shared = position({ slug: 'member', name: 'Member', isOfficer: false });
    expect(transferState(rowFor(club(), shared))).toBe('shared');
    const contested = position({ holders: [
      { userId: 'u-taylor', displayName: 'Taylor Brooks' },
      { userId: 'u-jordan', displayName: 'Jordan Reyes' },
    ] });
    expect(transferState(rowFor(club(), contested))).toBe('multiple');
    // A president who is the club's only member has nobody to hand the office to.
    const alone = club({ members: [member({ userId: 'u-taylor' })] });
    expect(transferState(rowFor(alone, position()))).toBe('no-candidates');
    expect(transferUnavailable['no-candidates']).toContain('already holds it');
  });

  it('names a vacant office as vacant', () => {
    expect(holderLabel(position({ holders: [] }))).toBe('Vacant');
  });
});

describe('the succession confirmation (D7)', () => {
  const copy = transferConfirmation(club(), position(), jordan);

  it('names who takes the office and who leaves it', () => {
    expect(copy.title).toBe('Transfer Treasurer to Jordan Reyes?');
    expect(copy.points[0]).toBe('Jordan Reyes becomes Treasurer of Startup Club, and Taylor Brooks stops holding it.');
    expect(copy.confirm).toBe('Transfer Treasurer');
  });

  it('names the agents that change hands, and what does not change', () => {
    expect(copy.points[1]).toBe('Jordan Reyes gains Funding pre-check.');
    expect(copy.points[2]).toBe('Taylor Brooks loses Funding pre-check.');
    expect(copy.points.at(-1)).toBe('Documents, installations and budgets do not change.');
  });

  it('counts only the agents the position actually opens', () => {
    expect(agentsForPosition([agent(), agent({ installationId: 'i-handoff', audience: 'members', usableBy: [] })], 'treasurer'))
      .toHaveLength(1);
    // A turned-off agent gives nobody access, so a succession does not move it.
    expect(agentsForPosition([agent({ status: 'disabled' })], 'treasurer')).toHaveLength(0);
    expect(transferConfirmation(club({ agents: [] }), position(), jordan).points[1])
      .toBe("No agent in Startup Club is limited to Treasurer, so nobody's agents change.");
  });

  it('does not promise an agent the new holder can already run', () => {
    const president = member({
      userId: 'u-sam', displayName: 'Sam Okafor',
      positions: [{ slug: 'member', name: 'Member' }, { slug: 'president', name: 'President' }],
    });
    const points = transferConfirmation(club({ members: [president, member()] }), position(), president).points;
    expect(points[1]).toBe('Sam Okafor can already run Funding pre-check through another position, so they gain no agent.');
  });

  it('does not claim a loss the outgoing holder keeps through another position', () => {
    const both = member({
      positions: [{ slug: 'treasurer', name: 'Treasurer' }, { slug: 'president', name: 'President' }],
    });
    const points = transferConfirmation(club({ members: [jordan, both] }), position(), jordan).points;
    expect(points[2]).toBe('Taylor Brooks keeps Funding pre-check through another position.');
  });

  it('handles a vacant office without inventing an outgoing holder', () => {
    const points = transferConfirmation(club(), position({ holders: [] }), jordan).points;
    expect(points[0]).toBe('Jordan Reyes becomes Treasurer of Startup Club. No one holds it today.');
    expect(points).toHaveLength(3);
  });
});

describe.skipIf(!probe)('the admin page on the seeded club', () => {
  it('reads Startup Club’s roster the way the page renders it', async () => {
    const data = await clubAdmin(await actorFor(USER.sam, ORG.startup), ORG.startup);
    const row = (userId: string) => memberBudget(data!.members.find((m) => m.userId === userId)!);
    // §15: Casey carries a $0.50 limit of her own; Taylor has none and reads the club's $5.00.
    expect(row(USER.casey).limitLabel).toBe('Set to $0.50');
    expect(row(USER.taylor).limitLabel).toBe('Inheriting $5.00');
    expect(clubBudget(data!).limit).toBe('$5.00');

    const treasurer = data!.positions.find((p) => p.slug === 'treasurer')!;
    expect(holderLabel(treasurer)).toBe('Taylor');
    expect(transferState({ position: treasurer, candidates: transferCandidates(data!, 'treasurer') }))
      .toBe('available');
    const jordanRow = data!.members.find((m) => m.userId === USER.jordan)!;
    const points = transferConfirmation(data!, treasurer, jordanRow).points;
    expect(points[0]).toBe('Jordan becomes Treasurer of Startup Club, and Taylor stops holding it.');
    expect(points[1]).toBe('Jordan gains Funding pre-check.');
    expect(points[2]).toBe('Taylor loses Funding pre-check.');
  });
});
