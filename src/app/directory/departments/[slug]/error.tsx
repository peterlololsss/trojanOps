'use client';

import { DirectoryErrorState } from '../../_dashboard/error-state';

export default function DepartmentError({ retry }: { readonly retry: () => void }) {
  return <DirectoryErrorState title="Department" failed="Could not load this department" retry={retry} />;
}
