// Owner: B (WP-6). POST /api/templates/:id/versions — publish the next version of a template
// (§14: USG admin for a global template, the club president for its own).
//
// Versions are immutable once published; installations tracking `latest` pick this one up on
// their next read, and pinned ones keep theirs.
import { parseBody, requireUser, route } from '@/lib/api';
import { publishVersion, versionDraftSchema } from '@/lib/distribution';

export const POST = route<{ templateId: string }>(async ({ req, actor, params }) => {
  requireUser(actor);
  const draft = await parseBody(req, versionDraftSchema);
  return publishVersion(actor, params.templateId, draft);
});
