-- Run only after separately approving the migration in an isolated test database.
-- All fixtures and assertions are transactional; no real users or credentials are used.
begin;
set local statement_timeout = '20s';

create temporary table assignment_reader_results (
  check_name text primary key,
  passed boolean not null
) on commit drop;
grant select, insert on pg_temp.assignment_reader_results to authenticated, anon;

create function pg_temp.assignment_reader_error(ids uuid[])
returns text language plpgsql set search_path = '' as $$
begin
  perform * from public.list_staff_matter_assignments(ids);
  return 'none';
exception when others then
  return sqlstate;
end;
$$;
grant execute on function pg_temp.assignment_reader_error(uuid[]) to authenticated, anon;

insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select id::uuid, 'authenticated', 'authenticated', label || '@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from (values
  ('71111111-1111-4111-8111-111111111111', 'assignment-reader-admin'),
  ('72222222-2222-4222-8222-222222222222', 'assignment-reader-lawyer'),
  ('73333333-3333-4333-8333-333333333333', 'assignment-reader-unassigned'),
  ('74444444-4444-4444-8444-444444444444', 'assignment-reader-client'),
  ('75555555-5555-4555-8555-555555555555', 'assignment-reader-foreign'),
  ('76666666-6666-4666-8666-666666666666', 'assignment-reader-former'),
  ('77777777-7777-4777-8777-777777777777', 'assignment-reader-second')
) as fixture(id, label);

insert into public.profiles (id, display_name) values
  ('71111111-1111-4111-8111-111111111111', 'Reader admin'),
  ('72222222-2222-4222-8222-222222222222', 'Reader lawyer A'),
  ('77777777-7777-4777-8777-777777777777', 'Reader lawyer B'),
  ('76666666-6666-4666-8666-666666666666', 'Reader former employee'),
  ('74444444-4444-4444-8444-444444444444', 'Never expose client');
insert into public.organizations (id, name) values
  ('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Assignment reader A'),
  ('7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Assignment reader B');
