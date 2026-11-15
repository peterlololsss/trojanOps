// Owner: A (WP-4). PUT /api/quota/limits: sets one quota limit (§11, §14). USG admins set platform,
// club and student_daily limits; presidents set member and installation limits in their club. A child
// above its parent is 422 clamp_violation; the response is the level's new remaining().
import { z } from 'zod';
import { parseBody, requireUser, route } from '@/lib/api';
import { quota } from '@/lib/gateway/quota';

const limitMicro = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const Body = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('platform'), limitMicro }),
  z.object({ scope: z.literal('student_daily'), limitMicro }),
  z.object({ scope: z.literal('org'), orgId: z.uuid(), limitMicro }),
  z.object({ scope: z.literal('member'), orgId: z.uuid(), userId: z.uuid(), limitMicro }),
  z.object({ scope: z.literal('installation'), installationId: z.uuid(), limitMicro }),
]);

export const PUT = route(async ({ req, actor }) => {
  const userId = requireUser(actor);
  const body = await parseBody(req, Body);
  await quota.setLimit(actor, body);
  // The student cap is one limit for everyone; its spend shown here is the caller's own.
  return quota.remaining(body.scope === 'student_daily' ? { scope: 'student_daily', userId } : body);
});
