// Owner: B (WP-6). Markup of the USG rule-pack and template pages, rendered to static HTML in node (no
// browser, no database) from the seeded funding pack: the rule-pack card and its publish review (D6),
// the template configuration, and the configuration editor's review.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PackReview, reachSentences } from '@/app/usg/rule-packs/publish-pack-dialog';
import { RulePackCard, UsedBy } from '@/app/usg/rule-packs/rule-pack-card';
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
/** Narration the pages must not carry: they show the product, not explanations of it. */
const META = ['What is a rule pack', 'Built for', 'Demo runtime', 'Example', 'Copied on', 'Corrections'];
const expectNoMeta = (page: string) => { for (const phrase of META) expect(page).not.toContain(phrase); };

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
    status: 'active', latestVersion: 1, distributedAt: '2026-11-15T18:00:00.000Z', installedCount: 3, targetCount: 3,
    purpose: v1.purpose, rulePackSlug: 'usg-funding',
  },
  versions: [v1],
  targets: [{ slug: 'all', name: 'All active clubs', clubs: [{ id: 'a', name: 'Archery Club' }, { id: 'd', name: 'Dance Club' }, { id: 's', name: 'Startup Club' }] }],
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
    expect(rule('annual-cap')).not.toHaveProperty('example');
    expect(formatRuleValue(rule('annual-cap'))).toBe('$8,000 per year');
    expect(formatRuleValue(rule('vendor-lead-time'))).toBe('6 academic weeks before the first payment is due');
    expect(formatRuleValue(rule('weekly-window'))).toBe('Wednesday 11:59 PM');
    expect(formatRuleValue(rule('not-eligible'))).toBe('18 expense types');
    expect(rule('not-eligible').note).toMatch(/^Any items critical to the function of the program/);
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
  it('shows the source, who uses the pack and every rule with its section, value and checker', () => {
    const html = render(createElement(RulePackCard, { pack }));
    const page = text(html);
    expect(page).toContain('USG Funding Guidelines 2026–27');
    expect(page).toContain('Published v1');
    expect(html).toContain(`href="${(seedPack.content.source as { url: string }).url}"`);
    expect(page).toContain('Funding Department Guidelines, current as of Oct 21, 2026');
    expect(page).toContain('USG web page');
    expect(page).toContain('Used by Funding pre-check · 4 clubs · Treasurer, President');
    expect(html).toContain(`href="/usg/templates/${TEMPLATE.fundingPrecheck}"`);
    for (const heading of ['Deadlines · 7 rules', 'Limits · 5 rules', 'Not eligible · 1 rule']) expect(page).toContain(heading);
    expect(page).toContain('Section Rule Value Checked by');
    expect(page).toMatch(/§3 Annual maximum per club USG wording .*\$8,000 per year Pre-check/);
    expect(page).toMatch(/Fixing an incomplete application USG wording .*2 business days USG reviewer/);
    expect(page).toContain('Gifts and gift cards');
    expect(page).toContain('Exception: Any items critical to the function of the program may be considered as an exception to this rule at the board’s discretion.');
    expect(page).toContain('Publish new version');
    expect(page).toContain('Version history (1)');
    expect(html).toContain('id="usg-funding-group-limits"');
    expectNoMeta(page);
    for (const gone of ['Meant for the agent', 'because it depends', 'When to apply', 'Copied from', 'not affiliated', 'for the agent to flag']) expect(page).not.toContain(gone);
  });
  it('marks an amended rule', () => {
    const v2 = withRuleValues(content, { ...ruleValues(parseRulePackContent(content)!), 'annual-cap': 10000 }, 'Cap raised.');
    const amended: UsgPack = { ...pack, versions: [{ version: 2, status: 'published', label: seedPack.label, content: v2, publishedAt: '2026-11-15T19:00:00.000Z' }, ...pack.versions] };
    const page = text(render(createElement(RulePackCard, { pack: amended })));
    expect(page).toMatch(/Annual maximum per club USG wording \(before amendment\) .*\$10,000 per year Amended · USG: \$8,000 Pre-check/);
    expect(page).toContain('Cap raised.');
    expectNoMeta(page);
  });
  it('links only USG’s own templates under Used by', () => {
    const club = { ...fundingUser, templateId: TEMPLATE.handoff, name: 'Club handoff', global: false, audience: 'members' as const, usableBy: [], installedCount: 1 };
    const html = render(createElement(UsedBy, { users: [fundingUser, club] }));
    expect(html).toContain(`href="/usg/templates/${TEMPLATE.fundingPrecheck}"`);
    expect(html).not.toContain(`href="/usg/templates/${TEMPLATE.handoff}"`);
    expect(text(html)).toContain('Club handoff · 1 club · All members');
    expect(text(render(createElement(UsedBy, { users: [] }))).trim()).toBe('None');
  });
  it('shows a pack without a rule list as JSON', () => {
    const page = text(render(createElement(RulePackCard, { pack: { slug: 'venue-rules', usedBy: [], versions: [{ version: 1, status: 'published', label: 'Venue rules', content: { maxHours: 4 }, publishedAt: null }] } })));
    expect(page).toContain('"maxHours": 4');
    expect(page).toContain('Used by None');
  });
  it('reviews only the changed values and who they reach', () => {
    const parsed = parseRulePackContent(content)!;
    const changes = ruleValueChanges(parsed, { ...ruleValues(parsed), 'annual-cap': 10000 });
    const page = text(render(createElement(PackReview, { labelChange: null, changes, changeNote: '', usedBy: pack.usedBy })));
    expect(page).toContain('§3 Annual maximum per club');
    expect(page).toContain('$8,000 → $10,000 per year');
    expect(page).not.toContain('$35');
    expect(page).toContain('Applies to Funding pre-check (Treasurer, President) in 4 clubs on the next run, including pinned installations.');
    expect(page).not.toMatch(/carry over|cannot be edited|To undo/);
    expect(reachSentences([])).toEqual(['No agent template uses this rule pack.']);
  });
});

