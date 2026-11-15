// Owner: B (WP-5). GET /api/directory: every club's public agents (§14).
//
// Open to any signed-in student, member of a club or not — that is the point of the campus
// directory, and D3 is Lee, who belongs to no club, opening one from it.
import { requireUser, route } from '@/lib/api';
import { directory } from '@/lib/distribution';

export const GET = route(async ({ actor }) => {
  requireUser(actor);
  return directory();
});
