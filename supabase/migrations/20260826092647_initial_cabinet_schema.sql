create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create type public.organization_role as enum ('admin', 'lawyer');
create type public.matter_participant_role as enum ('client', 'lawyer');
create type public.matter_status as enum ('active', 'paused', 'completed', 'archived');
create type public.matter_stage_status as enum ('future', 'current', 'complete');
create type public.document_status as enum ('received', 'reviewing', 'ready', 'archived');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Клиент',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 120)
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  constraint organizations_name_length check (char_length(btrim(name)) between 1 and 160)
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.organization_role not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_id_idx
  on public.organization_members (user_id);

create table public.matters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  reference text not null,
  title text not null,
  summary text not null default '',
  status public.matter_status not null default 'active',
  response_due_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matters_reference_length check (char_length(btrim(reference)) between 1 and 80),
  constraint matters_title_length check (char_length(btrim(title)) between 1 and 240),
  constraint matters_summary_length check (char_length(summary) <= 5000),
  unique (organization_id, reference)
);

create index matters_organization_status_updated_idx
  on public.matters (organization_id, status, updated_at desc);
create index matters_created_by_idx
  on public.matters (created_by)
  where created_by is not null;

create table public.matter_participants (
  matter_id uuid not null references public.matters (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.matter_participant_role not null,
  created_at timestamptz not null default now(),
  primary key (matter_id, user_id)
);

create index matter_participants_user_id_idx
  on public.matter_participants (user_id);

create table public.matter_stages (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters (id) on delete cascade,
  position smallint not null,
  title text not null,
  detail text not null default '',
  status public.matter_stage_status not null default 'future',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matter_stages_position_positive check (position > 0),
  constraint matter_stages_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint matter_stages_detail_length check (char_length(detail) <= 1000),
  unique (matter_id, position)
);

create unique index matter_stages_one_current_idx
  on public.matter_stages (matter_id)
  where status = 'current';

create table public.matter_events (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters (id) on delete cascade,
  event_type text not null,
  public_text text not null,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint matter_events_type_length check (char_length(btrim(event_type)) between 1 and 80),
  constraint matter_events_public_text_length check (char_length(btrim(public_text)) between 1 and 2000)
);

create index matter_events_matter_created_idx
  on public.matter_events (matter_id, created_at desc);
create index matter_events_actor_id_idx
  on public.matter_events (actor_id)
  where actor_id is not null;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters (id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  status public.document_status not null default 'received',
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_storage_path_length check (char_length(btrim(storage_path)) between 1 and 1000),
  constraint documents_original_name_length check (char_length(btrim(original_name)) between 1 and 255),
  constraint documents_mime_type_length check (char_length(btrim(mime_type)) between 1 and 160),
  constraint documents_size_range check (size_bytes between 1 and 10485760)
);

create index documents_matter_created_idx
  on public.documents (matter_id, created_at desc);
create index documents_uploaded_by_idx
  on public.documents (uploaded_by)
  where uploaded_by is not null;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint messages_body_length check (char_length(btrim(body)) between 1 and 6000)
);

create index messages_matter_created_idx
  on public.messages (matter_id, created_at desc);
create index messages_author_id_idx
  on public.messages (author_id);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  matter_id uuid references public.matters (id) on delete set null,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  created_at timestamptz not null default now(),
  constraint audit_events_action_length check (char_length(btrim(action)) between 1 and 80),
  constraint audit_events_entity_type_length check (char_length(btrim(entity_type)) between 1 and 80)
);

create index audit_events_organization_created_idx
  on public.audit_events (organization_id, created_at desc);
create index audit_events_matter_created_idx
  on public.audit_events (matter_id, created_at desc)
  where matter_id is not null;
create index audit_events_actor_id_idx
  on public.audit_events (actor_id)
  where actor_id is not null;

create or replace function private.is_org_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.organization_members as om
      where om.organization_id = target_organization_id
        and om.user_id = (select auth.uid())
        and om.role = 'admin'
    );
