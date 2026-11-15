// Owner: B (WP-6). Markup of the USG console's template and documents pages, rendered to static HTML in
// node (no browser, no database): the template cards, the template builder with its preview and review,
// the documents list and detail, the Markdown renderer, the line diff and the publish review (D6).
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { consequence, DocumentDetail, DocumentReview } from '@/app/usg/documents/[documentId]/document-detail';
import { DocumentBody, parseDocument } from '@/app/usg/documents/document-body';
import { DocumentsTable } from '@/app/usg/documents/documents-table';
import { lineChanges, lineDiff, MAX_DIFF_CELLS } from '@/app/usg/documents/line-diff';
import { TemplateKnowledge } from '@/app/usg/templates/[templateId]/template-knowledge';
import { TemplateDetail } from '@/app/usg/templates/[templateId]/template-detail';
import { TemplatePreview } from '@/app/usg/templates/[templateId]/template-preview';
import { initialState, reachSentences as versionReach, toBody, validate, versionChanges } from '@/app/usg/templates/[templateId]/version-draft';
import { VersionEditor, VersionReview } from '@/app/usg/templates/[templateId]/version-editor';
import { absoluteTime } from '@/app/usg/templates/console-ui';
import { TemplatesGrid } from '@/app/usg/templates/templates-grid';
import type { UsgTemplateView, UsgVersion } from '@/lib/distribution/usg-view';
import type { UsgDocumentRow, UsgDocumentUser, UsgDocumentView } from '@/lib/documents/usg-documents';
import { MODEL_IDS } from '@/lib/gateway/models';
import { DOCUMENT, ORG, TEMPLATE } from '@db/seed/ids';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }) }));

/** Visible text: tags dropped, entities decoded, whitespace collapsed. */
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').replace(/ ,/g, ',');
const render = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);
/** The pages show the product, not narration about it, and rule packs are not part of it. */
const ABSENT = ['Rule pack', 'rule pack', 'What is a rule pack', 'Built for', 'Demo runtime', 'Example', 'Copied on', 'Corrections'];
const expectProductOnly = (page: string, except: string[] = []) => { for (const phrase of ABSENT.filter(p => !except.includes(p))) expect(page).not.toContain(phrase); };

const guidelines = readFileSync(new URL('../db/seed/docs/usg-funding-rules.md', import.meta.url), 'utf8');
const reviewerNotes = readFileSync(new URL('../db/seed/docs/reviewer-notes.md', import.meta.url), 'utf8');

const prompt = ['You are Funding pre-check, a USG agent for club treasurers and presidents.',
  'For each budget line and date: say whether it passes, fails or needs a reviewer, cite the rule by section.'].join('\n\n');
const v1: UsgVersion = {
  version: 1, purpose: 'Checks a funding request against the USG funding rules before you submit it.', audience: 'positions',
  usableBy: ['treasurer', 'president'], maxTier: 'officers', sourceKinds: ['rulebook', 'finance'], tools: [],
  modelClasses: ['economy', 'standard'], defaultModelClass: 'standard', modelIds: [...MODEL_IDS], defaultModelId: 'claude-sonnet-5-5',
  systemPrompt: prompt, rulePackSlug: null,
  changelog: 'First version.', publishedAt: '2026-11-15T18:00:00.000Z',
};
const view = (patch: Partial<UsgTemplateView> = {}): UsgTemplateView => ({
  template: {
    id: TEMPLATE.fundingPrecheck, slug: 'funding-precheck', name: 'Funding pre-check', distribution: 'required', target: 'all',
    status: 'active', latestVersion: 1, distributedAt: '2026-11-15T18:00:00.000Z', installedCount: 3, targetCount: 3, purpose: v1.purpose,
    modelIds: [...MODEL_IDS], defaultModelId: 'claude-sonnet-5-5',
  },
  versions: [v1],
  targets: [{ slug: 'all', name: 'All active clubs', clubs: [{ id: 'a', name: 'Archery Club' }, { id: 'd', name: 'Dance Club' }, { id: 's', name: 'Startup Club' }] }],
  positions: [{ slug: 'member', name: 'Member' }, { slug: 'president', name: 'President' }, { slug: 'secretary', name: 'Secretary' }, { slug: 'treasurer', name: 'Treasurer' }],
  usgDocuments: [
    { id: DOCUMENT.usgFundingRules, kind: 'rulebook', title: 'USG Funding Department Guidelines', tier: 'public', version: 1 },
    { id: DOCUMENT.reviewerNotes, kind: 'usg_internal', title: 'Reviewer notes', tier: 'usg_internal', version: 1 },
  ],
  ...patch,
});

