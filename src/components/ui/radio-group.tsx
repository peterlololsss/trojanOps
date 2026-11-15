'use client';

import { Circle } from 'lucide-react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn('grid gap-3', className)} {...props} />;
}

export function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn('size-6 shrink-0 rounded-full border border-input bg-background text-primary hover:bg-accent data-[state=checked]:border-primary disabled:cursor-not-allowed disabled:opacity-50', className)}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="size-3 fill-current" aria-hidden="true" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}
