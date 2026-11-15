// Add the judge scenario to an existing demo database without resetting any existing records.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/lib/db/schema';
import { seedHackscPeople } from '../db/seed/hacksc-people';
import { seedHackscDistribution } from '../db/seed/hacksc-distribution';
import { seedHackscDocuments } from '../db/seed/documents';
import { seedHackscQuota } from '../db/seed/quota';

async function main() {
  const url = process.env.DATABASE_OWNER_URL;
  if (!url || process.env.DEMO_MODE !== '1') throw new Error('Demo setup requires DEMO_MODE=1 and DATABASE_OWNER_URL.');
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await drizzle(client, { schema }).transaction(async (tx) => {
      await seedHackscPeople(tx);
      await seedHackscDistribution(tx);
      await seedHackscDocuments(tx);
      await seedHackscQuota(tx);
    });
    console.log('HackSC demo records added. Existing records and versions preserved.');
  } finally {
    await client.end();
  }
}

await main();