insert into public.organization_members (organization_id, user_id, role) values
  ('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '71111111-1111-4111-8111-111111111111', 'admin'),
  ('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '72222222-2222-4222-8222-222222222222', 'lawyer'),
  ('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '73333333-3333-4333-8333-333333333333', 'lawyer'),
  ('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '77777777-7777-4777-8777-777777777777', 'lawyer'),
  ('7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '75555555-5555-4555-8555-555555555555', 'admin'),
  ('7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '76666666-6666-4666-8666-666666666666', 'lawyer');
insert into public.matters (id, organization_id, reference, title) values
  ('7c111111-1111-4111-8111-111111111111', '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'READER-1', 'Assignment reader assigned'),
  ('7c222222-2222-4222-8222-222222222222', '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'READER-2', 'Assignment reader unassigned'),
  ('7c333333-3333-4333-8333-333333333333', '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'READER-3', 'Assignment reader foreign'),
  ('7c444444-4444-4444-8444-444444444444', '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'READER-4', 'Assignment reader stale only'),
  ('7c555555-5555-4555-8555-555555555555', '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'READER-5', 'Assignment reader stale before active'),
  ('7c666666-6666-4666-8666-666666666666', '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'READER-6', 'Assignment reader current admin assignee'),
  ('7c777777-7777-4777-8777-777777777777', '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'READER-7', 'Assignment reader current staff without profile');
insert into public.matter_participants (matter_id, user_id, role, created_at) values
  ('7c111111-1111-4111-8111-111111111111', '74444444-4444-4444-8444-444444444444', 'client', '2026-01-01'),
  ('7c111111-1111-4111-8111-111111111111', '72222222-2222-4222-8222-222222222222', 'lawyer', '2026-01-02'),
  ('7c111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777', 'lawyer', '2026-01-02'),
  ('7c111111-1111-4111-8111-111111111111', '76666666-6666-4666-8666-666666666666', 'lawyer', '2026-01-03'),
  ('7c222222-2222-4222-8222-222222222222', '73333333-3333-4333-8333-333333333333', 'client', '2026-01-01'),
  ('7c444444-4444-4444-8444-444444444444', '76666666-6666-4666-8666-666666666666', 'lawyer', '2026-01-01'),
  ('7c555555-5555-4555-8555-555555555555', '76666666-6666-4666-8666-666666666666', 'lawyer', '2026-01-01'),
  ('7c555555-5555-4555-8555-555555555555', '77777777-7777-4777-8777-777777777777', 'lawyer', '2026-01-02'),
  ('7c666666-6666-4666-8666-666666666666', '71111111-1111-4111-8111-111111111111', 'lawyer', '2026-01-01'),
  ('7c777777-7777-4777-8777-777777777777', '73333333-3333-4333-8333-333333333333', 'lawyer', '2026-01-01');

set local role authenticated;
select set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', true);
insert into pg_temp.assignment_reader_results values
  ('admin:assigned-name-and-exact-fields', (select to_jsonb(r) = '{"matter_id":"7c111111-1111-4111-8111-111111111111","assigned_lawyer_id":"72222222-2222-4222-8222-222222222222","assigned_lawyer_name":"Reader lawyer A"}'::jsonb
    from public.list_staff_matter_assignments(array['7c111111-1111-4111-8111-111111111111']::uuid[]) as r)),
  ('admin:unassigned-null', (select assigned_lawyer_id is null and assigned_lawyer_name is null
    from public.list_staff_matter_assignments(array['7c222222-2222-4222-8222-222222222222']::uuid[]))),
  ('admin:stale-only-is-unassigned', (select to_jsonb(r) = '{"matter_id":"7c444444-4444-4444-8444-444444444444","assigned_lawyer_id":null,"assigned_lawyer_name":null}'::jsonb
    from public.list_staff_matter_assignments(array['7c444444-4444-4444-8444-444444444444']::uuid[]) as r)),
  ('admin:stale-earlier-active-later-selects-active', (select to_jsonb(r) = '{"matter_id":"7c555555-5555-4555-8555-555555555555","assigned_lawyer_id":"77777777-7777-4777-8777-777777777777","assigned_lawyer_name":"Reader lawyer B"}'::jsonb
    from public.list_staff_matter_assignments(array['7c555555-5555-4555-8555-555555555555']::uuid[]) as r)),
  ('admin:current-admin-remains-assignable', (select to_jsonb(r) = '{"matter_id":"7c666666-6666-4666-8666-666666666666","assigned_lawyer_id":"71111111-1111-4111-8111-111111111111","assigned_lawyer_name":"Reader admin"}'::jsonb
    from public.list_staff_matter_assignments(array['7c666666-6666-4666-8666-666666666666']::uuid[]) as r)),
  ('admin:current-staff-without-profile-uses-fallback', (select to_jsonb(r) = '{"matter_id":"7c777777-7777-4777-8777-777777777777","assigned_lawyer_id":"73333333-3333-4333-8333-333333333333","assigned_lawyer_name":"Сотрудник"}'::jsonb
    from public.list_staff_matter_assignments(array['7c777777-7777-4777-8777-777777777777']::uuid[]) as r)),
  ('admin:mixed-ids-only-own-no-duplicates', (select count(*) = 2 from public.list_staff_matter_assignments(array[
    '7c111111-1111-4111-8111-111111111111', '7c111111-1111-4111-8111-111111111111',
    '7c222222-2222-4222-8222-222222222222', '7c333333-3333-4333-8333-333333333333',
    '7c999999-9999-4999-8999-999999999999']::uuid[]))),
  ('input:empty', (select count(*) = 0 from public.list_staff_matter_assignments('{}'::uuid[]))),
  ('input:null', (select count(*) = 0 from public.list_staff_matter_assignments(null))),
  ('input:100-accepted', pg_temp.assignment_reader_error(array_fill('7c111111-1111-4111-8111-111111111111'::uuid, array[100])) = 'none'),
  ('input:101-denied', pg_temp.assignment_reader_error(array_fill('7c111111-1111-4111-8111-111111111111'::uuid, array[101])) = '22023'),
  ('input:null-element-denied', pg_temp.assignment_reader_error(array[null]::uuid[]) = '22023'),
  ('input:multidimensional-denied', pg_temp.assignment_reader_error(array_fill('7c111111-1111-4111-8111-111111111111'::uuid, array[2,2])) = '22023');

select set_config('request.jwt.claim.sub', '72222222-2222-4222-8222-222222222222', true);
insert into pg_temp.assignment_reader_results values
  ('lawyer:assigned-only', (select count(*) = 1 from public.list_staff_matter_assignments(array[
    '7c111111-1111-4111-8111-111111111111', '7c222222-2222-4222-8222-222222222222']::uuid[])));
select set_config('request.jwt.claim.sub', '73333333-3333-4333-8333-333333333333', true);
insert into pg_temp.assignment_reader_results values
  ('lawyer:unassigned-and-client-participant-denied', (select count(*) = 0 from public.list_staff_matter_assignments(array[
    '7c111111-1111-4111-8111-111111111111', '7c222222-2222-4222-8222-222222222222']::uuid[])));
select set_config('request.jwt.claim.sub', '74444444-4444-4444-8444-444444444444', true);
insert into pg_temp.assignment_reader_results values
  ('client:denied', (select count(*) = 0 from public.list_staff_matter_assignments(array['7c111111-1111-4111-8111-111111111111']::uuid[])));
select set_config('request.jwt.claim.sub', '75555555-5555-4555-8555-555555555555', true);
insert into pg_temp.assignment_reader_results values
  ('foreign:denied', (select count(*) = 0 from public.list_staff_matter_assignments(array['7c111111-1111-4111-8111-111111111111']::uuid[])));
select set_config('request.jwt.claim.sub', '76666666-6666-4666-8666-666666666666', true);
insert into pg_temp.assignment_reader_results values
  ('former:participant-without-same-org-membership-denied', (select count(*) = 0 from public.list_staff_matter_assignments(array['7c111111-1111-4111-8111-111111111111']::uuid[])));
select set_config('request.jwt.claim.sub', '', true);
insert into pg_temp.assignment_reader_results values
  ('auth:no-user-denied', pg_temp.assignment_reader_error('{}'::uuid[]) = '42501');
reset role;
set local role anon;
insert into pg_temp.assignment_reader_results values
  ('anon:execute-denied', pg_temp.assignment_reader_error('{}'::uuid[]) = '42501');
reset role;

-- Changes below affect only this transaction's synthetic fixtures.
delete from public.matter_participants where matter_id = '7c111111-1111-4111-8111-111111111111'
  and user_id in ('72222222-2222-4222-8222-222222222222', '76666666-6666-4666-8666-666666666666');
set local role authenticated;
select set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', true);
insert into pg_temp.assignment_reader_results values
  ('refresh:reassignment', (select assigned_lawyer_id = '77777777-7777-4777-8777-777777777777'::uuid and assigned_lawyer_name = 'Reader lawyer B'
    from public.list_staff_matter_assignments(array['7c111111-1111-4111-8111-111111111111']::uuid[])));
reset role;
delete from public.matter_participants where matter_id = '7c111111-1111-4111-8111-111111111111' and role = 'lawyer';
set local role authenticated;
select set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', true);
insert into pg_temp.assignment_reader_results values
  ('refresh:removal', (select assigned_lawyer_id is null and assigned_lawyer_name is null
    from public.list_staff_matter_assignments(array['7c111111-1111-4111-8111-111111111111']::uuid[])));
reset role;

do $$
declare failures text;
begin
  select string_agg(check_name, ', ' order by check_name) into failures
  from pg_temp.assignment_reader_results where not passed;
  if failures is not null then raise exception 'Assignment reader smoke failed: %', failures; end if;
end;
$$;
select count(*) as passed_checks from pg_temp.assignment_reader_results;
rollback;
