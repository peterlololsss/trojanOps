import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { myAgents } from '@/lib/distribution';
import { getActor } from '@/lib/identity';
import { MyAgentsList } from './my-agents-list';

export default async function MyAgentsPage() {
  const actor = await getActor();
  if (!actor.userId) return <>
    <PageHeader title="My agents" />
    <Alert>
      <LockKeyhole aria-hidden="true" />
      <div className="min-w-0">
        <AlertTitle>Sign in to see your agents</AlertTitle>
        <AlertDescription>Club agents are available to signed-in members. Choose a persona to continue in the demo.</AlertDescription>
        <Link href="/" className={buttonVariants({ variant: 'secondary', className: 'mt-3' })}>Go to sign-in</Link>
      </div>
    </Alert>
  </>;

  const clubs = await myAgents(actor.userId);
  return <>
    <PageHeader title="My agents" description="Agents your clubs make available to you. Opening an agent switches to its club." />
    <MyAgentsList key={`${actor.userId}:${actor.activeOrgId}`} clubs={clubs} />
  </>;
}
