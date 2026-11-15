// Owner: D. Internal queue in place of EngageSC funding applications.
import { randomUUID } from 'node:crypto';
import type { ApplicationSink } from '../../contracts';

const queue: Array<{ externalId: string; application: unknown }> = [];

/** Metadata only: never expose the application's arbitrary payload to administrative previews. */
export function listInternalSubmissionMetadata(): { reference: string }[] {
  return queue.map(({ externalId }) => ({ reference: externalId }));
}

export const internalApplications: ApplicationSink = {
  async submit(application) {
    const externalId = `internal-${randomUUID()}`;
    queue.push({ externalId, application });
    return { externalId };
  },
};
