-- DESTRUCTIVE, REVIEW ONLY. Export all distribution rows first. Owner approval
-- required for production. Does not touch projects/articles/storage or auth.
begin;
drop function if exists public.save_distribution_post(uuid,integer,jsonb,uuid[],uuid[]);
drop table if exists public.distribution_post_media;
drop table if exists public.distribution_post_targets;
drop table if exists public.distribution_posts;
drop table if exists public.distribution_accounts;
drop function if exists distribution_private.check_relation();
drop function if exists distribution_private.touch_record();
drop schema if exists distribution_private;
commit;
