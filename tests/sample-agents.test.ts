import { describe, expect, it } from 'vitest';
import { SAMPLE_AGENTS } from '@db/seed/sample-agents';
import { ORG } from '@db/seed/ids';

describe('sample agent definitions', () => {
  it('adds four unique optional examples across three clubs', () => {
    expect(SAMPLE_AGENTS).toHaveLength(4);
    expect(new Set(SAMPLE_AGENTS.map((a) => a.templateId)).size).toBe(4);
    expect(new Set(SAMPLE_AGENTS.map((a) => a.installationId)).size).toBe(4);
    expect(new Set(SAMPLE_AGENTS.map((a) => a.slug)).size).toBe(4);
    expect(new Set(SAMPLE_AGENTS.map((a) => a.orgId))).toEqual(new Set([ORG.startup, ORG.archery, ORG.dance]));
  });

  it('keeps the two public examples restricted to public sources and tier', () => {
    const publicAgents = SAMPLE_AGENTS.filter((a) => a.audience === 'public');
    expect(publicAgents).toHaveLength(2);
    for (const agent of publicAgents) {
      expect(agent.maxTier).toBe('public');
      expect(agent.sourceKinds).toEqual(['public']);
    }
  });

  it('uses separate member sources for minutes and event history', () => {
    const memberAgents = SAMPLE_AGENTS.filter((a) => a.audience === 'members');
    expect(memberAgents.map((a) => [a.slug, a.maxTier, a.sourceKinds])).toEqual([
      ['meeting-recap', 'members', ['minutes']],
      ['event-retrospective', 'members', ['archive']],
    ]);
  });
});
