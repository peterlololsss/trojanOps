-- Decision 29: template versions name the specific demo models offered in chat. Existing versions
-- offer every demo model of their classes, defaulting to the first model of their default class
-- (what chat showed before). Ids and classes follow src/lib/gateway/models.ts.
ALTER TABLE "agent_template_versions" ADD COLUMN "model_ids" text[];--> statement-breakpoint
ALTER TABLE "agent_template_versions" ADD COLUMN "default_model_id" text;--> statement-breakpoint
UPDATE "agent_template_versions" SET
  "model_ids" = ARRAY(
    SELECT m.id FROM (VALUES
      (1, 'gpt-6-luna', 'economy'), (2, 'gpt-6.1-sol', 'standard'),
      (3, 'claude-haiku-5-5', 'economy'), (4, 'claude-sonnet-5-5', 'standard'),
      (5, 'gemini-4-hydrogen', 'economy'), (6, 'gemini-4-carbon', 'standard')
    ) AS m(ord, id, model_class)
    WHERE m.model_class = any("agent_template_versions"."model_classes") ORDER BY m.ord),
  "default_model_id" = CASE "default_model_class" WHEN 'standard' THEN 'gpt-6.1-sol' ELSE 'gpt-6-luna' END;--> statement-breakpoint
ALTER TABLE "agent_template_versions" ALTER COLUMN "model_ids" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_template_versions" ALTER COLUMN "default_model_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_template_versions" ADD CONSTRAINT "agent_template_versions_default_model_id_check" CHECK ("agent_template_versions"."default_model_id" = any("agent_template_versions"."model_ids"));
