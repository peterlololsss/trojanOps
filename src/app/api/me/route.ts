// Owner: A (WP-3). GET /api/me: the caller's Actor, recomputed from the DB on this request (I3).
// A signed-out caller gets userId null and no grants.
import { route } from '@/lib/api';

export const GET = route(async ({ actor }) => actor);
