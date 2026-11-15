'use client';

// Owner: D (WP-11). The banner every directory route's error.tsx shows: what failed, and Try again.
import { CircleAlert } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function DirectoryErrorState({ title, failed, retry }: { title: string; failed: string; retry: () => void }) {
  return (
    <>
      <PageHeader title={title} />
      <Alert variant="destructive">
        <CircleAlert aria-hidden="true" />
        <div>
          <AlertTitle>{failed}</AlertTitle>
          <AlertDescription>Check your connection and try again. If the problem continues, contact a USG administrator.</AlertDescription>
          <Button variant="secondary" onClick={retry} className="mt-3">Try again</Button>
        </div>
      </Alert>
    </>
  );
}
