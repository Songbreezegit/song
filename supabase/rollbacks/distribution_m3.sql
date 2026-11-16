-- Review-only rollback draft. Requires approval and an empty M3.
begin;
set local row_security = off;
lock table public.distribution_publish_tasks, public.distribution_publish_task_media,
  public.distribution_publish_logs in access exclusive mode;
do $$
begin
  if exists (select 1 from public.distribution_publish_tasks)
    or exists (select 1 from public.distribution_publish_task_media)
    or exists (select 1 from public.distribution_publish_logs)
  then raise exception 'Rollback blocked: preserve M3 task, media and audit history and use a forward fix.'; end if;
end $$;
drop trigger if exists distribution_protect_task_media on storage.objects;
drop function if exists distribution_publish_private.protect_task_media();
drop function public.change_distribution_publish_task(uuid,text,uuid,integer,jsonb);
drop function distribution_publish_private.change_task(uuid,text,uuid,integer,jsonb);
drop function distribution_publish_private.capture_snapshot(uuid,integer);
drop function distribution_publish_private.check_work_url(text);
drop function distribution_publish_private.parse_instant(text);
drop function distribution_publish_private.check_payload(jsonb,text[],text[]);
drop table public.distribution_publish_logs, public.distribution_publish_task_media, public.distribution_publish_tasks;
drop schema distribution_publish_private;
drop role distribution_publish_writer;
commit;
