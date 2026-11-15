import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex max-w-[200px] items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-semibold [&_svg]:size-3 [&_svg]:shrink-0',
  { variants: { variant: {
    neutral: 'border-border bg-muted text-foreground',
    success: 'border-border text-success',
    info: 'border-border text-info',
    attention: 'border-transparent bg-gold-25 text-foreground [&_svg]:text-attention-ink',
    danger: 'border-border text-primary',
  } }, defaultVariants: { variant: 'neutral' } },
);

// Supply an icon as well as words when displaying a status.
export function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
