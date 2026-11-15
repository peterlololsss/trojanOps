// Owner: D (WP-11). The states every directory route shares: signed out, and the loading skeletons
// that hold the page's shape while the service answers.
import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function DirectorySignedOut({ title = 'Directory' }: { title?: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Alert>
        <LockKeyhole aria-hidden="true" />
        <div>
          <AlertTitle>Sign in to browse clubs</AlertTitle>
          <AlertDescription>Any student signed in with a USC account can browse clubs and use their public agents.</AlertDescription>
          <Link href="/" className={buttonVariants({ variant: 'secondary', className: 'mt-3' })}>Sign in</Link>
        </div>
      </Alert>
    </>
  );
}

/** A list page: header, filters, rows. */
export function ListSkeleton({ title, label }: { title: string; label: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div role="status" aria-label={label} className="space-y-4">
        <span className="sr-only">{label}</span>
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}
        </div>
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((row) => <Skeleton key={row} className="h-14 w-full" />)}
        </div>
      </div>
    </>
  );
}

/** A dashboard: initials tile and title, tabs, two panels. */
export function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="mb-4 flex gap-4">
        <Skeleton className="size-16 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-6 w-full max-w-lg" />
          <Skeleton className="h-5 w-64" />
        </div>
      </div>
      <Skeleton className="mb-6 h-10 w-full" />
      <div className="space-y-6">
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  );
}
