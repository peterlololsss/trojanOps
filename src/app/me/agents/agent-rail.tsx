'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { CircleAlert, ChartNoAxesColumn } from 'lucide-react';
import { AgentTags } from '@/components/inspector/agent-header';
import { changeSession, SessionChangeError } from '@/components/shell/session-request';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { findAgent, needsSwitch, type AgentGroup, type RailAgent } from './groups';
import { ProjectFiles } from './project-files';
import { Projects } from './projects';

export const agentHref = (installationId: string) => `/me/agents?agent=${encodeURIComponent(installationId)}`;

export interface AgentRailProps {
  readonly userId: string;
  readonly groups: readonly AgentGroup[];
  readonly selectedId: string | null;
  readonly activeOrgId: string | null;
}

export function AgentRail({ userId, groups, selectedId, activeOrgId }: AgentRailProps) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, startTransition] = useTransition();
  const [opening, setOpening] = useState<RailAgent | null>(null);
  const [error, setError] = useState<{ readonly message: string; readonly agent: RailAgent } | null>(null);

  function openAgent(agent: RailAgent) {
    if (inFlight.current || pending || (agent.installationId === selectedId && !needsSwitch(agent, activeOrgId))) return;
    inFlight.current = true;
    setOpening(agent);
    setError(null);
    const href = agentHref(agent.installationId);
    if (!needsSwitch(agent, activeOrgId)) {
      startTransition(() => router.push(href, { scroll: false }));
      inFlight.current = false;
      return;
    }
    startTransition(async () => {
      try {
        await changeSession({ kind: 'org', orgId: agent.orgId });
        startTransition(() => {
          router.push(href, { scroll: false });
          router.refresh();
        });
      } catch (failure) {
        if (!(failure instanceof SessionChangeError)) throw failure;
        setError({ message: failure.message, agent });
        setOpening(null);
      } finally {
        inFlight.current = false;
      }
    });
  }

  const selected = selectedId ? findAgent(groups, selectedId) : null;
  return <nav aria-label="My agents" className="flex w-full min-w-0 shrink-0 flex-col border-b border-sidebar-border bg-sidebar lg:w-[272px] lg:border-r lg:border-b-0">
    <div className="shrink-0 space-y-1 border-b border-sidebar-border px-4 py-3">
      <h2 className="text-base font-semibold leading-6">My agents</h2>
      <div className="flex flex-wrap gap-1">
        <Projects userId={userId} agents={groups.flatMap((group) => group.agents)} selectedId={selectedId} onOpenAgent={openAgent} />
        {selected && <ProjectFiles key={selected.installationId} userId={userId} agentId={selected.installationId} agentName={selected.name} />}
      </div>
    </div>
    <p role="status" aria-live="polite" className="sr-only">
      {pending && opening ? (needsSwitch(opening, activeOrgId) ? `Switching to ${opening.orgName} and opening ${opening.name}.` : `Opening ${opening.name}.`) : ''}
    </p>
    <div className="min-h-0 flex-1 overflow-y-auto pb-2">
      {error && <Alert variant="destructive" className="m-3 p-3">
        <CircleAlert aria-hidden="true" />
        <div className="min-w-0">
          <AlertTitle>Could not open {error.agent.name}</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => openAgent(error.agent)}>Retry</Button>
        </div>
      </Alert>}
      {groups.map((group) => <section key={group.key} aria-labelledby={`rail-${group.key}`}>
        <h3 id={`rail-${group.key}`} className="px-4 pt-6 pb-2 text-xs font-semibold leading-4 text-muted-foreground [overflow-wrap:anywhere]">{group.label}</h3>
        <ul className="space-y-2 px-3">{group.agents.map((agent) => {
          const current = agent.installationId === selectedId;
          const busy = pending && opening?.installationId === agent.installationId;
          return <li key={agent.installationId}>
            <Link href={agentHref(agent.installationId)} aria-current={current ? 'page' : undefined} aria-busy={busy || undefined}
              onClick={(event) => {
                if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                openAgent(agent);
              }}
              className={cn('block rounded-md border px-3 py-3 hover:bg-sidebar-accent focus-visible:outline-offset-2 [overflow-wrap:anywhere]',
                current ? 'border-primary bg-muted' : 'border-sidebar-border bg-background', busy && 'cursor-progress bg-sidebar-accent')}>
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{agent.name}</span>
                <span className="shrink-0 text-[12px] leading-4 tabular-nums text-muted-foreground">v{agent.templateVersion}</span>
              </span>
              <span className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">{agent.purpose}</span>
              {(group.kind === 'public' || agent.tags.length > 0) && <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                {group.kind === 'public' && <span className="text-[12px] leading-4 text-muted-foreground">{agent.orgName}</span>}
                <AgentTags inline tags={agent.tags} />
              </span>}
            </Link>
          </li>;
        })}</ul>
      </section>)}
    </div>
    <div className="shrink-0 border-t border-sidebar-border py-2">
      <Link href="/me/usage" className="flex items-center gap-2 border-l-[3px] border-transparent px-4 py-2 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground focus-visible:-outline-offset-2"><ChartNoAxesColumn aria-hidden className="size-4" />Usage</Link>
    </div>
  </nav>;
}
