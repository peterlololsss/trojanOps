import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'flex items-start gap-3 rounded-md border p-4 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0',
  { variants: { variant: {
    default: 'border-border bg-muted text-foreground',
    attention: 'border-border bg-gold-25 text-foreground [&>svg]:text-attention-ink',
    destructive: 'border-destructive bg-background text-foreground [&>svg]:text-primary',
  } }, defaultVariants: { variant: 'default' } },
);

export function Alert({ className, variant, role = 'alert', ...props }: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role={role} className={cn(alertVariants({ variant }), className)} {...props} />;
}
export function AlertTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 data-slot="alert-title" className={cn('font-semibold', className)} {...props} />;
}
export function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-description" className={cn('mt-1 text-sm', className)} {...props} />;
}
