// Owner: B (WP-6). POST /api/usg/templates/:id/retire — USG withdraws a template (§8, §14).
//
// Retiring blocks runs with "Retired by USG" and drops the agent out of the directory and My
// agents, rather than leaving it listed and failing when opened. Installations and documents are
// left alone, so it is reversible by publishing again.
import { z } from 'zod';
import { parseBody, requireUser, route } from '@/lib/api';
import { retire } from '@/lib/distribution';

export const POST = route<{ templateId: string }>(async ({ req, actor, params }) => {
  requireUser(actor);
  // Empty body, sent as application/json: the content-type check is what blocks cross-site forms.
  await parseBody(req, z.object({}).strict());
  await retire(actor, params.templateId);
  return { ok: true };
});
