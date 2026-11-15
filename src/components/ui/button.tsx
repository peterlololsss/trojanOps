// Owner: D. shadcn Button, restyled (ui-designer.md "Component changes"): Cardinal primary,
// bordered secondary, neutral ghost; destructive actions use the outline style with an explicit verb.
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary: 'border border-input bg-background text-foreground hover:bg-accent',
        outline: 'border border-input bg-background text-foreground hover:bg-accent',
        ghost: 'text-foreground hover:bg-accent',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 px-3',
        lg: 'h-10 px-6',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({
  className,
  variant,
  size,
  type = 'button',
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return <button type={type} data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
