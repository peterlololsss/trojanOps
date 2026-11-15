// Owner: B (WP-5). PATCH /api/orgs/:orgId/installations/:id — a club narrowing its own
// installation (§8, §14). D2's rejected widening comes back from here as 422 clamp_violation
// with the cap named, and the service writes installation.rejected.
//
// The path's orgId is passed to the service, which refuses it the same way as an unknown id when
// the installation belongs to another club.
import { parseBody, requireUser, route } from '@/lib/api';
import { installationPatchSchema, updateInstallation } from '@/lib/distribution';

export const PATCH = route<{ orgId: string; installationId: string }>(async ({ req, actor, params }) => {
  requireUser(actor);
  const patch = await parseBody(req, installationPatchSchema);
  return updateInstallation(actor, params.installationId, patch, params.orgId);
});
