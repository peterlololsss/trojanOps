import { describe, expect, it } from 'vitest';
import { clampInstallation, type ClampInput } from '@/lib/distribution/clamps';

const input: ClampInput = {
  version: { audience: 'members', usableBy: [], maxTier: 'members', tools: [], modelClasses: ['economy', 'standard'], defaultModelClass: 'standard' },
  installation: {},
  club: { policy: { allowedModelClasses: ['economy', 'standard'], allowPublicAgents: true }, positionSlugs: ['member'], ownedSourceIds: [], quotaMicro: 100_000 },
};

describe('per-message model choices', () => {
  it.each([
    { fixed: null, template: ['economy', 'standard'], policy: ['economy', 'standard'], expected: ['economy', 'standard'] },
    { fixed: 'economy', template: ['economy', 'standard'], policy: ['economy', 'standard'], expected: ['economy'] },
    { fixed: null, template: ['economy'], policy: ['economy', 'standard'], expected: ['economy'] },
    { fixed: null, template: ['economy', 'standard'], policy: ['economy'], expected: ['economy'] },
  ] satisfies Array<{ fixed: 'economy' | null; template: Array<'economy' | 'standard'>; policy: Array<'economy' | 'standard'>; expected: string[] }>)(
    'limits choices to the template, policy and fixed override ($expected)', ({ fixed, template, policy, expected }) => {
      const result = clampInstallation({ ...input,
        version: { ...input.version, modelClasses: template },
        installation: { modelClass: fixed },
        club: { ...input.club, policy: { ...input.club.policy, allowedModelClasses: policy } },
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.effective.allowedModelClasses).toEqual(expected);
    },
  );
});
