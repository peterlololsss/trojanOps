// Owner: D (WP-11). Server-only: a department dashboard, or the reason this viewer may not see it.
// Both department routes call it, so a student outside the club gets the same no-permission state.
import { AppError, type Actor } from '@/lib/contracts';
import { departmentDashboard } from '@/lib/directory/service';
import type { DepartmentDashboard } from '@/lib/directory/types';

export type DepartmentLoad = { data: DepartmentDashboard | null; forbidden: null } | { data: null; forbidden: string };

export async function loadDepartment(actor: Actor, orgId: string, slug: string): Promise<DepartmentLoad> {
  try {
    return { data: await departmentDashboard(actor, orgId, slug), forbidden: null };
  } catch (error) {
    if (error instanceof AppError && error.error.code === 'forbidden') return { data: null, forbidden: error.error.message };
    throw error;
  }
}
