// The heading of an agent's chat: name, then source · version · topic tags, then its purpose.
import { Fragment } from 'react';
import { cn } from '@/lib/utils';

/** The chat's centered column: header, transcript and composer share it, so their left edges line up. */
export const CHAT_COLUMN = 'mx-auto w-full max-w-[760px] px-6';

const TAG = 'inline-flex h-5 max-w-[200px] items-center truncate rounded-sm border border-border bg-background px-1.5 text-xs leading-4 text-foreground';

/** Topic tags. Inside a link (`inline`) they are plain spans, so the link's name reads as one phrase. */
export function AgentTags({ tags, inline = false, className }: { readonly tags: readonly string[]; readonly inline?: boolean; readonly className?: string }) {
  if (!tags.length) return null;
  if (inline) return <span className={cn('flex flex-wrap gap-1', className)}>{tags.map((tag) => <span key={tag} className={TAG}>{tag}</span>)}</span>;
  return <ul aria-label="Topics" className={cn('flex flex-wrap gap-1', className)}>
    {tags.map((tag) => <li key={tag} className={TAG}>{tag}</li>)}
  </ul>;
}

export interface AgentHeaderProps {
  readonly name: string;
  /** The club (or USG) the agent belongs to. */
  readonly source?: string;
  readonly version?: number;
  readonly tags?: readonly string[];
  readonly description?: string;
  readonly action?: React.ReactNode;
  readonly className?: string;
}

export function AgentHeader({ name, source, version, tags = [], description, action, className }: AgentHeaderProps) {
  const parts: React.ReactNode[] = [];
  if (source) parts.push(<span>{source}</span>);
  if (version !== undefined) parts.push(<span className="tabular-nums">v{version}</span>);
  if (tags.length) parts.push(<AgentTags tags={tags} />);
  return <header className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2', className)}>
    <div className="min-w-0 [overflow-wrap:anywhere]">
      <h1 className="text-xl font-semibold leading-7">{name}</h1>
      {parts.length > 0 && <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        {parts.map((part, i) => <Fragment key={i}>{i > 0 && <span aria-hidden="true">·</span>}{part}</Fragment>)}
      </div>}
      {description && <p className="mt-2 max-w-prose text-sm leading-5 text-muted-foreground">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </header>;
}
