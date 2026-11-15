// Owner: D (WP-11). Small building blocks shared by the directory dashboards: a bordered panel with
// a title row, a one-line nothing-yet state, an 8px meter and a "View all" link.
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Panel({ id, title, action, children, className, bodyClassName }: {
  id: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn('min-w-0 rounded-md border border-border', className)}>
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-2">
        <h2 id={id} className="text-xl font-semibold leading-7">{title}</h2>
        {action}
      </div>
      <div className={cn('px-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Nothing yet or no results: one short sentence, plus the action when there is one. */
export function Empty({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 py-4', className)}>
      <p className="text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}

/** The 8px bar: a border-colored track and a Cardinal fill. `valueText` is what a screen reader hears. */
export function Bar({ percent, label, valueText, className }: { percent: number; label: string; valueText: string; className?: string }) {
  return (
    <div role="meter" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-valuetext={valueText}
      className={cn('h-2 w-full overflow-hidden rounded-sm bg-border', className)}>
      <div className="h-2 bg-primary" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** "View all" plus, for screen readers, what it lists ("View all events"). */
export function ViewAll({ href, what, children = 'View all' }: { href: string; what?: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-8 items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline">
      {children}{what && <span className="sr-only"> {what}</span>}<ArrowRight aria-hidden="true" className="size-4" />
    </Link>
  );
}

export const textLink = 'text-primary underline underline-offset-4 hover:text-primary-hover';
