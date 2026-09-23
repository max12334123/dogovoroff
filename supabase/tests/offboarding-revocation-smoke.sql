-- Run only in an isolated test database. All fixtures and mutations roll back.
-- A stale lawyer participant must not preserve matter access after membership removal.
begin;

set local statement_timeout = '20s';

create temporary table offboarding_results (
  check_name text primary key,
  actual text not null,
  expected text not null
) on commit drop;

grant select, insert on table pg_temp.offboarding_results to authenticated;

create function pg_temp.try_update_matter_status(target_matter_id uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  affected_rows bigint;
begin
  update public.matters
  set status = 'paused'
  where id = target_matter_id;

  get diagnostics affected_rows = row_count;
  if affected_rows = 1 then
    return 'ok';
  end if;
  return 'no_row';
exception
  when others then
    return sqlstate;
end;
$$;

create function pg_temp.try_insert_stage(
  test_id uuid,
  target_matter_id uuid
)
returns text
language plpgsql
set search_path = ''
as $$
begin
  insert into public.matter_stages (id, matter_id, position, title, status)
  values (test_id, target_matter_id, 2, 'Offboarding write probe', 'future');
  return 'ok';
exception
  when others then
    return sqlstate;
end;
$$;

create function pg_temp.try_insert_event(
  test_id uuid,
  target_matter_id uuid,
  actor_id uuid
)
returns text
language plpgsql
set search_path = ''
as $$
begin
  insert into public.matter_events (id, matter_id, event_type, public_text, actor_id)
  values (test_id, target_matter_id, 'offboarding_probe', 'Offboarding write probe', actor_id);
  return 'ok';
exception
  when others then
    return sqlstate;
end;
$$;

create function pg_temp.try_insert_message(
  test_id uuid,
  target_matter_id uuid,
  actor_id uuid
)
returns text
language plpgsql
set search_path = ''
as $$
begin
  insert into public.messages (id, matter_id, author_id, body)
  values (test_id, target_matter_id, actor_id, 'Offboarding write probe');
  return 'ok';
exception
  when others then
    return sqlstate;
end;
$$;

create function pg_temp.try_insert_document(
  test_id uuid,
  target_matter_id uuid,
  actor_id uuid
)
returns text
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
    target_matter_id::text || '/' || test_id::text || '/probe.pdf',
    'offboarding-probe.pdf',
    'application/pdf',
    128,
    actor_id
  );
  return 'ok';
exception
  when others then
    return sqlstate;
end;
$$;

create function pg_temp.try_insert_storage_object(
  test_id uuid,
  target_matter_id uuid,
  actor_id uuid
)
returns text
language plpgsql
set search_path = ''
as $$
begin
  insert into storage.objects (id, bucket_id, name, owner_id, metadata)
  values (
    test_id,
    'matter-documents',
    target_matter_id::text || '/' || test_id::text || '/probe.pdf',
    actor_id::text,
    '{"size":128,"mimetype":"application/pdf"}'::jsonb
  );
  return 'ok';
exception
  when others then
    return sqlstate;
end;
$$;

create function pg_temp.try_register_document(
  test_id uuid,
  target_matter_id uuid
)
returns text
language plpgsql
set search_path = ''
as $$
begin
  perform * from public.register_matter_document(
    target_matter_id,
    test_id,
    target_matter_id::text || '/' || test_id::text || '/document.pdf',
    'offboarding-probe.pdf',
    'application/pdf',
    128
  );
  return 'ok';
exception
  when others then
    return sqlstate;
end;
$$;

create function pg_temp.try_create_document_request(target_matter_id uuid)
returns text
language plpgsql
set search_path = ''
as $$
begin
  perform *
  from public.create_document_request(
    target_matter_id,
    'Offboarding write probe',
    null,
    null
  );
  return 'ok';
exception
  when others then
    return sqlstate;
end;
$$;

