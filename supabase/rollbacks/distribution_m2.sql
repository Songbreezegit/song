-- Review-only rollback draft. Requires approval, an export and an empty M2.
begin;
-- Refuse an emptiness check if the caller would see rows filtered by RLS.
set local row_security = off;
lock table public.distribution_variants, public.distribution_variant_media in access exclusive mode;
do $$
begin
  if exists (select 1 from public.distribution_variants) or exists (select 1 from public.distribution_variant_media) then
    raise exception 'Rollback blocked: M2 data must be exported and preserved before removing the schema.';
  end if;
end $$;

drop function public.create_distribution_variant(uuid,uuid,uuid);
drop function public.save_distribution_variant(uuid,integer,jsonb,jsonb);
drop function public.sync_distribution_variant(uuid,integer,integer,text[]);
drop function distribution_private.lock_variant_revision(uuid,integer);
drop function distribution_private.replace_variant_media(uuid,jsonb);
drop function distribution_private.variant_with_media(uuid);
drop table public.distribution_variant_media;
drop table public.distribution_variants;
drop function distribution_private.copy_variant_source_media();
drop function distribution_private.check_variant_readiness();
drop function distribution_private.check_variant_media();
drop function distribution_private.touch_variant();
drop function distribution_private.variant_source_snapshot(public.distribution_posts);
drop function distribution_private.lock_variant_source(uuid,uuid,text);
drop function distribution_private.assert_variant_admin();
commit;
