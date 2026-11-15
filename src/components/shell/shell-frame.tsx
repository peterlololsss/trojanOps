// Owner: D (WP-2). Chooses the frame around a page: the sign-in page at `/` stands alone, the My agents
// workspace fills the viewport between masthead and footer with its own columns, and every other page
// gets the scope side nav and a 1280px content column. The footer is added by AppShell on all of them.
'use client';

import { usePathname } from 'next/navigation';
import { isWorkspacePath } from './navigation';

interface ShellFrameProps {
  readonly masthead: React.ReactNode;
  readonly sideNav: React.ReactNode;
  readonly children: React.ReactNode;
}

export function ShellFrame({ masthead, sideNav, children }: ShellFrameProps) {
  const pathname = usePathname();
  if (pathname === '/') {
    return <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">{children}</main>;
  }
  const workspace = isWorkspacePath(pathname);
  return (
    <>
      <a href="#main-content" className="sr-only z-10 rounded-md bg-background px-4 py-2 text-primary focus:not-sr-only focus:absolute focus:left-4 focus:top-2">
        Skip to content
      </a>
      {masthead}
      {workspace ? (
        // basis-0 keeps the body at the viewport height, so the columns inside scroll on their own.
        <main id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col lg:min-h-[560px] lg:basis-0">{children}</main>
      ) : (
        <div className="flex flex-1 flex-col md:flex-row">
          {sideNav}
          <main id="main-content" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1280px] flex-1 p-6">{children}</main>
        </div>
      )}
    </>
  );
}
