// Owner: A (WP-4). GET /api/audit?orgId=&action=&limit=: audit metadata the viewer may see (§12).
// USG admins see every club, presidents their own; anyone else gets 403 (§14).
import { z } from 'zod';
import { requireUser, route } from '@/lib/api';
import { AppError, type AuditAction } from '@/lib/contracts';
import { listAudit } from '@/lib/gateway/audit';

const ACTIONS = [
  'agent.run', 'run.access', 'tool.call', 'tool.confirm', 'tool.reject',
  'authz.denied', 'quota.blocked', 'quota.limit.set',
  'template.publish', 'template.distribute', 'template.retire',
  'installation.update', 'installation.rejected', 'agent.publish_public',
  'org.provision', 'roster.import', 'connector.sync', 'position.transfer',
  'rule_pack.publish', 'document.upload',
] as const satisfies readonly AuditAction[];
// Fails to compile when contracts gain an action this list lacks.
const EVERY_ACTION: [Exclude<AuditAction, (typeof ACTIONS)[number]>] extends [never] ? true : never = true;
void EVERY_ACTION;

const Query = z.object({
  orgId: z.uuid().optional(),
  action: z.enum(ACTIONS).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

export const GET = route(async ({ req, actor }) => {
  requireUser(actor);
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) throw new AppError({ code: 'invalid', message: 'Invalid audit filter.' });
  return listAudit(actor, parsed.data);
});
