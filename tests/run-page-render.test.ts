// Owner: C (WP-9). Markup of the run page parts: transcript, pending action cards and the Run details
// panel. Rendered to static HTML in node (no browser), with seed ids for fixtures.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RunWorkspace } from '@/components/inspector';
import { humanizeTool, readCount } from '@/components/inspector/format';
import { RunDetailsPanel } from '@/components/inspector/run-details-panel';
import { PendingActionCard } from '@/components/inspector/pending-action-card';
import type { ActionStatus, Turn } from '@/components/inspector/run-state';
import { Transcript, type TranscriptProps } from '@/components/inspector/transcript';
import { RunErrorBanner, validateInput } from '@/components/inspector/run-workspace';
import type { RunResult } from '@/lib/contracts';
import { DOCUMENT, INSTALLATION, ORG, SOURCE } from '@db/seed/ids';

const ACTION_ID = '00000099-0000-4000-8000-000000000001';

const result: RunResult = {
  runId: '00000098-0000-4000-8000-000000000001',
  reply: 'Club handoff can read 2 documents.\nMeeting minutes 2026-10-08 and Recruiting FAQ.',
  citations: [
    { documentId: DOCUMENT.minutes20261008, quote: 'The board met on October 8.' },
    { documentId: DOCUMENT.sponsorContacts, quote: 'This citation is not in the inspector.' },
  ],
  pendingActions: [{ id: ACTION_ID, tool: 'submit_to_queue' }],
  inspector: {
    runGrants: [{ grant: '*', label: 'Any signed-in student' }, { grant: `${ORG.startup}:member`, label: 'Startup Club · Member' }],
    sources: [{ id: SOURCE.startup.minutes, name: 'Startup Club · Minutes' }],
    permitted: [{ id: DOCUMENT.minutes20261008, title: 'Meeting minutes 2026-10-08', tier: 'members' }],
    readInRun: [{ id: DOCUMENT.minutes20261008, title: 'Meeting minutes 2026-10-08' }],
    templateVersion: 1,
    billedClub: 'Startup Club',
    costMicro: 10_000,
    quotaRemainingMicro: { 'Startup Club': 4_990_000 },
    auditEventId: 1042,
  },
};

const turns: Turn[] = [
  { kind: 'you', key: 'you-0', text: 'What did the board decide last meeting?' },
  { kind: 'agent', key: result.runId, result },
];

const transcript = (props: Partial<TranscriptProps> = {}) => renderToStaticMarkup(createElement(Transcript, {
  turns, actions: { [ACTION_ID]: { status: 'pending' } }, agentName: 'Club handoff', ...props,
}));

