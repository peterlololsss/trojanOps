// Owner: C. DataTable moved to @/components/inspector/data-table so the audit views can share it.
// This re-export keeps stream B's catalog import (`../documents/data-table`) working; delete it once
// B imports from @/components/inspector.
export { DataTable, type DataTableProps, type SortedColumn } from '@/components/inspector/data-table';
