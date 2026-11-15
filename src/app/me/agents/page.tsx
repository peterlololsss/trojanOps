// Owner: D (WP-11). The My agents workspace (§14): every agent the student can use, grouped by source
// in the rail; the selected agent's chat in the middle; its run details on the right.
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { LockKeyhole } from 'lucide-react';
import { AgentHeader, RunDetailsPanel, RunWorkspace } from '@/components/inspector';
import { CHAT_COLUMN } from '@/components/inspector/agent-header';
import { AgentAccessNotice, Notice } from '@/components/inspector/agent-access-notice';
import { PageHeader } from '@/components/shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { activeMemberships } from '@/lib/authz';
import { directory, myAgents } from '@/lib/distribution';
import { getRunPageData } from '@/lib/documents/run-page';
import { getActor } from '@/lib/identity';
import type { Actor } from '@/lib/contracts';
import { getDb } from '@/lib/db/client';
import { agentInstallations, agentTemplates, orgs } from '@/lib/db/schema';
import { AgentRail } from './agent-rail';
import { Projects } from './projects';
import { defaultAgent, findAgent, groupAgents, type RailAgent } from './groups';

/** States outside the workspace keep the usual page padding. */
function Padded({ children }: { readonly children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1280px] p-6">{children}</div>;
}

async function Chat({ actor, agent }: { readonly actor: Actor; readonly agent: RailAgent }) {
  const data = await getRunPageData(actor, agent.orgId, agent.installationId);
  const [publisher] = await getDb().select({ name: orgs.name }).from(agentInstallations)
    .innerJoin(agentTemplates, eq(agentTemplates.id, agentInstallations.templateId))
    .innerJoin(orgs, eq(orgs.id, agentTemplates.publisherOrgId))
    .where(eq(agentInstallations.id, agent.installationId));
  const source = publisher && publisher.name !== agent.orgName ? `${publisher.name} → ${agent.orgName}` : agent.orgName;
  const header = { source, version: agent.templateVersion, description: agent.purpose };
  if (data?.access.kind === 'ok' && data.agent) {
    return <RunWorkspace key={`${actor.userId}:${actor.activeOrgId}:${agent.installationId}`} fill installationId={agent.installationId}
      agentName={data.agent.name} config={data.workspace} header={header} />;
  }
  // Same frame as the chat, with the notice where the transcript would be.
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
    <section aria-label={agent.name} className="flex min-w-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border py-4"><AgentHeader className={CHAT_COLUMN} name={agent.name} {...header} /></div>
      <div className="min-h-0 flex-1 overflow-y-auto"><div className={`${CHAT_COLUMN} py-6`}>
        {data?.agent && data.access.kind !== 'ok'
          ? <AgentAccessNotice org={data.org} agent={data.agent} access={data.access} />
          : <Notice icon={LockKeyhole}>
            <p className="font-semibold">{`${agent.name} is not available to you right now.`}</p>
            <p>{`Ask ${agent.orgName}’s president if you need it.`}</p>
          </Notice>}
      </div></div>
    </section>
    <RunDetailsPanel inspector={null} className="shrink-0 border-t border-border lg:w-[320px] lg:border-t-0 lg:border-l" />
  </div>;
}

export default async function MyAgentsPage({ searchParams }: { readonly searchParams: Promise<{ agent?: string | string[] }> }) {
  const actor = await getActor();
  if (!actor.userId) return <Padded>
    <PageHeader title="My agents" />
    <Alert>
      <LockKeyhole aria-hidden="true" />
      <div className="min-w-0">
        <AlertTitle>Sign in to see your agents</AlertTitle>
        <AlertDescription>Agents are available to signed-in students.</AlertDescription>
        <Link href="/" className={buttonVariants({ variant: 'secondary', className: 'mt-3' })}>Go to sign-in</Link>
      </div>
    </Alert>
  </Padded>;

  const [clubs, publicAgents, held, params] = await Promise.all([myAgents(actor.userId), directory(), activeMemberships(actor.userId), searchParams]);
  const usgOrgIds = new Set((held ?? []).filter((m) => m.orgKind === 'usg').map((m) => m.orgId));
  const groups = groupAgents({ clubs, usgOrgIds, publicAgents, activeOrgId: actor.activeOrgId });
  if (!groups.length) return <Padded>
    <PageHeader title="My agents" />
    <div className="max-w-prose space-y-3">
      <h2 className="text-xl font-semibold leading-7">No agents yet</h2>
      <p>Agents appear here when a club adds you to its roster or opens an agent to all students.</p>
      <Link href="/directory/clubs" className={buttonVariants({ variant: 'secondary' })}>Browse clubs</Link>
      <Projects key={actor.userId} userId={actor.userId} />
    </div>
  </Padded>;

  const requested = typeof params.agent === 'string' ? params.agent : undefined;
  const selected = requested ? findAgent(groups, requested) : defaultAgent(groups, actor.activeOrgId);
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
    <AgentRail key={`${actor.userId}:${actor.activeOrgId}`} userId={actor.userId} groups={groups} selectedId={selected?.installationId ?? null} activeOrgId={actor.activeOrgId} />
    {selected ? <Chat actor={actor} agent={selected} /> : <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
      <div className={`${CHAT_COLUMN} min-w-0 flex-1 py-6`}>
        <Notice icon={LockKeyhole}>
          <p className="font-semibold">This agent is not available to you.</p>
          <p>It may have been turned off, or its audience changed. Choose an agent from the list.</p>
        </Notice>
      </div>
      <RunDetailsPanel inspector={null} className="shrink-0 border-t border-border lg:w-[320px] lg:border-t-0 lg:border-l" />
    </div>}
  </div>;
}
