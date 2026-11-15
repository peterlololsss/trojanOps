'use client';

import { DirectoryErrorState } from '../_dashboard/error-state';

export default function DepartmentsError({ retry }: { readonly retry: () => void }) {
  return <DirectoryErrorState title="Departments" failed="Could not load departments" retry={retry} />;
}
