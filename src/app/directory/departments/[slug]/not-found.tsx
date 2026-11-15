// Owner: D (WP-11). `loading.tsx` flushes the shell before the page resolves, so `notFound()` needs a
// boundary in this segment to replace the skeleton.
import { DepartmentNotFound } from '../../_dashboard/not-found-state';

export default function DepartmentNotFoundPage() {
  return <DepartmentNotFound backHref="/directory/departments" backLabel="All departments" />;
}
