// Owner: D (WP-11). `loading.tsx` flushes the shell before the page resolves, so `notFound()` needs a
// boundary in this segment to replace the skeleton.
import Link from 'next/link';
import { PageHeader } from '@/components/shell';
import { buttonVariants } from '@/components/ui/button';

export default function ClubNotFound() {
  return <>
    <PageHeader title="Club not found" />
    <div className="flex flex-wrap items-center gap-4 rounded-md border border-border p-4">
      <p>There is no club at this address.</p>
      <Link href="/directory/clubs" className={buttonVariants({ variant: 'secondary' })}>Browse clubs</Link>
    </div>
  </>;
}