$$;

create or replace function private.can_access_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.organization_members as om
        where om.organization_id = target_organization_id
          and om.user_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.matters as m
        join public.matter_participants as mp on mp.matter_id = m.id
        where m.organization_id = target_organization_id
          and mp.user_id = (select auth.uid())
      )
    );
$$;

create or replace function private.can_access_matter(target_matter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.matter_participants as mp
        where mp.matter_id = target_matter_id
          and mp.user_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.matters as m
        join public.organization_members as om
          on om.organization_id = m.organization_id
        where m.id = target_matter_id
          and om.user_id = (select auth.uid())
          and om.role = 'admin'
      )
    );
$$;

create or replace function private.can_manage_matter(target_matter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.matter_participants as mp
        where mp.matter_id = target_matter_id
          and mp.user_id = (select auth.uid())
          and mp.role = 'lawyer'
      )
      or exists (
        select 1
        from public.matters as m
        join public.organization_members as om
          on om.organization_id = m.organization_id
        where m.id = target_matter_id
          and om.user_id = (select auth.uid())
          and om.role = 'admin'
      )
    );
$$;

create or replace function private.can_access_matter_text(target_matter_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.matters as m
      where m.id::text = target_matter_id
        and (
          exists (
            select 1
            from public.matter_participants as mp
            where mp.matter_id = m.id
              and mp.user_id = (select auth.uid())
          )
          or exists (
            select 1
            from public.organization_members as om
            where om.organization_id = m.organization_id
              and om.user_id = (select auth.uid())
              and om.role = 'admin'
          )
        )
    );
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger matters_set_updated_at
before update on public.matters
for each row execute function private.set_updated_at();

create trigger matter_stages_set_updated_at
before update on public.matter_stages
for each row execute function private.set_updated_at();

create trigger documents_set_updated_at
before update on public.documents
for each row execute function private.set_updated_at();

create or replace function private.record_matter_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (
    organization_id,
    matter_id,
    actor_id,
    action,
    entity_type,
    entity_id
  ) values (
    new.organization_id,
    new.id,
    (select auth.uid()),
    case when tg_op = 'INSERT' then 'matter.created' else 'matter.updated' end,
    'matter',
    new.id
  );
  return new;
end;
$$;

create trigger matters_record_audit
after insert or update on public.matters
for each row execute function private.record_matter_audit();

create or replace function private.record_child_insert_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
begin
  select m.organization_id
  into target_organization_id
  from public.matters as m
  where m.id = new.matter_id;

  insert into public.audit_events (
    organization_id,
    matter_id,
    actor_id,
    action,
    entity_type,
    entity_id
  ) values (
    target_organization_id,
    new.matter_id,
    (select auth.uid()),
    case tg_table_name
      when 'documents' then 'document.created'
      when 'messages' then 'message.created'
      else 'entity.created'
    end,
    tg_table_name,
    new.id
  );
  return new;
end;
$$;

create trigger documents_record_audit
after insert on public.documents
for each row execute function private.record_child_insert_audit();

create trigger messages_record_audit
after insert on public.messages
for each row execute function private.record_child_insert_audit();

revoke execute on function private.set_updated_at() from public, anon, authenticated;
revoke execute on function private.record_matter_audit() from public, anon, authenticated;
revoke execute on function private.record_child_insert_audit() from public, anon, authenticated;
revoke execute on function private.is_org_admin(uuid) from public, anon, authenticated;
revoke execute on function private.can_access_organization(uuid) from public, anon, authenticated;
revoke execute on function private.can_access_matter(uuid) from public, anon, authenticated;
revoke execute on function private.can_manage_matter(uuid) from public, anon, authenticated;
revoke execute on function private.can_access_matter_text(text) from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.matters enable row level security;
alter table public.matter_participants enable row level security;
alter table public.matter_stages enable row level security;
alter table public.matter_events enable row level security;
alter table public.documents enable row level security;
alter table public.messages enable row level security;
alter table public.audit_events enable row level security;

