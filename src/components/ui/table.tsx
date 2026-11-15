import { cn } from '@/lib/utils';

// Semantic table primitives. Page owners add TanStack sorting/pagination when its dependency lands.
export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return <div data-slot="table-container" className="w-full overflow-x-auto">
    <table data-slot="table" className={cn('w-full caption-bottom text-sm', className)} {...props} />
  </div>;
}
export function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('bg-muted text-left', className)} {...props} />;
}
export function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}
export function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return <tfoot data-slot="table-footer" className={cn('border-t bg-muted font-semibold', className)} {...props} />;
}
export function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr data-slot="table-row" className={cn('h-10 border-b border-border hover:bg-accent data-[state=selected]:bg-accent', className)} {...props} />;
}
export function TableHead({ className, scope = 'col', ...props }: React.ComponentProps<'th'>) {
  return <th data-slot="table-head" scope={scope} className={cn('h-10 whitespace-nowrap px-3 text-left font-semibold', className)} {...props} />;
}
export function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return <td data-slot="table-cell" className={cn('px-3 py-2 align-middle', className)} {...props} />;
}
export function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return <caption data-slot="table-caption" className={cn('mt-3 text-left text-xs text-muted-foreground', className)} {...props} />;
}
