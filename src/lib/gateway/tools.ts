// Owner: A (WP-4). Tool kinds for §7 step 7. Write tools never execute from a model call (I6): they
// become pending_actions that a human confirms. Read and draft tools run through gateway.tool() once
// real agents exist (WP-14). An unregistered tool counts as a write tool, so it can only ever wait
// for a human.
export type ToolKind = 'read' | 'draft' | 'write';

// TODO(WP-14): register read and draft tools here as they are built.
const KINDS: Record<string, ToolKind> = {};

export function toolKind(tool: string): ToolKind {
  return Object.hasOwn(KINDS, tool) ? KINDS[tool] : 'write';
}

// Positions that may confirm a pending write action, by tool. TODO(verify): §14 says "a position
// allowed for that tool" and no write tool exists yet; register each one here with its positions
// (WP-14). A tool with no entry can be confirmed by the run's own user while they hold any active
// membership in the action's club: the person who asked for the action approves it, and the
// per-tool entries narrow that to named positions.
const CONFIRMERS: Record<string, string[]> = {};

/** The positions that may confirm `tool`, or null when any member of the club may. */
export function confirmerPositions(tool: string): string[] | null {
  return Object.hasOwn(CONFIRMERS, tool) ? CONFIRMERS[tool] : null;
}
