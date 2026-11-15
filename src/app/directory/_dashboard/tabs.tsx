// Owner: D (WP-11). Tabs as real links (`?tab=`), so each tab has a URL, works without JavaScript and
// keeps the browser's back button. The active tab carries `aria-current="page"` and a 2px Cardinal
// underline.
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { TabLink } from './model';

export function TabLinks<T extends string>({ label, tabs, active }: { label: string; tabs: readonly TabLink<T>[]; active: T }) {
  return (
    <nav aria-label={label} className="mb-6 border-b border-border">
      <ul className="-mb-px flex flex-wrap gap-x-1">
        {tabs.map((tab) => {
          const current = tab.key === active;
          return (
            <li key={tab.key}>
              <Link href={tab.href} aria-current={current ? 'page' : undefined} className={cn(
                'inline-flex h-10 items-center gap-1.5 border-b-2 px-3 text-sm',
                current
                  ? 'border-primary font-semibold text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-input hover:text-foreground',
              )}>
                {tab.label}
                {tab.count !== undefined && <><span className="sr-only">, </span><span className="tabular-nums text-muted-foreground">{tab.count}</span></>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Two or three linked choices that filter a list, such as Upcoming and Past events. */
export function SwitchLinks({ label, items }: { label: string; items: ReadonlyArray<{ label: string; href: string; current: boolean }> }) {
  return (
    <nav aria-label={label}>
      <ul className="flex">
        {items.map((item, i) => (
          <li key={item.href}>
            <Link href={item.href} aria-current={item.current ? 'page' : undefined} className={cn(
              'inline-flex h-8 items-center border border-input px-3 text-sm tabular-nums',
              i === 0 ? 'rounded-l-md' : '-ml-px',
              i === items.length - 1 && 'rounded-r-md',
              item.current ? 'bg-accent font-semibold text-foreground' : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
            )}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
