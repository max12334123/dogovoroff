begin;

set local statement_timeout = '20s';

create temporary table management_results (
  check_name text primary key,
  actual bigint not null,
  expected bigint not null
) on commit drop;

grant select, insert on table pg_temp.management_results to authenticated;

create function pg_temp.try_update_details(target_matter_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform *
  from public.update_matter_details(
    target_matter_id,
    'MGMT-002',
    'Обновленное тестовое дело',
    'Обновленное описание',
    '2026-09-01T12:00:00+00'::timestamptz
  );
  return true;
exception
  when insufficient_privilege
    or raise_exception
    or unique_violation
    or invalid_parameter_value then
    return false;
end;
$$;

create function pg_temp.try_update_workflow(target_matter_id uuid, target_stage_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform *
  from public.update_matter_workflow(
    target_matter_id,
    'paused'::public.matter_status,
    target_stage_id,
    'Проверить материалы',
    'Интеграционная проверка',
    '2026-09-02T12:00:00+00'::timestamptz,
    false,
    null
  );
  return true;
exception
  when insufficient_privilege
    or raise_exception
    or unique_violation
    or invalid_parameter_value then
    return false;
end;
$$;

create function pg_temp.try_direct_details(target_matter_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  update public.matters
  set title = 'Недопустимое изменение'
  where id = target_matter_id;
  return true;
exception
  when insufficient_privilege or raise_exception then
    return false;
end;
$$;

create function pg_temp.try_change_organization(target_matter_id uuid, target_organization_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  update public.matters
  set organization_id = target_organization_id
  where id = target_matter_id;
  return true;
exception
  when insufficient_privilege or raise_exception then
    return false;
end;
$$;

grant execute on function pg_temp.try_update_details(uuid) to authenticated;
grant execute on function pg_temp.try_update_workflow(uuid, uuid) to authenticated;
grant execute on function pg_temp.try_direct_details(uuid) to authenticated;
grant execute on function pg_temp.try_change_organization(uuid, uuid) to authenticated;

insert into auth.users (
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  ('61111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'management-client@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('63333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'management-lawyer@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('64444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'management-admin@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (id, display_name) values
  ('61111111-1111-4111-8111-111111111111', 'Management client'),
  ('63333333-3333-4333-8333-333333333333', 'Management lawyer'),
  ('64444444-4444-4444-8444-444444444444', 'Management admin');

insert into public.organizations (id, name) values
  ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Management smoke organization A'),
  ('6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Management smoke organization B');

insert into public.organization_members (organization_id, user_id, role) values
  ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '63333333-3333-4333-8333-333333333333', 'lawyer'),
  ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '64444444-4444-4444-8444-444444444444', 'admin');

insert into public.matters (id, organization_id, reference, title, summary, created_by) values
  ('6c111111-1111-4111-8111-111111111111', '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'MGMT-001', 'Исходное дело', 'Исходное описание', '64444444-4444-4444-8444-444444444444');

insert into public.matter_participants (matter_id, user_id, role) values
  ('6c111111-1111-4111-8111-111111111111', '61111111-1111-4111-8111-111111111111', 'client'),
  ('6c111111-1111-4111-8111-111111111111', '63333333-3333-4333-8333-333333333333', 'lawyer');

insert into public.matter_stages (id, matter_id, position, title, status) values
  ('6d111111-1111-4111-8111-111111111111', '6c111111-1111-4111-8111-111111111111', 1, 'Первичная проверка', 'current');

set local role authenticated;
select set_config('request.jwt.claim.sub', '64444444-4444-4444-8444-444444444444', true);
insert into pg_temp.management_results values
  ('admin:update-details', pg_temp.try_update_details('6c111111-1111-4111-8111-111111111111')::int, 1),
  ('admin:organization-immutable', pg_temp.try_change_organization('6c111111-1111-4111-8111-111111111111', '6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')::int, 0);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '63333333-3333-4333-8333-333333333333', true);
insert into pg_temp.management_results values
  ('lawyer:update-workflow', pg_temp.try_update_workflow('6c111111-1111-4111-8111-111111111111', '6d111111-1111-4111-8111-111111111111')::int, 1),
  ('lawyer:update-details-denied', pg_temp.try_update_details('6c111111-1111-4111-8111-111111111111')::int, 0),
  ('lawyer:direct-details-denied', pg_temp.try_direct_details('6c111111-1111-4111-8111-111111111111')::int, 0);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '61111111-1111-4111-8111-111111111111', true);
insert into pg_temp.management_results values
  ('client:update-workflow-denied', pg_temp.try_update_workflow('6c111111-1111-4111-8111-111111111111', '6d111111-1111-4111-8111-111111111111')::int, 0);
reset role;

insert into pg_temp.management_results values
  ('database:reference-updated', (select count(*) from public.matters where id = '6c111111-1111-4111-8111-111111111111' and reference = 'MGMT-002'), 1),
  ('database:title-updated', (select count(*) from public.matters where id = '6c111111-1111-4111-8111-111111111111' and title = 'Обновленное тестовое дело'), 1),
  ('database:workflow-paused', (select count(*) from public.matters where id = '6c111111-1111-4111-8111-111111111111' and status = 'paused'), 1),
  ('database:organization-preserved', (select count(*) from public.matters where id = '6c111111-1111-4111-8111-111111111111' and organization_id = '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1);

do $$
declare
  failures text;
begin
  select string_agg(
    check_name || '=' || actual::text || ' (expected ' || expected::text || ')',
    ', ' order by check_name
  )
  into failures
  from pg_temp.management_results
  where actual <> expected;

  if failures is not null then
    raise exception 'Matter management smoke failed: %', failures;
  end if;
end;
$$;

rollback;

select json_build_object(
  'passed', true,
  'authorization_checks', 6,
  'persistence_checks', 4,
  'persistent_rows', 0
) as result;
