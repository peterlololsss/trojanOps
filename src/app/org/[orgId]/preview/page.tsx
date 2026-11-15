import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lock } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { AppError } from '@/lib/contracts';
import { getPreviewPageData, type PreviewPageData } from '@/lib/documents/preview-page';
import { getActor } from '@/lib/identity';
import { PermissionMatrix } from './permission-matrix';

export default async function PreviewPage({ params, searchParams }: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ installation?: string | string[] }>;
}) {
  const { orgId } = await params;
  const query = await searchParams;
  const actor = await getActor();
  if (!actor.userId) {
    return (
      <>
        <PageHeader title="Permission preview" description="Sign in to preview document access." />
        <Link href="/" className="text-primary underline">Choose a persona to sign in</Link>
      </>
    );
  }
  let data: PreviewPageData | null;
  try {
    data = await getPreviewPageData(actor, orgId, Array.isArray(query.installation) ? query.installation[0] : query.installation);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.error.code === 'not_found') notFound();
    if (error.error.code !== 'forbidden') throw error;
    return (
      <>
        <PageHeader title="Permission preview" />
        <p className="flex items-start gap-2 rounded-md border border-border bg-muted p-4">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>Only this club’s president can preview access, with this club active.{' '}
            <Link href="/" className="text-primary underline">Switch your persona or active club</Link>, or ask your club president for help.
          </span>
        </p>
      </>
    );
  }
  if (!data) notFound();
  return (
    <>
      <PageHeader title="Permission preview" description={`${data.org.name} · See which documents each position can read through an agent.`} />
      <nav aria-label="Permission preview views" className="mb-6 flex gap-5 border-b border-border pb-3"><span aria-current="page" className="font-semibold">Access matrix</span><Link href={`/org/${orgId}/preview/retrieval`} className="text-primary underline">Retrieval test</Link></nav>
      {data.agents.length === 0 ? (
        <p className="rounded-md border border-border p-4">No agents are installed in {data.org.name} yet. Install an agent from the club catalog, then return to preview its access.</p>
      ) : (
        <>
          <form action={`/org/${orgId}/preview`} method="get" className="mb-4 flex flex-wrap items-end gap-3">
            <label className="w-80 max-w-full space-y-1">
              <span className="block font-semibold">Agent</span>
              <select key={data.selectedAgent?.id} name="installation" defaultValue={data.selectedAgent?.id} className="h-9 w-full rounded-md border border-input bg-background px-3">
                {data.agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}{agent.status === 'enabled' ? '' : ` (${agent.status})`}</option>
                ))}
              </select>
            </label>
            <Button type="submit">Preview access</Button>
          </form>
          <p className="mb-4 text-muted-foreground">This matrix shows document access. The agent’s audience separately controls who may run it. Only document titles you can read are shown.</p>
          {data.matrix && data.selectedAgent && (
            <PermissionMatrix key={data.selectedAgent.id} matrix={data.matrix} maxTier={data.selectedAgent.maxTier} agentName={data.selectedAgent.name} />
          )}
        </>
      )}
    </>
  );
}