const users: UsgDocumentUser[] = [
  { templateId: TEMPLATE.fundingPrecheck, name: 'Funding pre-check', global: true },
  { templateId: TEMPLATE.usgReviewAssistant, name: 'USG review assistant', global: false },
];
const createdAt = new Date('2026-11-15T18:00:00.000Z');
const rows: UsgDocumentRow[] = [
  { id: DOCUMENT.reviewerNotes, title: 'Reviewer notes', tier: 'usg_internal', sourceId: 's1', sourceName: 'USG internal', version: 1, createdAt, sourceKind: 'usg_internal', usedBy: [users[1]] },
  { id: DOCUMENT.usgFundingRules, title: 'USG Funding Department Guidelines', tier: 'public', sourceId: 's2', sourceName: 'USG rulebook', version: 1, createdAt, sourceKind: 'rulebook', usedBy: users },
];
const detail: UsgDocumentView = {
  orgId: ORG.usg, usedBy: users,
  document: { id: DOCUMENT.usgFundingRules, title: 'USG Funding Department Guidelines', tier: 'public', sourceId: 's2', sourceName: 'USG rulebook',
    sourceKind: 'rulebook', version: 1, createdAt, bodyMd: guidelines },
};

describe('USG console timestamps', () => {
  it('keeps the same punctuation when the runtime joins the date and time with “at”', () => {
    const prototype = Intl.DateTimeFormat.prototype;
    const format = Object.getOwnPropertyDescriptor(prototype, 'format');
    if (!format) throw new Error('Missing Intl.DateTimeFormat.format');
    Object.defineProperty(prototype, 'format', {
      ...format,
      get: () => () => 'Nov 15, 2026 at 10:00 AM',
    });
    try {
      expect(absoluteTime(v1.publishedAt)).toBe('Nov 15, 2026, 10:00 AM PT');
    } finally {
      Object.defineProperty(prototype, 'format', format);
    }
  });
});

