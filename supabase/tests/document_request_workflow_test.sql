begin;
select plan(36);

insert into auth.users (
  id,
  aud,
  role,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (id, display_name) values
  ('10000000-0000-4000-8000-000000000001', 'Workflow admin'),
  ('10000000-0000-4000-8000-000000000002', 'Workflow client'),
  ('10000000-0000-4000-8000-000000000003', 'Outside client');

insert into public.organizations (id, name)
values ('20000000-0000-4000-8000-000000000001', 'Document workflow test');

insert into public.organization_members (organization_id, user_id, role)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'admin'
);

insert into public.matters (id, organization_id, reference, title, created_by)
values (
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'DOC-WORKFLOW-1',
  'Document workflow matter',
  '10000000-0000-4000-8000-000000000001'
);

insert into public.matter_participants (matter_id, user_id, role)
values (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'client'
);

create temporary table workflow_state (
  request_id uuid primary key
) on commit drop;
create temporary table request_calls (
  call_name text not null,
  request_status public.document_request_status not null
) on commit drop;
create temporary table file_calls (
  call_name text not null,
  document_id uuid not null,
  document_status public.document_status not null
) on commit drop;

grant select, insert, update on table pg_temp.workflow_state to authenticated;
grant select, insert on table pg_temp.request_calls to authenticated;
grant select, insert on table pg_temp.file_calls to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
insert into pg_temp.workflow_state (request_id)
select created.request_id
from public.create_document_request(
  '30000000-0000-4000-8000-000000000001',
  '  Паспорт и договор  ',
  '  Загрузите полный комплект.  ',
  '2026-09-15'
) as created;
reset role;

