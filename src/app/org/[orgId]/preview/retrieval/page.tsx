import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lock } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { AppError } from '@/lib/contracts';
import { getActor } from '@/lib/identity';
import { getPreviewPageData } from '@/lib/documents/preview-page';
import { STARTERS } from '@/lib/documents/fixtures';
import { loadAgents } from '@/lib/distribution/queries';
import { RetrievalClient } from './retrieval-client';

export default async function RetrievalPage({ params, searchParams }: { readonly params: Promise<{ orgId: string }>; readonly searchParams: Promise<{ installation?: string }> }) {
  const { orgId } = await params;
  const actor = await getActor();
  if (!actor.userId) return <><PageHeader title="Permission preview" /><Link href="/" className="text-primary underline">Choose a persona to sign in.</Link></>;
  let data;
  try { data = await getPreviewPageData(actor, orgId, (await searchParams).installation); }
  catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.error.code === 'not_found') notFound();
    if (error.error.code !== 'forbidden') throw error;
    return <><PageHeader title="Permission preview" /><p className="flex items-start gap-2 rounded-md border border-border bg-muted p-4"><Lock aria-hidden className="mt-0.5 size-4 shrink-0" /><span>Only the club president can test retrieval, with this club active. <Link href="/" className="text-primary underline">Switch your persona or active club</Link>, or ask your club president.</span></p></>;
  }
  if (!data) notFound();
  const starters = Object.fromEntries((await loadAgents({ orgIds: [orgId] })).map(({ agent }) => [agent.installationId, STARTERS[agent.templateSlug] ?? []]));
  return <><PageHeader title="Permission preview" description={`${data.org.name} · See which documents and chunks each position can reach through an agent.`} /><nav aria-label="Permission preview views" className="mb-6 flex gap-5 border-b border-border pb-3"><Link href={`/org/${orgId}/preview`} className="text-primary underline">Access matrix</Link><span aria-current="page" className="font-semibold">Retrieval test</span></nav><RetrievalClient key={`${actor.userId}:${actor.activeOrgId}`} data={data} starters={starters} /></>;
}
