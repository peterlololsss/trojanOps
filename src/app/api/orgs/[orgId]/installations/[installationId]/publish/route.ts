// Owner: B (WP-5). POST /api/orgs/:orgId/installations/:id/publish — "Publish to all students",
// demo beat D3 (§14).
//
// The service authorises by installation: it resolves the club from the row and requires the
// caller to be its president. The path's orgId is passed too, so a URL naming one club cannot
// quietly publish an agent belonging to another.
import { z } from 'zod';
import { parseBody, requireUser, route } from '@/lib/api';
import { publishToAllStudents } from '@/lib/distribution';

/** An optional limit the president chose; §8 defaults it to half the club's monthly quota.
 * Send `{}` as application/json: the body may be empty, but the content-type check is what
 * blocks cross-site forms, so it is never skipped. */
const Body = z.object({ limitMicro: z.number().int().nonnegative().optional() }).strict();

export const POST = route<{ orgId: string; installationId: string }>(async ({ req, actor, params }) => {
  requireUser(actor);
  const { limitMicro } = await parseBody(req, Body);
  return publishToAllStudents(actor, params.installationId, { limitMicro, expectOrgId: params.orgId });
});
