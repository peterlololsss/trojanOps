'use client';

import { AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';

export default function CatalogError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <>
      <PageHeader title="Catalog" />
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-primary p-4">
        <AlertCircle aria-hidden className="size-4 text-primary" />
        <p>Could not load this club&rsquo;s agents. Try again in a moment.</p>
        <Button variant="secondary" onClick={retry}>Try again</Button>
      </div>
    </>
  );
}
