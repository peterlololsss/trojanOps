// Owner: A (WP-4). POST /api/pending-actions/:id/reject: the user who may confirm a pending write
// action rejects it instead (I6, §14). Send `{}` as application/json, as for confirm.
import { z } from 'zod';
import { parseBody, requireUser, route } from '@/lib/api';
import { gateway } from '@/lib/gateway';

export const POST = route<{ id: string }>(async ({ req, actor, params }) => {
  requireUser(actor);
  await parseBody(req, z.object({}).strict());
  return gateway.reject(actor, params.id);
});
