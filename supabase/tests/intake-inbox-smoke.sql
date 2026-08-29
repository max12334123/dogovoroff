begin;

set local statement_timeout = '20s';

create temporary table intake_results (
  check_name text primary key,
  actual bigint not null,
  expected bigint not null
) on commit drop;

grant select, insert on table pg_temp.intake_results to authenticated, anon, service_role;

create function pg_temp.try_store_intake(
  target_organization_id uuid,
  target_submission_id uuid
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform *
  from public.store_intake_request(
    target_organization_id,
    target_submission_id,
    '2026-08-29T08:00:00+00'::timestamptz,
    'Тестовый клиент',
    '+7 900 000-00-00',
    'Арбитраж и суды',
    'Синтетическое обращение для smoke-теста.',
    'Быстрая заявка',
    'Не проводился',
    'Не проводился',
    'Не проводился',
    '2026-08-29T08:00:00+00'::timestamptz,
    'https://dogovoroff.vercel.app/personal-data-consent',
    '3 от 29.08.2026',
    'Smoke test'
  );
  return true;
exception
  when insufficient_privilege or raise_exception or invalid_parameter_value then
    return false;
end;
$$;

create function pg_temp.try_list_intake(target_organization_id uuid)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  result_count bigint;
begin
  select count(*) into result_count
  from public.list_intake_requests(target_organization_id);
  return result_count;
exception
  when insufficient_privilege or raise_exception then
    return -1;
end;
$$;

create function pg_temp.try_update_intake(target_request_id uuid, target_status text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  resolved_request_id uuid;
begin
  select intake.id
  into resolved_request_id
  from public.intake_requests as intake
  where intake.id = target_request_id
     or intake.submission_id = target_request_id
  order by (intake.id = target_request_id) desc
  limit 1;

  if resolved_request_id is null then
    return false;
  end if;

  perform * from public.update_intake_request_status(resolved_request_id, target_status);
  return true;
exception
  when insufficient_privilege or raise_exception or invalid_parameter_value then
    return false;
end;
$$;

create function pg_temp.try_convert_intake(target_request_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  resolved_request_id uuid;
begin
  select intake.id
  into resolved_request_id
  from public.intake_requests as intake
  where intake.id = target_request_id
     or intake.submission_id = target_request_id
  order by (intake.id = target_request_id) desc
  limit 1;

  if resolved_request_id is null then
    return false;
  end if;

  perform *
  from public.create_matter_from_intake_request(
    resolved_request_id,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'intake-client@example.test',
    'INTAKE-001',
    'Обращение по входящей заявке',
    'Синтетическое дело для smoke-теста.',
    '33333333-3333-4333-8333-333333333333',
    'Первичная проверка',
    'Проверить материалы обращения.',
    'Загрузить документ',
    'Загрузите обезличенный тестовый файл.'
  );
  return true;
exception
  when insufficient_privilege or raise_exception or unique_violation or invalid_parameter_value then
    return false;
end;
$$;

grant execute on function pg_temp.try_store_intake(uuid, uuid) to authenticated, anon, service_role;
grant execute on function pg_temp.try_list_intake(uuid) to authenticated, anon;
grant execute on function pg_temp.try_update_intake(uuid, text) to authenticated, anon;
grant execute on function pg_temp.try_convert_intake(uuid) to authenticated, anon;

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
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'intake-client@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'intake-lawyer@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'intake-admin@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (id, display_name) values
  ('11111111-1111-4111-8111-111111111111', 'Intake client'),
  ('33333333-3333-4333-8333-333333333333', 'Intake lawyer'),
  ('44444444-4444-4444-8444-444444444444', 'Intake admin');

insert into public.organizations (id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Intake smoke organization A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Intake smoke organization B');

insert into public.organization_members (organization_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'lawyer'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'admin');

set local role service_role;
insert into pg_temp.intake_results values
  ('service:store-new', pg_temp.try_store_intake(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  )::int, 1),
  ('service:store-duplicate', pg_temp.try_store_intake(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  )::int, 1),
  ('service:store-closed-fixture', pg_temp.try_store_intake(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  )::int, 1);
reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
insert into pg_temp.intake_results values
  ('anonymous:store-denied', pg_temp.try_store_intake(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  )::int, 0),
  ('anonymous:list-denied', pg_temp.try_list_intake('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), -1),
  ('anonymous:update-denied', pg_temp.try_update_intake(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'reviewing'
  )::int, 0),
  ('anonymous:convert-denied', pg_temp.try_convert_intake(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  )::int, 0);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
insert into pg_temp.intake_results values
  ('client:list-denied', pg_temp.try_list_intake('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), -1),
  ('client:update-denied', pg_temp.try_update_intake(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'reviewing'
  )::int, 0);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
insert into pg_temp.intake_results values
  ('lawyer:list-own', pg_temp.try_list_intake('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 2),
  ('lawyer:list-other-denied', pg_temp.try_list_intake('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), -1),
  ('lawyer:update-status', pg_temp.try_update_intake(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'reviewing'
  )::int, 1),
  ('lawyer:close-second', pg_temp.try_update_intake(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'closed'
  )::int, 1);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
insert into pg_temp.intake_results values
  ('admin:convert-new', pg_temp.try_convert_intake(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  )::int, 1),
  ('admin:convert-duplicate', pg_temp.try_convert_intake(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  )::int, 0),
  ('admin:convert-closed-denied', pg_temp.try_convert_intake(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  )::int, 0);
reset role;

insert into pg_temp.intake_results values
  ('database:request-linked', (
    select count(*)
    from public.intake_requests
    where submission_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and status = 'matter_created'
      and matter_id is not null
  ), 1),
  ('database:one-matter', (
    select count(*) from public.matters where reference = 'INTAKE-001'
  ), 1),
  ('database:one-intake', (
    select count(*) from public.intake_requests
    where submission_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ), 1),
  ('database:closed-not-converted', (
    select count(*)
    from public.intake_requests
    where submission_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      and status = 'closed'
      and matter_id is null
  ), 1),
  ('database:one-participant-client', (
    select count(*)
    from public.matter_participants as participant
    join public.matters as matter on matter.id = participant.matter_id
    where matter.reference = 'INTAKE-001' and participant.role = 'client'
  ), 1),
  ('database:one-participant-lawyer', (
    select count(*)
    from public.matter_participants as participant
    join public.matters as matter on matter.id = participant.matter_id
    where matter.reference = 'INTAKE-001' and participant.role = 'lawyer'
  ), 1);

do $$
declare
  failures text;
begin
  select string_agg(
    check_name || '=' || actual::text || ' (expected ' || expected::text || ')',
    ', ' order by check_name
  )
  into failures
  from pg_temp.intake_results
  where actual <> expected;

  if failures is not null then
    raise exception 'Intake inbox smoke failed: %', failures;
  end if;
end;
$$;

rollback;

select json_build_object(
  'passed', true,
  'authorization_checks', 13,
  'idempotency_checks', 3,
  'conversion_checks', 6,
  'persistent_rows', 0
) as result;