alter table public.profiles force row level security;
alter table public.organizations force row level security;
alter table public.organization_members force row level security;
alter table public.matters force row level security;
alter table public.matter_participants force row level security;
alter table public.matter_stages force row level security;
alter table public.matter_events force row level security;
alter table public.documents force row level security;
alter table public.messages force row level security;
alter table public.audit_events force row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.organization_members from anon, authenticated;
revoke all on table public.matters from anon, authenticated;
revoke all on table public.matter_participants from anon, authenticated;
revoke all on table public.matter_stages from anon, authenticated;
revoke all on table public.matter_events from anon, authenticated;
revoke all on table public.documents from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select on table public.organizations to authenticated;
grant select on table public.organization_members to authenticated;
grant select, update on table public.matters to authenticated;
grant select on table public.matter_participants to authenticated;
grant select, insert, update, delete on table public.matter_stages to authenticated;
grant select, insert on table public.matter_events to authenticated;
grant select, insert on table public.documents to authenticated;
grant select, insert on table public.messages to authenticated;
grant select on table public.audit_events to authenticated;

create policy profiles_select_own
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_insert_own
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

create policy profiles_update_own
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy organization_members_select_own
on public.organization_members for select
to authenticated
using ((select auth.uid()) = user_id);

create policy matter_participants_select_own
on public.matter_participants for select
to authenticated
using ((select auth.uid()) = user_id);

create policy organizations_select_accessible
on public.organizations for select
to authenticated
using ((select private.can_access_organization(organizations.id)));

create policy matters_select_accessible
on public.matters for select
to authenticated
using ((select private.can_access_matter(matters.id)));

create policy matters_update_managers
on public.matters for update
to authenticated
using ((select private.can_manage_matter(matters.id)))
with check ((select private.can_manage_matter(matters.id)));

create policy matter_stages_select_accessible
on public.matter_stages for select
to authenticated
using ((select private.can_access_matter(matter_stages.matter_id)));

create policy matter_stages_insert_managers
on public.matter_stages for insert
to authenticated
with check ((select private.can_manage_matter(matter_stages.matter_id)));

create policy matter_stages_update_managers
on public.matter_stages for update
to authenticated
using ((select private.can_manage_matter(matter_stages.matter_id)))
with check ((select private.can_manage_matter(matter_stages.matter_id)));

create policy matter_stages_delete_managers
on public.matter_stages for delete
to authenticated
using ((select private.can_manage_matter(matter_stages.matter_id)));

create policy matter_events_select_accessible
on public.matter_events for select
to authenticated
using ((select private.can_access_matter(matter_events.matter_id)));

create policy matter_events_insert_managers
on public.matter_events for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and (select private.can_manage_matter(matter_events.matter_id))
);

create policy documents_select_accessible
on public.documents for select
to authenticated
using ((select private.can_access_matter(documents.matter_id)));

create policy documents_insert_accessible
on public.documents for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and storage_path like matter_id::text || '/%'
  and (select private.can_access_matter(documents.matter_id))
);

create policy messages_select_accessible
on public.messages for select
to authenticated
using ((select private.can_access_matter(messages.matter_id)));

create policy messages_insert_accessible
on public.messages for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and (select private.can_access_matter(messages.matter_id))
);

create policy audit_events_select_org_admins
on public.audit_events for select
to authenticated
using ((select private.is_org_admin(audit_events.organization_id)));

insert into public.organizations (name)
values ('ДоговорОфф')
on conflict (name) do nothing;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'matter-documents',
  'matter-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy matter_documents_select_accessible
on storage.objects for select
to authenticated
using (
  bucket_id = 'matter-documents'
  and (select private.can_access_matter_text((storage.foldername(name))[1]))
);

create policy matter_documents_insert_accessible
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'matter-documents'
  and (select private.can_access_matter_text((storage.foldername(name))[1]))
);