describe('/usg/templates/[templateId]', () => {
  it('lists only the USG documents the version’s max tier lets it read', () => {
    const internal = { ...v1, sourceKinds: ['usg_internal'] };
    expect(text(render(createElement(TemplateKnowledge, { data: view({ versions: [internal] }) })))).not.toContain('Reviewer notes');
    expect(text(render(createElement(TemplateKnowledge, { data: view({ versions: [{ ...internal, maxTier: 'usg_internal' }] }) })))).toContain('Reviewer notes');
  });
  it('heads the page with status, version and reach, then four tabs with knowledge and one distribution target', () => {
    const html = render(createElement(TemplateDetail, { data: view() }));
    const page = text(html);
    expect(page).toContain('All templates Funding pre-check Active Required v1 · All active clubs · Installed in 3 of 3 Distribute More');
    expect(html).toContain('href="/usg/templates"');
    expect(html).toContain('role="tablist"');
    expect((html.match(/role="tab"/g) ?? [])).toHaveLength(4);
    expect(page).toContain('Configure Knowledge Distribution Versions');
    expect((html.match(/id="metadata-target"/g) ?? [])).toHaveLength(1);
    expect(html).not.toContain('rollout-target');
    expect(html).toContain(`href="/usg/documents/${DOCUMENT.usgFundingRules}"`);
    expect(page).toContain('Default model Change note Published v1');
    expect(page).toMatch(/Officers claude-sonnet-5-5 First version\./);
    expect(page).not.toContain('Edit configuration');
    expectProductOnly(page);
    const retired = text(render(createElement(TemplateDetail, { data: view({ template: { ...view().template, status: 'retired' } }) })));
    expect(retired).toContain('Retired by USG');
    expect(retired).not.toContain('Distribute More');
  });
  it('shows club ownership for club-only knowledge and uploads only to connected active rulebooks', () => {
    const club = text(render(createElement(TemplateKnowledge, { data: view({ versions: [{ ...v1, sourceKinds: ['finance'] }] }) })));
    expect(club).toContain('Each installed club supplies its own club finances');
    expect(club).not.toContain('No USG documents');
    const data = view({ knowledgeUpload: { orgId: ORG.usg, sources: [{ id: 'rules', name: 'USG rulebook', kind: 'rulebook' }] } });
    expect(text(render(createElement(TemplateKnowledge, { data })))).toContain('Add document');
    expect(text(render(createElement(TemplateKnowledge, { data: { ...data, template: { ...data.template, status: 'retired' } } })))).not.toContain('Add document');
    expect(text(render(createElement(TemplateKnowledge, { data: { ...data, versions: [{ ...v1, sourceKinds: [] }] } })))).not.toContain('Add document');
  });
  it('builds the first version of a template with nothing published', () => {
    const page = text(render(createElement(VersionEditor, { data: view({ versions: [], template: { ...view().template, latestVersion: 0, installedCount: 0, defaultModelId: null, modelIds: [] } }) })));
    expect(page).toContain('No version published yet Draft of version 1 Review and publish v1');
    expect(page).toContain('USG template · v1 draft');
  });
  it('keeps the request body shape, carrying the rule-pack field over, and lists the fields that change', () => {
    const state = { ...initialState({ ...v1, rulePackSlug: 'usg-funding' }), usableBy: ['treasurer'], tools: ['submit_to_queue'], changelog: 'Treasurers file it themselves.' };
    const body = toBody(state);
    expect(Object.keys(body).sort()).toEqual(['audience', 'changelog', 'defaultModelId', 'maxTier', 'modelIds', 'purpose', 'rulePackSlug', 'sourceKinds', 'systemPrompt', 'tools', 'usableBy']);
    expect(body).toMatchObject({ usableBy: ['treasurer'], tools: ['submit_to_queue'], rulePackSlug: 'usg-funding', modelIds: [...MODEL_IDS], defaultModelId: 'claude-sonnet-5-5' });
    expect(toBody(initialState(v1)).rulePackSlug).toBeNull();
    const ctx = { positions: view().positions };
    const changes = versionChanges(v1, toBody({ ...state, rulePackSlug: '' }), ctx);
    expect(changes.map(c => c.field)).toEqual(['Positions', 'Tools']);
    expect(versionChanges(v1, toBody(initialState(v1)), ctx)).toEqual([]);
    expect(validate({ ...state, audience: 'positions', usableBy: [] }).usableBy).toMatch(/Choose at least one position/);
    expect(toBody({ ...state, audience: 'public', maxTier: 'officers' })).toMatchObject({ audience: 'public', usableBy: [], maxTier: 'public' });

    const page = text(render(createElement(VersionReview, { templateName: 'Funding pre-check', nextVersion: 2, currentVersion: 1, changes,
      reach: versionReach(body, 3, ctx), changelog: state.changelog })));
    expect(page).toContain('Changes Setting Now (v1) After (v2)');
    expect(page).toContain('Positions Treasurer, President Treasurer');
    expect(page).toContain('Tools None Submit to queue');
    expect(page).toContain('Reaches Treasurer in 3 clubs on the next run; pinned installations keep their version.');
    expect(page).toContain('Change note: Treasurers file it themselves.');
    expectProductOnly(page);
  });
  it('offers specific models: lists the model and default changes, and needs at least one offered default', () => {
    const ctx = { positions: view().positions };
    const state = { ...initialState(v1), modelIds: ['gemini-4-carbon', 'gpt-6-luna'] as typeof v1.modelIds, defaultModelId: 'gpt-6-luna' as const };
    const body = toBody(state);
    expect(body).toMatchObject({ modelIds: ['gpt-6-luna', 'gemini-4-carbon'], defaultModelId: 'gpt-6-luna' });
    expect(body).not.toHaveProperty('modelClasses');
    expect(versionChanges(v1, body, ctx)).toEqual([
      { field: 'Models', before: MODEL_IDS.join(', '), after: 'gpt-6-luna, gemini-4-carbon' },
      { field: 'Default model', before: 'claude-sonnet-5-5', after: 'gpt-6-luna' },
    ]);
    expect(validate(state)).toEqual({});
    expect(validate({ ...state, modelIds: [] }).modelIds).toBe('Offer at least one model.');
    expect(validate({ ...state, defaultModelId: 'claude-sonnet-5-5' }).modelIds).toMatch(/Choose a default model from the models you offer/);
  });
  it('edits every setting through labelled controls under a publish bar, with no rule pack control', () => {
    const html = render(createElement(VersionEditor, { data: view() }));
    const page = text(html);
    expect(page).toContain('Version 1 · published Nov 15, 2026, 10:00 AM PT No unpublished changes Review and publish v2');
    expect(page).not.toContain('Discard');
    for (const choice of ['Details', 'Purpose', 'Instructions', '32 words', 'Knowledge', 'Club finances', 'USG rulebook', 'Reads up to', 'Officers',
      'Tools', 'Submit to queue', 'Proposes filing the application in USG’s queue; the user confirms.', 'Models', 'Access', 'All students',
      'All members', 'Named positions', 'Positions', 'Treasurer', 'Change note']) expect(page).toContain(choice);
    // The model checklist, grouped by provider, then the chat default from the same menu chat uses.
    expect(page).toContain('OpenAI gpt-6-luna Economy 1 credit per run gpt-6.1-sol Standard 3 credits per run Anthropic claude-haiku-5-5 Economy 1 credit per run claude-sonnet-5-5 Standard 3 credits per run Google gemini-4-hydrogen Economy 1 credit per run gemini-4-carbon Standard 3 credits per run');
    expect(page).toContain('Default in chat claude-sonnet-5-5 3 credits per run');
    expect(html).toContain('aria-label="Default in chat: claude-sonnet-5-5"');
    expect(html).not.toContain('version-rulepack');
    expect(page).not.toContain('USG internal');
    expect(page).not.toContain('Model classes');
    expectProductOnly(page);
    const retired = render(createElement(VersionEditor, { data: view({ template: { ...view().template, status: 'retired' } }) }));
    expect(retired).toMatch(/<fieldset disabled=""/);
    expect(text(retired)).toContain('Retired templates cannot publish new versions.');
    expect(text(retired)).not.toContain('Review and publish');
  });
  it('previews the chat members see: purpose, starters and the draft’s default model', () => {
    const page = text(render(createElement(VersionEditor, { data: view() })));
    expect(page).toContain('Preview What members see Funding pre-check USG template · v1 · Funding Budget');
    expect(page).toContain(`What would you like to work on? ${v1.purpose} How much of the annual cap does the spring budget use? When are funding requests due?`);
    expect(page).toContain('Ask Funding pre-check… claude-sonnet-5-5 3 credits Run');
    const props = { name: 'Funding pre-check', slug: 'new-template', versionLabel: 'v2 draft', purpose: 'Answers questions about USG funding.',
      modelIds: ['gpt-6-luna', 'claude-haiku-5-5'] as typeof v1.modelIds, defaultModelId: 'claude-haiku-5-5' as const, onDefaultModel: () => {} };
    const html = render(createElement(TemplatePreview, props));
    expect(text(html)).toContain('USG template · v2 draft Answers questions about USG funding. Ask Funding pre-check… claude-haiku-5-5 1 credit Run');
    expect(html).toContain('aria-label="Preview model: claude-haiku-5-5"');
    expect(text(html)).not.toContain('What would you like to work on?');
    expectProductOnly(text(html));
  });
});

