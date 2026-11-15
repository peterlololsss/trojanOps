// The changed lines between two versions of a document's text, for the publish review.

export interface LineChange {
  /** The line number in the new text, or in the old text for a removed line. */
  line: number;
  /** null when the line is new. */
  before: string | null;
  /** null when the line was removed. */
  after: string | null;
}

/**
 * Either the changed lines, or, when the edited region is too large to diff in the browser, only how
 * many lines it spans (`changes: null`).
 */
export type LineDiff = { changes: LineChange[]; count: number } | { changes: null; count: number };

/** The LCS table holds one cell per pair of lines in the edited region; beyond this, count instead. */
export const MAX_DIFF_CELLS = 4_000_000;

/**
 * Lines that differ, from a longest-common-subsequence diff. Within each run of changes, removed and
 * added lines pair up as before → after; extras stay one-sided. Blank-line-only changes are left out.
 */
export function lineDiff(before: string, after: string, maxCells = MAX_DIFF_CELLS): LineDiff {
  const a = before.replace(/\r\n?/g, '\n').split('\n'); const b = after.replace(/\r\n?/g, '\n').split('\n');
  // Skip the common head and tail so only the edited region is compared.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length; let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const x = a.slice(start, endA); const y = b.slice(start, endB);
  if (x.length * y.length > maxCells) return { changes: null, count: Math.max(x.length, y.length) };

  const lcs = Array.from({ length: x.length + 1 }, () => new Uint32Array(y.length + 1));
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) {
    lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  }
  const changes: LineChange[] = [];
  let removed: Array<{ line: number; text: string }> = []; let added: Array<{ line: number; text: string }> = [];
  const flush = () => {
    for (let k = 0; k < Math.max(removed.length, added.length); k++) {
      const old = removed[k]; const now = added[k];
      changes.push({ line: now?.line ?? old!.line, before: old?.text ?? null, after: now?.text ?? null });
    }
    removed = []; added = [];
  };
  let i = 0; let j = 0;
  while (i < x.length || j < y.length) {
    if (i < x.length && j < y.length && x[i] === y[j]) { flush(); i++; j++; }
    else if (j < y.length && (i === x.length || lcs[i][j + 1] >= lcs[i + 1][j])) { added.push({ line: start + j + 1, text: y[j] }); j++; }
    else { removed.push({ line: start + i + 1, text: x[i] }); i++; }
  }
  flush();
  const shown = changes.filter(c => (c.before ?? '').trim() !== '' || (c.after ?? '').trim() !== '');
  return { changes: shown, count: shown.length };
}

/** The changed lines, or null when the edited region is too large to diff. */
export const lineChanges = (before: string, after: string, maxCells = MAX_DIFF_CELLS): LineChange[] | null =>
  lineDiff(before, after, maxCells).changes;
