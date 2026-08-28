begin;

set local statement_timeout = '20s';

create temporary table rls_results (
  check_name text primary key,
  actual bigint not null,
  expected bigint not null
) on commit drop;

grant select, insert on table pg_temp.rls_results to authenticated, anon;

create function pg_temp.try_count_matters()
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  visible_count bigint;
begin
  select count(*) into visible_count from public.matters;
  return visible_count;
exception
  when insufficient_privilege then
    return 0;
end;
$$;

create function pg_temp.try_insert_message(
  test_id uuid,
  target_matter_id uuid,
  claimed_author_id uuid
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  insert into public.messages (id, matter_id, author_id, body)
  values (test_id, target_matter_id, claimed_author_id, 'RLS smoke message');
  return true;
exception
  when insufficient_privilege then
    return false;
end;
$$;

create function pg_temp.try_insert_document(
  test_id uuid,
  target_matter_id uuid,
  claimed_uploader_id uuid
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  insert into public.documents (
    id,
    matter_id,
    storage_path,
    original_name,
    mime_type,
    size_bytes,
    uploaded_by
  ) values (
    test_id,
    target_matter_id,
    target_matter_id::text || '/' || test_id::text || '/document.pdf',
    'rls-smoke.pdf',
    'application/pdf',
    128,
    claimed_uploader_id
  );
  return true;
exception
  when insufficient_privilege then
    return false;
end;
$$;

grant execute on function pg_temp.try_count_matters() to authenticated, anon;
grant execute on function pg_temp.try_insert_message(uuid, uuid, uuid) to authenticated;
grant execute on function pg_temp.try_insert_document(uuid, uuid, uuid) to authenticated;

insert into auth.users (
  id,
  aud,
  role,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (id, display_name) values
  ('11111111-1111-4111-8111-111111111111', 'Client A'),
  ('22222222-2222-4222-8222-222222222222', 'Client B'),
  ('33333333-3333-4333-8333-333333333333', 'Lawyer'),
  ('44444444-4444-4444-8444-444444444444', 'Admin'),
  ('55555555-5555-4555-8555-555555555555', 'Outside client');

insert into public.organizations (id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'RLS smoke organization A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'RLS smoke organization B');

insert into public.organization_members (organization_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'lawyer'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'admin');

insert into public.matters (id, organization_id, reference, title, created_by) values
  ('a1111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'RLS-A', 'Matter A', '44444444-4444-4444-8444-444444444444'),
  ('b2222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'RLS-B', 'Matter B', '44444444-4444-4444-8444-444444444444'),
  ('c3333333-3333-4333-8333-333333333333', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'RLS-C', 'Matter C', null);

insert into public.matter_participants (matter_id, user_id, role) values
  ('a1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'client'),
  ('a1111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'lawyer'),
  ('b2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'client'),
  ('c3333333-3333-4333-8333-333333333333', '55555555-5555-4555-8555-555555555555', 'client');

insert into public.matter_stages (id, matter_id, position, title, status) values
  ('a1111111-aaaa-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 1, 'Stage A', 'current'),
  ('b2222222-bbbb-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', 1, 'Stage B', 'current'),
  ('c3333333-cccc-4333-8333-333333333333', 'c3333333-3333-4333-8333-333333333333', 1, 'Stage C', 'current');

insert into public.matter_events (id, matter_id, event_type, public_text, actor_id) values
  ('a1111111-aaaa-4111-9111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'fixture', 'Event A', '44444444-4444-4444-8444-444444444444'),
  ('b2222222-bbbb-4222-9222-222222222222', 'b2222222-2222-4222-8222-222222222222', 'fixture', 'Event B', '44444444-4444-4444-8444-444444444444'),
  ('c3333333-cccc-4333-9333-333333333333', 'c3333333-3333-4333-8333-333333333333', 'fixture', 'Event C', '55555555-5555-4555-8555-555555555555');

insert into public.documents (
  id,
  matter_id,
  storage_path,
  original_name,
  mime_type,
  size_bytes,
  uploaded_by
) values
  ('a1111111-aaaa-4111-a111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111/a1111111-aaaa-4111-a111-111111111111/document.pdf', 'fixture-a.pdf', 'application/pdf', 128, '11111111-1111-4111-8111-111111111111'),
  ('b2222222-bbbb-4222-a222-222222222222', 'b2222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222/b2222222-bbbb-4222-a222-222222222222/document.pdf', 'fixture-b.pdf', 'application/pdf', 128, '22222222-2222-4222-8222-222222222222'),
  ('c3333333-cccc-4333-a333-333333333333', 'c3333333-3333-4333-8333-333333333333', 'c3333333-3333-4333-8333-333333333333/c3333333-cccc-4333-a333-333333333333/document.pdf', 'fixture-c.pdf', 'application/pdf', 128, '55555555-5555-4555-8555-555555555555');

insert into public.messages (id, matter_id, author_id, body) values
  ('a1111111-aaaa-4111-b111-111111111111', 'a1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Message A'),
  ('b2222222-bbbb-4222-b222-222222222222', 'b2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'Message B'),
  ('c3333333-cccc-4333-b333-333333333333', 'c3333333-3333-4333-8333-333333333333', '55555555-5555-4555-8555-555555555555', 'Message C');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
insert into pg_temp.rls_results values
  ('client_a:matters', (select count(*) from public.matters), 1),
  ('client_a:stages', (select count(*) from public.matter_stages), 1),
  ('client_a:documents', (select count(*) from public.documents), 1),
  ('client_a:messages', (select count(*) from public.messages), 1),
  ('client_a:audit', (select count(*) from public.audit_events), 0);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
insert into pg_temp.rls_results values
  ('client_b:matters', (select count(*) from public.matters), 1),
  ('client_b:documents', (select count(*) from public.documents), 1),
  ('client_b:messages', (select count(*) from public.messages), 1);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
insert into pg_temp.rls_results values
  ('lawyer:matters', (select count(*) from public.matters), 1),
  ('lawyer:documents', (select count(*) from public.documents), 1),
  ('lawyer:messages', (select count(*) from public.messages), 1),
  ('lawyer:audit', (select count(*) from public.audit_events), 0);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
insert into pg_temp.rls_results values
  ('admin:matters', (select count(*) from public.matters), 2),
  ('admin:documents', (select count(*) from public.documents), 2),
  ('admin:messages', (select count(*) from public.messages), 2),
  ('admin:audit', (select case when exists (select 1 from public.audit_events) then 1 else 0 end), 1);
reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
insert into pg_temp.rls_results values
  ('anonymous:matters', pg_temp.try_count_matters(), 0);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
insert into pg_temp.rls_results values
  ('client_a:message-own', pg_temp.try_insert_message('a1111111-aaaa-4111-c111-111111111111', 'a1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111')::int, 1),
  ('client_a:message-other', pg_temp.try_insert_message('a1111111-aaaa-4111-c222-222222222222', 'b2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111')::int, 0),
  ('client_a:message-forged-author', pg_temp.try_insert_message('a1111111-aaaa-4111-c333-333333333333', 'a1111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')::int, 0),
  ('client_a:document-own', pg_temp.try_insert_document('a1111111-aaaa-4111-d111-111111111111', 'a1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111')::int, 1),
  ('client_a:document-other', pg_temp.try_insert_document('a1111111-aaaa-4111-d222-222222222222', 'b2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111')::int, 0),
  ('client_a:document-forged-uploader', pg_temp.try_insert_document('a1111111-aaaa-4111-d333-333333333333', 'a1111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')::int, 0);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
insert into pg_temp.rls_results values
  ('lawyer:message-assigned', pg_temp.try_insert_message('a1111111-aaaa-4111-e111-111111111111', 'a1111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333')::int, 1),
  ('lawyer:message-unassigned', pg_temp.try_insert_message('a1111111-aaaa-4111-e222-222222222222', 'b2222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333')::int, 0);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
insert into pg_temp.rls_results values
  ('admin:message-own-org', pg_temp.try_insert_message('a1111111-aaaa-4111-f111-111111111111', 'b2222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444')::int, 1),
  ('admin:message-other-org', pg_temp.try_insert_message('a1111111-aaaa-4111-f222-222222222222', 'c3333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444')::int, 0);
reset role;

do $$
declare
  failures text;
begin
  select string_agg(check_name, ', ' order by check_name)
  into failures
  from pg_temp.rls_results
  where actual <> expected;

  if failures is not null then
    raise exception 'RLS isolation check failed: %', failures;
  end if;
end;
$$;

rollback;

select json_build_object(
  'passed', true,
  'actors', 5,
  'read_checks', 17,
  'write_checks', 10,
  'persistent_rows', 0
) as result;
