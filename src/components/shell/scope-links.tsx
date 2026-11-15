'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { matchesPath, type Scope } from './navigation';

export type { Scope } from './navigation';

export function ScopeLinks({ scopes }: { scopes: Scope[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Scope" className="flex h-full min-w-0 flex-1 items-stretch overflow-x-auto">
      {scopes.map((s) => {
        const active = matchesPath(pathname, s.match);
        return (
          <Link key={s.href} href={s.href} aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-primary-foreground hover:bg-primary-hover',
              active ? 'border-gold font-semibold' : 'border-transparent',
            )}>
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
