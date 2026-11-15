import { cn } from '@/lib/utils';

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(
    'min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50',
    className,
  )} {...props} />;
}
