'use client';

// Owner: B (WP-7). A failure the page itself could not turn into a banner (a render error, or a
// refresh that threw) still reads as a banner with a way out, not as an empty page.
import { AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';

export default function ClubAdminError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <>
      <PageHeader title="Manage club" />
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-primary p-4">
        <AlertCircle aria-hidden className="size-4 text-primary" />
        <p>Could not load this club&rsquo;s roster and budgets. Try again in a moment.</p>
        <Button variant="secondary" onClick={retry}>Try again</Button>
      </div>
    </>
  );
}
