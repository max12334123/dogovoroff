-- Run only in an isolated test database. All fixtures and mutations roll back.
begin;
set local statement_timeout = '30s';

create temporary table ordinary_document_results (
  check_name text primary key,
  actual text not null,
  expected text not null
) on commit drop;
grant select, insert on table pg_temp.ordinary_document_results to authenticated, anon;

create function pg_temp.try_register_ordinary_document(
  target_matter_id uuid,
  new_document_id uuid,
  new_original_name text,
  new_mime_type text,
  new_size_bytes bigint,
  new_storage_path text default null
)
returns text
language plpgsql
set search_path = ''
as $$
begin
  perform * from public.register_matter_document(
    target_matter_id,
    new_document_id,
    coalesce(new_storage_path, target_matter_id::text || '/' || new_document_id::text || '/document.pdf'),
    new_original_name,
    new_mime_type,
    new_size_bytes
  );
  return 'ok';
exception
  when others then
    return sqlstate;
end;
$$;

create function pg_temp.try_forge_ordinary_document(target_matter_id uuid, new_document_id uuid)
returns text
language plpgsql
set search_path = ''
as $$
begin
  insert into public.documents (
    id, matter_id, storage_path, original_name, mime_type,
    size_bytes, status, uploaded_by, created_at, updated_at
  ) values (
    new_document_id,
    target_matter_id,
    target_matter_id::text || '/' || new_document_id::text || '/document.pdf',
    'phantom.pdf',
    'application/pdf',
    128,
    'ready',
    (select auth.uid()),
    now() - interval '1 year',
    now() - interval '1 year'
  );
  return 'ok';
exception
  when others then
    return sqlstate;
end;
$$;

grant execute on function pg_temp.try_register_ordinary_document(uuid, uuid, text, text, bigint, text) to authenticated, anon;
grant execute on function pg_temp.try_forge_ordinary_document(uuid, uuid) to authenticated;

