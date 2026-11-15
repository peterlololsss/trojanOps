// Owner: B (WP-6). POST /api/usg/rule-packs/:slug/versions (§14). Not used by the UI (decision 26).
//
// Published packs are immutable; this adds the next version, and the next funding-precheck run in
// any club resolves it because agents read the latest published pack at run time.
import { parseBody, requireUser, route } from '@/lib/api';
import { publishRulePack, rulePackDraftSchema } from '@/lib/distribution';

export const POST = route<{ slug: string }>(async ({ req, actor, params }) => {
  requireUser(actor);
  const draft = await parseBody(req, rulePackDraftSchema);
  return publishRulePack(actor, params.slug, draft);
});
