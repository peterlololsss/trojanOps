'use client';

import { usePathname } from 'next/navigation';
import { matchesPath, type Scope } from './navigation';
import { SideNav } from './side-nav';

export function ScopeSideNav({ scopes }: { scopes: Scope[] }) {
  const pathname = usePathname();
  const scope = scopes.find((s) => matchesPath(pathname, s.match));
  if (!scope?.items?.length) return null;
  return <SideNav items={scope.items} label={`${scope.label} navigation`} />;
}
