// Owner: B (WP-6). POST /api/usg/templates/:id/distribute — demo beat D2 (§14).
//
// Idempotent: D1's roster sync runs it again and existing clubs report no changes, so the count
// it returns is the number of installations this call actually created.
import { z } from 'zod';
import { parseBody, requireUser, route } from '@/lib/api';
import { distribute } from '@/lib/distribution';

export const POST = route<{ templateId: string }>(async ({ req, actor, params }) => {
  requireUser(actor);
  // Empty body, sent as application/json: the content-type check is what blocks cross-site forms.
  await parseBody(req, z.object({}).strict());
  return distribute(actor, params.templateId);
});
