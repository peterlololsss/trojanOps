// Owner: B. Spec: docs/architecture.md §5 "Distribution" and §8.
import { sql } from 'drizzle-orm';
import { boolean, check, integer, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, ts } from './columns';
import { orgs, users } from './orgs';
import type { Audience, ModelClass, Tier } from '../../contracts';

export const agentTemplates = pgTable('agent_templates', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  publisherOrgId: uuid('publisher_org_id').notNull().references(() => orgs.id),
  scope: text('scope').notNull().$type<'global' | 'org'>(),
  distribution: text('distribution').notNull().$type<'required' | 'default' | 'optional'>(),
  target: text('target').notNull().default('all'),           // 'all' or a cohort slug
  status: text('status').notNull().default('active').$type<'active' | 'retired'>(),
  latestVersion: integer('latest_version').notNull().default(0),
  distributedAt: ts('distributed_at'),
  createdAt: createdAt(),
}, (t) => [
  check('agent_templates_scope_check', sql`${t.scope} in ('global', 'org')`),
  check('agent_templates_distribution_check', sql`${t.distribution} in ('required', 'default', 'optional')`),
  check('agent_templates_status_check', sql`${t.status} in ('active', 'retired')`),
]);

export const agentTemplateVersions = pgTable('agent_template_versions', {
  id: id(),
  templateId: uuid('template_id').notNull().references(() => agentTemplates.id),
  version: integer('version').notNull(),
  purpose: text('purpose').notNull(),
  audience: text('audience').notNull().$type<Audience>(),
  usableBy: text('usable_by').array().notNull().default(sql`'{}'`),
  maxTier: text('max_tier').notNull().$type<Tier>(),
  sourceKinds: text('source_kinds').array().notNull().default(sql`'{}'`),
  tools: text('tools').array().notNull().default(sql`'{}'`),
  modelClasses: text('model_classes').array().notNull().$type<ModelClass[]>(),
  defaultModelClass: text('default_model_class').notNull().$type<ModelClass>(),
  systemPrompt: text('system_prompt').notNull(),
  rulePackSlug: text('rule_pack_slug'),
  changelog: text('changelog').notNull().default(''),
  publishedBy: uuid('published_by').references(() => users.id),
  publishedAt: ts('published_at').notNull(),
  createdAt: createdAt(),
}, (t) => [
  unique('agent_template_versions_template_version_unique').on(t.templateId, t.version),
  check('agent_template_versions_audience_check', sql`${t.audience} in ('public', 'members', 'positions')`),
  check('agent_template_versions_max_tier_check', sql`${t.maxTier} in ('public', 'members', 'officers', 'usg_internal')`),
  check('agent_template_versions_default_model_class_check', sql`${t.defaultModelClass} in ('standard', 'economy')`),
]);

// Null override columns mean "use the template version's value".
export const agentInstallations = pgTable('agent_installations', {
  id: id(),
  templateId: uuid('template_id').notNull().references(() => agentTemplates.id),
  orgId: uuid('org_id').notNull().references(() => orgs.id),
  enabled: boolean('enabled').notNull().default(true),
  track: text('track').notNull().default('latest').$type<'latest' | 'pinned'>(),
  pinnedVersion: integer('pinned_version'),
  audience: text('audience').$type<Audience>(),
  usableBy: text('usable_by').array(),
  promptAddendum: text('prompt_addendum').notNull().default(''),
  extraSourceIds: uuid('extra_source_ids').array().notNull().default(sql`'{}'`),
  modelClass: text('model_class').$type<ModelClass>(),
  installedBy: uuid('installed_by').references(() => users.id),
  installedAt: ts('installed_at').notNull(),
  createdAt: createdAt(),
}, (t) => [
  unique('agent_installations_template_org_unique').on(t.templateId, t.orgId),
  check('agent_installations_track_check', sql`${t.track} in ('latest', 'pinned')`),
  check('agent_installations_pinned_version_check', sql`${t.track} <> 'pinned' or ${t.pinnedVersion} is not null`),
  check('agent_installations_audience_check', sql`${t.audience} is null or ${t.audience} in ('public', 'members', 'positions')`),
  check('agent_installations_model_class_check', sql`${t.modelClass} is null or ${t.modelClass} in ('standard', 'economy')`),
]);

export const rulePacks = pgTable('rule_packs', {
  id: id(),
  slug: text('slug').notNull(),
  version: integer('version').notNull(),
  status: text('status').notNull().$type<'draft' | 'published'>(),
  label: text('label').notNull(),
  content: jsonb('content').notNull(),
  publishedBy: uuid('published_by').references(() => users.id),
  publishedAt: ts('published_at'),
  createdAt: createdAt(),
}, (t) => [
  unique('rule_packs_slug_version_unique').on(t.slug, t.version),
  check('rule_packs_status_check', sql`${t.status} in ('draft', 'published')`),
]);

export const usgClubPolicy = pgTable('usg_club_policy', {
  orgId: uuid('org_id').primaryKey().references(() => orgs.id),
  allowedModelClasses: text('allowed_model_classes').array().notNull().$type<ModelClass[]>(),
  allowPublicAgents: boolean('allow_public_agents').notNull().default(true),
  createdAt: createdAt(),
});
