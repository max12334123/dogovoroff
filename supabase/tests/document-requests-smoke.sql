begin;
set local statement_timeout = '30s';

create temporary table document_request_results (
  category text not null check (category in ('authorization', 'transition', 'isolation')),
  check_name text primary key,
  actual bigint not null,
  expected bigint not null
) on commit drop;

create temporary table document_request_ids (
  label text primary key,
  request_id uuid not null unique
) on commit drop;

grant select, insert on table pg_temp.document_request_results to authenticated, anon;
grant select, insert on table pg_temp.document_request_ids to authenticated, anon;

create temporary table document_request_terminal_attempts (
  check_name text primary key,
  succeeded boolean not null
) on commit drop;

grant select, insert on table pg_temp.document_request_terminal_attempts to authenticated, anon;

create temporary table document_request_sensitive_values (
  sensitive_text text primary key
) on commit drop;

create temporary table document_request_event_baseline (
  event_id uuid primary key
) on commit drop;

create temporary table document_request_audit_baseline (
  audit_id uuid primary key
) on commit drop;

create temporary table document_request_created_event_ids (
  event_id uuid primary key
) on commit drop;

create temporary table document_request_created_audit_ids (
  audit_id uuid primary key
) on commit drop;

create function pg_temp.try_create_document_request(target_matter_id uuid, request_title text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  created_request_id uuid;
begin
  select created.request_id
  into created_request_id
  from public.create_document_request(
    target_matter_id,
    request_title,
    'Synthetic request instructions',
    null
  ) as created;
  return created_request_id;
exception
  when insufficient_privilege
    or raise_exception
    or invalid_parameter_value then
    return null;
end;
$$;

create function pg_temp.try_count_document_requests(target_matter_id uuid)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  visible_count bigint;
begin
  select count(*)
  into visible_count
  from public.document_requests as request
  where request.matter_id = target_matter_id;
  return visible_count;
exception
  when insufficient_privilege then
    return 0;
end;
$$;

create function pg_temp.try_update_document_request(target_request_id uuid, request_title text)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform *
  from public.update_document_request(
    target_request_id,
    request_title,
    'Updated synthetic instructions',
    null
  );
  return true;
exception
  when insufficient_privilege
    or raise_exception
    or invalid_parameter_value then
    return false;
end;
$$;

create function pg_temp.try_register_document_request_file(
  target_request_id uuid,
  target_document_id uuid,
  original_filename text
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  target_matter_id uuid;
begin
  select request.matter_id
  into target_matter_id
  from public.document_requests as request
  where request.id = target_request_id;

  perform *
  from public.register_document_request_file(
    target_request_id,
    target_document_id,
    target_matter_id::text || '/' || target_document_id::text || '/document.pdf',
    original_filename,
    'application/pdf',
    1024
  );
  return true;
exception
  when insufficient_privilege
    or raise_exception
    or invalid_parameter_value
    or unique_violation then
    return false;
end;
$$;

create function pg_temp.try_submit_document_request(target_request_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform * from public.submit_document_request(target_request_id);
  return true;
exception
  when insufficient_privilege
    or raise_exception
    or invalid_parameter_value then
    return false;
end;
$$;

create function pg_temp.try_review_document_request(
  target_request_id uuid,
  review_status public.document_request_status,
  review_note text
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform *
  from public.review_document_request(target_request_id, review_status, review_note);
  return true;
exception
  when insufficient_privilege
    or raise_exception
    or invalid_parameter_value then
    return false;
end;
$$;

create function pg_temp.try_cancel_document_request(target_request_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform * from public.cancel_document_request(target_request_id);
  return true;
exception
  when insufficient_privilege
    or raise_exception
    or invalid_parameter_value then
    return false;
end;
$$;

create function pg_temp.try_withdraw_document_request_file(
  target_request_id uuid,
  target_document_id uuid
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform *
  from public.withdraw_document_request_file(target_request_id, target_document_id);
  return true;
exception
  when insufficient_privilege
    or raise_exception
    or invalid_parameter_value then
    return false;
end;
$$;

create function pg_temp.try_direct_document_request_insert(
  target_matter_id uuid,
  claimed_creator_id uuid
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  insert into public.document_requests (matter_id, title, created_by)
  values (target_matter_id, 'Forbidden direct request', claimed_creator_id);
  return true;
exception
  when insufficient_privilege
    or raise_exception
    or invalid_parameter_value then
    return false;
end;
$$;

create function pg_temp.try_direct_linked_document_insert(
  target_request_id uuid,
  target_matter_id uuid,
  target_document_id uuid,
  original_filename text
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  insert into public.documents (
    id,
    matter_id,
    request_id,
    storage_path,
    original_name,
    mime_type,
    size_bytes,
    uploaded_by
  ) values (
    target_document_id,
    target_matter_id,
    target_request_id,
    target_matter_id::text || '/' || target_document_id::text || '/document.pdf',
    original_filename,
    'application/pdf',
    1024,
    (select auth.uid())
  );
  return true;
exception
  when insufficient_privilege
    or raise_exception
    or invalid_parameter_value then
    return false;
end;
$$;

grant execute on function pg_temp.try_create_document_request(uuid, text) to authenticated, anon;
grant execute on function pg_temp.try_count_document_requests(uuid) to authenticated, anon;
grant execute on function pg_temp.try_update_document_request(uuid, text) to authenticated, anon;
grant execute on function pg_temp.try_register_document_request_file(uuid, uuid, text) to authenticated, anon;
grant execute on function pg_temp.try_submit_document_request(uuid) to authenticated, anon;
grant execute on function pg_temp.try_review_document_request(uuid, public.document_request_status, text) to authenticated, anon;
grant execute on function pg_temp.try_cancel_document_request(uuid) to authenticated, anon;
grant execute on function pg_temp.try_withdraw_document_request_file(uuid, uuid) to authenticated, anon;
grant execute on function pg_temp.try_direct_document_request_insert(uuid, uuid) to authenticated, anon;
grant execute on function pg_temp.try_direct_linked_document_insert(uuid, uuid, uuid, text) to authenticated, anon;

insert into pg_temp.document_request_sensitive_values (sensitive_text) values
  ('Synthetic request A'),
  ('Synthetic review note'),
  ('synthetic-first.pdf'),
  ('Synthetic request B'),
  ('Synthetic request instructions'),
  ('Updated request A'),
  ('Updated synthetic instructions'),
  ('Blocked request update'),
  ('Terminal update'),
  ('Terminal review'),
  ('Cancelled update'),
  ('Anonymous request'),
  ('Client request'),
  ('Forbidden direct request'),
  ('synthetic-second.pdf');

insert into pg_temp.document_request_event_baseline (event_id)
select event.id from public.matter_events as event;

insert into pg_temp.document_request_audit_baseline (audit_id)
select event.id from public.audit_events as event;

select set_config('request.jwt.claim.sub', '', true);

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
  ('71111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'client-a.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('72222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'client-b.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('73333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'lawyer.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('74444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'admin.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (id, display_name) values
  ('71111111-1111-4111-8111-111111111111', 'Synthetic client A'),
  ('72222222-2222-4222-8222-222222222222', 'Synthetic client B'),
  ('73333333-3333-4333-8333-333333333333', 'Synthetic lawyer'),
  ('74444444-4444-4444-8444-444444444444', 'Synthetic admin');

insert into public.organizations (id, name)
values ('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Document request smoke organization');

insert into public.organization_members (organization_id, user_id, role) values
  ('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '73333333-3333-4333-8333-333333333333', 'lawyer'),
  ('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '74444444-4444-4444-8444-444444444444', 'admin');

insert into public.matters (id, organization_id, reference, title, created_by) values
  ('7a111111-1111-4111-8111-111111111111', '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'DOC-SMOKE-A', 'Synthetic matter A', '74444444-4444-4444-8444-444444444444'),
  ('7b222222-2222-4222-8222-222222222222', '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'DOC-SMOKE-B', 'Synthetic matter B', '74444444-4444-4444-8444-444444444444');

insert into public.matter_participants (matter_id, user_id, role) values
  ('7a111111-1111-4111-8111-111111111111', '71111111-1111-4111-8111-111111111111', 'client'),
  ('7a111111-1111-4111-8111-111111111111', '73333333-3333-4333-8333-333333333333', 'lawyer'),
  ('7b222222-2222-4222-8222-222222222222', '72222222-2222-4222-8222-222222222222', 'client'),
  ('7b222222-2222-4222-8222-222222222222', '73333333-3333-4333-8333-333333333333', 'lawyer');

insert into storage.objects (id, bucket_id, name, owner_id, metadata) values
  (
    '7d111111-1111-4111-8111-111111111111',
    'matter-documents',
    '7a111111-1111-4111-8111-111111111111/7d111111-1111-4111-8111-111111111111/document.pdf',
    '71111111-1111-4111-8111-111111111111',
    '{"size":1024,"mimetype":"application/pdf"}'::jsonb
  ),
  (
    '7d222222-2222-4222-8222-222222222222',
    'matter-documents',
    '7a111111-1111-4111-8111-111111111111/7d222222-2222-4222-8222-222222222222/document.pdf',
    '71111111-1111-4111-8111-111111111111',
    '{"size":1024,"mimetype":"application/pdf"}'::jsonb
  );

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
insert into pg_temp.document_request_results values
  ('authorization', 'anonymous:read-denied', pg_temp.try_count_document_requests('7a111111-1111-4111-8111-111111111111'), 0),
  ('authorization', 'anonymous:create-denied', (pg_temp.try_create_document_request('7a111111-1111-4111-8111-111111111111', 'Anonymous request') is not null)::int, 0);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', true);
insert into pg_temp.document_request_results values
  ('authorization', 'client_a:create-denied', (pg_temp.try_create_document_request('7a111111-1111-4111-8111-111111111111', 'Client request') is not null)::int, 0);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '73333333-3333-4333-8333-333333333333', true);
insert into pg_temp.document_request_ids (label, request_id)
select 'A', pg_temp.try_create_document_request('7a111111-1111-4111-8111-111111111111', 'Synthetic request A');
insert into pg_temp.document_request_ids (label, request_id)
select 'B', pg_temp.try_create_document_request('7b222222-2222-4222-8222-222222222222', 'Synthetic request B');
insert into pg_temp.document_request_results values
  ('authorization', 'lawyer:create', (select count(*) from pg_temp.document_request_ids), 2),
  ('authorization', 'lawyer:update-before-upload', pg_temp.try_update_document_request((select request_id from pg_temp.document_request_ids where label = 'A'), 'Updated request A')::int, 1);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', true);
insert into pg_temp.document_request_results values
  ('authorization', 'client_a:read-own', pg_temp.try_count_document_requests('7a111111-1111-4111-8111-111111111111'), 1),
  ('authorization', 'client_a:read-client_b-denied', pg_temp.try_count_document_requests('7b222222-2222-4222-8222-222222222222'), 0),
  ('authorization', 'client_a:direct-write-denied', pg_temp.try_direct_document_request_insert('7a111111-1111-4111-8111-111111111111', '71111111-1111-4111-8111-111111111111')::int, 0),
  ('authorization', 'client_a:direct-linked-document-denied', pg_temp.try_direct_linked_document_insert(
    (select request_id from pg_temp.document_request_ids where label = 'A'),
    '7a111111-1111-4111-8111-111111111111',
    '7d111111-1111-4111-8111-111111111111',
    'synthetic-first.pdf'
  )::int, 0),
  ('isolation', 'client_a:submit-empty-denied', pg_temp.try_submit_document_request((select request_id from pg_temp.document_request_ids where label = 'A'))::int, 0);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '72222222-2222-4222-8222-222222222222', true);
insert into pg_temp.document_request_results values
  ('authorization', 'client_b:read-client_a-denied', pg_temp.try_count_document_requests('7a111111-1111-4111-8111-111111111111'), 0),
  ('authorization', 'client_b:register-client_a-denied', pg_temp.try_register_document_request_file(
    (select request_id from pg_temp.document_request_ids where label = 'A'),
    '7d111111-1111-4111-8111-111111111111',
    'synthetic-first.pdf'
  )::int, 0);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', true);
insert into pg_temp.document_request_results values
  ('transition', 'client_a:register-first', pg_temp.try_register_document_request_file(
    (select request_id from pg_temp.document_request_ids where label = 'A'),
    '7d111111-1111-4111-8111-111111111111',
    'synthetic-first.pdf'
  )::int, 1),
  ('transition', 'client_a:register-second', pg_temp.try_register_document_request_file(
    (select request_id from pg_temp.document_request_ids where label = 'A'),
    '7d222222-2222-4222-8222-222222222222',
    'synthetic-second.pdf'
  )::int, 1);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '73333333-3333-4333-8333-333333333333', true);
insert into pg_temp.document_request_results values
  ('authorization', 'lawyer:update-after-upload-denied', pg_temp.try_update_document_request((select request_id from pg_temp.document_request_ids where label = 'A'), 'Blocked request update')::int, 0);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', true);
insert into pg_temp.document_request_results values
  ('transition', 'client_a:submit', pg_temp.try_submit_document_request((select request_id from pg_temp.document_request_ids where label = 'A'))::int, 1),
  ('isolation', 'client_a:mutate-submitted-denied', pg_temp.try_withdraw_document_request_file(
    (select request_id from pg_temp.document_request_ids where label = 'A'),
    '7d222222-2222-4222-8222-222222222222'
  )::int, 0),
  ('isolation', 'client_a:registration-retry-after-submit', (
    pg_temp.try_register_document_request_file(
      (select request_id from pg_temp.document_request_ids where label = 'A'),
      '7d111111-1111-4111-8111-111111111111',
      'synthetic-first.pdf'
    ) and (
      select count(*) = 2
      from public.documents as document
      where document.request_id = (select request_id from pg_temp.document_request_ids where label = 'A')
    )
  )::int, 1);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '73333333-3333-4333-8333-333333333333', true);
insert into pg_temp.document_request_results values
  ('isolation', 'lawyer:return-without-note-denied', pg_temp.try_review_document_request(
    (select request_id from pg_temp.document_request_ids where label = 'A'),
    'changes_requested',
    null
  )::int, 0),
  ('transition', 'lawyer:return-with-note', pg_temp.try_review_document_request(
    (select request_id from pg_temp.document_request_ids where label = 'A'),
    'changes_requested',
    'Synthetic review note'
  )::int, 1);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', true);
insert into pg_temp.document_request_results values
  ('transition', 'client_a:withdraw-second', pg_temp.try_withdraw_document_request_file(
    (select request_id from pg_temp.document_request_ids where label = 'A'),
    '7d222222-2222-4222-8222-222222222222'
  )::int, 1),
  ('transition', 'client_a:resubmit', pg_temp.try_submit_document_request((select request_id from pg_temp.document_request_ids where label = 'A'))::int, 1);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '74444444-4444-4444-8444-444444444444', true);
insert into pg_temp.document_request_results values
  ('transition', 'admin:accept', pg_temp.try_review_document_request(
    (select request_id from pg_temp.document_request_ids where label = 'A'),
    'accepted',
    null
  )::int, 1);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '73333333-3333-4333-8333-333333333333', true);
insert into pg_temp.document_request_results values
  ('transition', 'lawyer:cancel-second-request', pg_temp.try_cancel_document_request((select request_id from pg_temp.document_request_ids where label = 'B'))::int, 1);
insert into pg_temp.document_request_terminal_attempts values
  ('accepted:update', pg_temp.try_update_document_request((select request_id from pg_temp.document_request_ids where label = 'A'), 'Terminal update')),
  ('accepted:review', pg_temp.try_review_document_request((select request_id from pg_temp.document_request_ids where label = 'A'), 'changes_requested', 'Terminal review')),
  ('accepted:cancel', pg_temp.try_cancel_document_request((select request_id from pg_temp.document_request_ids where label = 'A'))),
  ('cancelled:update', pg_temp.try_update_document_request((select request_id from pg_temp.document_request_ids where label = 'B'), 'Cancelled update'));
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '72222222-2222-4222-8222-222222222222', true);
insert into pg_temp.document_request_terminal_attempts values
  ('cancelled:submit', pg_temp.try_submit_document_request((select request_id from pg_temp.document_request_ids where label = 'B'))),
  ('cancelled:register', pg_temp.try_register_document_request_file(
    (select request_id from pg_temp.document_request_ids where label = 'B'),
    '7d222222-2222-4222-8222-222222222222',
    'synthetic-second.pdf'
  ));
reset role;

insert into pg_temp.document_request_created_event_ids (event_id)
select event.id
from public.matter_events as event
where not exists (
  select 1
  from pg_temp.document_request_event_baseline as baseline
  where baseline.event_id = event.id
);

insert into pg_temp.document_request_created_audit_ids (audit_id)
select event.id
from public.audit_events as event
where not exists (
  select 1
  from pg_temp.document_request_audit_baseline as baseline
  where baseline.audit_id = event.id
);

insert into pg_temp.document_request_results values
  ('isolation', 'database:documents-ready', (
    select count(*)
    from public.documents as document
    where document.request_id = (select request_id from pg_temp.document_request_ids where label = 'A')
      and document.status = 'ready'
  ), 1),
  ('isolation', 'database:events-generic', (
    select case when exists (
      select 1
      from pg_temp.document_request_created_event_ids as created
      join public.matter_events as event on event.id = created.event_id
      cross join pg_temp.document_request_sensitive_values as sensitive
      where position(lower(sensitive.sensitive_text) in lower(event.event_type)) > 0
        or position(lower(sensitive.sensitive_text) in lower(event.public_text)) > 0
    ) then 0 else 1 end
  ), 1),
  ('isolation', 'database:terminal-immutable', (
    select count(*)
    from pg_temp.document_request_terminal_attempts as attempt
    where attempt.succeeded
  ), 0);

do $$
declare
  failures text;
begin
  select string_agg(
    check_name || '=' || actual::text || ' (expected ' || expected::text || ')',
    ', ' order by check_name
  )
  into failures
  from pg_temp.document_request_results
  where actual <> expected;

  if failures is not null then
    raise exception 'Document request smoke failed: %', failures;
  end if;

  if (select count(*) from pg_temp.document_request_results where category = 'authorization') <> 12
    or (select count(*) from pg_temp.document_request_results where category = 'transition') <> 8
    or (select count(*) from pg_temp.document_request_results where category = 'isolation') <> 7 then
    raise exception 'Document request smoke failed: incomplete check categories';
  end if;

  if (select count(*) from pg_temp.document_request_created_event_ids) <> 7
    or (
      select count(*)
      from pg_temp.document_request_created_event_ids as created
      join public.matter_events as event on event.id = created.event_id
      where event.event_type = 'document_request.created'
    ) <> 2
    or (
      select count(*)
      from pg_temp.document_request_created_event_ids as created
      join public.matter_events as event on event.id = created.event_id
      where event.event_type = 'document_request.submitted'
    ) <> 2
    or (
      select count(*)
      from pg_temp.document_request_created_event_ids as created
      join public.matter_events as event on event.id = created.event_id
      where event.event_type = 'document_request.changes_requested'
    ) <> 1
    or (
      select count(*)
      from pg_temp.document_request_created_event_ids as created
      join public.matter_events as event on event.id = created.event_id
      where event.event_type = 'document_request.accepted'
    ) <> 1
    or (
      select count(*)
      from pg_temp.document_request_created_event_ids as created
      join public.matter_events as event on event.id = created.event_id
      where event.event_type = 'document_request.cancelled'
    ) <> 1 then
    raise exception 'Document request smoke failed: missing request events';
  end if;

  if (select count(*) from pg_temp.document_request_created_audit_ids) <> 13
    or (
      select count(*)
      from pg_temp.document_request_created_audit_ids as created
      join public.audit_events as event on event.id = created.audit_id
      where event.action = 'matter.created'
    ) <> 2
    or (
      select count(*)
      from pg_temp.document_request_created_audit_ids as created
      join public.audit_events as event on event.id = created.audit_id
      where event.action = 'document_request.created'
    ) <> 2
    or (
      select count(*)
      from pg_temp.document_request_created_audit_ids as created
      join public.audit_events as event on event.id = created.audit_id
      where event.action = 'document_request.updated'
    ) <> 1
    or (
      select count(*)
      from pg_temp.document_request_created_audit_ids as created
      join public.audit_events as event on event.id = created.audit_id
      where event.action = 'document.created'
    ) <> 2
    or (
      select count(*)
      from pg_temp.document_request_created_audit_ids as created
      join public.audit_events as event on event.id = created.audit_id
      where event.action = 'document_request.submitted'
    ) <> 2
    or (
      select count(*)
      from pg_temp.document_request_created_audit_ids as created
      join public.audit_events as event on event.id = created.audit_id
      where event.action = 'document_request.changes_requested'
    ) <> 1
    or (
      select count(*)
      from pg_temp.document_request_created_audit_ids as created
      join public.audit_events as event on event.id = created.audit_id
      where event.action = 'document_request.file_withdrawn'
    ) <> 1
    or (
      select count(*)
      from pg_temp.document_request_created_audit_ids as created
      join public.audit_events as event on event.id = created.audit_id
      where event.action = 'document_request.accepted'
    ) <> 1
    or (
      select count(*)
      from pg_temp.document_request_created_audit_ids as created
      join public.audit_events as event on event.id = created.audit_id
      where event.action = 'document_request.cancelled'
    ) <> 1 then
    raise exception 'Document request smoke failed: missing request audits';
  end if;

  if exists (
    select 1
    from pg_temp.document_request_created_event_ids as created
    join public.matter_events as event on event.id = created.event_id
    where event.matter_id not in (
      '7a111111-1111-4111-8111-111111111111',
      '7b222222-2222-4222-8222-222222222222'
    )
      or (
        event.actor_id is not null
        and event.actor_id not in (
          '71111111-1111-4111-8111-111111111111',
          '72222222-2222-4222-8222-222222222222',
          '73333333-3333-4333-8333-333333333333',
          '74444444-4444-4444-8444-444444444444'
        )
      )
  ) then
    raise exception 'Document request smoke failed: event identifier scope';
  end if;

  if exists (
    select 1
    from pg_temp.document_request_created_audit_ids as created
    join public.audit_events as event on event.id = created.audit_id
    cross join pg_temp.document_request_sensitive_values as sensitive
    where position(lower(sensitive.sensitive_text) in lower(event.action)) > 0
      or position(lower(sensitive.sensitive_text) in lower(event.entity_type)) > 0
  ) then
    raise exception 'Document request smoke failed: audit text exposure';
  end if;

  if exists (
    select 1
    from pg_temp.document_request_created_audit_ids as created
    join public.audit_events as event on event.id = created.audit_id
    where event.organization_id <> '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      or event.matter_id is null
      or event.matter_id not in (
        '7a111111-1111-4111-8111-111111111111',
        '7b222222-2222-4222-8222-222222222222'
      )
      or event.entity_type not in ('matter', 'documents', 'document_request')
      or (
        event.actor_id is not null
        and event.actor_id not in (
          '71111111-1111-4111-8111-111111111111',
          '72222222-2222-4222-8222-222222222222',
          '73333333-3333-4333-8333-333333333333',
          '74444444-4444-4444-8444-444444444444'
        )
      )
      or event.entity_id is null
      or (
        event.entity_id not in (
          '7a111111-1111-4111-8111-111111111111',
          '7b222222-2222-4222-8222-222222222222',
          '7d111111-1111-4111-8111-111111111111',
          '7d222222-2222-4222-8222-222222222222'
        )
        and event.entity_id not in (select request_id from pg_temp.document_request_ids)
      )
  ) then
    raise exception 'Document request smoke failed: audit identifier scope';
  end if;
end;
$$;

rollback;

select json_build_object(
  'passed', true,
  'authorization_checks', 12,
  'transition_checks', 8,
  'isolation_checks', 7,
  'persistent_rows',
    (select count(*) from public.document_requests where matter_id in (
      '7a111111-1111-4111-8111-111111111111',
      '7b222222-2222-4222-8222-222222222222'
    ))
    + (select count(*) from public.documents where matter_id in (
      '7a111111-1111-4111-8111-111111111111',
      '7b222222-2222-4222-8222-222222222222'
    ))
    + (select count(*) from public.matter_events where matter_id in (
      '7a111111-1111-4111-8111-111111111111',
      '7b222222-2222-4222-8222-222222222222'
    ))
    + (select count(*) from public.audit_events where matter_id in (
      '7a111111-1111-4111-8111-111111111111',
      '7b222222-2222-4222-8222-222222222222'
    ))
    + (select count(*) from storage.objects where name like '7a111111-1111-4111-8111-111111111111/%')
) as result;
