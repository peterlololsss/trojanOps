// Owner: B (WP-7). GET /api/orgs/:orgId/catalog — the club's agent library (§14).
//
// Members read it; the president gets `canManage` true and the controls that go with it. A club
// the caller does not belong to still answers, because the catalog itself is not secret: what
// differs is `reasonLabel`, which is null for every agent they may not run.
import { requireUser, route } from '@/lib/api';
import { catalog } from '@/lib/distribution';
import { AppError } from '@/lib/contracts';

export const GET = route<{ orgId: string }>(async ({ actor, params }) => {
  requireUser(actor);
  const found = await catalog(actor, params.orgId);
  if (!found) throw new AppError({ code: 'not_found', message: 'This club has no agents.' });
  return found;
});