create function pg_temp.try_update_workflow(
  target_matter_id uuid,
  target_stage_id uuid
)
returns text
language plpgsql
set search_path = ''
as $$
begin
  perform *
  from public.update_matter_workflow(
    target_matter_id,
    'active'::public.matter_status,
    target_stage_id,
    null,
    null,
    null,
    false,
    null
  );
  return 'ok';
exception
  when others then
    return sqlstate;
end;
$$;

grant execute on function pg_temp.try_update_matter_status(uuid) to authenticated;
grant execute on function pg_temp.try_insert_stage(uuid, uuid) to authenticated;
grant execute on function pg_temp.try_insert_event(uuid, uuid, uuid) to authenticated;
grant execute on function pg_temp.try_insert_message(uuid, uuid, uuid) to authenticated;
grant execute on function pg_temp.try_insert_document(uuid, uuid, uuid) to authenticated;
grant execute on function pg_temp.try_register_document(uuid, uuid) to authenticated;
grant execute on function pg_temp.try_insert_storage_object(uuid, uuid, uuid) to authenticated;
grant execute on function pg_temp.try_create_document_request(uuid) to authenticated;
grant execute on function pg_temp.try_update_workflow(uuid, uuid) to authenticated;

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
  ('81111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'offboarding-client@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('83333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'offboarding-lawyer@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('84444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'offboarding-admin@example.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (id, display_name) values
  ('81111111-1111-4111-8111-111111111111', 'Offboarding client'),
  ('83333333-3333-4333-8333-333333333333', 'Offboarding lawyer'),
  ('84444444-4444-4444-8444-444444444444', 'Offboarding admin');

insert into public.organizations (id, name) values
  ('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Offboarding smoke organization'),
  ('8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Offboarding smoke other organization');

insert into public.organization_members (organization_id, user_id, role) values
  ('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '83333333-3333-4333-8333-333333333333', 'lawyer'),
  ('8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '83333333-3333-4333-8333-333333333333', 'lawyer'),
  ('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '84444444-4444-4444-8444-444444444444', 'admin');

insert into public.matters (id, organization_id, reference, title, created_by) values
  ('8c111111-1111-4111-8111-111111111111', '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'OFFBOARD-1', 'Offboarding smoke matter', '84444444-4444-4444-8444-444444444444');

insert into public.matter_participants (matter_id, user_id, role) values
  ('8c111111-1111-4111-8111-111111111111', '81111111-1111-4111-8111-111111111111', 'client'),
  ('8c111111-1111-4111-8111-111111111111', '83333333-3333-4333-8333-333333333333', 'lawyer');

insert into public.matter_stages (id, matter_id, position, title, status) values
  ('8d111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111', 1, 'Offboarding stage', 'current');

insert into public.matter_events (id, matter_id, event_type, public_text, actor_id) values
  ('8e111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111', 'fixture', 'Offboarding event', '84444444-4444-4444-8444-444444444444');

insert into public.documents (
  id,
  matter_id,
  storage_path,
  original_name,
  mime_type,
  size_bytes,
  uploaded_by
) values (
  '8f111111-1111-4111-8111-111111111111',
  '8c111111-1111-4111-8111-111111111111',
  '8c111111-1111-4111-8111-111111111111/8f111111-1111-4111-8111-111111111111/fixture.pdf',
  'offboarding-fixture.pdf',
  'application/pdf',
  128,
  '81111111-1111-4111-8111-111111111111'
);

insert into public.messages (id, matter_id, author_id, body) values
  ('8b111111-1111-4111-8111-111111111111', '8c111111-1111-4111-8111-111111111111', '81111111-1111-4111-8111-111111111111', 'Offboarding fixture message');

insert into public.document_requests (
  id,
  matter_id,
  title,
  status,
  created_by
) values (
  '8a111111-1111-4111-8111-111111111111',
  '8c111111-1111-4111-8111-111111111111',
  'Offboarding fixture request',
  'requested',
  '83333333-3333-4333-8333-333333333333'
);

insert into storage.objects (id, bucket_id, name, owner_id, metadata) values (
  '8f222222-2222-4222-8222-222222222222',
  'matter-documents',
  '8c111111-1111-4111-8111-111111111111/8f222222-2222-4222-8222-222222222222/fixture.pdf',
  '81111111-1111-4111-8111-111111111111',
  '{"size":128,"mimetype":"application/pdf"}'::jsonb
);

-- These pre-existing owned uploads test RPC authorization across offboarding.
insert into storage.objects (id, bucket_id, name, owner_id, metadata) values
  ('8f333333-3333-4333-8333-333333333333', 'matter-documents', '8c111111-1111-4111-8111-111111111111/8f333333-3333-4333-8333-333333333333/document.pdf', '83333333-3333-4333-8333-333333333333', '{"size":128,"mimetype":"application/pdf"}'::jsonb),
  ('8f555555-5555-4555-8555-555555555555', 'matter-documents', '8c111111-1111-4111-8111-111111111111/8f555555-5555-4555-8555-555555555555/document.pdf', '81111111-1111-4111-8111-111111111111', '{"size":128,"mimetype":"application/pdf"}'::jsonb),
  ('8f777777-7777-4777-8777-777777777777', 'matter-documents', '8c111111-1111-4111-8111-111111111111/8f777777-7777-4777-8777-777777777777/document.pdf', '83333333-3333-4333-8333-333333333333', '{"size":128,"mimetype":"application/pdf"}'::jsonb),
  ('8f888888-8888-4888-8888-888888888888', 'matter-documents', '8c111111-1111-4111-8111-111111111111/8f888888-8888-4888-8888-888888888888/document.pdf', '84444444-4444-4444-8444-444444444444', '{"size":128,"mimetype":"application/pdf"}'::jsonb);

-- Legitimate control: an assigned current lawyer has read and management access.
set local role authenticated;
select set_config('request.jwt.claim.sub', '83333333-3333-4333-8333-333333333333', true);
insert into pg_temp.offboarding_results values
  ('current-lawyer:organization', (select count(*)::text from public.organizations where id = '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), '1'),
  ('current-lawyer:matter', (select count(*)::text from public.matters where id = '8c111111-1111-4111-8111-111111111111'), '1'),
  ('current-lawyer:own-participant', (select count(*)::text from public.matter_participants where matter_id = '8c111111-1111-4111-8111-111111111111'), '1'),
  ('current-lawyer:can-access-organization', private.can_access_organization('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')::text, 'true'),
  ('current-lawyer:can-access-matter', private.can_access_matter('8c111111-1111-4111-8111-111111111111')::text, 'true'),
  ('current-lawyer:can-manage-matter', private.can_manage_matter('8c111111-1111-4111-8111-111111111111')::text, 'true'),
  ('current-lawyer:can-access-matter-text', private.can_access_matter_text('8c111111-1111-4111-8111-111111111111')::text, 'true'),
  ('current-lawyer:register-owned-document-allowed', pg_temp.try_register_document('8f777777-7777-4777-8777-777777777777', '8c111111-1111-4111-8111-111111111111'), 'ok');
reset role;

-- The production lifecycle event being tested: membership is removed while the
-- historical lawyer participant row is intentionally left in place.
do $$
declare
  deleted_rows bigint;
begin
  delete from public.organization_members
  where organization_id = '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    and user_id = '83333333-3333-4333-8333-333333333333';

  get diagnostics deleted_rows = row_count;
  if deleted_rows <> 1 then
    raise exception 'Offboarding fixture failed: removed % membership rows instead of 1', deleted_rows;
  end if;
end;
$$;

insert into pg_temp.offboarding_results values
  ('database:stale-lawyer-participant-retained', (
    select count(*)::text
    from public.matter_participants
    where matter_id = '8c111111-1111-4111-8111-111111111111'
      and user_id = '83333333-3333-4333-8333-333333333333'
      and role = 'lawyer'
  ), '1'),
  ('database:other-organization-membership-preserved', (
    select count(*)::text
    from public.organization_members
    where organization_id = '8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and user_id = '83333333-3333-4333-8333-333333333333'
      and role = 'lawyer'
  ), '1');

set local role authenticated;
select set_config('request.jwt.claim.sub', '83333333-3333-4333-8333-333333333333', true);
insert into pg_temp.offboarding_results values
  ('former-lawyer:organization-hidden', (select count(*)::text from public.organizations where id = '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), '0'),
  ('former-lawyer:matter-hidden', (select count(*)::text from public.matters where id = '8c111111-1111-4111-8111-111111111111'), '0'),
  ('former-lawyer:participant-hidden', (select count(*)::text from public.matter_participants where matter_id = '8c111111-1111-4111-8111-111111111111'), '0'),
  ('former-lawyer:stages-hidden', (select count(*)::text from public.matter_stages where matter_id = '8c111111-1111-4111-8111-111111111111'), '0'),
  ('former-lawyer:events-hidden', (select count(*)::text from public.matter_events where matter_id = '8c111111-1111-4111-8111-111111111111'), '0'),
  ('former-lawyer:documents-hidden', (select count(*)::text from public.documents where matter_id = '8c111111-1111-4111-8111-111111111111'), '0'),
  ('former-lawyer:messages-hidden', (select count(*)::text from public.messages where matter_id = '8c111111-1111-4111-8111-111111111111'), '0'),
  ('former-lawyer:requests-hidden', (select count(*)::text from public.document_requests where matter_id = '8c111111-1111-4111-8111-111111111111'), '0'),
  ('former-lawyer:storage-hidden', (select count(*)::text from storage.objects where name like '8c111111-1111-4111-8111-111111111111/%'), '0'),
  ('former-lawyer:cannot-access-organization', private.can_access_organization('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')::text, 'false'),
  ('former-lawyer:cannot-access-matter', private.can_access_matter('8c111111-1111-4111-8111-111111111111')::text, 'false'),
  ('former-lawyer:cannot-manage-matter', private.can_manage_matter('8c111111-1111-4111-8111-111111111111')::text, 'false'),
  ('former-lawyer:cannot-access-matter-text', private.can_access_matter_text('8c111111-1111-4111-8111-111111111111')::text, 'false');
reset role;

-- Legitimate control: client participation remains sufficient for client access.
set local role authenticated;
select set_config('request.jwt.claim.sub', '81111111-1111-4111-8111-111111111111', true);
insert into pg_temp.offboarding_results values
  ('client:organization-visible', (select count(*)::text from public.organizations where id = '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), '1'),
  ('client:matter-visible', (select count(*)::text from public.matters where id = '8c111111-1111-4111-8111-111111111111'), '1'),
  ('client:own-participant-visible', (select count(*)::text from public.matter_participants where matter_id = '8c111111-1111-4111-8111-111111111111'), '1'),
  ('client:stages-visible', (select count(*)::text from public.matter_stages where matter_id = '8c111111-1111-4111-8111-111111111111'), '1'),
  ('client:events-visible', (select count(*)::text from public.matter_events where matter_id = '8c111111-1111-4111-8111-111111111111'), '1'),
  ('client:documents-visible', (select count(*)::text from public.documents where matter_id = '8c111111-1111-4111-8111-111111111111'), '2'),
  ('client:messages-visible', (select count(*)::text from public.messages where matter_id = '8c111111-1111-4111-8111-111111111111'), '1'),
  ('client:requests-visible', (select count(*)::text from public.document_requests where matter_id = '8c111111-1111-4111-8111-111111111111'), '1'),
  ('client:storage-visible', (select count(*)::text from storage.objects where name like '8c111111-1111-4111-8111-111111111111/%'), '5'),
  ('client:can-access-organization', private.can_access_organization('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')::text, 'true'),
  ('client:can-access-matter', private.can_access_matter('8c111111-1111-4111-8111-111111111111')::text, 'true'),
  ('client:cannot-manage-matter', private.can_manage_matter('8c111111-1111-4111-8111-111111111111')::text, 'false'),
  ('client:can-access-matter-text', private.can_access_matter_text('8c111111-1111-4111-8111-111111111111')::text, 'true');
reset role;

-- Legitimate control: a current organization administrator remains a manager.
set local role authenticated;
select set_config('request.jwt.claim.sub', '84444444-4444-4444-8444-444444444444', true);
insert into pg_temp.offboarding_results values
  ('admin:matter-visible', (select count(*)::text from public.matters where id = '8c111111-1111-4111-8111-111111111111'), '1'),
  ('admin:can-manage-matter', private.can_manage_matter('8c111111-1111-4111-8111-111111111111')::text, 'true'),
  ('admin:register-owned-document-allowed', pg_temp.try_register_document('8f888888-8888-4888-8888-888888888888', '8c111111-1111-4111-8111-111111111111'), 'ok');
reset role;

-- Former staff must also lose every write path backed by the shared helpers.
set local role authenticated;
select set_config('request.jwt.claim.sub', '83333333-3333-4333-8333-333333333333', true);
insert into pg_temp.offboarding_results values
  ('former-lawyer:update-matter-denied', pg_temp.try_update_matter_status('8c111111-1111-4111-8111-111111111111'), 'no_row'),
  ('former-lawyer:insert-stage-denied', pg_temp.try_insert_stage('8d222222-2222-4222-8222-222222222222', '8c111111-1111-4111-8111-111111111111'), '42501'),
  ('former-lawyer:insert-event-denied', pg_temp.try_insert_event('8e222222-2222-4222-8222-222222222222', '8c111111-1111-4111-8111-111111111111', '83333333-3333-4333-8333-333333333333'), '42501'),
  ('former-lawyer:insert-message-denied', pg_temp.try_insert_message('8b222222-2222-4222-8222-222222222222', '8c111111-1111-4111-8111-111111111111', '83333333-3333-4333-8333-333333333333'), '42501'),
  ('former-lawyer:register-owned-document-denied', pg_temp.try_register_document('8f333333-3333-4333-8333-333333333333', '8c111111-1111-4111-8111-111111111111'), '42501'),
  ('former-lawyer:insert-storage-denied', pg_temp.try_insert_storage_object('8f444444-4444-4444-8444-444444444444', '8c111111-1111-4111-8111-111111111111', '83333333-3333-4333-8333-333333333333'), '42501'),
  ('former-lawyer:create-request-denied', pg_temp.try_create_document_request('8c111111-1111-4111-8111-111111111111'), '42501'),
  ('former-lawyer:update-workflow-denied', pg_temp.try_update_workflow('8c111111-1111-4111-8111-111111111111', '8d111111-1111-4111-8111-111111111111'), '42501');
reset role;

-- Client write paths remain available after the lawyer is removed.
set local role authenticated;
select set_config('request.jwt.claim.sub', '81111111-1111-4111-8111-111111111111', true);
insert into pg_temp.offboarding_results values
  ('client:insert-message-still-allowed', pg_temp.try_insert_message('8b333333-3333-4333-8333-333333333333', '8c111111-1111-4111-8111-111111111111', '81111111-1111-4111-8111-111111111111'), 'ok'),
  ('client:direct-document-insert-denied', pg_temp.try_insert_document('8f555555-5555-4555-8555-555555555555', '8c111111-1111-4111-8111-111111111111', '81111111-1111-4111-8111-111111111111'), '42501'),
  ('client:register-owned-document-allowed', pg_temp.try_register_document('8f555555-5555-4555-8555-555555555555', '8c111111-1111-4111-8111-111111111111'), 'ok'),
  ('client:insert-storage-still-allowed', pg_temp.try_insert_storage_object('8f666666-6666-4666-8666-666666666666', '8c111111-1111-4111-8111-111111111111', '81111111-1111-4111-8111-111111111111'), 'ok');
reset role;

do $$
declare
  failures text;
begin
  select string_agg(
    check_name || '=' || actual || ' (expected ' || expected || ')',
    ', ' order by check_name
  )
  into failures
  from pg_temp.offboarding_results
  where actual <> expected;

  if failures is not null then
    raise exception 'Offboarding revocation smoke failed: %', failures;
  end if;
end;
$$;

select count(*) as passed_checks from pg_temp.offboarding_results;

rollback;
