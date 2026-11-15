import { cn } from '@/lib/utils';

export function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return <input data-slot="input" type={type} className={cn(
    'h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50',
    className,
  )} {...props} />;
}