select is(
  (select request.status::text from public.document_requests as request join pg_temp.workflow_state as state on state.request_id = request.id),
  'requested',
  'manager creates a requested document request'
);
select is(
  (
    select request.title || '|' || request.instructions || '|' || request.due_on::text
    from public.document_requests as request
    join pg_temp.workflow_state as state on state.request_id = request.id
  ),
  'Паспорт и договор|Загрузите полный комплект.|2026-09-15',
  'create normalizes request metadata'
);
select is(
  (
    select count(*)::bigint
    from public.matter_events as event
    join pg_temp.workflow_state as state on state.request_id::text is not null
    where event.matter_id = '30000000-0000-4000-8000-000000000001'
      and event.event_type = 'document_request.created'
  ),
  1::bigint,
  'create records one generic client event'
);
select is(
  (
    select count(*)::bigint
    from public.audit_events as event
    join pg_temp.workflow_state as state on state.request_id = event.entity_id
    where event.action = 'document_request.created'
  ),
  1::bigint,
  'create records one technical audit event'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
insert into pg_temp.request_calls (call_name, request_status)
select 'update', updated.request_status
from pg_temp.workflow_state as state
cross join lateral public.update_document_request(
  state.request_id,
  'Паспорт, договор и приложение',
  'Загрузите полный комплект.',
  '2026-09-16'
) as updated;
insert into pg_temp.request_calls (call_name, request_status)
select 'update_retry', updated.request_status
from pg_temp.workflow_state as state
cross join lateral public.update_document_request(
  state.request_id,
  'Паспорт, договор и приложение',
  'Загрузите полный комплект.',
  '2026-09-16'
) as updated;
reset role;

select is(
  (select request.title from public.document_requests as request join pg_temp.workflow_state as state on state.request_id = request.id),
  'Паспорт, договор и приложение',
  'manager updates untouched request metadata'
);
select is(
  (select count(*)::bigint from public.matter_events as event where event.event_type = 'document_request.updated'),
  0::bigint,
  'metadata updates do not copy text into the client timeline'
);
select is(
  (select count(*)::bigint from public.audit_events as event where event.action = 'document_request.updated'),
  1::bigint,
  'an identical metadata retry does not duplicate audit records'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::bigint from public.document_requests),
  1::bigint,
  'assigned client can read the request'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select is(
  (select count(*)::bigint from public.document_requests),
  0::bigint,
  'unrelated client cannot read the request'
);
select throws_ok(
  (
    select format('select * from public.submit_document_request(%L::uuid)', state.request_id)
    from pg_temp.workflow_state as state
  ),
  '42501',
  'not_authorized',
  'unrelated client cannot submit the request'
);
reset role;

insert into storage.objects (id, bucket_id, name, owner_id, metadata)
values (
  '50000000-0000-4000-8000-000000000001',
  'matter-documents',
  '30000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/document.pdf',
  '10000000-0000-4000-8000-000000000002',
  jsonb_build_object('size', 128, 'mimetype', 'application/pdf')
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
insert into pg_temp.file_calls (call_name, document_id, document_status)
select 'register', registered.document_id, registered.document_status
from pg_temp.workflow_state as state
cross join lateral public.register_document_request_file(
  state.request_id,
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/document.pdf',
  'client-secret-passport.pdf',
  'application/pdf',
  128
) as registered;
insert into pg_temp.file_calls (call_name, document_id, document_status)
select 'register_retry', registered.document_id, registered.document_status
from pg_temp.workflow_state as state
cross join lateral public.register_document_request_file(
  state.request_id,
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/document.pdf',
  'client-secret-passport.pdf',
  'application/pdf',
  128
) as registered;
reset role;

select is((select count(*)::bigint from pg_temp.file_calls), 2::bigint, 'file registration retries return the existing row');
select is(
  (select count(*)::bigint from public.documents as document where document.id = '40000000-0000-4000-8000-000000000001'),
  1::bigint,
  'file registration is idempotent'
);
select is(
  (select count(*)::bigint from public.audit_events as event where event.action = 'document.created' and event.entity_id = '40000000-0000-4000-8000-000000000001'),
  1::bigint,
  'file registration creates one document audit record'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
insert into pg_temp.request_calls (call_name, request_status)
select 'submit', submitted.request_status
from pg_temp.workflow_state as state
cross join lateral public.submit_document_request(state.request_id) as submitted;
insert into pg_temp.request_calls (call_name, request_status)
select 'submit_retry', submitted.request_status
from pg_temp.workflow_state as state
cross join lateral public.submit_document_request(state.request_id) as submitted;
reset role;

select is(
  (select count(*)::bigint from pg_temp.request_calls as call where call.call_name in ('submit', 'submit_retry')),
  2::bigint,
  'submit retries return the submitted request'
);
select is(
  (select request.status::text from public.document_requests as request join pg_temp.workflow_state as state on state.request_id = request.id),
  'submitted',
  'client submits an editable request with a file'
);
select is(
  (select count(*)::bigint from public.matter_events as event where event.event_type = 'document_request.submitted'),
  1::bigint,
  'submit retry does not duplicate timeline events'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
insert into pg_temp.request_calls (call_name, request_status)
select 'changes', reviewed.request_status
from pg_temp.workflow_state as state
cross join lateral public.review_document_request(
  state.request_id,
  'changes_requested',
  '  Замените нечитаемую страницу.  '
) as reviewed;
insert into pg_temp.request_calls (call_name, request_status)
select 'changes_retry', reviewed.request_status
from pg_temp.workflow_state as state
cross join lateral public.review_document_request(
  state.request_id,
  'changes_requested',
  'Замените нечитаемую страницу.'
) as reviewed;
reset role;

select is(
  (select count(*)::bigint from pg_temp.request_calls as call where call.call_name in ('changes', 'changes_retry')),
  2::bigint,
  'review retries return the existing decision'
);
select is(
  (
    select request.status::text || '|' || request.last_review_note
    from public.document_requests as request
    join pg_temp.workflow_state as state on state.request_id = request.id
  ),
  'changes_requested|Замените нечитаемую страницу.',
  'manager returns the request with a normalized client note'
);
select is(
  (select count(*)::bigint from public.matter_events as event where event.event_type = 'document_request.changes_requested'),
  1::bigint,
  'review retry does not duplicate timeline events'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
insert into pg_temp.file_calls (call_name, document_id, document_status)
select 'withdraw', withdrawn.document_id, withdrawn.document_status
from pg_temp.workflow_state as state
cross join lateral public.withdraw_document_request_file(
  state.request_id,
  '40000000-0000-4000-8000-000000000001'
) as withdrawn;
insert into pg_temp.file_calls (call_name, document_id, document_status)
select 'withdraw_retry', withdrawn.document_id, withdrawn.document_status
from pg_temp.workflow_state as state
cross join lateral public.withdraw_document_request_file(
  state.request_id,
  '40000000-0000-4000-8000-000000000001'
) as withdrawn;
reset role;

select is(
  (select count(*)::bigint from pg_temp.file_calls as call where call.call_name in ('withdraw', 'withdraw_retry')),
  2::bigint,
  'withdraw retries return the archived document'
);
select is(
  (select document.status::text from public.documents as document where document.id = '40000000-0000-4000-8000-000000000001'),
  'archived',
  'client can archive an editable request file'
);
select is(
  (select count(*)::bigint from public.audit_events as event where event.action = 'document_request.file_withdrawn'),
  1::bigint,
  'withdraw retry does not duplicate audit records'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select throws_ok(
  (
    select format('select * from public.submit_document_request(%L::uuid)', state.request_id)
    from pg_temp.workflow_state as state
  ),
  'P0001',
  'request_file_required',
  'client cannot resubmit without an active file'
);
reset role;

insert into storage.objects (id, bucket_id, name, owner_id, metadata)
values (
  '50000000-0000-4000-8000-000000000002',
  'matter-documents',
  '30000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000002/document.pdf',
  '10000000-0000-4000-8000-000000000002',
  jsonb_build_object('size', 256, 'mimetype', 'application/pdf')
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
insert into pg_temp.file_calls (call_name, document_id, document_status)
select 'register_replacement', registered.document_id, registered.document_status
from pg_temp.workflow_state as state
cross join lateral public.register_document_request_file(
  state.request_id,
  '40000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000002/document.pdf',
  'replacement.pdf',
  'application/pdf',
  256
) as registered;
insert into pg_temp.request_calls (call_name, request_status)
select 'resubmit', submitted.request_status
from pg_temp.workflow_state as state
cross join lateral public.submit_document_request(state.request_id) as submitted;
reset role;

select is(
  (select count(*)::bigint from public.documents as document join pg_temp.workflow_state as state on state.request_id = document.request_id),
  2::bigint,
  'replacement registration preserves archived history'
);
select is(
  (select request.status::text from public.document_requests as request join pg_temp.workflow_state as state on state.request_id = request.id),
  'submitted',
  'client resubmits the replacement file'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select throws_ok(
  (
    select format(
      'select * from public.review_document_request(%L::uuid, null, null)',
      state.request_id
    )
    from pg_temp.workflow_state as state
  ),
  'P0001',
  'request_state_changed',
  'manager must provide a supported review decision'
);
insert into pg_temp.request_calls (call_name, request_status)
select 'accept', reviewed.request_status
from pg_temp.workflow_state as state
cross join lateral public.review_document_request(state.request_id, 'accepted', 'ignored') as reviewed;
insert into pg_temp.request_calls (call_name, request_status)
select 'accept_retry', reviewed.request_status
from pg_temp.workflow_state as state
cross join lateral public.review_document_request(state.request_id, 'accepted', null) as reviewed;
reset role;

select is(
  (select count(*)::bigint from pg_temp.request_calls as call where call.call_name in ('accept', 'accept_retry')),
  2::bigint,
  'accept retries return the accepted request'
);
select is(
  (select request.status::text from public.document_requests as request join pg_temp.workflow_state as state on state.request_id = request.id),
  'accepted',
  'manager accepts the resubmitted request'
);
select is(
  (
    select request.status::text || '|' || request.last_review_note
    from public.document_requests as request
    join pg_temp.workflow_state as state on state.request_id = request.id
  ),
  'accepted|Замените нечитаемую страницу.',
  'accept preserves the most recent correction note'
);
select is(
  (select document.status::text from public.documents as document where document.id = '40000000-0000-4000-8000-000000000002'),
  'ready',
  'accept marks the active replacement ready'
);
select is(
  (select document.status::text from public.documents as document where document.id = '40000000-0000-4000-8000-000000000001'),
  'archived',
  'accept leaves withdrawn history archived'
);
select is(
  (select count(*)::bigint from public.matter_events as event where event.event_type = 'document_request.accepted'),
  1::bigint,
  'accept retry does not duplicate timeline events'
);
select is(
  (select count(*)::bigint from public.audit_events as event where event.action = 'document_request.accepted'),
  1::bigint,
  'accept retry does not duplicate audit records'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select throws_ok(
  (
    select format(
      'select * from public.withdraw_document_request_file(%L::uuid, %L::uuid)',
      state.request_id,
      '40000000-0000-4000-8000-000000000002'
    )
    from pg_temp.workflow_state as state
  ),
  'P0001',
  'request_state_changed',
  'client cannot withdraw an accepted file'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select throws_ok(
  (
    select format('select * from public.cancel_document_request(%L::uuid)', state.request_id)
    from pg_temp.workflow_state as state
  ),
  'P0001',
  'request_state_changed',
  'manager cannot cancel an accepted request'
);
reset role;

select ok(
  not exists (
    select 1
    from public.matter_events as event
    where event.event_type like 'document_request.%'
      and (
        event.public_text ilike '%Паспорт%'
        or event.public_text ilike '%client-secret%'
        or event.public_text ilike '%нечитаемую%'
      )
  ),
  'timeline events never copy request, file, or review text'
);

select * from finish();
rollback;
