import { z } from 'zod';

const count = z.number().int().nonnegative();
const rosterResult = z.object({
  orgsCreated: count,
  usersCreated: count,
  positionsCreated: count,
  membershipsStarted: count,
  membershipsEnded: count,
  positionsChanged: count,
  installationsCreated: count,
  clubs: z.array(z.object({
    orgId: z.string(), orgName: z.string(), created: z.boolean(),
    positionsChanged: count, installationsCreated: count,
  })),
});

export type RosterSyncResult = z.infer<typeof rosterResult>;

export class RosterSyncError extends Error {
  constructor(readonly reason: 'network' | 'rejected' | 'invalid_response', message: string) {
    super(message);
    this.name = 'RosterSyncError';
  }
}

export async function syncRoster(): Promise<RosterSyncResult> {
  let response: Response;
  try {
    response = await fetch('/api/usg/connectors/roster/sync', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    if (!(error instanceof TypeError || error instanceof DOMException)) throw error;
    throw new RosterSyncError('network', 'Could not confirm the sync. Check your connection and try again. Some roster changes may already have been saved.');
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (!(error instanceof SyntaxError || error instanceof TypeError || error instanceof DOMException)) throw error;
    throw new RosterSyncError('invalid_response', 'Could not read the sync result. Reload the page and try again. Some roster changes may already have been saved.');
  }
  if (!response.ok) {
    const details = z.object({ message: z.string().min(1) }).safeParse(body);
    throw new RosterSyncError('rejected', details.success ? details.data.message
      : 'The sync could not finish. Try again; previously saved roster changes will be retained.');
  }
  const result = rosterResult.safeParse(body);
  if (!result.success) {
    throw new RosterSyncError('invalid_response', 'The server did not return a complete sync result. Reload the page and try again.');
  }
  return result.data;
}
