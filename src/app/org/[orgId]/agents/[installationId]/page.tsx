// Owner: C (WP-9). The agent run page (§14): transcript, run details and pending actions. Before the
// viewer types, it says whether they can run the agent and, if not, who can and how to ask. The
// gateway still decides on every run (§7).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lock } from 'lucide-react';
import { AgentHeader, RunWorkspace } from '@/components/inspector';
import { AgentAccessNotice, Notice } from '@/components/inspector/agent-access-notice';
import { agentTags } from '@/app/me/agents/agent-tags';
import { getRunPageData } from '@/lib/documents/run-page';
import { getActor } from '@/lib/identity';

export default async function AgentRunPage({ params }: { params: Promise<{ orgId: string; installationId: string }> }) {
  const { orgId, installationId } = await params;
  const actor = await getActor();
  if (!actor.userId) {
    return (
      <>
        <AgentHeader name="Agent" className="mb-6" />
        <Notice icon={Lock}>
          <p className="font-semibold">Sign in to run this agent.</p>
          <Link href="/" className="text-primary underline">Choose a persona to sign in</Link>
        </Notice>
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
        <AgentHeader name="Internal agent" source={org.name} className="mb-6" />
        <Notice icon={Lock}>
          <p className="font-semibold">{`This agent is internal to ${org.name}. Only ${org.name} members can see or use it.`}</p>
          <p>{`If you joined ${org.name} recently, ask its president to add you to the roster.`}</p>
        </Notice>
      </>
    );
  }

  const { agent, access } = data;
  const header = { source: org.name, version: agent.templateVersion, tags: agentTags(agent.templateSlug), description: agent.purpose };
  if (access.kind === 'ok') {
    return <RunWorkspace key={`${actor.userId}:${actor.activeOrgId}:${agent.installationId}`} installationId={agent.installationId}
      agentName={agent.name} config={data.workspace} header={header} />;
  }
  return (
    <>
      <AgentHeader name={agent.name} {...header} className="mb-6" />
      <AgentAccessNotice org={org} agent={agent} access={access} />
    </>
  );
}
