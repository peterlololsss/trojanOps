// Owner: A. The mock runtime (§7): no model call. Lists the accessible documents, quotes the first
// sentence of up to three, adds the rule-pack line, costs a flat $0.01.
import type { AgentRuntime } from '../contracts';

export const MOCK_COST_MICRO = 10_000;

const firstSentence = (text: string) => (text.match(/^.*?[.!?](\s|$)/)?.[0] ?? text).trim();
const titled = (d: { title: string; version?: number }) => (d.version && d.version > 1 ? `${d.title} (v${d.version})` : d.title);

export const mockRuntime: AgentRuntime = {
  async run(agent, _actor, _input, { accessibleDocuments: docs }) {
    const lines = [
      docs.length
        ? `I can read ${docs.length} document${docs.length === 1 ? '' : 's'}: ${docs.map(titled).join(', ')}.`
        : 'I cannot read any documents for this run.',
    ];
    if (agent.rulePack) {
      const cap = (agent.rulePack.content as { annualCapUsd?: number }).annualCapUsd;
      lines.push(`${agent.rulePack.label} v${agent.rulePack.version} · annual cap $${cap?.toLocaleString('en-US')}`);
    }
    return {
      reply: lines.join('\n\n'),
      citations: docs.slice(0, 3).map((d) => ({ documentId: d.id, quote: firstSentence(d.bodyMd) })),
      proposedActions: [],
      usage: { model: 'mock', inputTokens: 0, outputTokens: 0, costMicro: MOCK_COST_MICRO },
    };
  },
};