describe('/usg/templates/[templateId]', () => {
  it('lists the configuration as labels and values', () => {
    const html = render(createElement(AgentSummary, { data: view() }));
    const page = text(html);
    expect(page).toContain('Configuration Version 1 · published Nov 15, 2026, 10:00 AM PT');
    expect(page).toContain('Purpose Checks a funding request against the USG funding rules before you submit it.');
    expect(page).toContain('Who uses it Treasurer, President · 3 clubs');
    expect(html).toContain('You are Funding pre-check, a USG agent for club treasurers and presidents.\n\nFor each budget line');
    expect(page).toContain('Knowledge USG rulebook USG library USG Funding Department Guidelines Club finances Each club');
    expect(html).toMatch(/href="\/usg\/rule-packs">USG Funding Guidelines 2026–27 · v1 · 13 rules</);
    expect(page).toContain('Tools None');
    expect(page).toContain('Model Standard (default), Economy');
    expect(page).toContain('Reads up to Officers');
    expectNoMeta(page);
    for (const gone of ['What this agent does', 'The system prompt', 'Every run uses', 'never reads more', 'USG cannot open', 'Sources:', 'Max tier:', 'Model class:', 'quota']) expect(page).not.toContain(gone);
  });
  it('lists only the USG documents the version’s max tier lets it read', () => {
    const both = { ...v1, sourceKinds: ['rulebook', 'usg_internal'] };
    expect(text(render(createElement(AgentSummary, { data: view({ versions: [both] }) })))).not.toContain('Reviewer notes');
    expect(text(render(createElement(AgentSummary, { data: view({ versions: [{ ...both, maxTier: 'usg_internal' }] }) })))).toContain('Reviewer notes');
  });
  it('shows a template with no published version', () => {
    const page = text(render(createElement(AgentSummary, { data: view({ versions: [], template: { ...view().template, latestVersion: 0, installedCount: 0 } }) })));
    expect(page).toContain('Configuration No version published yet');
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
      reach: versionReach(body, 3, ctx), changelog: state.changelog })));
    expect(page).toContain('Changes Setting Now (v1) After (v2)');
    expect(page).toContain('Positions Treasurer, President Treasurer');
    expect(page).toContain('Rule pack USG Funding Guidelines 2026–27 None');
    expect(page).toContain('Tools None Submit to queue');
    expect(page).toContain('Reaches Treasurer in 3 clubs on the next run; pinned installations keep their version.');
    expect(page).toContain('Change note: Treasurers file it themselves.');
    expect(page).not.toMatch(/cannot be edited|publishing stops/);
  });
  it('edits every setting through labelled controls', () => {
    // One "Edit configuration" button, on the Configuration card: the editor renders nothing until it is opened.
    expect(render(createElement(VersionEditor, { data: view(), editing: false, setEditing: () => {} }))).toBe('');
    const page = text(render(createElement(VersionEditor, { data: view(), editing: true, setEditing: () => {} })));
    expect(page).toContain('Publishes as version 2');
    for (const choice of ['Purpose', 'Audience', 'All students', 'All members', 'Named positions', 'Positions', 'Treasurer', 'Instructions',
      'Knowledge sources', 'Club finances', 'USG rulebook', 'Reads up to', 'Officers', 'Rule pack', 'Tools', 'Submit to queue',
      'Proposes filing the application in USG’s queue; the user confirms.', 'Model classes', 'Economy', 'Standard', 'Default model',
      'USG Funding Guidelines 2026–27 (v1, 13 rules)', 'Change note']) expect(page).toContain(choice);
    expect(page).not.toContain('USG internal');
    for (const gone of ['Who may open it', 'The system prompt', 'The kinds of documents', 'The max tier', 'USG policy the agent', 'Actions it can take',
      'The strength and cost', 'Shown in the version history', 'One sentence.', 'Each club fills', 'In this demo']) expect(page).not.toContain(gone);
    expectNoMeta(page);
  });
});

describe('/usg/templates', () => {
  it('shows what each template does and the rule pack it uses', () => {
    const data = view();
    const page = text(render(createElement(TemplatesTable, { data: { templates: [data.template], targets: data.targets, rulePacks: data.rulePacks } })));
    expect(page).toContain('What it does');
    expect(page).toContain('Checks a funding request against the USG funding rules before you submit it.');
    expect(page).toContain('Rule pack');
    expect(page).toContain('USG Funding Guidelines 2026–27');
    expect(page).toContain('Installed in 3 of 3');
  });
});
