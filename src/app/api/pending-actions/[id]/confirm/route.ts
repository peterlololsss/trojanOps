// Owner: A (WP-4). POST /api/pending-actions/:id/confirm: the user who ran the agent confirms a pending
// write action (I6, §14). Send `{}` as application/json: the body is empty, but the content-type check
// is what blocks cross-site forms.
import { z } from 'zod';
import { parseBody, requireUser, route } from '@/lib/api';
import { gateway } from '@/lib/gateway';

export const POST = route<{ id: string }>(async ({ req, actor, params }) => {
  requireUser(actor);
  await parseBody(req, z.object({}).strict());
  return gateway.confirm(actor, params.id);
});
