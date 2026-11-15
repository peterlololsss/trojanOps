'use client';

// The demo-model menu: chat's composer and the USG template builder use the same control, so a
// template's default model looks the way members will see it.
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { modelById, type DemoModel, type ModelId } from '@/lib/gateway/models';
import { creditLabel, priceMicro } from '@/lib/gateway/prices';

export interface ModelPickerProps {
  readonly choices: readonly DemoModel[];
  readonly value: ModelId;
  readonly onChange: (id: ModelId) => void;
  /** A line under the choices, such as why the list is short. */
  readonly note?: string | null;
  /** Accessible name prefix, e.g. "Demo model" in chat or "Default model" in the builder. */
  readonly label?: string;
  readonly disabled?: boolean;
  readonly className?: string;
}

export function ModelPicker({ choices, value, onChange, note, label = 'Demo model', disabled, className }: ModelPickerProps) {
  const selected = choices.find((c) => c.id === value) ?? modelById(value);
  const name = selected?.label ?? value;
  return <DropdownMenu>
    <DropdownMenuTrigger asChild disabled={disabled}>
      <Button type="button" variant="ghost" size="sm" className={cn('max-w-56 px-2 font-mono text-xs', className)} aria-label={`${label}: ${name}`}>
        <span className="truncate">{name}</span><ChevronDown aria-hidden className="size-3" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-80">
      <p className="px-2 py-2 text-xs text-muted-foreground">Demo models</p>
      <DropdownMenuRadioGroup value={selected?.id} onValueChange={(id) => { const choice = choices.find((c) => c.id === id); if (choice) onChange(choice.id); }}>
        {choices.map((choice) => <DropdownMenuRadioItem key={choice.id} value={choice.id}>
          <span className="flex-1 font-mono text-xs">{choice.label}</span>
          <span className="text-xs text-muted-foreground">{choice.provider}</span>
          <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">{creditLabel(priceMicro(choice.modelClass))}</span>
        </DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
      {note && <><DropdownMenuSeparator /><p className="px-3 py-2 text-xs leading-4">{note}</p></>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
