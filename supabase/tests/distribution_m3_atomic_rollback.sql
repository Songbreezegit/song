-- Run only after the approved Staging runner creates a marked task.
-- Replace these three UUIDs and the version from its atomic-probe checkpoint.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
-- Keep the injected failure private and scoped to this transaction.
create function pg_temp.m3_test_reject_audit() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Injected M3 audit failure' using errcode='P0001';
end $$;

do $$
declare
  run_id uuid := '00000000-0000-0000-0000-000000000000';
  target uuid := '00000000-0000-0000-0000-000000000000';
  actor uuid := '00000000-0000-0000-0000-000000000000';
  task_revision integer := 0;
  request_uuid uuid := gen_random_uuid();
  before_state jsonb;
  after_state jsonb;
  event_count bigint;
begin
  if not exists (select 1 from auth.users where id=actor
    and raw_app_meta_data->>'distribution_staging_run_id'=run_id::text)
  then raise exception 'Run scope does not match a Staging Auth fixture'; end if;
  select to_jsonb(t) into strict before_state from public.distribution_publish_tasks t
    where id=target and version=task_revision and created_by=actor and status='planned' and plan_note='M3 integration ' || run_id::text;
  select count(*) into event_count from public.distribution_publish_logs where task_id=target;
  execute format('create trigger m3_test_reject_audit before insert on public.distribution_publish_logs
    for each row when (new.request_id=%L::uuid) execute function pg_temp.m3_test_reject_audit()',request_uuid);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claim.aal','aal2',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'aal','aal2','role','authenticated')::text,true);
  set local role authenticated;
  begin
    perform public.change_distribution_publish_task(request_uuid,'start',target,task_revision,'{}');
    raise exception 'Expected injected M3 audit failure' using errcode='XX000';
  exception when raise_exception then
    if sqlerrm <> 'Injected M3 audit failure' then raise; end if;
  end;
  reset role;
  select to_jsonb(t) into strict after_state from public.distribution_publish_tasks t where id=target;
  if before_state is distinct from after_state or event_count <> (select count(*) from public.distribution_publish_logs where task_id=target)
    or exists (select 1 from public.distribution_publish_logs l where l.request_id=request_uuid)
  then raise exception 'M3 task or audit state changed despite the injected failure'; end if;
end $$;
select jsonb_build_object('passed',true,'injected_audit_failure',true,'transaction_rolled_back',true) as verification;
rollback;
