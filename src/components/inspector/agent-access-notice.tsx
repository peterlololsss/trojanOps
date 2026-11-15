// Why an agent can't run for this viewer right now, and what to do about it. Shown in place of the
// chat on the run pages and in the My agents workspace. The gateway still decides on every run (§7).
import { CircleSlash, Lock } from 'lucide-react';
import { SwitchOrgButton } from '@/components/shell/switch-org-button';
import { NO_POSITIONS_LABEL, type RunAccess, type RunPageAgent } from '@/lib/documents/run-page';
import { cn } from '@/lib/utils';

export function Notice({ icon: Icon, className, children }: { icon: typeof Lock; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex max-w-[720px] items-start gap-[8px] rounded-md border border-border bg-muted px-[16px] py-[16px]', className)}>
      <Icon aria-hidden className="mt-[2px] size-[16px] shrink-0 text-muted-foreground" />
      <div className="min-w-0 space-y-[4px]">{children}</div>
    </div>
  );
}

export interface AgentAccessNoticeProps {
  readonly org: { readonly id: string; readonly name: string };
  readonly agent: RunPageAgent;
  readonly access: Exclude<RunAccess, { kind: 'ok' | 'not_member' }>;
  readonly className?: string;
}

export function AgentAccessNotice({ org, agent, access, className }: AgentAccessNoticeProps) {
  // Audience labels read as words mid-sentence; position names keep their capitals.
  const who = agent.audience === 'positions' ? agent.audienceLabel : agent.audienceLabel.toLowerCase();
  const noPositions = agent.audience === 'positions' && agent.audienceLabel === NO_POSITIONS_LABEL;
  switch (access.kind) {
    case 'switch_org':
      return <Notice icon={Lock} className={className}>
        <p className="font-semibold">{`Switch to ${org.name} to use ${agent.name}.`}</p>
        <p>{`${agent.name} is an internal agent, so it runs only with ${org.name} as your active club.`}</p>
        <SwitchOrgButton orgId={org.id} orgName={org.name} />
      </Notice>;
    case 'not_in_audience':
      return <Notice icon={Lock} className={className}>
        <p className="font-semibold">
          {noPositions ? `${agent.name} is not open to any position in ${org.name} yet.` : `${agent.name} is for ${who} in ${org.name}.`}
        </p>
        <p>Ask your club president if you need access.</p>
      </Notice>;
    case 'unavailable':
      return <Notice icon={CircleSlash} className={className}>
        <p className="font-semibold">{access.message}</p>
        <p>{access.reason === 'retired'
          ? `USG retired this agent, so it no longer runs in any club. Ask ${org.name}’s president which agent replaces it.`
          : `${org.name}’s president chooses which agents are turned on in the club catalog. Ask them if you need ${agent.name}.`}</p>
      </Notice>;
    default: { const exhaustive: never = access; return exhaustive; }
  }
}
