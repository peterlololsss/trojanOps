// Owner: D (WP-11). The dashboard header, after EngageSC's club page: an initials tile in place of a
// logo or cover photo, the name in Caslon with " · parent" in muted text, the tagline, chips, a line
// of facts, and the actions on the right.
import { initials } from '@/lib/directory/view';
import { cn } from '@/lib/utils';

/** A club's or department's initials on a Cardinal square: never a logo, never a person. */
export function InitialsTile({ name, size = 'lg' }: { name: string; size?: 'sm' | 'lg' }) {
  return (
    <span aria-hidden="true" className={cn(
      'flex shrink-0 select-none items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground',
      size === 'lg' ? 'size-16 text-xl' : 'size-8 text-xs',
    )}>
      {initials(name)}
    </span>
  );
}

export function DashboardHeader({ name, parent, tagline, chips, facts, actions }: {
  name: string;
  /** "Registered student organization", or a link to the parent club. */
  parent: React.ReactNode;
  tagline: string;
  chips?: React.ReactNode[];
  facts?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const shownChips = (chips ?? []).filter(Boolean);
  return (
    <header className="mb-4 flex flex-wrap items-start gap-x-4 gap-y-3">
      <InitialsTile name={name} />
      <div className="min-w-0 flex-1 basis-80">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h1 className="font-serif text-[28px] leading-9 [overflow-wrap:anywhere]">{name}</h1>
          <p className="text-base leading-6 text-muted-foreground"><span aria-hidden="true">· </span>{parent}</p>
        </div>
        {tagline && <p className="mt-1 max-w-prose text-base leading-6">{tagline}</p>}
        {shownChips.length > 0 && <ul aria-label="Categories and status" className="mt-3 flex flex-wrap gap-2">
          {shownChips.map((chip, i) => <li key={i}>{chip}</li>)}
        </ul>}
        {facts && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">{facts}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
