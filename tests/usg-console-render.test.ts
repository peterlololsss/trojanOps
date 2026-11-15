// Owner: B (WP-6). Markup of the USG rule-pack and template pages, rendered to static HTML in node (no
// browser, no database) from the seeded funding pack: the rule-pack card and its publish review (D6),
// the template summary, and the configuration editor's review.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PackReview, reachSentences } from '@/app/usg/rule-packs/publish-pack-dialog';
import { RulePackCard, UsedBy } from '@/app/usg/rule-packs/rule-pack-card';
import { RulePackExplainer } from '@/app/usg/rule-packs/rule-pack-explainer';
import { AgentSummary } from '@/app/usg/templates/[templateId]/agent-summary';
import { initialState, reachSentences as versionReach, toBody, validate, versionChanges } from '@/app/usg/templates/[templateId]/version-draft';
import { VersionEditor, VersionReview } from '@/app/usg/templates/[templateId]/version-editor';
import { TemplatesTable } from '@/app/usg/templates/templates-table';
import {
  formatRuleValue, isAmended, parseRulePackContent, ruleValueChanges, ruleValues, valueError, withRuleValues,
} from '@/lib/distribution/rule-pack-content';
import type { UsgPack, UsgTemplateView, UsgVersion } from '@/lib/distribution/usg-view';
import { TEMPLATE } from '@db/seed/ids';
import seedPack from '../rules/packs/usg-funding.v1.json';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }) }));

/** Visible text: tags dropped, entities decoded, whitespace collapsed. */
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');
const render = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

const content = seedPack.content as Record<string, unknown>;
const fundingUser = { templateId: TEMPLATE.fundingPrecheck, name: 'Funding pre-check', version: 1, audience: 'positions' as const, usableBy: ['treasurer', 'president'], installedCount: 4, global: true };
const pack: UsgPack = {
  slug: 'usg-funding', usedBy: [fundingUser],
  versions: [{ version: 1, status: 'published', label: seedPack.label, content, publishedAt: '2026-11-15T18:00:00.000Z' }],
};

const prompt = ['You are Funding pre-check, a USG agent for club treasurers and presidents.',
  'For each budget line and date: say whether it passes, fails or needs a reviewer, cite the rule by section.'].join('\n\n');
const v1: UsgVersion = {
  version: 1, purpose: 'Checks a funding request against the USG funding rules before you submit it.', audience: 'positions',
  usableBy: ['treasurer', 'president'], maxTier: 'officers', sourceKinds: ['rulebook', 'finance'], tools: [],
  modelClasses: ['standard', 'economy'], defaultModelClass: 'standard', systemPrompt: prompt, rulePackSlug: 'usg-funding',
  changelog: 'First version.', publishedAt: '2026-11-15T18:00:00.000Z',
};
const view = (patch: Partial<UsgTemplateView> = {}): UsgTemplateView => ({
  template: {
    id: TEMPLATE.fundingPrecheck, slug: 'funding-precheck', name: 'Funding pre-check', distribution: 'required', target: 'all',
    status: 'active', latestVersion: 1, distributedAt: '2026-11-15T18:00:00.000Z', installedCount: 4, targetCount: 4,
    purpose: v1.purpose, rulePackSlug: 'usg-funding',
  },
  versions: [v1],
  targets: [{ slug: 'all', name: 'All active clubs', clubs: [{ id: 'a', name: 'Archery Club' }, { id: 'd', name: 'Dance Club' }, { id: 's', name: 'Startup Club' }, { id: 'r', name: 'Robotics Club' }] }],
  rulePacks: [{ slug: 'usg-funding', label: 'USG Funding Guidelines 2026–27', version: 1, ruleCount: 13 }],
  positions: [{ slug: 'member', name: 'Member' }, { slug: 'president', name: 'President' }, { slug: 'secretary', name: 'Secretary' }, { slug: 'treasurer', name: 'Treasurer' }],
  usgDocuments: [{ kind: 'rulebook', title: 'USG Funding Department Guidelines', tier: 'public' }, { kind: 'usg_internal', title: 'Reviewer notes', tier: 'usg_internal' }],
  ...patch,
});

