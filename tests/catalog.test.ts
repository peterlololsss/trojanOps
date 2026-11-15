// Owner: B (WP-7). The club catalog lists everything installed in a club — including what the
// club switched off and what USG retired — while answering per viewer what they may actually use.
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { catalog } from '@/lib/distribution';
import { INSTALLATION, ORG, TEMPLATE, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp } from './db';

const probe = await appSql();
await probe?.end();
afterAll(async () => {
  if (probe) await closeAppDb();
});

const entry = (c: Awaited<ReturnType<typeof catalog>>, slug: string) =>
  c!.agents.find((a) => a.templateSlug === slug);

describe.skipIf(!probe)('catalog · what the club has', () => {
  it('lists an installation the club switched off, which my-agents hides', async () => {
    const found = await catalog(await actorFor(USER.casey, ORG.startup), ORG.startup);
    const slugs = found!.agents.map((a) => a.templateSlug).sort();
    expect(slugs).toEqual(['event-retrospective', 'funding-precheck', 'handoff', 'meeting-recap', 'recruiting-qa']);
    // Seeded disabled: D3 publishes it on stage, and the president needs to see it to do that.
    expect(entry(found, 'recruiting-qa')!.status).toBe('disabled');
  });

  // §14 scopes the catalog to the club's members. It carries the club's monthly quota, each
  // agent's budget, and for USG the configuration of an internal agent — none of which belongs to
  // a student who merely knows the club's id.
  it('refuses a student who is not in the club', async () => {
    await expect(catalog(await actorFor(USER.casey, ORG.startup), ORG.dance))
      .rejects.toMatchObject({ error: { code: 'forbidden' } });
  });

  it('lets a USG admin see any club, since they oversee all of them', async () => {
    const found = await catalog(await actorFor(USER.avery, ORG.usg), ORG.dance);
    expect(found!.agents.map((a) => a.templateSlug)).toContain('showcase-qa');
    expect(found!.canManage).toBe(false);
  });

  it('returns null for a club with no installations at all', async () => {
    expect(await catalog(await actorFor(USER.avery, ORG.usg), crypto.randomUUID())).toBeNull();
  });
});

describe.skipIf(!probe)('catalog · what this viewer may use', () => {
  it('marks only the members agent usable for a plain member', async () => {
    const found = await catalog(await actorFor(USER.casey, ORG.startup), ORG.startup);
    expect(entry(found, 'handoff')!.reasonLabel).toBe('All members');
    expect(entry(found, 'funding-precheck')!.reasonLabel).toBeNull();
  });

  it('marks the pre-check usable for the treasurer, by position', async () => {
    const found = await catalog(await actorFor(USER.taylor, ORG.startup), ORG.startup);
    expect(entry(found, 'funding-precheck')!.reasonLabel).toBe('Treasurer, President');
  });

  // Morgan is Archery's treasurer and a plain member of Startup: the position must not follow her.
  it("does not let another club's treasurer use this club's pre-check", async () => {
    const found = await catalog(await actorFor(USER.morgan, ORG.startup), ORG.startup);
    expect(entry(found, 'funding-precheck')!.reasonLabel).toBeNull();
    expect(entry(found, 'handoff')!.reasonLabel).toBe('All members');
  });

  it('offers nothing on a switched-off agent, however senior the viewer', async () => {
    const found = await catalog(await actorFor(USER.sam, ORG.startup), ORG.startup);
    expect(entry(found, 'recruiting-qa')!.reasonLabel).toBeNull();
  });
});

describe.skipIf(!probe)('catalog · what the president may do', () => {
  it('lets the president manage, and a member not', async () => {
    expect((await catalog(await actorFor(USER.sam, ORG.startup), ORG.startup))!.canManage).toBe(true);
    expect((await catalog(await actorFor(USER.casey, ORG.startup), ORG.startup))!.canManage).toBe(false);
  });

  // Morgan is Archery's treasurer and a plain member of Startup: she may read Startup's catalog,
  // but acting in Archery she manages nothing here.
  it('does not let someone manage a club they are not acting in as its president', async () => {
    expect((await catalog(await actorFor(USER.morgan, ORG.archery), ORG.startup))!.canManage).toBe(false);
  });

  it('marks a required agent, which §8 says cannot be switched off', async () => {
    const found = await catalog(await actorFor(USER.sam, ORG.startup), ORG.startup);
    expect(entry(found, 'funding-precheck')!.distribution).toBe('required');
    expect(entry(found, 'handoff')!.distribution).toBe('optional');
  });
});

describe.skipIf(!probe)('catalog · versions and retirement', () => {
  it('flags a pinned installation whose template has moved on (§8)', () =>
    inRolledBackApp(async (tx) => {
      await tx.execute(
        sql`update agent_installations set track = 'pinned', pinned_version = 1 where id = ${INSTALLATION.startupHandoff}`,
      );
      await tx.execute(sql`update agent_templates set latest_version = 2 where id = ${TEMPLATE.handoff}`);
      await tx.execute(
        sql`insert into agent_template_versions (template_id, version, purpose, audience, usable_by, max_tier,
              source_kinds, tools, model_classes, default_model_class, system_prompt, changelog, published_at, created_at)
            select template_id, 2, purpose, audience, usable_by, max_tier, source_kinds, tools, model_classes,
              default_model_class, system_prompt, 'v2', now(), now()
            from agent_template_versions where template_id = ${TEMPLATE.handoff} and version = 1`,
      );
      const found = await catalog(await actorFor(USER.sam, ORG.startup), ORG.startup);
      expect(entry(found, 'handoff')).toMatchObject({ templateVersion: 1, updateAvailable: true });
    }));

  it('shows a retired template as retired rather than dropping it', () =>
    inRolledBackApp(async (tx) => {
      await tx.execute(sql`update agent_templates set status = 'retired' where id = ${TEMPLATE.handoff}`);
      const found = await catalog(await actorFor(USER.sam, ORG.startup), ORG.startup);
      expect(entry(found, 'handoff')).toMatchObject({ status: 'retired', reasonLabel: null });
    }));
});