describe('/usg/templates', () => {
  it('shows each template as a card: purpose, distribution, status, reach and default model', () => {
    const data = view();
    const html = render(createElement(TemplatesGrid, { data: { templates: [data.template], targets: data.targets } }));
    const page = text(html);
    expect(page).toContain('1 result');
    expect(page).not.toContain('1 results');
    expect(page).toContain(`Funding pre-check v1 ${v1.purpose} Required Active All active clubs Installed in 3 of 3`);
    expect(html).toContain('aria-label="Installed in 3 of 3 clubs"');
    expect(page).toContain('Default model claude-sonnet-5-5 Last distributed Nov 15, 2026, 10:00 AM PT');
    expect(html).toContain(`href="/usg/templates/${TEMPLATE.fundingPrecheck}"`);
    expect(html).not.toContain('<table');
    expectProductOnly(page);
    expect(text(render(createElement(TemplatesGrid, { data: { templates: [], targets: data.targets } })))).toContain('No templates yet Create a template to publish its first version');
  });
});

describe('/usg/documents', () => {
  it('lists USG’s documents with source, readers, version and the templates that read them', () => {
    const html = render(createElement(DocumentsTable, { documents: rows, orgId: ORG.usg }));
    const page = text(html);
    expect(page).toContain('Title Source Readable by Version Used by');
    expect(page).toContain('USG Funding Department Guidelines USG rulebook Public v1 Funding pre-check, USG review assistant');
    expect(page).toContain('Reviewer notes USG internal USG internal v1 USG review assistant');
    expect(html).toContain(`href="/usg/documents/${DOCUMENT.usgFundingRules}"`);
    expect(html).toContain(`href="/usg/templates/${TEMPLATE.fundingPrecheck}"`);
    expect(html).not.toContain(`href="/usg/templates/${TEMPLATE.usgReviewAssistant}"`);
    const empty = render(createElement(DocumentsTable, { documents: [], orgId: ORG.usg }));
    expect(text(empty)).toContain('No USG documents yet. Upload a document');
    expect(empty).toContain(`href="/org/${ORG.usg}/documents"`);
    expectProductOnly(page);
  });
});

