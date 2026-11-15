// Owner: A (WP-4). POST /api/agents/:installationId/runs { input }: one agent run through the
// gateway (I5). Errors come back as ApiError (401, 403, 404, 429).
import { z } from 'zod';
import { parseBody, route } from '@/lib/api';
import { runAgent } from '@/lib/gateway';

export const POST = route<{ installationId: string }>(async ({ req, actor, params }) => {
  const body = await parseBody(req, z.object({ input: z.string().trim().min(1).max(8000), modelClass: z.enum(['economy', 'standard']).optional() }));
  return runAgent(actor, params.installationId, body.input, { modelClass: body.modelClass });
});