const card = (status: ActionStatus) => renderToStaticMarkup(createElement(PendingActionCard, {
  action: { id: ACTION_ID, tool: 'submit_to_queue' }, status,
}));

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
/** Each button's text, ignoring icons inside it. */
const buttons = (html: string) => [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((m) => text(m[1]).trim());

describe('run page markup', () => {
  it('labels speakers and makes AI answers navigable as headings', () => {
    const html = transcript();
    expect(html).toContain('>You</p>');
    expect(html).toMatch(/<h2\b[^>]*>AI · Club handoff<\/h2>/);
    expect(html).toContain('What did the board decide last meeting?');
    expect(html).toContain('whitespace-pre-wrap');
  });

  it('keeps run metadata out of the transcript and links each answer to its run details', () => {
    const html = transcript();
    expect(html).not.toContain('Audit #1042');
    expect(html).not.toContain('Read 1 of 1 permitted documents');
    expect(html).not.toContain('<details');
    expect(text(html)).toContain('Copy');
    expect(html).not.toContain('Run details');
    const linked = transcript({ onInspect: () => {} });
    expect(buttons(linked)).toContain('Run details');
    expect(linked).not.toContain('Show this run in inspector');
  });

  it('escapes reply text instead of rendering HTML', () => {
    const html = transcript({ turns: [{ kind: 'agent', key: 'r', result: { ...result, reply: '<img src=x onerror=alert(1)>' } }] });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('labels answers with the agent name and no runtime note, and keeps the tier mark', () => {
    const html = transcript();
    expect(html).not.toMatch(/Demo runtime|placeholder answer/i);
    expect(html).toContain('Uses Members information');
    expect(html).toMatch(/aria-expanded="false"/);
  });

  it('takes citation titles from the inspector and drops unknown citations', () => {
    const html = transcript();
    expect(html).toContain('Sources for this answer');
    expect(html).toContain('Meeting minutes 2026-10-08');
    expect(html).toContain('aria-label="Source 1: Meeting minutes 2026-10-08"');
    expect(html).not.toContain('This citation is not in the inspector.');
    const none = transcript({ turns: [{ kind: 'agent', key: 'r', result: { ...result, citations: [] } }] });
    expect(none).toContain('This answer cites no documents.');
  });

  it('never shows raw grants or ids in the transcript', () => {
    const html = transcript();
    expect(html).not.toMatch(/0000001\d-0000-4000/);   // org ids
    expect(html).not.toContain(DOCUMENT.minutes20261008);
    expect(html).not.toContain(':member');
  });

  it('shows a pending action after the turn that proposed it, with Confirm, Reject and the waiting copy', () => {
    const html = transcript();
    expect(html.indexOf('Pending action: Submit to queue')).toBeGreaterThan(html.indexOf('Club handoff'));
    const pending = text(card({ status: 'pending' }));
    expect(pending).toContain('Submit to queue');
    expect(pending).toContain('submit_to_queue');
    expect(pending).toContain('Waiting for you');
    expect(pending).toContain('Waits for you to confirm. Nothing runs until you do.');
    expect(pending).toContain('Confirm');
    expect(pending).toContain('Reject');
  });

  const live = (html: string) => html.match(/<p role="status" aria-live="polite"[^>]*>(.*?)<\/p>/)?.[1];

  it('states confirming, confirmed and rejected with words in one live region, hiding buttons that cannot act', () => {
    const confirming = card({ status: 'confirming' });
    expect(text(live(confirming) ?? '')).toContain('Confirming…');
    expect(buttons(confirming)).toEqual([]);   // no disabled buttons without a reason

    const confirmed = card({ status: 'confirmed' });
    expect(text(live(confirmed) ?? '')).toContain('Confirmed and recorded in the audit log.');
    expect(buttons(confirmed)).toEqual([]);

    const rejected = card({ status: 'rejected' });
    expect(text(live(rejected) ?? '')).toContain('Rejected. Nothing ran.');
    expect(buttons(rejected)).toEqual([]);
  });

  it('always renders exactly one live region per card, empty while pending', () => {
    const states: ActionStatus[] = [
      { status: 'pending' }, { status: 'confirming' }, { status: 'rejecting' }, { status: 'confirmed' }, { status: 'rejected' },
      { status: 'failed', message: 'Could not confirm this action.', retry: true },
      { status: 'failed', message: 'This action was already handled.', retry: false },
    ];
    for (const status of states) {
      expect(card(status).match(/role="status" aria-live="polite"/g)).toHaveLength(1);
    }
    expect(live(card({ status: 'pending' }))).toBe('');
  });

  it('offers Confirm again after a failure worth retrying', () => {
    const failed = card({ status: 'failed', message: 'Could not confirm this action. Check your connection and try again.', retry: true });
    expect(failed).toContain('role="alert"');
    expect(text(failed)).toContain('Could not confirm this action. Check your connection and try again. You can try again.');
    expect(buttons(failed)).toEqual(['Confirm', 'Reject']);
    expect(text(failed)).not.toContain('Only the person who ran the agent');
  });

  it('drops Confirm after a final refusal and says who can confirm', () => {
    const refused = card({ status: 'failed', message: 'You can’t confirm this action.', retry: false });
    expect(refused).toContain('role="alert"');
    expect(text(refused)).toContain('You can’t confirm this action.');
    expect(text(refused)).not.toContain('You can try again');
    expect(text(refused)).toContain('Only the person who ran the agent, as a member of the agent’s club, can confirm or reject it.');
    expect(buttons(refused)).toEqual([]);
    expect(text(refused)).not.toContain('Waits for you to confirm');
  });

  it('explains what Run details will show before the first run', () => {
    const html = renderToStaticMarkup(createElement(RunDetailsPanel, { inspector: null }));
    expect([...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1])).toEqual(['Run details']);
    expect(text(html).trim()).toBe('Run details No runs yet. Send a message to see this run’s document access, sources and cost.');
    const after = renderToStaticMarkup(createElement(RunDetailsPanel, { inspector: result.inspector }));
    expect([...after.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1]))
      .toEqual(['Run grants', 'Sources', 'Documents', 'Versions', 'Billing', 'Audit']);
    expect(after).toContain('Template v1');
    expect(after).not.toContain('Finished run');
  });

  it('renders the empty workspace with a header, a labelled field, a live progress region and run details', () => {
    const html = renderToStaticMarkup(createElement(RunWorkspace, {
      installationId: INSTALLATION.startupHandoff, agentName: 'Club handoff',
      header: { source: 'Startup Club', version: 1, tags: ['Onboarding', 'Minutes'], description: 'Helps incoming officers catch up.' },
    }));
    expect(html).toMatch(/<h1[^>]*>Club handoff<\/h1>/);
    expect(text(html)).toContain('Startup Club · v1 · Onboarding Minutes');
    expect(html).toContain('Helps incoming officers catch up.');
    expect(html).toMatch(/<label[^>]*class="sr-only"[^>]*>Message<\/label>/);
    expect(html).toContain('placeholder="Ask Club handoff…"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Run Club handoff');
    expect(html).toContain('Run details');
    expect(html).toContain('No runs yet.');
    expect(html).not.toContain('New conversation');
    expect(html).not.toMatch(/Demo runtime|Thinking|Enter to run|Only you can see|What Club handoff can read|Paid by/i);
    expect(html).not.toContain(INSTALLATION.startupHandoff);
  });

  it('shows the quota copy verbatim and links to the persona picker when signed out', () => {
    const message = 'Your monthly AI quota in Startup Club is used up ($0.00 of $0.00). Ask your president to raise it.';
    const quota = renderToStaticMarkup(createElement(RunErrorBanner, { error: { code: 'quota_exceeded', message } }));
    expect(quota).toContain('role="alert"');
    expect(quota).toContain(message);
    expect(quota).toContain('Dismiss');
    const signedOut = renderToStaticMarkup(createElement(RunErrorBanner, { error: { code: 'unauthenticated', message: 'Sign in to continue.' } }));
    expect(signedOut).toMatch(/<a[^>]*href="\/"[^>]*>Choose a persona<\/a>/);
  });

  it('validates input on submit and formats helper copy', () => {
    expect(validateInput('   ')).toBe('Write a message before you run the agent.');
    expect(validateInput('x'.repeat(8001))).toBe('Messages can be up to 8,000 characters. Shorten this one by 1.');
    expect(validateInput(' Hello ')).toBeNull();
    expect(humanizeTool('submit_to_queue')).toBe('Submit to queue');
    expect(readCount(0)).toBe('Read no documents');
    expect(readCount(3)).toBe('Read 3 documents');
  });
});