insert into auth.users (id, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('91111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('92222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('93333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('94444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('95555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (id, display_name) values
  ('91111111-1111-4111-8111-111111111111', 'Ordinary client'),
  ('92222222-2222-4222-8222-222222222222', 'Other client'),
  ('93333333-3333-4333-8333-333333333333', 'Assigned lawyer'),
  ('94444444-4444-4444-8444-444444444444', 'Organization admin'),
  ('95555555-5555-4555-8555-555555555555', 'Unrelated user');

insert into public.organizations (id, name) values
  ('9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Ordinary document organization'),
  ('9bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Other organization');

insert into public.organization_members (organization_id, user_id, role) values
  ('9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '93333333-3333-4333-8333-333333333333', 'lawyer'),
  ('9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '94444444-4444-4444-8444-444444444444', 'admin');

insert into public.matters (id, organization_id, reference, title, created_by) values
  ('9c111111-1111-4111-8111-111111111111', '9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ORDINARY-1', 'Ordinary registration matter', '94444444-4444-4444-8444-444444444444'),
  ('9c222222-2222-4222-8222-222222222222', '9bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'ORDINARY-2', 'Unrelated matter', null);

insert into public.matter_participants (matter_id, user_id, role) values
  ('9c111111-1111-4111-8111-111111111111', '91111111-1111-4111-8111-111111111111', 'client'),
  ('9c111111-1111-4111-8111-111111111111', '93333333-3333-4333-8333-333333333333', 'lawyer'),
  ('9c222222-2222-4222-8222-222222222222', '92222222-2222-4222-8222-222222222222', 'client');

insert into storage.objects (id, bucket_id, name, owner_id, metadata) values
  ('9d111111-1111-4111-8111-111111111111', 'matter-documents', '9c111111-1111-4111-8111-111111111111/9d111111-1111-4111-8111-111111111111/document.pdf', '91111111-1111-4111-8111-111111111111', '{"size":128,"mimetype":"application/pdf"}'::jsonb),
  ('9d222222-2222-4222-8222-222222222222', 'matter-documents', '9c111111-1111-4111-8111-111111111111/9d222222-2222-4222-8222-222222222222/document.pdf', '93333333-3333-4333-8333-333333333333', '{"size":128,"mimetype":"application/pdf"}'::jsonb),
  ('9d333333-3333-4333-8333-333333333333', 'matter-documents', '9c111111-1111-4111-8111-111111111111/9d333333-3333-4333-8333-333333333333/document.pdf', '94444444-4444-4444-8444-444444444444', '{"size":128,"mimetype":"application/pdf"}'::jsonb),
  ('9d555555-5555-4555-8555-555555555555', 'matter-documents', '9c111111-1111-4111-8111-111111111111/9d555555-5555-4555-8555-555555555555/document.pdf', '93333333-3333-4333-8333-333333333333', '{"size":128,"mimetype":"application/pdf"}'::jsonb),
  ('9d666666-6666-4666-8666-666666666666', 'matter-documents', '9c222222-2222-4222-8222-222222222222/9d666666-6666-4666-8666-666666666666/document.pdf', '91111111-1111-4111-8111-111111111111', '{"size":128,"mimetype":"application/pdf"}'::jsonb),
  ('9d777777-7777-4777-8777-777777777777', 'matter-documents', '9c111111-1111-4111-8111-111111111111/9d777777-7777-4777-8777-777777777777/document.pdf', '95555555-5555-4555-8555-555555555555', '{"size":128,"mimetype":"application/pdf"}'::jsonb),
  ('9e111111-1111-4111-8111-111111111111', 'matter-documents', '9c111111-1111-4111-8111-111111111111/9e111111-1111-4111-8111-111111111111/document.doc', '91111111-1111-4111-8111-111111111111', '{"size":128,"mimetype":"application/msword"}'::jsonb),
  ('9e222222-2222-4222-8222-222222222222', 'matter-documents', '9c111111-1111-4111-8111-111111111111/9e222222-2222-4222-8222-222222222222/document.docx', '91111111-1111-4111-8111-111111111111', '{"size":128,"mimetype":"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}'::jsonb),
  ('9e333333-3333-4333-8333-333333333333', 'matter-documents', '9c111111-1111-4111-8111-111111111111/9e333333-3333-4333-8333-333333333333/document.jpg', '91111111-1111-4111-8111-111111111111', '{"size":128,"mimetype":"image/jpeg"}'::jsonb),
  ('9e444444-4444-4444-8444-444444444444', 'matter-documents', '9c111111-1111-4111-8111-111111111111/9e444444-4444-4444-8444-444444444444/document.jpeg', '91111111-1111-4111-8111-111111111111', '{"size":128,"mimetype":"image/jpeg"}'::jsonb),
  ('9e555555-5555-4555-8555-555555555555', 'matter-documents', '9c111111-1111-4111-8111-111111111111/9e555555-5555-4555-8555-555555555555/document.png', '91111111-1111-4111-8111-111111111111', '{"size":128,"mimetype":"image/png"}'::jsonb);

insert into pg_temp.ordinary_document_results values
  ('authenticated:direct-insert-grant-removed', has_table_privilege('authenticated', 'public.documents', 'INSERT')::text, 'false'),
  ('authenticated:rpc-granted', has_function_privilege('authenticated', 'public.register_matter_document(uuid, uuid, text, text, text, bigint)', 'EXECUTE')::text, 'true'),
  ('anon:rpc-not-granted', has_function_privilege('anon', 'public.register_matter_document(uuid, uuid, text, text, text, bigint)', 'EXECUTE')::text, 'false');

set local role authenticated;
select set_config('request.jwt.claim.sub', '91111111-1111-4111-8111-111111111111', true);
insert into pg_temp.ordinary_document_results values
  ('client:direct-forgery-denied', pg_temp.try_forge_ordinary_document('9c111111-1111-4111-8111-111111111111', '9d888888-8888-4888-8888-888888888888'), '42501'),
  ('client:missing-object-denied', pg_temp.try_register_ordinary_document('9c111111-1111-4111-8111-111111111111', '9d444444-4444-4444-8444-444444444444', 'missing.pdf', 'application/pdf', 128), '42501'),
  ('client:foreign-owner-denied', pg_temp.try_register_ordinary_document('9c111111-1111-4111-8111-111111111111', '9d555555-5555-4555-8555-555555555555', 'foreign.pdf', 'application/pdf', 128), '42501'),
  ('client:wrong-size-denied', pg_temp.try_register_ordinary_document('9c111111-1111-4111-8111-111111111111', '9d111111-1111-4111-8111-111111111111', 'client.pdf', 'application/pdf', 129), '42501'),
  ('client:wrong-name-type-denied', pg_temp.try_register_ordinary_document('9c111111-1111-4111-8111-111111111111', '9d111111-1111-4111-8111-111111111111', 'client.exe', 'application/pdf', 128), 'P0001'),
  ('client:wrong-path-denied', pg_temp.try_register_ordinary_document('9c111111-1111-4111-8111-111111111111', '9d111111-1111-4111-8111-111111111111', 'client.pdf', 'application/pdf', 128, 'other/document.pdf'), 'P0001'),
  ('client:other-matter-denied', pg_temp.try_register_ordinary_document('9c222222-2222-4222-8222-222222222222', '9d666666-6666-4666-8666-666666666666', 'other.pdf', 'application/pdf', 128), '42501'),
  ('client:valid-upload', pg_temp.try_register_ordinary_document('9c111111-1111-4111-8111-111111111111', '9d111111-1111-4111-8111-111111111111', 'client.pdf', 'application/pdf', 128), 'ok'),
  ('client:doc-upload', pg_temp.try_register_ordinary_document('9c111111-1111-4111-8111-111111111111', '9e111111-1111-4111-8111-111111111111', 'client.doc', 'application/msword', 128, '9c111111-1111-4111-8111-111111111111/9e111111-1111-4111-8111-111111111111/document.doc'), 'ok'),
  ('client:docx-upload', pg_temp.try_register_ordinary_document('9c111111-1111-4111-8111-111111111111', '9e222222-2222-4222-8222-222222222222', 'client.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 128, '9c111111-1111-4111-8111-111111111111/9e222222-2222-4222-8222-222222222222/document.docx'), 'ok'),
  ('client:jpg-upload', pg_temp.try_register_ordinary_document('9c111111-1111-4111-8111-111111111111', '9e333333-3333-4333-8333-333333333333', 'client.jpg', 'image/jpeg', 128, '9c111111-1111-4111-8111-111111111111/9e333333-3333-4333-8333-333333333333/document.jpg'), 'ok'),
  ('client:jpeg-upload', pg_temp.try_register_ordinary_document('9c111111-1111-4111-8111-111111111111', '9e444444-4444-4444-8444-444444444444', 'client.jpeg', 'image/jpeg', 128, '9c111111-1111-4111-8111-111111111111/9e444444-4444-4444-8444-444444444444/document.jpeg'), 'ok'),
  ('client:png-upload', pg_temp.try_register_ordinary_document('9c111111-1111-4111-8111-111111111111', '9e555555-5555-4555-8555-555555555555', 'client.png', 'image/png', 128, '9c111111-1111-4111-8111-111111111111/9e555555-5555-4555-8555-555555555555/document.png'), 'ok'),
  ('client:idempotent-retry', pg_temp.try_register_ordinary_document('9c111111-1111-4111-8111-111111111111', '9d111111-1111-4111-8111-111111111111', 'client.pdf', 'application/pdf', 128), 'ok'),
  ('client:conflicting-retry-denied', pg_temp.try_register_ordinary_document('9c111111-1111-4111-8111-111111111111', '9d111111-1111-4111-8111-111111111111', 'changed.pdf', 'application/pdf', 128), 'P0001');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '93333333-3333-4333-8333-333333333333', true);
insert into pg_temp.ordinary_document_results values
  ('assigned-lawyer:valid-upload', pg_temp.try_register_ordinary_document('9c111111-1111-4111-8111-111111111111', '9d222222-2222-4222-8222-222222222222', 'lawyer.pdf', 'application/pdf', 128), 'ok');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '94444444-4444-4444-8444-444444444444', true);
insert into pg_temp.ordinary_document_results values
  ('org-admin:valid-upload', pg_temp.try_register_ordinary_document('9c111111-1111-4111-8111-111111111111', '9d333333-3333-4333-8333-333333333333', 'admin.pdf', 'application/pdf', 128), 'ok');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '95555555-5555-4555-8555-555555555555', true);
insert into pg_temp.ordinary_document_results values
  ('outsider:own-object-not-enough', pg_temp.try_register_ordinary_document('9c111111-1111-4111-8111-111111111111', '9d777777-7777-4777-8777-777777777777', 'outsider.pdf', 'application/pdf', 128), '42501');
reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
insert into pg_temp.ordinary_document_results values
  ('anon:rpc-denied', pg_temp.try_register_ordinary_document('9c111111-1111-4111-8111-111111111111', '9d111111-1111-4111-8111-111111111111', 'client.pdf', 'application/pdf', 128), '42501');
reset role;

insert into pg_temp.ordinary_document_results values
  ('database:only-valid-documents-registered', (select count(*)::text from public.documents where matter_id = '9c111111-1111-4111-8111-111111111111'), '8'),
  ('database:one-audit-for-idempotent-upload', (
    select count(*)::text from public.audit_events
    where entity_type = 'documents'
      and entity_id = '9d111111-1111-4111-8111-111111111111'
      and action = 'document.created'
  ), '1'),
  ('database:no-audit-for-forgery', (
    select count(*)::text from public.audit_events
    where entity_type = 'documents'
      and entity_id = '9d888888-8888-4888-8888-888888888888'
  ), '0'),
  ('database:defaults-and-owner-preserved', (
    select (status = 'received'
      and request_id is null
      and uploaded_by = '91111111-1111-4111-8111-111111111111'
      and created_at between now() - interval '1 minute' and now()
      and updated_at between now() - interval '1 minute' and now())::text
    from public.documents
    where id = '9d111111-1111-4111-8111-111111111111'
  ), 'true');

do $$
declare failures text;
begin
  select string_agg(check_name || '=' || actual || ' (expected ' || expected || ')', ', ' order by check_name)
  into failures
  from pg_temp.ordinary_document_results
  where actual <> expected;
  if failures is not null then
    raise exception 'Ordinary document registration smoke failed: %', failures;
  end if;
end;
$$;

select count(*) as passed_checks from pg_temp.ordinary_document_results;
rollback;
