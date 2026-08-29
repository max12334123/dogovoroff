create table public.intake_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  submission_id uuid not null,
  submitted_at timestamptz not null,
  status text not null default 'new',
  name text not null,
  phone text not null,
  service text not null,
  message text not null default '',
  form_mode text not null,
  precheck_mode text not null,
  precheck_practice text not null,
  precheck_excerpt text not null,
  consent_timestamp timestamptz not null,
  consent_document text not null,
  consent_version text not null,
  source text not null,
  matter_id uuid references public.matters (id) on delete restrict,
  handled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intake_requests_status_allowed
    check (status in ('new', 'reviewing', 'contacted', 'matter_created', 'closed')),
  constraint intake_requests_name_length check (char_length(btrim(name)) between 2 and 80),
  constraint intake_requests_phone_length check (char_length(btrim(phone)) between 1 and 32),
  constraint intake_requests_service_length check (char_length(btrim(service)) between 2 and 120),
  constraint intake_requests_message_length check (char_length(message) <= 2000),
  constraint intake_requests_form_mode_length check (char_length(btrim(form_mode)) between 1 and 80),
  constraint intake_requests_precheck_mode_length check (char_length(btrim(precheck_mode)) between 1 and 80),
  constraint intake_requests_precheck_practice_length check (char_length(btrim(precheck_practice)) between 1 and 160),
  constraint intake_requests_precheck_excerpt_length check (char_length(btrim(precheck_excerpt)) between 1 and 1200),
  constraint intake_requests_consent_document_length check (char_length(btrim(consent_document)) between 1 and 500),
  constraint intake_requests_consent_version_length check (char_length(btrim(consent_version)) between 1 and 200),
  constraint intake_requests_source_length check (char_length(btrim(source)) between 1 and 120),
  constraint intake_requests_matter_status_consistent check (
    (status = 'matter_created' and matter_id is not null)
    or (status <> 'matter_created' and matter_id is null)
  ),
  unique (organization_id, submission_id)
);

create index intake_requests_organization_status_submitted_idx
  on public.intake_requests (organization_id, status, submitted_at desc);

create unique index intake_requests_matter_id_unique_idx
  on public.intake_requests (matter_id)
  where matter_id is not null;

create index intake_requests_handled_by_idx
  on public.intake_requests (handled_by)
  where handled_by is not null;

create trigger intake_requests_set_updated_at
before update on public.intake_requests
for each row execute function private.set_updated_at();

alter table public.intake_requests enable row level security;
alter table public.intake_requests force row level security;

revoke all on table public.intake_requests from public, anon, authenticated;
grant select, insert on table public.intake_requests to service_role;

