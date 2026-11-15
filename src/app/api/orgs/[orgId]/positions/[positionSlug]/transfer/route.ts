// Owner: B (WP-7). POST /api/orgs/:orgId/positions/:slug/transfer — demo beat D7 (§14).
//
// Succession: the outgoing holder's membership ends and the incoming one is inserted as `manual`
// in one transaction, so the agents that follow the position change hands at the same instant.
// §13's precedence rule then keeps a later roster sync from undoing it.
import { z } from 'zod';
import { parseBody, requireUser, route } from '@/lib/api';
import { transferPosition } from '@/lib/lifecycle/transfer';

const Body = z.object({ toUserId: z.uuid() }).strict();

export const POST = route<{ orgId: string; positionSlug: string }>(async ({ req, actor, params }) => {
  requireUser(actor);
  const { toUserId } = await parseBody(req, Body);
  await transferPosition(actor, params.orgId, params.positionSlug, toUserId);
  return { ok: true };
});
