'use server';

import { reviewTemplateKnowledge } from '@/lib/distribution/usg-view';
import { getActor } from '@/lib/identity';

export async function reviewKnowledgeUpload(templateId: string, raw: unknown) {
  return reviewTemplateKnowledge(await getActor(), templateId, raw);
}
