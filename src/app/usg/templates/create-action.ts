'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { AppError } from '@/lib/contracts';
import { createUsgTemplate } from '@/lib/distribution/create-template';
import { getActor } from '@/lib/identity';

export async function createTemplateAction(_previous: { readonly error: string | null }, form: FormData): Promise<{ readonly error: string | null }> {
  let templateId: string;
  try {
    const created = await createUsgTemplate(await getActor(), {
      name: form.get('name'), target: form.get('target'), distribution: form.get('distribution'),
      version: {
        purpose: form.get('purpose'), systemPrompt: form.get('systemPrompt'),
        audience: 'members', usableBy: [], maxTier: 'members', sourceKinds: form.getAll('sourceKinds'),
        tools: [], modelClasses: ['economy'], defaultModelClass: 'economy', changelog: 'First version.',
      },
    });
    templateId = created.templateId;
  } catch (error) {
    if (error instanceof AppError) return { error: error.error.message };
    throw error;
  }
  revalidatePath('/usg/templates');
  redirect(`/usg/templates/${templateId}`);
}
