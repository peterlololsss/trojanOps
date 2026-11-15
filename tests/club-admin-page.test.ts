// Owner: B (WP-7). The club admin page's view logic: what a budget row says before and after D5,
// and what the succession confirmation promises before D7 is sent.
import { afterAll, describe, expect, it } from 'vitest';
import {
  agentsForPosition, budgetExplanation, budgetSaved, clubBudget, dollars, holderLabel, memberBudget,
  parseDollars, transferConfirmation, transferState, transferUnavailable,
} from '@/app/org/[orgId]/admin/admin-view';
import {
  clubAdmin, transferCandidates, effectiveAgent, canUse,
  type CatalogEntry, type ClubAdmin, type ClubMember, type ClubPosition,
} from '@/lib/distribution';
import { ORG, USER, INSTALLATION, DOCUMENT } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp } from './db';

import { transferPosition } from '@/lib/lifecycle/transfer';
import { capGrants, grantsFor } from '@/lib/authz';
import { listAccessibleDocuments } from '@/lib/documents/access';

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
  memberModels: { fixed: null, defaultClass: 'standard', allowed: ['economy', 'standard'] },
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
      .toBe("Startup Club has used its 500 credits for this month. They reset Dec 1. USG can raise the club's budget.");
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
    expect(copy.points.at(-1)).toBe('No document, installation or budget is edited.');
  });

  // Document grants follow the position (§5 allowed_positions), so officer documents move even
  // through an agent whose audience is "All members" — the agent list above does not cover them.
  it('describes the transferred grant without promising complete document access or revocation', () => {
    const text = copy.points.join(' ');
    expect(text).toContain('position grant');
    expect(text).toContain('Other positions');
    expect(text).toContain("sources and max tier still apply");
    expect(text).not.toContain('will not.');
  });

  it('counts only the agents the position actually opens', () => {
    expect(agentsForPosition([agent(), agent({ installationId: 'i-handoff', audience: 'members', usableBy: [] })], 'treasurer'))
      .toHaveLength(1);
    // A turned-off agent gives nobody access, so a succession does not move it.
    expect(agentsForPosition([agent({ status: 'disabled' })], 'treasurer')).toHaveLength(0);
    expect(transferConfirmation(club({ agents: [] }), position(), jordan).points[1])
      .toBe('Jordan Reyes gains no additional enabled agents.');
  });

  it('does not promise an agent the new holder can already run', () => {
    const president = member({
      userId: 'u-sam', displayName: 'Sam Okafor',
      positions: [{ slug: 'member', name: 'Member' }, { slug: 'president', name: 'President' }],
    });
    const points = transferConfirmation(club({ members: [president, member()] }), position(), president).points;
    expect(points[1]).toBe('Sam Okafor gains no additional enabled agents.');
  });

  it('does not claim a loss the outgoing holder keeps through another position', () => {
    const both = member({
      positions: [{ slug: 'treasurer', name: 'Treasurer' }, { slug: 'president', name: 'President' }],
    });
    const points = transferConfirmation(club({ members: [jordan, both] }), position(), jordan).points;
    expect(points[2]).toBe('Taylor Brooks keeps access to the same enabled agents.');
  });

  it('includes member access lost with the last office even when no position agent is enabled', () => {
    const sam = member({ userId: 'u-sam', displayName: 'Sam', positions: [{ slug: 'president', name: 'President' }] });
    const presidency = position({ slug: 'president', name: 'President', holders: [{ userId: sam.userId, displayName: sam.displayName }] });
    const agents = [agent({ status: 'retired' }),
      agent({ installationId: 'handoff', name: 'Club handoff', audience: 'members', usableBy: [] }),
      agent({ installationId: 'public', name: 'Recruiting Q&A', audience: 'public', usableBy: [], maxTier: 'public' }),
      agent({ installationId: 'paused', name: 'Paused agent', audience: 'members', usableBy: [], status: 'disabled' })];
    const points = transferConfirmation(club({ members: [sam, jordan], agents }), presidency, jordan).points;
    expect(points).toContain('Sam loses Club handoff.');
    expect(points.join(' ')).not.toContain("nobody's agents change");
    expect(points.join(' ')).not.toContain('loses Recruiting Q&A');
    expect(points.join(' ')).not.toContain('Paused agent');
    expect(points.join(' ')).not.toContain('Funding pre-check');
  });

  it('handles a vacant office without inventing an outgoing holder', () => {
    const points = transferConfirmation(club(), position({ holders: [] }), jordan).points;
    expect(points[0]).toBe('Jordan Reyes becomes Treasurer of Startup Club. No one holds it today.');
    // The documents sentence names no outgoing holder either.
    expect(points.join(' ')).toContain('Jordan Reyes gains the Treasurer position grant');
    expect(points.join(' ')).not.toContain('loses that position grant');
    expect(points.join(' ')).not.toContain('will not.');
    expect(points).toHaveLength(4);
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


// Regressions for PR #27 review: confirmation must match actual membership/RLS behavior.
describe.skipIf(!probe)('succession confirmation · permission regressions', () => {
  it('does not promise document revocation when the outgoing holder retains President', () => inRolledBackApp(async () => {
    await transferPosition(await actorFor(USER.sam, ORG.startup), ORG.startup, 'treasurer', USER.sam);
    const data = (await clubAdmin(await actorFor(USER.sam, ORG.startup), ORG.startup))!;
    const outgoingOffice = data.positions.find(p => p.slug === 'treasurer')!;
    const recipient = data.members.find(m => m.userId === USER.jordan)!;
    const confirmation = transferConfirmation(data, outgoingOffice, recipient);
    expect(confirmation.points.join(' ')).not.toContain('Sam will not.');
    await transferPosition(await actorFor(USER.sam, ORG.startup), ORG.startup, 'treasurer', USER.jordan);
    const actor = await actorFor(USER.sam, ORG.startup);
    const agent = await effectiveAgent(INSTALLATION.startupHandoff);
    const grants = capGrants(await grantsFor(USER.sam, ORG.startup), ORG.startup, agent.maxTier);
    const documents = await listAccessibleDocuments(actor, grants, agent);
    expect(documents.some(d => d.id === DOCUMENT.spring2026Budget)).toBe(true);
  }));

  it('names the members agent actually lost when the outgoing president has no memberships left', () => inRolledBackApp(async () => {
    const data = (await clubAdmin(await actorFor(USER.sam, ORG.startup), ORG.startup))!;
    const confirmation = transferConfirmation(data, data.positions.find(p => p.slug === 'president')!, data.members.find(m => m.userId === USER.jordan)!);
    const handoff = await effectiveAgent(INSTALLATION.startupHandoff);
    expect((await canUse(USER.sam, handoff)).ok).toBe(true);
    expect(confirmation.points.some(p => p.startsWith('Sam loses ') && p.includes('Club handoff'))).toBe(true);
    await transferPosition(await actorFor(USER.sam, ORG.startup), ORG.startup, 'president', USER.jordan);
    expect((await canUse(USER.sam, handoff)).ok).toBe(false);
  }));
});
