import { createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Composer } from '@/components/inspector/composer';
import { CitationContent } from '@/components/inspector/citation-content';
import { Transcript } from '@/components/inspector/transcript';
import type { RunResult } from '@/lib/contracts';
import type { ChatConfig } from '@/lib/documents/run-config';

const config: ChatConfig = {
  orgId: 'club', scope: { sentence: 'Public sources only.', grantLabels: ['Any signed-in student'], sources: ['Public'], billedClub: 'Startup Club' },
  models: { allowed: [{ modelClass: 'economy', priceMicro: 10_000 }, { modelClass: 'standard', priceMicro: 30_000 }], defaultClass: 'economy',
    ids: ['gpt-6-luna', 'gpt-6.1-sol', 'claude-haiku-5-5', 'claude-sonnet-5-5'], defaultId: 'gpt-6-luna', fixedByClub: false, limitedByTemplate: false },
  quota: { scope: 'student_daily', limitMicro: 50_000, spentMicro: 40_000, remainingMicro: 10_000, resetsAt: '2026-11-16T08:00:00Z' },
  blockedMessage: null, starters: [], audienceLabel: 'All students', templateVersion: 1,
};
const renderComposer = (over: Partial<Parameters<typeof Composer>[0]> = {}) => renderToStaticMarkup(createElement(Composer, {
  config, agentName: 'Recruiting Q&A', input: '', model: 'gpt-6.1-sol', running: false, playing: false, error: null, charge: null,
  textareaRef: createRef<HTMLTextAreaElement>(), onInput: () => {}, onModel: () => {}, onRun: () => {}, onStop: () => {}, ...over,
}));

describe('chat balance and failure states', () => {
  it('offers an affordable model and names the daily reset when Standard costs too much', () => {
    const html = renderComposer();
    expect(html).toContain('Switch to gpt-6-luna');
    expect(html).toContain('80% used');
    expect(html).toContain('midnight PT');
    expect(html).toContain('aria-label="Run Recruiting Q&amp;A"');
    expect(html).not.toContain('disabled=');
  });
  it('explains a block on load while allowing the gateway to decide a submission', () => {
    const html = renderComposer({ config: { ...config, quota: { ...config.quota, remainingMicro: 0, spentMicro: 50_000 }, blockedMessage: 'Daily allowance is used up.' } });
    expect(html).toContain('Daily allowance is used up.');
    expect(html).toContain('100% used');
    expect(html).not.toContain('disabled=');
  });
  it('offers Stop during playback', () => {
    const html = renderComposer({ playing: true });
    expect(html).toContain('Stop</button>');
    expect(html).not.toContain('Run Recruiting Q&amp;A');
  });
  it('labels the field for screen readers only and shows no keyboard or runtime notes', () => {
    const html = renderComposer();
    expect(html).toMatch(/<label[^>]*class="sr-only"[^>]*>Message<\/label>/);
    expect(html).toContain('placeholder="Ask Recruiting Q&amp;A…"');
    expect(html).toContain('rows="1"');
    expect(html).not.toMatch(/Enter to run|Shift\+Enter|Demo runtime/);
  });
  it('keeps a block in the transcript without a retry action', () => {
    const html = renderToStaticMarkup(createElement(Transcript, { agentName: 'Club handoff', actions: {}, turns: [{ kind: 'note', key: 'n', error: { code: 'quota_exceeded', message: 'No allowance left.' }, retry: false }] }));
    expect(html).toContain('Blocked before the agent ran');
    expect(html).toContain('Nothing was charged.');
    expect(html).not.toContain('Try again');
  });
});

describe('citation quote content', () => {
  it.each([true, false])('gates quotes on the current permission decision (%s)', (allowed) => {
    const html = renderToStaticMarkup(createElement(CitationContent, { n: 1, title: 'Minutes', documentId: 'private-document-id', tier: 'members', quote: 'The board met on October 8.', allowed, reason: allowed ? 'Readable through Startup Club · Member.' : 'Access changed.' }));
    expect(html.includes('The board met on October 8.')).toBe(allowed);
    expect(html).toContain(allowed ? 'Readable through Startup Club' : 'Access changed.');
    expect(html).not.toContain('private-document-id');
  });
});

describe('chat notes between runs', () => {
  const result = (runId: string, version: number): RunResult => ({
    runId, reply: 'Placeholder answer.', citations: [], pendingActions: [],
    inspector: {
      runGrants: [], sources: [], readInRun: [], templateVersion: 1, billedClub: 'Startup Club', costMicro: 30_000,
      quotaRemainingMicro: {}, auditEventId: 1,
      permitted: [{ id: 'guidelines', title: 'USG Funding Department Guidelines', tier: 'public', version }],
    },
  });
  it('says when a document the agent reads moved to a new version', () => {
    const html = renderToStaticMarkup(createElement(Transcript, { agentName: 'Funding pre-check', actions: {}, turns: [
      { kind: 'you', key: 'y1', text: 'Check Demo day.' }, { kind: 'agent', key: 'r1', result: result('r1', 1) },
      { kind: 'you', key: 'y2', text: 'And now?' }, { kind: 'agent', key: 'r2', result: result('r2', 2) },
    ] }));
    expect(html).toContain('USG Funding Department Guidelines is now v2.');
  });
});
