create type public.document_request_status as enum (
  'requested',
  'submitted',
  'changes_requested',
  'accepted',
  'cancelled'
);

create table public.document_requests (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters (id) on delete cascade,
  title text not null,
  instructions text,
  due_on date,
  status public.document_request_status not null default 'requested',
  last_review_note text,
  created_by uuid not null references auth.users (id) on delete restrict,
  reviewed_by uuid references auth.users (id) on delete set null,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_requests_title_length
    check (char_length(btrim(title)) between 1 and 240),
  constraint document_requests_instructions_length
    check (instructions is null or char_length(btrim(instructions)) between 1 and 2000),
  constraint document_requests_review_note_length
    check (last_review_note is null or char_length(btrim(last_review_note)) between 1 and 2000),
  constraint document_requests_changes_note_required
    check (status <> 'changes_requested' or last_review_note is not null)
);

create index document_requests_matter_status_due_idx
  on public.document_requests (matter_id, status, due_on);
create index document_requests_created_by_idx
  on public.document_requests (created_by);
create index document_requests_reviewed_by_idx
  on public.document_requests (reviewed_by)
  where reviewed_by is not null;

alter table public.documents
  add column request_id uuid references public.document_requests (id);

create index documents_request_created_idx
  on public.documents (request_id, created_at desc)
  where request_id is not null;

create trigger document_requests_set_updated_at
before update on public.document_requests
for each row execute function private.set_updated_at();

alter table public.document_requests enable row level security;
alter table public.document_requests force row level security;

revoke all on table public.document_requests from public, anon, authenticated;
grant select (
  id,
  matter_id,
  title,
  instructions,
  due_on,
  status,
  last_review_note,
  submitted_at,
  reviewed_at,
  created_at,
  updated_at
) on table public.document_requests to authenticated;

create policy document_requests_select_accessible
on public.document_requests for select
to authenticated
using ((select private.can_access_matter(document_requests.matter_id)));

drop policy if exists documents_insert_accessible on public.documents;
create policy documents_insert_accessible
on public.documents for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and request_id is null
  and storage_path like matter_id::text || '/%'
  and (select private.can_access_matter(documents.matter_id))
);

create or replace function private.is_matter_client(target_matter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.matter_participants as participant
      where participant.matter_id = target_matter_id
        and participant.user_id = (select auth.uid())
        and participant.role = 'client'
    );
$$;