describe('rule-pack content', () => {
  const parsed = parseRulePackContent(content)!;
  it('reads the seeded guidelines and formats values with their units', () => {
    expect(parsed.rules).toHaveLength(13);
    expect(parsed.source).toMatchObject({ title: 'Funding Department Guidelines', currentAsOf: '2026-10-21' });
    const rule = (id: string) => parsed.rules.find(r => r.id === id)!;
    expect(formatRuleValue(rule('annual-cap'))).toBe('$8,000 per year');
    expect(formatRuleValue(rule('vendor-lead-time'))).toBe('6 academic weeks before the first payment is due');
    expect(formatRuleValue(rule('weekly-window'))).toBe('Wednesday 11:59 PM');
    expect(formatRuleValue(rule('not-eligible'))).toBe('18 expense types');
  });
  it('falls back to null for content without a well-formed rule list', () => {
    expect(parseRulePackContent({ annualCapUsd: 8000 })).toBeNull();
    expect(parseRulePackContent({ rules: [{ id: 'x', group: 'limits' }] })).toBeNull();
    expect(parseRulePackContent({ rules: [...(content.rules as unknown[]), (content.rules as unknown[])[0]] })).toBeNull();
  });
  it('keeps everything but the edited values, mirrors the cap and stores the note', () => {
    const values = { ...ruleValues(parsed), 'annual-cap': 10000 };
    expect(ruleValueChanges(parsed, values)).toEqual([{ id: 'annual-cap', section: '§3', title: 'Annual maximum per club', before: '$8,000', after: '$10,000', unit: 'per year' }]);
    const next = withRuleValues(content, values, 'Cap raised after the fall budget vote.');
    expect(next).toMatchObject({ annualCapUsd: 10000, source: content.source, changeNote: 'Cap raised after the fall budget vote.' });
    expect(parseRulePackContent(next)!.rules).toHaveLength(13);
    expect(withRuleValues(next, values, '  ')).not.toHaveProperty('changeNote');
  });
  it('marks an amended value with USG’s original, across later versions, until it is set back', () => {
    const rule = (c: Record<string, unknown>, id: string) => parseRulePackContent(c)!.rules.find(r => r.id === id)!;
    const v2 = withRuleValues(content, { ...ruleValues(parsed), 'annual-cap': 10000 }, '');
    expect(rule(v2, 'annual-cap')).toMatchObject({ value: 10000, amendedFrom: 8000 });
    expect(isAmended(rule(v2, 'annual-cap'))).toBe(true);
    expect(rule(v2, 'food-per-person')).not.toHaveProperty('amendedFrom');
    const v3 = withRuleValues(v2, { ...ruleValues(parseRulePackContent(v2)!), 'annual-cap': 12000 }, '');
    expect(rule(v3, 'annual-cap')).toMatchObject({ value: 12000, amendedFrom: 8000 });
    const v4 = withRuleValues(v3, { ...ruleValues(parseRulePackContent(v3)!), 'annual-cap': 8000 }, '');
    expect(rule(v4, 'annual-cap')).not.toHaveProperty('amendedFrom');
    expect(parseRulePackContent(v4)!.rules.some(isAmended)).toBe(false);
  });
  it('says why a value is refused', () => {
    const rule = (id: string) => parsed.rules.find(r => r.id === id)!;
    expect(valueError(rule('travel-lead-time'), 8.5)).toMatch(/whole number/);
    expect(valueError(rule('annual-cap'), -1)).toMatch(/0 or more/);
    expect(valueError(rule('food-per-person'), 37.5)).toBeNull();
    expect(valueError(rule('weekly-window'), ' ')).toMatch(/Enter a value/);
  });
});

