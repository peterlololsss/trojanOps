// Owner: C (WP-9). The agent run page (§14): transcript, inspector and pending actions. Before the
// viewer types, it says whether they can run the agent and, if not, who can and how to ask. The
// gateway still decides on every run (§7).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CircleSlash, Lock } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { RunWorkspace } from '@/components/inspector';
import { getRunPageData, NO_POSITIONS_LABEL } from '@/lib/documents/run-page';
import { getActor } from '@/lib/identity';

function Notice({ icon: Icon, children }: { icon: typeof Lock; children: React.ReactNode }) {
  return (
    <div className="flex max-w-[720px] items-start gap-[8px] rounded-md border border-border bg-muted px-[16px] py-[16px]">
      <Icon aria-hidden className="mt-[2px] size-[16px] shrink-0 text-muted-foreground" />
      <div className="space-y-[4px]">{children}</div>
    </div>
  );
}

export default async function AgentRunPage({ params }: { params: Promise<{ orgId: string; installationId: string }> }) {
  const { orgId, installationId } = await params;
  const actor = await getActor();
  if (!actor.userId) {
    return (
      <>
        <PageHeader title="Agent" description="Sign in to run this agent." />
        <Link href="/" className="text-primary underline">Choose a persona to sign in</Link>
      </>
    );
  }

  const data = await getRunPageData(actor, orgId, installationId);
  if (!data) notFound();
  const { org } = data;

  // An internal agent, and the viewer is not a member: say nothing about the agent itself.
  // `access.kind` is nested, so TypeScript narrows the union by `agent === null` instead.
  if (data.access.kind === 'not_member' || data.agent === null) {
    return (
      <>
        <PageHeader title="Internal agent" description={org.name} />
        <Notice icon={Lock}>
          <p className="font-semibold">{`This agent is internal to ${org.name}. Only ${org.name} members can see or use it.`}</p>
          <p>{`If you joined ${org.name} recently, ask its president to add you to the roster.`}</p>
        </Notice>
      </>
    );
  }

  const { agent, access } = data;
  // Audience labels read as words mid-sentence; position names keep their capitals.
  const who = agent.audience === 'positions' ? agent.audienceLabel : agent.audienceLabel.toLowerCase();
  const noPositions = agent.audience === 'positions' && agent.audienceLabel === NO_POSITIONS_LABEL;

  return (
    <>
      <PageHeader title={agent.name} description={`${org.name} · ${agent.purpose}`} />
      {access.kind === 'ok' && (
        <RunWorkspace installationId={agent.installationId} agentName={agent.name} demoRuntime={data.demoRuntime} />
      )}
      {access.kind === 'switch_org' && (
        <Notice icon={Lock}>
          <p className="font-semibold">{`Switch to ${org.name} to use ${agent.name}.`}</p>
          <p>{`${agent.name} is an internal agent, so it runs only with ${org.name} as your active club.`}{' '}
            <Link href="/" className="text-primary underline">Switch your active club</Link>
          </p>
        </Notice>
      )}
      {access.kind === 'not_in_audience' && (
        <Notice icon={Lock}>
          <p className="font-semibold">
            {noPositions ? `${agent.name} is not open to any position in ${org.name} yet.` : `${agent.name} is for ${who} in ${org.name}.`}
          </p>
          <p>Ask your club president if you need access.</p>
        </Notice>
      )}
      {access.kind === 'unavailable' && (
        <Notice icon={CircleSlash}>
          <p className="font-semibold">{access.message}</p>
          <p>{access.reason === 'retired'
            ? `USG retired this agent, so it no longer runs in any club. Ask ${org.name}’s president which agent replaces it.`
            : `${org.name}’s president chooses which agents are turned on in the club catalog. Ask them if you need ${agent.name}.`}</p>
        </Notice>
      )}
    </>
  );
}
