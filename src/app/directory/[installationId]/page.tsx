import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { directory } from '@/lib/distribution';
import { getActor } from '@/lib/identity';
import { RunWorkspace } from '@/components/inspector';
import { agentTags } from '@/app/me/agents/agent-tags';
import { getRunPageData } from '@/lib/documents/run-page';

export default async function PublicAgentPage({ params }: { readonly params: Promise<{ installationId: string }> }) {
  const actor = await getActor();
  if (!actor.userId) return <>
    <PageHeader title="Public agent" />
    <Alert><LockKeyhole aria-hidden="true" /><div>
      <AlertTitle>Sign in to run an agent</AlertTitle>
      <AlertDescription><Link href="/" className="text-primary underline">Sign in</Link> with your student account. Club membership is not required for public agents.</AlertDescription>
    </div></Alert>
  </>;
  const { installationId } = await params;
  const agent = (await directory()).find((entry) => entry.installationId === installationId);
  if (!agent) return <>
    <PageHeader title="Agent unavailable" />
    <Alert><LockKeyhole aria-hidden="true" /><div>
      <AlertTitle>This agent is not open to all students</AlertTitle>
      <AlertDescription>It may have been turned off or its audience may have changed. <Link href="/directory/clubs" className="text-primary underline">Browse clubs</Link> to choose an available agent.</AlertDescription>
    </div></Alert>
  </>;
  const data = await getRunPageData(actor, agent.orgId, agent.installationId);
  if (!data?.workspace) return <><PageHeader title="Agent unavailable" /><p>This agent is no longer available. Return to the directory and choose an available agent.</p></>;
  return <>
    <Link href={`/directory/clubs/${agent.orgId}?tab=agents`} className="mb-4 inline-flex min-h-8 items-center text-primary underline underline-offset-4">Back to {agent.orgName}</Link>
    <RunWorkspace key={`${actor.userId}:${actor.activeOrgId}:${agent.installationId}`} installationId={agent.installationId} agentName={agent.name}
      config={data.workspace} header={{ source: agent.orgName, version: agent.templateVersion, tags: agentTags(agent.templateSlug), description: agent.purpose }} headerSpacePx={144} />
  </>;
}
