// Owner: B (WP-5). GET /api/me/agents: what the signed-in student's own clubs expose to them,
// grouped by club, each agent with the reason it is listed (§14).
//
// It answers for the caller only — the user id comes from the session, never the query string —
// so one student cannot read another's clubs.
import { requireUser, route } from '@/lib/api';
import { myAgents } from '@/lib/distribution';

export const GET = route(async ({ actor }) => {
  return myAgents(requireUser(actor));
});
