'use client';

import { DirectoryErrorState } from './_dashboard/error-state';

export default function DirectoryError({ retry }: { readonly retry: () => void }) {
  return <DirectoryErrorState title="Directory" failed="Could not load the directory" retry={retry} />;
}
