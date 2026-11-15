'use client';

// Owner: C (WP-9). The run workspace shared by /org/[orgId]/agents/[installationId] and
// /directory/[installationId] (stream D): transcript and input on the left, the inspector on the
// right. Every run goes through POST /api/agents/:installationId/runs, so the gateway decides (I5).
// Page-agnostic: no club-specific copy here; the page above it says whose agent this is.
// The transcript lives in memory only (I15): no browser storage, nothing reloads.
import { AlertCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useReducer, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ApiError } from '@/lib/contracts';
import { Inspector } from './inspector';
import { InspectorPlaceholder } from './inspector-placeholder';
import { canConfirm, initialRunState, latestInspector, requestConfirm, requestRun, runReducer } from './run-state';
import { Transcript } from './transcript';

export interface RunWorkspaceProps {
  installationId: string;
  agentName: string;
  /** The mock runtime is on: replies are labelled "Demo runtime: placeholder answer". */
  demoRuntime: boolean;
}

/** Same limit as the runs route (1–8000 characters after trimming). */
const MAX_INPUT = 8000;

export function validateInput(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'Write a message before you run the agent.';
  if (trimmed.length > MAX_INPUT) {
    return `Messages can be up to 8,000 characters. Shorten this one by ${(trimmed.length - MAX_INPUT).toLocaleString('en-US')}.`;
  }
  return null;
}

export function RunErrorBanner({ error, onDismiss }: { error: ApiError; onDismiss?: () => void }) {
  return (
    <div role="alert" className="mb-[12px] flex flex-wrap items-start gap-[8px] rounded-md border border-primary bg-background px-[16px] py-[12px]">
      <AlertCircle aria-hidden className="mt-[2px] size-[16px] shrink-0 text-primary" />
      <p className="min-w-0 flex-1">
        {error.message}
        {error.code === 'unauthenticated' && <>{' '}<Link href="/" className="text-primary underline">Choose a persona</Link></>}
      </p>
      <Button type="button" variant="ghost" className="h-[28px] px-[8px]" onClick={onDismiss}>Dismiss</Button>
    </div>
  );
}

export function RunWorkspace({ installationId, agentName, demoRuntime }: RunWorkspaceProps) {
  const [state, dispatch] = useReducer(runReducer, initialRunState);
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fieldId = useId();
  const errorId = useId();
  const hintId = useId();
  const inspector = latestInspector(state);

  useEffect(() => {
    if (state.turns.length > 0) endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [state.turns.length]);

  async function run(text: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    dispatch({ type: 'submit', text });
    try {
      // requestRun never throws: network and non-JSON failures come back as a `failed` event.
      dispatch(await requestRun(fetch, installationId, text, `Could not run ${agentName}. Try again in a moment.`));
    } finally {
      inFlight.current = false;
    }
  }

  async function confirm(id: string) {
    if (!canConfirm(state.actions[id])) return;
    dispatch({ type: 'confirm_started', id });
    dispatch(await requestConfirm(fetch, id, 'Could not confirm this action. Check your connection and try again.'));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.running) return;   // progress is already showing; the reducer ignores it too
    const problem = validateInput(input);
    setInputError(problem);
    if (problem) return;
    void run(input.trim());
    setInput('');
  }

  return (
    <div className="flex flex-col items-start gap-[24px] lg:flex-row">
      <div className="w-full min-w-0 max-w-[720px] flex-1">
        <Transcript
          turns={state.turns}
          actions={state.actions}
          agentName={agentName}
          demoRuntime={demoRuntime}
          onConfirm={(id) => void confirm(id)}
          onReject={(id) => dispatch({ type: 'rejected', id })}
        />
        <div ref={endRef} />

        <form noValidate onSubmit={onSubmit} className="mt-[16px]">
          {state.error && <RunErrorBanner error={state.error} onDismiss={() => dispatch({ type: 'dismiss_error' })} />}
          <label htmlFor={fieldId} className="mb-[4px] block font-semibold">Message</label>
          <textarea
            id={fieldId}
            name="input"
            rows={3}
            value={input}
            aria-invalid={inputError ? true : undefined}
            aria-describedby={inputError ? `${errorId} ${hintId}` : hintId}
            onChange={(e) => {
              setInput(e.target.value);
              if (inputError) setInputError(validateInput(e.target.value));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            className="block min-h-[88px] w-full resize-y rounded-md border border-input bg-background px-[12px] py-[8px] text-[14px] leading-5 aria-invalid:border-primary"
          />
          {inputError && (
            <p id={errorId} className="mt-[4px] flex items-center gap-[4px] text-primary">
              <AlertCircle aria-hidden className="size-[14px] shrink-0" />
              <span>{inputError}</span>
            </p>
          )}
          <div className="mt-[8px] flex flex-wrap items-center gap-x-[16px] gap-y-[8px]">
            <Button type="submit" className="h-[36px] px-[16px]">{`Run ${agentName}`}</Button>
            {/* Always mounted so screen readers announce the step when it appears. */}
            <p aria-live="polite" role="status" className="flex items-center gap-[8px]">
              {state.running && (
                <>
                  <Clock aria-hidden className="size-[16px] shrink-0 text-muted-foreground" />
                  <span>Checking access</span>
                </>
              )}
            </p>
            <p id={hintId} className="ml-auto text-[12px] leading-4 text-muted-foreground">Press Ctrl+Enter to run. Leaving this page clears the conversation.</p>
          </div>
        </form>
      </div>

      <div className="w-[384px] max-w-full shrink-0 lg:sticky lg:top-[24px]">
        {inspector ? <Inspector inspector={inspector} /> : <InspectorPlaceholder />}
      </div>
    </div>
  );
}
