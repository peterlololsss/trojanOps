'use client';

import { AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';

export default function UsgAuditError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <>
      <PageHeader title="Audit log" />
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-primary p-4">
        <AlertCircle aria-hidden className="size-4 text-primary" />
        <p>Could not load the USG audit log. Try again in a moment.</p>
        <Button variant="secondary" onClick={retry}>Try again</Button>
      </div>
    </>
  );
}
