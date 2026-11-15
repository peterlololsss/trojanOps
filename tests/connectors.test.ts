import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { AppError } from '@/lib/contracts';
import { connectors } from '@/lib/db/schema';
import { parseRosterCsv } from '@/lib/connectors/roster/mock';
import { appSql, closeAppDb, inRolledBackApp } from './db';

const HEADER = 'orgSlug,orgName,externalUserId,userDisplayName,position';
const probe = await appSql();
await probe?.end();

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
afterAll(async () => {
  if (probe) await closeAppDb();
});

describe('CSV roster boundary', () => {
  it('reads quoted commas, escaped quotes and multiline names without shifting fields', () => {
    const csv = `${HEADER}\r\nrobotics,"Robotics, Club",quinn,"Quinn ""Q""\r\nLee",president\r\n`;

    expect(parseRosterCsv(csv)).toEqual([{
      orgSlug: 'robotics', orgName: 'Robotics, Club', externalUserId: 'quinn',
      userDisplayName: 'Quinn "Q"\r\nLee', position: 'president',
    }]);
  });

  it.each([
    '', 'bad,header\n', `${HEADER}\n`,
    `${HEADER}\nrobotics,Robotics Club,quinn,Quinn`,
    `${HEADER}\nrobotics,Robotics Club,quinn,Quinn,president,extra`,
    `${HEADER}\nrobotics,Robotics Club,quinn,,president`,
    `${HEADER}\nrobotics,Robotics Club,quinn,   ,president`,
    `${HEADER}\nrobotics,"Robotics Club,quinn,Quinn,president`,
    `${HEADER}\nrobotics,Robotics"Club,quinn,Quinn,president`,
    `${HEADER}\nrobotics,"Robotics Club"extra,quinn,Quinn,president`,
  ])('rejects malformed or incomplete roster input %#', (csv) => {
    expect(() => parseRosterCsv(csv)).toThrow(AppError);
  });
});

describe('connector selection', () => {
  it('keeps the selected implementation after startup environment changes', async () => {
    const registry = await import('@/lib/connectors/registry');
    registry.getConnectors();
    vi.stubEnv('CONNECTOR_ROSTER', 'engagesc');

    expect(registry.connectorImplementation('roster')).toBe('csv');
  });

  it('rejects an unavailable implementation instead of reporting a working mock', async () => {
    vi.stubEnv('CONNECTOR_ROSTER', 'engagesc');
    const registry = await import('@/lib/connectors/registry');

    expect(() => registry.getConnectors()).toThrow();
  });
});

describe.skipIf(!probe)('connector status persistence', () => {
  it('records the selected implementations without erasing stored sync health', async () => {
    const { listConnectors } = await import('@/lib/connectors/registry');
    await inRolledBackApp(async (tx) => {
      const lastSyncAt = new Date('2026-11-15T18:00:00Z');
      await tx.insert(connectors).values({
        kind: 'roster', implementation: 'old', status: 'degraded', lastSyncAt, createdAt: lastSyncAt,
      }).onConflictDoUpdate({ target: connectors.kind, set: { implementation: 'old', status: 'degraded', lastSyncAt } });

      const listed = await listConnectors();

      expect(listed.find((entry) => entry.kind === 'roster')).toEqual({
        kind: 'roster', implementation: 'csv', status: 'degraded', lastSyncAt, isMock: true,
      });
      const stored = await tx.select().from(connectors);
      expect(stored).toHaveLength(5);
      expect(stored.find((entry) => entry.kind === 'identity')?.implementation).toBe('persona');
    });
  });

  it('persists a failed sync without overwriting the previous successful time', async () => {
    const { recordRosterSync } = await import('@/lib/connectors/registry');
    await inRolledBackApp(async (tx) => {
      const lastSyncAt = new Date('2026-11-15T18:00:00Z');
      await tx.insert(connectors).values({
        kind: 'roster', implementation: 'csv', status: 'ok', lastSyncAt, createdAt: lastSyncAt,
      }).onConflictDoUpdate({ target: connectors.kind, set: { status: 'ok', lastSyncAt } });

      await recordRosterSync({ status: 'down', details: { changes: 0 } });

      const [stored] = await tx.select().from(connectors).where(eq(connectors.kind, 'roster'));
      expect(stored).toMatchObject({ status: 'down', lastSyncAt, details: { changes: 0 } });
    });
  });

  it('records recovery and the successful sync time', async () => {
    const { recordRosterSync } = await import('@/lib/connectors/registry');
    await inRolledBackApp(async (tx) => {
      const earlier = new Date('2026-11-15T18:00:00Z');
      await tx.insert(connectors).values({
        kind: 'roster', implementation: 'csv', status: 'down', lastSyncAt: earlier, createdAt: earlier,
      }).onConflictDoUpdate({ target: connectors.kind, set: { status: 'down', lastSyncAt: earlier } });
      const completed = new Date('2026-11-15T18:10:00Z');

      await recordRosterSync({ status: 'ok', lastSyncAt: completed, details: { changes: 3 } });

      const [stored] = await tx.select().from(connectors).where(eq(connectors.kind, 'roster'));
      expect(stored).toMatchObject({ status: 'ok', lastSyncAt: completed, details: { changes: 3 } });
    });
  });
});