create or replace function public.store_intake_request(
  target_organization_id uuid,
  new_submission_id uuid,
  new_submitted_at timestamptz,
  new_name text,
  new_phone text,
  new_service text,
  new_message text,
  new_form_mode text,
  new_precheck_mode text,
  new_precheck_practice text,
  new_precheck_excerpt text,
  new_consent_timestamp timestamptz,
  new_consent_document text,
  new_consent_version text,
  new_source text
)
returns table (
  request_id uuid,
  created boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_name text := btrim(coalesce(new_name, ''));
  normalized_phone text := btrim(coalesce(new_phone, ''));
  normalized_service text := btrim(coalesce(new_service, ''));
  normalized_message text := coalesce(new_message, '');
  normalized_form_mode text := btrim(coalesce(new_form_mode, ''));
  normalized_precheck_mode text := btrim(coalesce(new_precheck_mode, ''));
  normalized_precheck_practice text := btrim(coalesce(new_precheck_practice, ''));
  normalized_precheck_excerpt text := btrim(coalesce(new_precheck_excerpt, ''));
  normalized_consent_document text := btrim(coalesce(new_consent_document, ''));
  normalized_consent_version text := btrim(coalesce(new_consent_version, ''));
  normalized_source text := btrim(coalesce(new_source, ''));
  stored_request_id uuid;
  was_created boolean := false;
begin
  if target_organization_id is null
    or new_submission_id is null
    or new_submitted_at is null
    or new_consent_timestamp is null
    or not exists (
      select 1 from public.organizations as organization
      where organization.id = target_organization_id
    )
    or char_length(normalized_name) not between 2 and 80
    or char_length(normalized_phone) not between 1 and 32
    or char_length(normalized_service) not between 2 and 120
    or char_length(normalized_message) > 2000
    or char_length(normalized_form_mode) not between 1 and 80
    or char_length(normalized_precheck_mode) not between 1 and 80
    or char_length(normalized_precheck_practice) not between 1 and 160
    or char_length(normalized_precheck_excerpt) not between 1 and 1200
    or char_length(normalized_consent_document) not between 1 and 500
    or char_length(normalized_consent_version) not between 1 and 200
    or char_length(normalized_source) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'invalid_intake_input';
  end if;

  insert into public.intake_requests (
    organization_id,
    submission_id,
    submitted_at,
    name,
    phone,
    service,
    message,
    form_mode,
    precheck_mode,
    precheck_practice,
    precheck_excerpt,
    consent_timestamp,
    consent_document,
    consent_version,
    source
  ) values (
    target_organization_id,
    new_submission_id,
    new_submitted_at,
    normalized_name,
    normalized_phone,
    normalized_service,
    normalized_message,
    normalized_form_mode,
    normalized_precheck_mode,
    normalized_precheck_practice,
    normalized_precheck_excerpt,
    new_consent_timestamp,
    normalized_consent_document,
    normalized_consent_version,
    normalized_source
  )
  on conflict (organization_id, submission_id) do nothing
  returning id into stored_request_id;

  if stored_request_id is not null then
    was_created := true;
  else
    select intake.id
    into stored_request_id
    from public.intake_requests as intake
    where intake.organization_id = target_organization_id
      and intake.submission_id = new_submission_id;
  end if;

  return query select stored_request_id, was_created;
end;
$$;

revoke all on function public.store_intake_request(
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text
) from public, anon, authenticated, service_role;

grant execute on function public.store_intake_request(
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text
) to service_role;

create or replace function public.list_intake_requests(target_organization_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  submission_id uuid,
  status text,
  name text,
  phone text,
  service text,
  message text,
  form_mode text,
  precheck_mode text,
  precheck_practice text,
  precheck_excerpt text,
  submitted_at timestamptz,
  updated_at timestamptz,
  matter_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null
    or not exists (
      select 1
      from public.organization_members as member
      where member.organization_id = target_organization_id
        and member.user_id = actor_id
        and member.role in ('admin', 'lawyer')
    ) then
    raise exception using errcode = '42501', message = 'organization_not_available';
  end if;

  return query
  select
    intake.id,
    intake.organization_id,
    intake.submission_id,
    intake.status,
    intake.name,
    intake.phone,
    intake.service,
    intake.message,
    intake.form_mode,
    intake.precheck_mode,
    intake.precheck_practice,
    intake.precheck_excerpt,
    intake.submitted_at,
    intake.updated_at,
    intake.matter_id
  from public.intake_requests as intake
  where intake.organization_id = target_organization_id
  order by
    case intake.status
      when 'new' then 0
      when 'reviewing' then 1
      when 'contacted' then 2
      else 3
    end,
    intake.submitted_at desc
  limit 250;
end;
$$;

revoke all on function public.list_intake_requests(uuid) from public, anon, authenticated;
grant execute on function public.list_intake_requests(uuid) to authenticated;

create or replace function public.update_intake_request_status(
  target_request_id uuid,
  new_status text
)
returns table (
  request_id uuid,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  normalized_status text := btrim(coalesce(new_status, ''));
  request_organization_id uuid;
  existing_matter_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'authorization_required';
  end if;

  if normalized_status not in ('new', 'reviewing', 'contacted', 'closed') then
    raise exception using errcode = '22023', message = 'intake_status_invalid';
  end if;

  select intake.organization_id, intake.matter_id
  into request_organization_id, existing_matter_id
  from public.intake_requests as intake
  where intake.id = target_request_id
  for update;

  if request_organization_id is null then
    raise exception using errcode = 'P0001', message = 'intake_request_not_found';
  end if;

  if not exists (
    select 1
    from public.organization_members as member
    where member.organization_id = request_organization_id
      and member.user_id = actor_id
      and member.role in ('admin', 'lawyer')
  ) then
    raise exception using errcode = '42501', message = 'organization_not_available';
  end if;

  if existing_matter_id is not null then
    raise exception using errcode = 'P0001', message = 'intake_already_converted';
  end if;

  update public.intake_requests as intake
  set
    status = normalized_status,
    handled_by = actor_id
  where intake.id = target_request_id;

  insert into public.audit_events (
    organization_id,
    actor_id,
    action,
    entity_type,
    entity_id
  ) values (
    request_organization_id,
    actor_id,
    'intake.updated',
    'intake_request',
    target_request_id
  );

  return query select target_request_id, normalized_status;
end;
$$;

revoke all on function public.update_intake_request_status(uuid, text) from public, anon, authenticated;
grant execute on function public.update_intake_request_status(uuid, text) to authenticated;

create or replace function public.create_matter_from_intake_request(
  target_request_id uuid,
  target_organization_id uuid,
  target_client_email text,
  new_reference text,
  new_title text,
  new_summary text,
  target_lawyer_id uuid,
  initial_stage_title text,
  initial_stage_detail text,
  new_next_action_title text,
  new_next_action_description text
)
returns table (
  matter_id uuid,
  client_id uuid,
  client_display_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  request_organization_id uuid;
  existing_matter_id uuid;
  request_status text;
  created_matter_id uuid;
  selected_client_id uuid;
  selected_client_display_name text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'authorization_required';
  end if;

  select intake.organization_id, intake.matter_id, intake.status
  into request_organization_id, existing_matter_id, request_status
  from public.intake_requests as intake
  where intake.id = target_request_id
  for update;

  if request_organization_id is null then
    raise exception using errcode = 'P0001', message = 'intake_request_not_found';
  end if;

  if request_organization_id <> target_organization_id then
    raise exception using errcode = '42501', message = 'organization_not_available';
  end if;

  if existing_matter_id is not null then
    raise exception using errcode = 'P0001', message = 'intake_already_converted';
  end if;

  if request_status = 'closed' then
    raise exception using errcode = 'P0001', message = 'intake_request_closed';
  end if;

  select created.matter_id, created.client_id, created.client_display_name
  into created_matter_id, selected_client_id, selected_client_display_name
  from public.create_matter_for_client_email(
    target_organization_id,
    target_client_email,
    new_reference,
    new_title,
    new_summary,
    target_lawyer_id,
    initial_stage_title,
    initial_stage_detail,
    new_next_action_title,
    new_next_action_description
  ) as created;

  update public.intake_requests as intake
  set
    status = 'matter_created',
    matter_id = created_matter_id,
    handled_by = actor_id
  where intake.id = target_request_id;

  insert into public.audit_events (
    organization_id,
    matter_id,
    actor_id,
    action,
    entity_type,
    entity_id
  ) values (
    request_organization_id,
    created_matter_id,
    actor_id,
    'intake.converted',
    'intake_request',
    target_request_id
  );

  return query
  select created_matter_id, selected_client_id, selected_client_display_name;
end;
$$;

revoke all on function public.create_matter_from_intake_request(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.create_matter_from_intake_request(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text
) to authenticated;

comment on table public.intake_requests
  is 'Private organization-scoped inbox for website requests. Direct access is denied to browser roles.';

comment on function public.store_intake_request(uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, timestamptz, text, text, text)
  is 'Idempotently stores one validated website request. Callable only with the server-side service role.';

comment on function public.list_intake_requests(uuid)
  is 'Lists bounded intake request fields for authenticated staff of the target organization.';

comment on function public.update_intake_request_status(uuid, text)
  is 'Updates a non-converted intake request after an explicit staff membership check.';

comment on function public.create_matter_from_intake_request(uuid, uuid, text, text, text, text, uuid, text, text, text, text)
  is 'Atomically converts one intake request into a matter through the existing administrator-only creation boundary.';
