'use server';

import { z } from 'zod';
import { AppError } from '@/lib/contracts';
import { directory } from '@/lib/distribution';
import { runAgent } from '@/lib/gateway';
import { getActor } from '@/lib/identity';
import type { PublicRunState } from './run-state';

const submission = z.object({ installationId: z.uuid(), question: z.string().trim().min(1).max(8000) });

export async function submitPublicRun(
  installationId: string,
  expectedUserId: string,
  _previous: PublicRunState,
  formData: FormData,
): Promise<PublicRunState> {
  const actor = await getActor();
  if (!actor.userId || actor.userId !== expectedUserId) {
    return { status: 'error', code: 'unauthenticated', message: 'Your session changed. Reload this page and sign in before running the agent.' };
  }
  const parsed = submission.safeParse({ installationId, question: formData.get('question') });
  if (!parsed.success) {
    return { status: 'error', code: 'invalid', message: 'Enter a question between 1 and 8,000 characters and open an agent from the directory.' };
  }
  try {
    const agent = (await directory()).find((entry) => entry.installationId === parsed.data.installationId);
    if (!agent) {
      return { status: 'error', code: 'not_found', message: 'This agent is no longer in the directory. Return to the directory and choose an available agent.' };
    }
    const result = await runAgent(actor, agent.installationId, parsed.data.question);
    return { status: 'success', input: parsed.data.question, result };
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return { status: 'error', code: error.error.code, message: error.error.message };
  }
}
