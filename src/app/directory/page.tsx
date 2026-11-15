import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { directory } from '@/lib/distribution';
import { getActor } from '@/lib/identity';
import { DirectoryList } from './directory-list';

export default async function DirectoryPage() {
  const actor = await getActor();
  if (!actor.userId) {
    return <>
      <PageHeader title="Directory" />
      <Alert>
        <LockKeyhole aria-hidden="true" />
        <div>
          <AlertTitle>Sign in to browse public agents</AlertTitle>
          <AlertDescription>All signed-in students can use these agents, including students who do not belong to a club.</AlertDescription>
          <Link href="/" className={buttonVariants({ variant: 'secondary', className: 'mt-3' })}>Sign in</Link>
        </div>
      </Alert>
    </>;
  }
  const agents = await directory();
  return <>
    <PageHeader title="Directory" description="Public agents from clubs across campus. No club membership required." />
    <DirectoryList key={actor.userId} agents={agents} />
  </>;
}
