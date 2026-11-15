'use client';

import { DirectoryErrorState } from '../_dashboard/error-state';

export default function ClubsError({ retry }: { readonly retry: () => void }) {
  return <DirectoryErrorState title="Clubs" failed="Could not load clubs" retry={retry} />;
}