describe('/usg/documents/[documentId]', () => {
  it('shows the document’s metadata and its text, with the publish action', () => {
    const html = render(createElement(DocumentDetail, { data: detail }));
    const page = text(html);
    expect(page).toContain('USG Funding Department Guidelines All documents Publish new version');
    expect(html).toContain('href="/usg/documents"');
    expect(page).toContain('Source USG rulebook Readable by Public Version v1 Used by Funding pre-check, USG review assistant');
    expect(page).toContain('USC Undergraduate Student Government Funding Department Guidelines, current as of October 21, 2026.');
    expect(page).toContain('Section 1: Funding Application Timeline');
    expect(page).toContain('Individual organizations may receive a maximum of $8,000 from the USG Funding Department per year.');
    expect(page).not.toContain('Review v2');
    // USG's guidelines themselves say "Examples include…".
    expectProductOnly(page, ['Example']);
    expectProductOnly(page.slice(0, page.indexOf('USC Undergraduate Student Government')));
  });
  it('renders headings, paragraphs and nested bulleted and numbered lists', () => {
    const blocks = parseDocument(guidelines);
    expect(blocks[0]).toEqual({ kind: 'paragraph', text: 'USC Undergraduate Student Government Funding Department Guidelines, current as of October 21, 2026.' });
    expect(blocks[1]).toEqual({ kind: 'heading', level: 2, text: 'Section 1: Funding Application Timeline' });
    const html = render(createElement(DocumentBody, { text: guidelines }));
    expect(html).toMatch(/<h2[^>]*>Section 2: Funding Application Overview<\/h2>/);
    // "A completed application consists of the following:" holds a list, whose items hold another.
    expect(html).toMatch(/A completed application consists of the following:<ul[^>]*><li[^>]*>Applicant information/);
    expect(html).toMatch(/including quotes for each individual expense<ul[^>]*><li[^>]*>For online purchases/);
    expect(html).not.toContain('## ');
    const notes = render(createElement(DocumentBody, { text: reviewerNotes }));
    expect(notes).toMatch(/<ol[^>]*><li[^>]*>Event count:/);
    expect(render(createElement(DocumentBody, { text: 'Line one\nline two\n\n<b>bold</b>' }))).toContain('<p>Line one line two</p><p>&lt;b&gt;bold&lt;/b&gt;</p>');
  });
  it('diffs the text line by line', () => {
    const edited = guidelines.replace('maximum of $8,000', 'maximum of $10,000');
    expect(lineChanges(guidelines, guidelines)).toEqual([]);
    expect(lineChanges(guidelines, edited)).toEqual([{
      line: 52,
      before: '- Individual organizations may receive a maximum of $8,000 from the USG Funding Department per year.',
      after: '- Individual organizations may receive a maximum of $10,000 from the USG Funding Department per year.',
    }]);
    expect(lineChanges('a\nb\nc', 'a\nB\nc\nd')).toEqual([{ line: 2, before: 'b', after: 'B' }, { line: 4, before: null, after: 'd' }]);
    expect(lineChanges('a\nb\nc', 'a\nc')).toEqual([{ line: 2, before: 'b', after: null }]);
    expect(lineChanges('a\nb', 'a\n\nb')).toEqual([]);
  });
  it('counts instead of diffing when the edited region is too large', () => {
    const before = Array.from({ length: 2100 }, (_, i) => `old ${i}`).join('\n');
    const after = Array.from({ length: 2100 }, (_, i) => `new ${i}`).join('\n');
    expect(2100 * 2100).toBeGreaterThan(MAX_DIFF_CELLS);
    expect(lineDiff(before, after)).toEqual({ changes: null, count: 2100 });
    // The shared head and tail do not count toward the limit.
    expect(lineDiff(`${before}\nx`, `${before}\ny`)).toEqual({ changes: [{ line: 2101, before: 'x', after: 'y' }], count: 1 });
    const page = text(render(createElement(DocumentReview, { diff: lineDiff(before, after), usedBy: users, nextVersion: 2 })));
    expect(page).toContain('Changed lines (2,100)');
    expect(page).not.toContain('Line Before After');
    expect(page).toContain('Funding pre-check and USG review assistant read version 2 on their next run.');
  });
  it('reviews the changed lines and who reads the new version', () => {
    const diff = lineDiff(guidelines, guidelines.replace('maximum of $8,000', 'maximum of $10,000'));
    const page = text(render(createElement(DocumentReview, { diff, usedBy: users, nextVersion: 2 })));
    expect(page).toContain('Changed lines (1) Line Before After 52');
    expect(page).toContain('maximum of $8,000 from the USG Funding Department per year.');
    expect(page).toContain('maximum of $10,000 from the USG Funding Department per year.');
    expect(page).toContain('Funding pre-check and USG review assistant read version 2 on their next run.');
    expect(page).not.toContain('not shown');
    expect(page).not.toContain('Could not save');
    expectProductOnly(page);

    const many = lineDiff(Array.from({ length: 14 }, (_, i) => `line ${i}`).join('\n'), Array.from({ length: 14 }, (_, i) => `LINE ${i}`).join('\n'));
    const long = text(render(createElement(DocumentReview, { diff: many, usedBy: [], nextVersion: 3 })));
    expect(long).toContain('Changed lines (14)');
    expect(long).toContain('4 more changed lines not shown');
    expect(long).not.toContain('LINE 10');
    expect(consequence(users.slice(0, 1), 3)).toBe('Funding pre-check reads version 3 on its next run.');
    // One-sided rows carry words for screen readers, not an aria-label on a plain span.
    const added = render(createElement(DocumentReview, { diff: lineDiff('a', 'a\nb'), usedBy: [], nextVersion: 2 }));
    expect(added).toContain('<span class="sr-only">Added line</span>');
    expect(added).not.toContain('aria-label="No line"');
  });
  it('shows the server’s message when the document changed since it was opened', () => {
    const stale = 'This document changed since you opened it. Reload to see version 2.';
    const page = text(render(createElement(DocumentReview, { diff: lineDiff('a', 'b'), usedBy: users, nextVersion: 2, error: stale })));
    expect(page).toContain(`Could not save ${stale}`);
  });
});
