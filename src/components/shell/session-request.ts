import { z } from 'zod';

export type SessionChange =
  | { readonly kind: 'persona'; readonly userId: string | null }
  | { readonly kind: 'org'; readonly orgId: string };

export class SessionChangeError extends Error {
  constructor(readonly code: 'network' | 'rejected' | 'invalid_response', message: string) {
    super(message);
    this.name = 'SessionChangeError';
  }
}

export async function changeSession(change: SessionChange): Promise<void> {
  const persona = change.kind === 'persona';
  let response: Response;
  try {
    response = await fetch(persona ? '/api/session/persona' : '/api/session/active-org', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(persona ? { userId: change.userId } : { orgId: change.orgId }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    if (error instanceof TypeError || error instanceof DOMException) {
      throw new SessionChangeError('network', 'Could not reach the server. Check your connection, then try again.');
    }
    throw error;
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (error instanceof TypeError || error instanceof DOMException) {
      throw new SessionChangeError('network', 'Could not read the server response. Check your connection, then try again.');
    }
    if (!(error instanceof SyntaxError)) throw error;
    body = null;
  }
  if (!response.ok) {
    const details = z.object({ message: z.string().min(1) }).safeParse(body);
    throw new SessionChangeError('rejected', details.success ? details.data.message
      : `The session request failed (${response.status}). Try again.`);
  }
  const confirmed = persona
    ? z.object({ userId: z.literal(change.userId) }).safeParse(body).success
    : z.object({ activeOrgId: z.literal(change.orgId) }).safeParse(body).success;
  if (!confirmed) {
    throw new SessionChangeError('invalid_response', 'The server did not confirm the session change. Reload the page and try again.');
  }
}
