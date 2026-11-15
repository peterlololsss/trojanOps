'use server';

import { AppError, type Grant } from '../contracts';
import { loadAgents } from '../distribution/queries';
import { getActor } from '../identity';
import { demoChunks, type DemoChunk } from './fixtures';
import { documentAgentAccess, documentAudience, getKnowledgeLibrary, type DocumentAgentAccess } from './knowledge-library';
import { uploadDocumentInput } from './library';
import { requirePreviewPresident } from './preview';
import { previewSubjects } from './preview-subjects';
import { testRetrieval } from './retrieval-test';

export type ReviewReceipt = { readonly title: string; readonly whoCanRead: string; readonly chunks: DemoChunk[]; readonly agents: DocumentAgentAccess[] };
export type ReviewResult = { readonly ok: true; readonly receipt: ReviewReceipt } | { readonly ok: false; readonly message: string };

export async function reviewDocumentUpload(orgId: string, raw: unknown): Promise<ReviewResult> {
  const actor = await getActor();
  try {
    await requirePreviewPresident(actor, orgId);
    const parsed = uploadDocumentInput.safeParse(raw);
    if (!parsed.success) return { ok: false, message: 'Add a title, a source, valid access settings and Markdown text before reviewing.' };
    const draft = parsed.data;
    const library = await getKnowledgeLibrary(actor, orgId);
    if (!library?.canUpload || !library.sources.some((s) => s.id === draft.sourceId)) return { ok: false, message: 'Choose a source in this active club.' };
    if (draft.tier === 'usg_internal' && library.org.kind !== 'usg') return { ok: false, message: 'Only USG can upload USG-internal documents.' };
    if (draft.allowedPositions.some((p) => !library.positions.some((known) => known.slug === p)) || (draft.tier !== 'officers' && draft.allowedPositions.length)) return { ok: false, message: 'Choose only officer positions from this club for an Officers document.' };
    let readGrants: Grant[];
    switch (draft.tier) {
      case 'public': readGrants = ['*']; break;
      case 'members': readGrants = [`${orgId}:*`]; break;
      case 'officers': readGrants = [...new Set(['president', ...draft.allowedPositions])].map((p): Grant => `${orgId}:${p}`); break;
      case 'usg_internal': readGrants = [`${orgId}:reviewer`, `${orgId}:admin`]; break;
      default: { const exhaustive: never = draft.tier; return exhaustive; }
    }
    const agents = (await loadAgents({ orgIds: [orgId] })).map((a) => a.agent);
    const names = new Map(library.positions.map((p) => [p.slug, p.name]));
    return { ok: true, receipt: { title: draft.title, whoCanRead: documentAudience(draft.tier, draft.allowedPositions, names), chunks: demoChunks(draft.bodyMd), agents: documentAgentAccess({ sourceId: draft.sourceId, tier: draft.tier, readGrants }, agents, await previewSubjects(orgId)) } };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.error.message };
    if (error instanceof Error) return { ok: false, message: 'Could not review access. Try again in a moment.' };
    throw error;
  }
}

export async function runRetrievalTest(orgId: string, input: unknown) {
  try {
    const result = await testRetrieval(await getActor(), orgId, input);
    return { ok: true as const, result };
  } catch (error) {
    if (error instanceof AppError) return { ok: false as const, message: error.error.message };
    if (error instanceof Error) return { ok: false as const, message: "Couldn't run the test. Try again in a moment." };
    throw error;
  }
}

