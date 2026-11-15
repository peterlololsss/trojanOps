'use client';

// Owner: B. The builder's preview: the chat's first screen as members will see it with the draft
// (run-workspace.tsx's empty state and composer), redrawn from the draft so it needs no installation.
// Only the model menu is live; picking a model there sets the draft's default.
import { ArrowUpCircle, ArrowUpRight } from 'lucide-react';
import { AgentTags } from '@/components/inspector/agent-header';
import { ModelPicker } from '@/components/inspector/model-picker';
import { buttonVariants } from '@/components/ui/button';
import { agentTags } from '@/app/me/agents/agent-tags';
import { STARTERS } from '@/lib/documents/fixtures';
import { classOf, DEMO_MODELS, type ModelId } from '@/lib/gateway/models';
import { creditLabel, priceMicro } from '@/lib/gateway/prices';
import { cn } from '@/lib/utils';

export interface TemplatePreviewProps {
  readonly name: string;
  readonly slug: string;
  /** "v1", or "v2 draft" while the draft differs from the published version. */
  readonly versionLabel: string;
  readonly purpose: string;
  readonly modelIds: readonly ModelId[];
  readonly defaultModelId: ModelId;
  readonly onDefaultModel: (id: ModelId) => void;
  readonly disabled?: boolean;
}

export function TemplatePreview({ name, slug, versionLabel, purpose, modelIds, defaultModelId, onDefaultModel, disabled }: TemplatePreviewProps) {
  const starters = Object.hasOwn(STARTERS, slug) ? STARTERS[slug] : [];
  const tags = agentTags(slug);
  const choices = DEMO_MODELS.filter(model => modelIds.includes(model.id));
  return <aside aria-labelledby="template-preview-title" className="min-w-0 space-y-3 lg:sticky lg:top-24">
    <div>
      <h2 id="template-preview-title" className="text-base font-semibold leading-6">Preview</h2>
      <p className="text-sm text-muted-foreground">What members see</p>
    </div>
    <div className="flex min-h-[520px] flex-col rounded-md border border-border bg-background">
      <div className="border-b border-border px-4 py-3 [overflow-wrap:anywhere]">
        <p className="font-semibold leading-6">{name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>USG template</span><span aria-hidden="true">·</span><span className="tabular-nums">{versionLabel}</span>
          {tags.length > 0 && <><span aria-hidden="true">·</span><AgentTags tags={tags} /></>}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center px-4 py-6 [overflow-wrap:anywhere]">
        {starters.length > 0 ? <div className="mx-auto w-full max-w-lg">
          <p className="text-xl font-semibold leading-7">What would you like to work on?</p>
          {purpose && <p className="mt-2 text-base leading-6 text-muted-foreground">{purpose}</p>}
          <ul aria-label="Suggested questions" className="mt-6 divide-y divide-border border-y border-border">
            {starters.map(starter => <li key={starter} className="flex min-h-12 items-center justify-between gap-4 px-3 py-3">
              <span>{starter}</span><ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </li>)}
          </ul>
        </div> : <p className="mx-auto max-w-md text-center text-base leading-6 text-muted-foreground">{purpose || 'Add a purpose to show it here.'}</p>}
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-md border border-input">
          <p aria-hidden="true" className="px-3 pt-3 text-base leading-6 text-muted-foreground">Ask {name}…</p>
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-2">
            <div className="flex min-w-0 items-center gap-1">
              {choices.length ? <ModelPicker choices={choices} value={defaultModelId} onChange={onDefaultModel} label="Preview model" disabled={disabled} />
                : <span className="px-2 text-xs text-muted-foreground">No models offered</span>}
              {choices.length > 0 && <span className="text-xs tabular-nums text-muted-foreground">{creditLabel(priceMicro(classOf(defaultModelId)))}</span>}
            </div>
            <span aria-hidden="true" className={cn(buttonVariants(), 'pointer-events-none min-w-20 opacity-50')}><ArrowUpCircle />Run</span>
          </div>
        </div>
      </div>
    </div>
  </aside>;
}
