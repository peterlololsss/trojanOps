// Owner: B (WP-7). GET /api/orgs/:orgId/catalog — the club's agent library (§14).
//
// §14 scopes it to the club's members; the president also gets `canManage` true and the controls
// that go with it. The service enforces that, so the page and this route refuse alike.
import { requireUser, route } from '@/lib/api';
import { catalog } from '@/lib/distribution';
import { AppError } from '@/lib/contracts';

export const GET = route<{ orgId: string }>(async ({ actor, params }) => {
  requireUser(actor);
  const found = await catalog(actor, params.orgId);
  if (!found) throw new AppError({ code: 'not_found', message: 'This club does not exist.' });
  return found;
});
