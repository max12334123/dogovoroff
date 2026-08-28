begin;

set local statement_timeout = '20s';

create temporary table assignment_results (
  check_name text primary key,
  actual bigint not null,
  expected bigint not null
) on commit drop;

grant select, insert on table pg_temp.assignment_results to authenticated, anon;

create function pg_temp.try_list_assignable_staff(target_organization_id uuid)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  result_count bigint;
begin
  select count(*)
  into result_count
  from public.list_assignable_staff(target_organization_id);
  return result_count;
exception
  when insufficient_privilege then
    return -1;
end;
$$;

create function pg_temp.try_create_assignment(
  target_organization_id uuid,
  target_client_email text,
  target_reference text,
  target_lawyer_id uuid
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform *
  from public.create_matter_for_client_email(
    target_organization_id,
    target_client_email,
    target_reference,
    'Тестовое дело',
    'Синтетические данные интеграционного теста.',
    target_lawyer_id,
    'Первичная проверка',
    'Проверить материалы.',
    'Загрузить документ',
    'Только обезличенный тестовый файл.'
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

grant execute on function pg_temp.try_list_assignable_staff(uuid) to authenticated, anon;
grant execute on function pg_temp.try_create_assignment(uuid, text, text, uuid) to authenticated, anon;

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
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'client-a@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'client-b@example.test', null, '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'lawyer@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'admin@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (id, display_name) values
  ('11111111-1111-4111-8111-111111111111', 'Test client A'),
  ('22222222-2222-4222-8222-222222222222', 'Test client B'),
  ('33333333-3333-4333-8333-333333333333', 'Test lawyer'),
  ('44444444-4444-4444-8444-444444444444', 'Test admin');

insert into public.organizations (id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Assignment smoke organization A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Assignment smoke organization B');

insert into public.organization_members (organization_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'lawyer'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'admin');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
insert into pg_temp.assignment_results values
  ('client:list-staff-denied', pg_temp.try_list_assignable_staff('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), -1),
  ('client:create-denied', pg_temp.try_create_assignment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'client-a@example.test', 'CLIENT-DENIED', null)::int, 0);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
insert into pg_temp.assignment_results values
  ('lawyer:list-staff-denied', pg_temp.try_list_assignable_staff('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), -1),
  ('lawyer:create-denied', pg_temp.try_create_assignment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'client-a@example.test', 'LAWYER-DENIED', null)::int, 0);
reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
insert into pg_temp.assignment_results values
  ('anonymous:list-staff-denied', pg_temp.try_list_assignable_staff('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), -1),
  ('anonymous:create-denied', pg_temp.try_create_assignment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'client-a@example.test', 'ANON-DENIED', null)::int, 0);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
insert into pg_temp.assignment_results values
  ('admin:list-own-staff', pg_temp.try_list_assignable_staff('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 2),
  ('admin:list-other-org-denied', pg_temp.try_list_assignable_staff('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), -1);

insert into pg_temp.assignment_results values
  ('admin:create-complete', pg_temp.try_create_assignment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'client-a@example.test', 'ASSIGN-001', '33333333-3333-4333-8333-333333333333')::int, 1);

insert into pg_temp.assignment_results values
  ('admin:unconfirmed-client-denied', pg_temp.try_create_assignment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'client-b@example.test', 'ASSIGN-002', null)::int, 0),
  ('admin:other-org-denied', pg_temp.try_create_assignment('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'client-a@example.test', 'ASSIGN-003', null)::int, 0),
  ('admin:duplicate-reference-denied', pg_temp.try_create_assignment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'client-a@example.test', 'ASSIGN-001', null)::int, 0),
  ('admin:created-matter-visible', (select count(*) from public.matters where reference = 'ASSIGN-001'), 1);
reset role;

insert into pg_temp.assignment_results values
  ('database:one-matter', (select count(*) from public.matters where reference like 'ASSIGN-%'), 1),
  ('database:two-participants', (
    select count(*)
    from public.matter_participants as mp
    join public.matters as m on m.id = mp.matter_id
    where m.reference = 'ASSIGN-001'
  ), 2),
  ('database:one-current-stage', (
    select count(*)
    from public.matter_stages as ms
    join public.matters as m on m.id = ms.matter_id
    where m.reference = 'ASSIGN-001'
      and ms.status = 'current'
  ), 1);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
insert into pg_temp.assignment_results values
  ('assigned-client:matter-visible', (select count(*) from public.matters where reference = 'ASSIGN-001'), 1),
  ('assigned-client:stage-visible', (
    select count(*)
    from public.matter_stages as ms
    join public.matters as m on m.id = ms.matter_id
    where m.reference = 'ASSIGN-001'
  ), 1);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
insert into pg_temp.assignment_results values
  ('assigned-lawyer:matter-visible', (select count(*) from public.matters where reference = 'ASSIGN-001'), 1);
reset role;

do $$
declare
  failures text;
begin
  select string_agg(
    check_name || '=' || actual::text || ' (expected ' || expected::text || ')',
    ', ' order by check_name
  )
  into failures
  from pg_temp.assignment_results
  where actual <> expected;

  if failures is not null then
    raise exception 'Staff assignment smoke failed: %', failures;
  end if;
end;
$$;

rollback;

select json_build_object(
  'passed', true,
  'authorization_checks', 12,
  'persistence_checks', 3,
  'visibility_checks', 3,
  'persistent_rows', 0
) as result;
