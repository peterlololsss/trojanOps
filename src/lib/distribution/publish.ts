// Owner: B. D3 uses the same lock, merged overrides and I7 checks as any installation edit.
import type { Actor, EffectiveAgent } from '../contracts';
import { writeInstallation } from './install';

/** Clamp → setLimit → write → re-read → audit. The shared writer defaults the installation
 * budget to half the club's monthly limit, under the club lock, before enabling public access. */
export async function publishToAllStudents(
  actor: Actor, installationId: string, input: { limitMicro?: number; expectOrgId?: string } = {},
): Promise<EffectiveAgent> {
  return writeInstallation(actor, installationId, {
    audience: 'public', usableBy: [], enabled: true, limitMicro: input.limitMicro,
  }, true, input.expectOrgId);
}
