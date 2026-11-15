// Owner: D (WP-11). A department that does not exist: say so and offer the way back.
import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import { buttonVariants } from '@/components/ui/button';

export function DepartmentNotFound({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return <>
    <PageHeader title="Department not found" />
    <div className="flex flex-wrap items-center gap-4 rounded-md border border-border p-4">
      <p>There is no department at this address.</p>
      <Link href={backHref} className={buttonVariants({ variant: 'secondary' })}>{backLabel}</Link>
    </div>
  </>;
}
