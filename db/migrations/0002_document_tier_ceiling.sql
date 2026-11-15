-- A role can grant both Officers and USG internal documents. Preserve its grants and apply the
-- agent's tier ceiling independently in RLS. Library reads have no agent ceiling.
create function app_document_tier_rank(value text) returns integer
language sql immutable parallel safe as $$
  select case value
    when 'public' then 0
    when 'members' then 1
    when 'officers' then 2
    when 'usg_internal' then 3
  end
$$;
--> statement-breakpoint
alter policy documents_read on documents using (
  read_grants && app_setting_array('app.grants')
  and source_id::text = any (app_setting_array('app.agent_sources'))
  and app_document_tier_rank(tier) <= app_document_tier_rank(
    coalesce(nullif(current_setting('app.max_tier', true), ''), 'usg_internal'))
);