create or replace function private.record_document_request_activity(
  target_request_id uuid,
  safe_action text,
  safe_public_text text,
  target_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_matter_id uuid;
  target_organization_id uuid;
begin
  select request.matter_id, matter.organization_id
  into target_matter_id, target_organization_id
  from public.document_requests as request
  join public.matters as matter on matter.id = request.matter_id
  where request.id = target_request_id;

  if target_matter_id is null or target_organization_id is null then
    raise exception 'request_not_found';
  end if;

  if safe_public_text is not null then
    insert into public.matter_events (matter_id, event_type, public_text, actor_id)
    values (target_matter_id, safe_action, safe_public_text, target_actor_id);
  end if;

  insert into public.audit_events (
    organization_id,
    matter_id,
    actor_id,
    action,
    entity_type,
    entity_id
  ) values (
    target_organization_id,
    target_matter_id,
    target_actor_id,
    safe_action,
    'document_request',
    target_request_id
  );
end;
$$;

revoke all on function private.is_matter_client(uuid) from public, anon, authenticated;
revoke all on function private.record_document_request_activity(uuid, text, text, uuid)
from public, anon, authenticated;

create or replace function private.create_document_request(
  target_matter_id uuid,
  new_title text,
  new_instructions text,
  new_due_on date
)
returns table (
  request_id uuid,
  request_status public.document_request_status,
  request_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  normalized_title text := btrim(coalesce(new_title, ''));
  normalized_instructions text := nullif(btrim(coalesce(new_instructions, '')), '');
  created_request_id uuid;
  created_request_status public.document_request_status;
  created_request_updated_at timestamptz;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if not (select private.can_manage_matter(target_matter_id)) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if char_length(normalized_title) not between 1 and 240
    or char_length(normalized_instructions) > 2000 then
    raise exception 'request_state_changed';
  end if;

  insert into public.document_requests (
    matter_id,
    title,
    instructions,
    due_on,
    created_by
  ) values (
    target_matter_id,
    normalized_title,
    normalized_instructions,
    new_due_on,
    actor_id
  )
  returning
    document_requests.id,
    document_requests.status,
    document_requests.updated_at
  into created_request_id, created_request_status, created_request_updated_at;

  perform private.record_document_request_activity(
    created_request_id,
    'document_request.created',
    'Запрошены документы.',
    actor_id
  );

  return query select
    created_request_id,
    created_request_status,
    created_request_updated_at;
end;
$$;

create or replace function private.update_document_request(
  target_request_id uuid,
  new_title text,
  new_instructions text,
  new_due_on date
)
returns table (
  request_id uuid,
  request_status public.document_request_status,
  request_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  normalized_title text := btrim(coalesce(new_title, ''));
  normalized_instructions text := nullif(btrim(coalesce(new_instructions, '')), '');
  locked_matter_id uuid;
  locked_status public.document_request_status;
  locked_title text;
  locked_instructions text;
  locked_due_on date;
  locked_updated_at timestamptz;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if char_length(normalized_title) not between 1 and 240
    or char_length(normalized_instructions) > 2000 then
    raise exception 'request_state_changed';
  end if;

  select
    request.matter_id,
    request.status,
    request.title,
    request.instructions,
    request.due_on,
    request.updated_at
  into
    locked_matter_id,
    locked_status,
    locked_title,
    locked_instructions,
    locked_due_on,
    locked_updated_at
  from public.document_requests as request
  where request.id = target_request_id
  for update;

  if not found then
    raise exception 'request_not_found';
  end if;
  if not (select private.can_manage_matter(locked_matter_id)) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if locked_status <> 'requested' then
    raise exception 'request_state_changed';
  end if;
  if exists (
    select 1
    from public.documents as document
    where document.request_id = target_request_id
      and document.status <> 'archived'
  ) then
    raise exception 'request_state_changed';
  end if;

  if normalized_title = locked_title
    and normalized_instructions is not distinct from locked_instructions
    and new_due_on is not distinct from locked_due_on then
    return query select target_request_id, locked_status, locked_updated_at;
    return;
  end if;

  update public.document_requests as request
  set
    title = normalized_title,
    instructions = normalized_instructions,
    due_on = new_due_on
  where request.id = target_request_id
  returning request.status, request.updated_at
  into locked_status, locked_updated_at;

  perform private.record_document_request_activity(
    target_request_id,
    'document_request.updated',
    null,
    actor_id
  );

  return query select target_request_id, locked_status, locked_updated_at;
end;
$$;

create or replace function private.register_document_request_file(
  target_request_id uuid,
  new_document_id uuid,
  new_storage_path text,
  new_original_name text,
  new_mime_type text,
  new_size_bytes bigint
)
returns table (
  document_id uuid,
  request_id uuid,
  document_status public.document_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  normalized_name text := btrim(coalesce(new_original_name, ''));
  normalized_mime text := lower(btrim(coalesce(new_mime_type, '')));
  locked_matter_id uuid;
  locked_status public.document_request_status;
  existing_document public.documents%rowtype;
  active_file_count integer;
  inserted_status public.document_status;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  select request.matter_id, request.status
  into locked_matter_id, locked_status
  from public.document_requests as request
  where request.id = target_request_id
  for update;

  if not found then
    raise exception 'request_not_found';
  end if;
  if not (select private.is_matter_client(locked_matter_id)) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if new_document_id is null
    or new_size_bytes is null
    or new_size_bytes not between 1 and 10485760
    or char_length(normalized_name) not between 1 and 255
    or char_length(normalized_mime) not between 1 and 160
    or position('/' in normalized_name) > 0
    or position(chr(92) in normalized_name) > 0
    or normalized_name ~ '[[:cntrl:]]' then
    raise exception 'request_state_changed';
  end if;

  if not coalesce((
    normalized_mime = 'application/pdf'
      and new_storage_path = locked_matter_id::text || '/' || new_document_id::text || '/document.pdf'
  ) or (
    normalized_mime = 'application/msword'
      and new_storage_path = locked_matter_id::text || '/' || new_document_id::text || '/document.doc'
  ) or (
    normalized_mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      and new_storage_path = locked_matter_id::text || '/' || new_document_id::text || '/document.docx'
  ) or (
    normalized_mime = 'image/jpeg'
      and new_storage_path in (
        locked_matter_id::text || '/' || new_document_id::text || '/document.jpg',
        locked_matter_id::text || '/' || new_document_id::text || '/document.jpeg'
      )
  ) or (
    normalized_mime = 'image/png'
      and new_storage_path = locked_matter_id::text || '/' || new_document_id::text || '/document.png'
  ), false) then
    raise exception 'request_state_changed';
  end if;

  if not exists (
    select 1
    from storage.objects as object
    where object.bucket_id = 'matter-documents'
      and object.name = new_storage_path
      and object.owner_id::text = actor_id::text
      and object.metadata ->> 'size' = new_size_bytes::text
      and lower(object.metadata ->> 'mimetype') = normalized_mime
  ) then
    raise exception using errcode = '42501', message = 'storage_object_not_owned';
  end if;

  select document.*
  into existing_document
  from public.documents as document
  where document.id = new_document_id;

  if found then
    if existing_document.request_id = target_request_id
      and existing_document.matter_id = locked_matter_id
      and existing_document.storage_path = new_storage_path
      and existing_document.original_name = normalized_name
      and existing_document.mime_type = normalized_mime
      and existing_document.size_bytes = new_size_bytes
      and existing_document.uploaded_by = actor_id then
      return query select
        existing_document.id,
        existing_document.request_id,
        existing_document.status;
      return;
    end if;
    raise exception 'document_registration_conflict';
  end if;

  if locked_status not in ('requested', 'changes_requested') then
    raise exception 'request_state_changed';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_request_id::text, 0));

  select count(*)
  into active_file_count
  from public.documents as document
  where document.request_id = target_request_id
    and document.status <> 'archived';

  if active_file_count >= 20 then
    raise exception 'request_file_limit';
  end if;

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
    new_document_id,
    locked_matter_id,
    target_request_id,
    new_storage_path,
    normalized_name,
    normalized_mime,
    new_size_bytes,
    actor_id
  )
  returning documents.status into inserted_status;

  return query select new_document_id, target_request_id, inserted_status;
end;
$$;

create or replace function private.submit_document_request(target_request_id uuid)
returns table (
  request_id uuid,
  request_status public.document_request_status,
  request_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  locked_matter_id uuid;
  locked_status public.document_request_status;
  locked_updated_at timestamptz;
  active_file_count integer;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  select request.matter_id, request.status, request.updated_at
  into locked_matter_id, locked_status, locked_updated_at
  from public.document_requests as request
  where request.id = target_request_id
  for update;

  if not found then
    raise exception 'request_not_found';
  end if;
  if not (select private.is_matter_client(locked_matter_id)) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if locked_status = 'submitted' then
    return query select target_request_id, locked_status, locked_updated_at;
    return;
  end if;
  if locked_status not in ('requested', 'changes_requested') then
    raise exception 'request_state_changed';
  end if;

  select count(*)
  into active_file_count
  from public.documents as document
  where document.request_id = target_request_id
    and document.status <> 'archived';

  if active_file_count < 1 then
    raise exception 'request_file_required';
  end if;
  if active_file_count > 20 then
    raise exception 'request_file_limit';
  end if;

  update public.document_requests as request
  set
    status = 'submitted',
    submitted_at = now()
  where request.id = target_request_id
  returning request.status, request.updated_at
  into locked_status, locked_updated_at;

  perform private.record_document_request_activity(
    target_request_id,
    'document_request.submitted',
    'Комплект документов отправлен на проверку.',
    actor_id
  );

  return query select target_request_id, locked_status, locked_updated_at;
end;
$$;

create or replace function private.review_document_request(
  target_request_id uuid,
  new_decision public.document_request_status,
  new_note text
)
returns table (
  request_id uuid,
  request_status public.document_request_status,
  request_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  normalized_note text;
  locked_matter_id uuid;
  locked_status public.document_request_status;
  locked_note text;
  locked_updated_at timestamptz;
  safe_action text;
  safe_public_text text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if new_decision is null or new_decision not in ('accepted', 'changes_requested') then
    raise exception 'request_state_changed';
  end if;

  normalized_note := case
    when new_decision = 'changes_requested'
      then nullif(btrim(coalesce(new_note, '')), '')
    else null
  end;

  if new_decision = 'changes_requested' and normalized_note is null then
    raise exception 'request_review_note_required';
  end if;
  if char_length(normalized_note) > 2000 then
    raise exception 'request_review_note_required';
  end if;

  select
    request.matter_id,
    request.status,
    request.last_review_note,
    request.updated_at
  into locked_matter_id, locked_status, locked_note, locked_updated_at
  from public.document_requests as request
  where request.id = target_request_id
  for update;

  if not found then
    raise exception 'request_not_found';
  end if;
  if not (select private.can_manage_matter(locked_matter_id)) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if locked_status = new_decision
    and (
      new_decision = 'accepted'
      or locked_note is not distinct from normalized_note
    ) then
    return query select target_request_id, locked_status, locked_updated_at;
    return;
  end if;
  if locked_status <> 'submitted' then
    raise exception 'request_state_changed';
  end if;

  update public.document_requests as request
  set
    status = new_decision,
    last_review_note = case
      when new_decision = 'accepted' then locked_note
      else normalized_note
    end,
    reviewed_by = actor_id,
    reviewed_at = now()
  where request.id = target_request_id
  returning request.status, request.updated_at
  into locked_status, locked_updated_at;

  if new_decision = 'accepted' then
    update public.documents as document
    set status = 'ready'
    where document.request_id = target_request_id
      and document.status <> 'archived';
    safe_action := 'document_request.accepted';
    safe_public_text := 'Комплект документов принят.';
  else
    safe_action := 'document_request.changes_requested';
    safe_public_text := 'Комплект документов возвращён на исправление.';
  end if;

  perform private.record_document_request_activity(
    target_request_id,
    safe_action,
    safe_public_text,
    actor_id
  );

  return query select target_request_id, locked_status, locked_updated_at;
end;
$$;

create or replace function private.cancel_document_request(target_request_id uuid)
returns table (
  request_id uuid,
  request_status public.document_request_status,
  request_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  locked_matter_id uuid;
  locked_status public.document_request_status;
  locked_updated_at timestamptz;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  select request.matter_id, request.status, request.updated_at
  into locked_matter_id, locked_status, locked_updated_at
  from public.document_requests as request
  where request.id = target_request_id
  for update;

  if not found then
    raise exception 'request_not_found';
  end if;
  if not (select private.can_manage_matter(locked_matter_id)) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if locked_status = 'cancelled' then
    return query select target_request_id, locked_status, locked_updated_at;
    return;
  end if;
  if locked_status not in ('requested', 'submitted', 'changes_requested') then
    raise exception 'request_state_changed';
  end if;

  update public.document_requests as request
  set
    status = 'cancelled',
    reviewed_by = actor_id,
    reviewed_at = now()
  where request.id = target_request_id
  returning request.status, request.updated_at
  into locked_status, locked_updated_at;

  perform private.record_document_request_activity(
    target_request_id,
    'document_request.cancelled',
    'Запрос документов отменён.',
    actor_id
  );

  return query select target_request_id, locked_status, locked_updated_at;
end;
$$;

create or replace function private.withdraw_document_request_file(
  target_request_id uuid,
  target_document_id uuid
)
returns table (
  request_id uuid,
  request_status public.document_request_status,
  document_id uuid,
  document_status public.document_status,
  request_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  locked_matter_id uuid;
  locked_request_status public.document_request_status;
  locked_request_updated_at timestamptz;
  locked_document_status public.document_status;
  locked_uploader_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  select request.matter_id, request.status, request.updated_at
  into locked_matter_id, locked_request_status, locked_request_updated_at
  from public.document_requests as request
  where request.id = target_request_id
  for update;

  if not found then
    raise exception 'request_not_found';
  end if;
  if not (select private.is_matter_client(locked_matter_id)) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  select document.status, document.uploaded_by
  into locked_document_status, locked_uploader_id
  from public.documents as document
  where document.id = target_document_id
    and document.request_id = target_request_id
  for update;

  if not found then
    raise exception 'request_file_not_found';
  end if;
  if locked_uploader_id is distinct from actor_id then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if locked_document_status = 'archived' then
    return query select
      target_request_id,
      locked_request_status,
      target_document_id,
      locked_document_status,
      locked_request_updated_at;
    return;
  end if;
  if locked_request_status not in ('requested', 'changes_requested') then
    raise exception 'request_state_changed';
  end if;

  update public.documents as document
  set status = 'archived'
  where document.id = target_document_id
  returning document.status into locked_document_status;

  perform private.record_document_request_activity(
    target_request_id,
    'document_request.file_withdrawn',
    null,
    actor_id
  );

  return query select
    target_request_id,
    locked_request_status,
    target_document_id,
    locked_document_status,
    locked_request_updated_at;
end;
$$;

create or replace function public.create_document_request(
  target_matter_id uuid,
  new_title text,
  new_instructions text,
  new_due_on date
)
returns table (
  request_id uuid,
  request_status public.document_request_status,
  request_updated_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_document_request($1, $2, $3, $4);
$$;

create or replace function public.update_document_request(
  target_request_id uuid,
  new_title text,
  new_instructions text,
  new_due_on date
)
returns table (
  request_id uuid,
  request_status public.document_request_status,
  request_updated_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.update_document_request($1, $2, $3, $4);
$$;

create or replace function public.register_document_request_file(
  target_request_id uuid,
  new_document_id uuid,
  new_storage_path text,
  new_original_name text,
  new_mime_type text,
  new_size_bytes bigint
)
returns table (
  document_id uuid,
  request_id uuid,
  document_status public.document_status
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.register_document_request_file($1, $2, $3, $4, $5, $6);
$$;

create or replace function public.submit_document_request(target_request_id uuid)
returns table (
  request_id uuid,
  request_status public.document_request_status,
  request_updated_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.submit_document_request($1);
$$;

create or replace function public.review_document_request(
  target_request_id uuid,
  new_decision public.document_request_status,
  new_note text
)
returns table (
  request_id uuid,
  request_status public.document_request_status,
  request_updated_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.review_document_request($1, $2, $3);
$$;

create or replace function public.cancel_document_request(target_request_id uuid)
returns table (
  request_id uuid,
  request_status public.document_request_status,
  request_updated_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.cancel_document_request($1);
$$;

create or replace function public.withdraw_document_request_file(
  target_request_id uuid,
  target_document_id uuid
)
returns table (
  request_id uuid,
  request_status public.document_request_status,
  document_id uuid,
  document_status public.document_status,
  request_updated_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.withdraw_document_request_file($1, $2);
$$;

revoke all on function private.create_document_request(uuid, text, text, date)
from public, anon, authenticated;
grant execute on function private.create_document_request(uuid, text, text, date)
to authenticated;

revoke all on function private.update_document_request(uuid, text, text, date)
from public, anon, authenticated;
grant execute on function private.update_document_request(uuid, text, text, date)
to authenticated;

revoke all on function private.register_document_request_file(uuid, uuid, text, text, text, bigint)
from public, anon, authenticated;
grant execute on function private.register_document_request_file(uuid, uuid, text, text, text, bigint)
to authenticated;

revoke all on function private.submit_document_request(uuid)
from public, anon, authenticated;
grant execute on function private.submit_document_request(uuid)
to authenticated;

revoke all on function private.review_document_request(uuid, public.document_request_status, text)
from public, anon, authenticated;
grant execute on function private.review_document_request(uuid, public.document_request_status, text)
to authenticated;

revoke all on function private.cancel_document_request(uuid)
from public, anon, authenticated;
grant execute on function private.cancel_document_request(uuid)
to authenticated;

revoke all on function private.withdraw_document_request_file(uuid, uuid)
from public, anon, authenticated;
grant execute on function private.withdraw_document_request_file(uuid, uuid)
to authenticated;

revoke all on function public.create_document_request(uuid, text, text, date)
from public, anon, authenticated;
grant execute on function public.create_document_request(uuid, text, text, date)
to authenticated;

revoke all on function public.update_document_request(uuid, text, text, date)
from public, anon, authenticated;
grant execute on function public.update_document_request(uuid, text, text, date)
to authenticated;

revoke all on function public.register_document_request_file(uuid, uuid, text, text, text, bigint)
from public, anon, authenticated;
grant execute on function public.register_document_request_file(uuid, uuid, text, text, text, bigint)
to authenticated;

revoke all on function public.submit_document_request(uuid)
from public, anon, authenticated;
grant execute on function public.submit_document_request(uuid)
to authenticated;

revoke all on function public.review_document_request(uuid, public.document_request_status, text)
from public, anon, authenticated;
grant execute on function public.review_document_request(uuid, public.document_request_status, text)
to authenticated;

revoke all on function public.cancel_document_request(uuid)
from public, anon, authenticated;
grant execute on function public.cancel_document_request(uuid)
to authenticated;

revoke all on function public.withdraw_document_request_file(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.withdraw_document_request_file(uuid, uuid)
to authenticated;

comment on function public.create_document_request(uuid, text, text, date)
is 'Creates a document request after checking matter-management access.';
comment on function public.update_document_request(uuid, text, text, date)
is 'Updates untouched requested-state metadata after checking management access.';
comment on function public.register_document_request_file(uuid, uuid, text, text, text, bigint)
is 'Registers an owned Storage object in an editable document request.';
comment on function public.submit_document_request(uuid)
is 'Submits an editable client document request for staff review.';
comment on function public.review_document_request(uuid, public.document_request_status, text)
is 'Accepts or returns a submitted document request after checking management access.';
comment on function public.cancel_document_request(uuid)
is 'Cancels a non-terminal document request after checking management access.';
comment on function public.withdraw_document_request_file(uuid, uuid)
is 'Soft-archives a client-owned file while its request is editable.';
