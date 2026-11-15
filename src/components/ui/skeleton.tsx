import { cn } from '@/lib/utils';

// The enclosing loading region supplies aria-busy and a readable status message.
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} data-slot="skeleton" aria-hidden="true"
    className={cn('rounded-sm bg-accent motion-safe:animate-pulse', className)} />;
}