describe('/usg/rule-packs', () => {
  it('explains what a rule pack is, why it exists and who follows it', () => {
    const page = text(render(createElement(RulePackExplainer, { packs: [pack] })));
    expect(page).toContain('What is a rule pack?');
    expect(page).toContain('Funding pre-check is built to show Taylor that $40 a person for catering is over the $35 limit before submitting');
    expect(page).toContain('Funding pre-check uses USG Funding Guidelines 2026–27 in 4 clubs');
    expect(page).toContain('including clubs pinned to an older template version');
    expect(page).not.toMatch(/\bchecks every request\b|\bNow Taylor sees\b/);
  });
  it('shows the source, who uses the pack and every rule with its section and example', () => {
    const html = render(createElement(RulePackCard, { pack, demoRuntime: true }));
    const page = text(html);
    expect(page).toContain('USG Funding Guidelines 2026–27');
    expect(html).toContain(`href="${(seedPack.content.source as { url: string }).url}"`);
    expect(page).toContain('Funding Department Guidelines, current as of Oct 21, 2026');
    expect(page).toContain('Used by Funding pre-check · 4 clubs · Treasurer, President');
    expect(html).toContain(`href="/usg/templates/${TEMPLATE.fundingPrecheck}"`);
    for (const heading of ['Deadlines · 7 rules', 'Limits · 5 rules', 'Not eligible · 1 rule']) expect(page).toContain(heading);
    expect(page).toMatch(/§3 Annual maximum per club USG wording .*\$8,000 per year Pre-check Startup Club's spring budget plans \$6,200/);
    expect(page).toContain('Fixing an incomplete application');
    expect(page).toContain('USG reviewer');
    expect(page).toContain('Startup Club budgets $2,400 of catering for 60 expected Demo day guests: $40 a person, over the $35 limit.');
    expect(page).toContain('Gifts and gift cards');
    expect(page).toContain('Exception: Any items critical to the function of the program may be considered as an exception to this rule at the board’s discretion.');
    expect(page).toContain('Corrections Two typos corrected');
    expect(page).toContain('10 for the agent to flag before submission, 3 for a USG reviewer.');
    expect(page).toContain('Demo runtime: runs show this pack’s version and annual cap; rule-by-rule checks come with the real agent.');
    expect(page).toContain('Copied from USG’s public Funding Department Guidelines (current as of October 21, 2026). TrojanOps is a student project and is not affiliated with or endorsed by USG.');
    expect(page).not.toContain('Amended');
    expect(html).toContain('id="usg-funding-group-limits"');
    expect(page).toContain('Publish new version');
    expect(page).toContain('Version history (1)');
  });
  it('marks an amended rule, hides its stale example and says the pack is amended', () => {
    const v2 = withRuleValues(content, { ...ruleValues(parseRulePackContent(content)!), 'annual-cap': 10000 }, 'Cap raised.');
    const amended: UsgPack = { ...pack, versions: [{ version: 2, status: 'published', label: seedPack.label, content: v2, publishedAt: '2026-11-15T19:00:00.000Z' }, ...pack.versions] };
    const page = text(render(createElement(RulePackCard, { pack: amended })));
    expect(page).toMatch(/Annual maximum per club USG wording \(before amendment\) .*\$10,000 per year Amended · USG: \$8,000 Pre-check No example yet for the amended value\./);
    expect(page).not.toContain('Another $2,000 request would take it past $8,000');
    expect(page).toContain('Based on USG’s public Funding Department Guidelines (current as of October 21, 2026), with amendments in this version. TrojanOps is a student project and is not affiliated with or endorsed by USG.');
    expect(page).not.toContain('Copied from USG’s public');
    expect(page).not.toContain('Demo runtime:');
    expect(page).toContain('Cap raised.');
  });
  it('links only USG’s own templates under Used by', () => {
    const club = { ...fundingUser, templateId: TEMPLATE.handoff, name: 'Club handoff', global: false, audience: 'members' as const, usableBy: [], installedCount: 1 };
    const html = render(createElement(UsedBy, { users: [fundingUser, club] }));
    expect(html).toContain(`href="/usg/templates/${TEMPLATE.fundingPrecheck}"`);
    expect(html).not.toContain(`href="/usg/templates/${TEMPLATE.handoff}"`);
    expect(text(html)).toContain('Club handoff · 1 club · All members');
  });
  it('shows a pack without a rule list as JSON', () => {
    const page = text(render(createElement(RulePackCard, { pack: { slug: 'venue-rules', usedBy: [], versions: [{ version: 1, status: 'published', label: 'Venue rules', content: { maxHours: 4 }, publishedAt: null }] } })));
    expect(page).toContain('"maxHours": 4');
    expect(page).toContain('No agent template uses this pack yet.');
  });
  it('reviews only the changed values and who they reach', () => {
    const parsed = parseRulePackContent(content)!;
    const changes = ruleValueChanges(parsed, { ...ruleValues(parsed), 'annual-cap': 10000 });
    const page = text(render(createElement(PackReview, { label: seedPack.label, nextVersion: 2, labelChange: null, changes, changeNote: '', usedBy: pack.usedBy })));
    expect(page).toContain('§3 Annual maximum per club');
    expect(page).toContain('$8,000 → $10,000 per year');
    expect(page).not.toContain('$35');
    expect(page).toContain('Applies to Funding pre-check in 4 clubs on the next run, including pinned installations.');
    expect(page).toContain('Treasurer, President in those clubs get answers based on v2.');
    expect(reachSentences([], 2)).toEqual(['No agent template uses this rule pack yet, so no run changes until a template names it.']);
  });
});

describe('/usg/templates/[templateId]', () => {
  it('summarizes what the agent does before any setting', () => {
    const html = render(createElement(AgentSummary, { data: view(), demoRuntime: true }));
    const page = text(html);
    expect(page).toContain('What this agent does');
    expect(page).toContain('Treasurer, President in each club. Installed in all 4 clubs in its target.');
    expect(page).toContain('Built for: Taylor, Startup Club’s treasurer, checking the Demo day request before the Wednesday 11:59 PM deadline');
    expect(page).toContain('Every run uses the newest published version of the pack. Demo runtime: runs show this pack’s version and annual cap; rule-by-rule checks come with the real agent.');
    expect(page).not.toMatch(/checks every request|Every run checks/);
    expect(html).toContain('You are Funding pre-check, a USG agent for club treasurers and presidents.\n\nFor each budget line');
    expect(page).toContain('USG rulebook');
    expect(page).toContain('USG Funding Department Guidelines');
    expect(page).not.toContain('Reviewer notes');
    expect(page).toContain('USG cannot open club finance documents');
    expect(html).toMatch(/href="\/usg\/rule-packs">USG Funding Guidelines 2026–27 · v1 · 13 rules</);
    expect(page).toContain('None. It can only answer; it cannot submit or change anything.');
    expect(page).toContain('Standard by default; clubs may switch to Economy.');
    expect(page).toContain('Officers documents.');
    expect(page).not.toContain('quota');
  });
  it('lists only the USG documents the version’s max tier lets it read', () => {
    const both = { ...v1, sourceKinds: ['rulebook', 'usg_internal'] };
    expect(text(render(createElement(AgentSummary, { data: view({ versions: [both] }) })))).not.toContain('Reviewer notes');
    const internal = text(render(createElement(AgentSummary, { data: view({ versions: [{ ...both, maxTier: 'usg_internal' }] }) })));
    expect(internal).toContain('Reviewer notes');
    expect(text(render(createElement(AgentSummary, { data: view() })))).not.toContain('Demo runtime:');
  });
  it('explains a template with no published version', () => {
    const page = text(render(createElement(AgentSummary, { data: view({ versions: [], template: { ...view().template, latestVersion: 0, installedCount: 0 } }) })));
    expect(page).toContain('No version is published yet, so no club can run this agent.');
  });
  it('keeps the request body shape and lists the fields that change', () => {
    const state = { ...initialState(v1), usableBy: ['treasurer'], tools: ['submit_to_queue'], rulePackSlug: '', changelog: 'Treasurers file it themselves.' };
    const body = toBody(state);
    expect(Object.keys(body).sort()).toEqual(['audience', 'changelog', 'defaultModelClass', 'maxTier', 'modelClasses', 'purpose', 'rulePackSlug', 'sourceKinds', 'systemPrompt', 'tools', 'usableBy']);
    expect(body).toMatchObject({ usableBy: ['treasurer'], tools: ['submit_to_queue'], rulePackSlug: null, modelClasses: ['economy', 'standard'] });
    const ctx = { positions: view().positions, rulePacks: view().rulePacks };
    const changes = versionChanges(v1, body, ctx);
    expect(changes.map(c => c.field)).toEqual(['Positions', 'Rule pack', 'Tools']);
    expect(versionChanges(v1, toBody(initialState(v1)), ctx)).toEqual([]);
    expect(validate({ ...state, audience: 'positions', usableBy: [] }).usableBy).toMatch(/Choose at least one position/);
    expect(toBody({ ...state, audience: 'public', maxTier: 'officers' })).toMatchObject({ audience: 'public', usableBy: [], maxTier: 'public' });

    const page = text(render(createElement(VersionReview, { templateName: 'Funding pre-check', nextVersion: 2, currentVersion: 1, changes,
      reach: versionReach(body, 4, ctx), changelog: state.changelog })));
    expect(page).toContain('What changes from version 1');
    expect(page).toContain('Positions Treasurer, President Treasurer');
    expect(page).toContain('Rule pack USG Funding Guidelines 2026–27 None');
    expect(page).toContain('Tools None Submit to queue');
    expect(page).toContain('Treasurer in each of the 4 installed clubs can use it.');
    expect(page).toContain('It can read up to Officers documents from USG rulebook and Club finances.');
    expect(page).toContain('Change note: Treasurers file it themselves.');
  });
  it('turns slugs into choices with plain explanations', () => {
    // One "Edit configuration" button, in the summary: the editor renders nothing until it is opened.
    expect(render(createElement(VersionEditor, { data: view(), editing: false, setEditing: () => {} }))).toBe('');
    const page = text(render(createElement(VersionEditor, { data: view(), editing: true, setEditing: () => {} })));
    expect(page).toContain('Changes publish as version 2.');
    for (const choice of ['All students', 'All members', 'Named positions', 'Treasurer', 'Club finances', 'USG rulebook', 'Officers',
      'Submit to queue', 'Proposes filing the application in USG’s queue; the user confirms. In this demo, confirming records the decision only.',
      'Economy', 'Standard', 'USG Funding Guidelines 2026–27 (v1, 13 rules)', 'The USG policy this agent is built to apply.']) expect(page).toContain(choice);
    expect(page).not.toContain('USG internal notes');
    expect(page).toContain('USG internal is not offered');
    expect(page).toContain('Review version 2');
  });
});

describe('/usg/templates', () => {
  it('shows what each template does and the rule pack it follows', () => {
    const data = view();
    const page = text(render(createElement(TemplatesTable, { data: { templates: [data.template], targets: data.targets, rulePacks: data.rulePacks } })));
    expect(page).toContain('What it does');
    expect(page).toContain('Checks a funding request against the USG funding rules before you submit it.');
    expect(page).toContain('Rule pack');
    expect(page).toContain('USG Funding Guidelines 2026–27');
    expect(page).toContain('Installed in 4 of 4');
  });
});
