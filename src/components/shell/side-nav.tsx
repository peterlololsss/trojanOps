'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isNavItemActive, type NavItem } from './navigation';

export function SideNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="w-full shrink-0 overflow-x-auto border-b border-sidebar-border bg-sidebar py-2 md:w-56 md:border-r md:border-b-0 md:py-4">
      <ul className="flex md:block">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} aria-current={isNavItemActive(pathname, item) ? 'page' : undefined}
              className={cn(
                'block whitespace-nowrap border-l-[3px] px-4 py-2 hover:bg-sidebar-accent',
                isNavItemActive(pathname, item) ? 'border-primary font-semibold' : 'border-transparent',
              )}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
