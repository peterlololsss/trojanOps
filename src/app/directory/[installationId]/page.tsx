import Link from 'next/link';
import { LockKeyhole, Users } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { directory } from '@/lib/distribution';
import { getActor } from '@/lib/identity';
import { submitPublicRun } from './actions';
import { PublicRun } from './public-run';

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
      <AlertTitle>This agent is not in the public directory</AlertTitle>
      <AlertDescription>It may have been turned off or its audience may have changed. <Link href="/directory" className="text-primary underline">Return to the directory</Link> to choose an available agent.</AlertDescription>
    </div></Alert>
  </>;
  return <>
    <Link href="/directory" className="mb-4 inline-flex min-h-8 items-center text-primary underline underline-offset-4">Back to directory</Link>
    <PageHeader title={agent.name} description={agent.purpose} />
    <div className="mb-6 flex flex-wrap items-center gap-3 text-muted-foreground">
      <span>{agent.orgName}</span><Badge><Users aria-hidden="true" />All students</Badge><span>Template v{agent.templateVersion}</span>
    </div>
    <PublicRun key={`${actor.userId}:${actor.activeOrgId}:${agent.installationId}`} agentName={agent.name}
      isMock={(process.env.AGENT_RUNTIME ?? 'mock') === 'mock'}
      action={submitPublicRun.bind(null, agent.installationId, actor.userId)} />
  </>;
}
