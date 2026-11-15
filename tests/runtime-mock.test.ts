import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AccessibleDocument, Actor, EffectiveAgent } from '@/lib/contracts';
import { mockRuntime } from '@/lib/runtime/mock';

const actor: Actor = { userId: 'member', activeOrgId: 'club', positions: ['member'], grants: ['*', 'club:*'] };
const agent: EffectiveAgent = {
  installationId: 'handoff', orgId: 'club', templateSlug: 'handoff', name: 'Club handoff',
  templateVersion: 1, status: 'enabled', purpose: 'Brief incoming organizers', audience: 'members',
  usableBy: [], maxTier: 'officers', sourceIds: ['operations', 'finance'], tools: [],
  modelClass: 'economy', systemPrompt: 'Use only readable documents.',
};
const minutes: AccessibleDocument = {
  id: 'minutes', title: 'HackSC organizing meeting', tier: 'members',
  bodyMd: readFileSync(new URL('../db/seed/docs/hacksc-minutes-2026.md', import.meta.url), 'utf8'),
};
const handoff: AccessibleDocument = {
  id: 'handoff', title: 'HackSC president handoff', tier: 'members',
  bodyMd: readFileSync(new URL('../db/seed/docs/hacksc-handoff-2026.md', import.meta.url), 'utf8'),
};
const finance: AccessibleDocument = {
  id: 'finance', title: 'HackSC finance worksheet', tier: 'officers',
  bodyMd: readFileSync(new URL('../db/seed/docs/hacksc-budget-2026.md', import.meta.url), 'utf8'),
};
const run = (input: string, docs: AccessibleDocument[], config = agent) =>
  mockRuntime.run(config, actor, input, { runId: 'run', accessibleDocuments: docs });

describe('grounded demo runtime', () => {
  it('turns accessible handoff records into a labeled lesson and actionable process', async () => {
    const result = await run('I am organizing for the first time. Show the old process, lessons and a new plan.', [minutes, handoff]);
    expect(result.reply).toContain('Demo');
    expect(result.reply).toContain('no model call');
    expect(result.reply).toContain('Our biggest mistake');
    expect(result.reply).toContain('1. Start the room request six weeks');
    expect(result.reply).toContain('6. At closing');
    expect(result.reply).toContain('45 minutes');
    expect(result.reply.indexOf('Our biggest mistake')).toBeLessThan(result.reply.indexOf('1. Start'));
    expect(result.reply).not.toContain('$7,300');
    expect(result.reply).not.toMatch(/[\u3400-\u9fff]/u);
    expect(new Set(result.citations.map((citation) => citation.documentId))).toEqual(new Set(['minutes', 'handoff']));
    for (const citation of result.citations) {
      expect([minutes, handoff].find((document) => document.id === citation.documentId)?.bodyMd).toContain(citation.quote);
    }
    expect(result.usage).toEqual({ model: 'demo-economy', inputTokens: 0, outputTokens: 0, costMicro: 10_000 });
  });

  it.each(['Show the club budget and financial expenses.', 'Show me HackSC’s financial documents.'])('refuses inaccessible finance instead of quoting unrelated member notes: %s', async (input) => {
    const result = await run(input, [minutes, handoff]);
    expect(result.reply).toMatch(/don’t have permission to access the club’s financial documents/);
    expect(result.reply).not.toContain('excerpts');
    expect(result.citations).toEqual([]);
    expect(result.proposedActions).toEqual([]);
    expect(result.reply).not.toContain('worksheet');
    expect(result.reply).not.toContain('$7,300');
    expect(result.reply).not.toMatch(/[\u3400-\u9fff]/u);
  });

  it('uses readable finance records for an authorized financial answer', async () => {
    const result = await run('Summarize the budget', [minutes, finance]);
    expect(result.reply).toContain('$7,300');
    expect(result.reply).toContain('unapproved scenario amounts');
    expect(result.citations.map((citation) => citation.documentId)).toEqual(['finance']);
    expect(finance.bodyMd).toContain(result.citations[0].quote);
  });

  it('does not turn missing sources into a pending write', async () => {
    const result = await run('Please submit this budget', [], { ...agent, tools: ['submit_to_queue'] });
    expect(result.citations).toEqual([]);
    expect(result.proposedActions).toEqual([]);
  });

  it('preserves verified citations, versions, standard pricing and pending human decisions', async () => {
    const result = await run('Please submit this budget', [{ ...finance, version: 2 }], {
      ...agent, modelClass: 'standard', tools: ['submit_to_queue'], templateSlug: 'funding-precheck',
    });
    expect(result.reply).toContain('HackSC finance worksheet (v2)');
    expect(result.reply).toContain('[1]');
    expect(result.reply).not.toContain('documentId');
    expect(result.usage.costMicro).toBe(30_000);
    expect(result.proposedActions).toEqual([{ tool: 'submit_to_queue', args: {} }]);
  });

  it('keeps the readable rulebook when a funding question mentions a budget', async () => {
    // Given a funding agent with readable policy and no club finance record.
    const rulebook: AccessibleDocument = { id: 'rules', title: 'USG Funding Department Guidelines',
      tier: 'public', version: 2, bodyMd: 'The annual maximum is $10,000. Requests require officer approval.' };
    // When the funding question includes a finance keyword.
    const result = await run('What budget limit applies?', [rulebook], { ...agent, templateSlug: 'funding-precheck' });
    // Then the rulebook remains the cited source instead of becoming a finance-access refusal.
    expect(result.citations.map((citation) => citation.documentId)).toEqual(['rules']);
    expect(rulebook.bodyMd).toContain(result.citations[0].quote);
    expect(result.reply).toContain('$10,000');
  });
});
