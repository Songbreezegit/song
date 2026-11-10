-- Return an HTTP conflict for a stale application version. PostgreSQL
-- serialization failures (40001) cause PostgREST 14 to retry the transaction.
-- CREATE OR REPLACE retains the existing function owner and grants.
begin;

create or replace function public.save_distribution_post(p_id uuid, p_version integer, p_post jsonb, p_account_ids uuid[], p_media_ids uuid[])
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved public.distribution_posts; input public.distribution_posts;
begin
  if (select auth.uid()) is null or coalesce((select auth.jwt()->>'aal'), '') <> 'aal2'
    or not exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  then raise exception 'MFA-verified site administrator required' using errcode = '42501'; end if;
  if p_id is null or (p_version is not null and p_version < 1) or jsonb_typeof(p_post) is distinct from 'object'
    or octet_length(p_post::text) > 524288
    or not p_post ?& array['title','body','tags','content_type','project_id','promotion_goal','status']
    or exists (select 1 from jsonb_object_keys(p_post) k where k <> all(array['title','body','tags','content_type','project_id','promotion_goal','status']))
  then raise exception 'Invalid post payload' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_each(p_post) e where e.key in ('title','body','content_type','promotion_goal','status') and jsonb_typeof(e.value) <> 'string')
    or jsonb_typeof(p_post->'tags') <> 'array'
    or jsonb_typeof(p_post->'project_id') not in ('string','null')
  then raise exception 'Invalid post field types' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_array_elements(p_post->'tags') tag where jsonb_typeof(tag) <> 'string') then
    raise exception 'Invalid tags' using errcode = '22023'; end if;
  if p_account_ids is null or p_media_ids is null or cardinality(p_account_ids) > 50 or cardinality(p_media_ids) > 20
    or coalesce(array_ndims(p_account_ids), 1) <> 1 or coalesce(array_ndims(p_media_ids), 1) <> 1
    or (select count(distinct id) from unnest(p_account_ids) id) <> cardinality(p_account_ids)
    or (select count(distinct id) from unnest(p_media_ids) id) <> cardinality(p_media_ids)
  then raise exception 'Invalid relation identifiers' using errcode = '22023'; end if;
  input := jsonb_populate_record(null::public.distribution_posts, p_post);
  if p_version is null then
    insert into public.distribution_posts(id,title,body,tags,content_type,project_id,promotion_goal,status)
      values(p_id,input.title,input.body,input.tags,input.content_type,input.project_id,input.promotion_goal,input.status) returning * into saved;
  else
    update public.distribution_posts set title=input.title,body=input.body,tags=input.tags,content_type=input.content_type,
      project_id=input.project_id,promotion_goal=input.promotion_goal,status=input.status where id=p_id and version=p_version returning * into saved;
    if not found then raise exception 'Post changed or is no longer accessible; reload before saving' using errcode = 'PT409'; end if;
  end if;
  delete from public.distribution_post_targets where post_id=p_id and not (account_id = any(p_account_ids));
  insert into public.distribution_post_targets(post_id,account_id) select p_id,id from unnest(p_account_ids) id
    where not exists(select 1 from public.distribution_post_targets t where t.post_id=p_id and t.account_id=id);
  delete from public.distribution_post_media where post_id=p_id and not (media_id = any(p_media_ids));
  insert into public.distribution_post_media(post_id,media_id,sort_order) select p_id,id,ordinality-1 from unnest(p_media_ids) with ordinality m(id,ordinality)
    on conflict (post_id,media_id) do update set sort_order=excluded.sort_order;
  return to_jsonb(saved) || jsonb_build_object('account_ids',to_jsonb(p_account_ids),'media_ids',to_jsonb(p_media_ids));
end $$;

commit;
