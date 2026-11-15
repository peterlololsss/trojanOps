'use client';

import { CircleAlert } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function IntegrationsError({ retry }: { readonly retry: () => void }) {
  return <>
    <PageHeader title="Integrations" />
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <div>
        <AlertTitle>Could not load connectors</AlertTitle>
        <AlertDescription>Check your connection and try again. If the problem continues, contact a USG administrator.</AlertDescription>
        <Button variant="secondary" onClick={retry} className="mt-3">Try again</Button>
      </div>
    </Alert>
  </>;
}
