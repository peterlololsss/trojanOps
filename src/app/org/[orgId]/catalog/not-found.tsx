// Owner: B. `loading.tsx` flushes the shell before the page resolves, so `notFound()` can no
// longer set the status or swap the body — without this the response is a skeleton that never
// finishes, at HTTP 200.
import Link from 'next/link';
import { PageHeader } from '@/components/shell';

export default function ClubNotFound() {
  return (
    <>
      <PageHeader title="Club not found" description="There is no club with that address." />
      <p className="rounded-md border border-border p-4">
        Check the link, or browse{' '}
        <Link href="/directory/clubs" className="text-primary underline">all clubs</Link> in the directory.
      </p>
    </>
  );
}
