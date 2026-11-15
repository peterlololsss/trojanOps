'use client';

import { DirectoryErrorState } from '../../_dashboard/error-state';

export default function ClubDashboardError({ retry }: { readonly retry: () => void }) {
  return <DirectoryErrorState title="Club" failed="Could not load this club" retry={retry} />;
}
