// Owner: D (WP-10). The csv roster: db/seed/roster.csv stands in for the EngageSC directory.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { AppError } from '../../contracts';
import type { RosterRow, RosterSource } from '../../contracts';

const COLUMNS = ['orgSlug', 'orgName', 'externalUserId', 'userDisplayName', 'position'] as const;
const field = z.string().trim().min(1);
const rowSchema = z.tuple([field, field, field, field, field]);

export function parseRosterCsv(text: string): RosterRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let quoted = false;
  let closedQuote = false;
  const invalid = () => new AppError({ code: 'invalid', message: 'The roster CSV is malformed. Check its quoting and columns, then sync again.' });
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index++;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else cell += character;
      continue;
    }
    if (character === ',') {
      record.push(cell);
      cell = '';
      closedQuote = false;
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      record.push(cell);
      if (record.length > 1 || cell.length > 0) records.push(record);
      record = [];
      cell = '';
      closedQuote = false;
    } else if (character === '"' && cell.length === 0 && !closedQuote) {
      quoted = true;
    } else {
      if (character === '"' || closedQuote) throw invalid();
      cell += character;
    }
  }
  if (quoted) throw invalid();
  if (record.length > 0 || cell.length > 0 || closedQuote) records.push([...record, cell]);
  const [header, ...rows] = records;
  if (!header || header.length !== COLUMNS.length || header.some((name, index) => name !== COLUMNS[index])) {
    throw new AppError({ code: 'invalid', message: `The roster CSV header must be: ${COLUMNS.join(',')}.` });
  }
  if (rows.length === 0) throw new AppError({ code: 'invalid', message: 'The roster CSV has no members. Add its rows, then sync again.' });
  return rows.map((row, index) => {
    const parsed = rowSchema.safeParse(row);
    if (!parsed.success) {
      throw new AppError({ code: 'invalid', message: `Roster record ${index + 2} needs exactly five nonempty fields. Correct the record, then sync again.` });
    }
    const [orgSlug, orgName, externalUserId, userDisplayName, position] = parsed.data;
    return { orgSlug, orgName, externalUserId, userDisplayName, position };
  });
}

export const csvRoster: RosterSource = {
  async fetch() {
    return parseRosterCsv(await readFile(path.join(process.cwd(), 'db', 'seed', 'roster.csv'), 'utf8'));
  },
};
