create or replace function public.list_assignable_staff(target_organization_id uuid)
returns table (
  user_id uuid,
  display_name text,
  member_role public.organization_role
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not exists (
      select 1
      from public.organization_members as om
      where om.organization_id = target_organization_id
        and om.user_id = (select auth.uid())
        and om.role = 'admin'
    ) then
    raise exception using errcode = '42501', message = 'organization_not_available';
  end if;

  return query
  select
    om.user_id,
    coalesce(p.display_name, 'Сотрудник')::text,
    om.role
  from public.organization_members as om
  left join public.profiles as p on p.id = om.user_id
  where om.organization_id = target_organization_id
    and om.role in ('admin', 'lawyer')
  order by
    case when om.role = 'lawyer' then 0 else 1 end,
    coalesce(p.display_name, 'Сотрудник'),
    om.user_id;
end;
$$;

revoke all on function public.list_assignable_staff(uuid) from public, anon, authenticated;
grant execute on function public.list_assignable_staff(uuid) to authenticated;

create or replace function public.create_matter_for_client_email(
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
  normalized_email text := lower(btrim(coalesce(target_client_email, '')));
  normalized_reference text := btrim(coalesce(new_reference, ''));
  normalized_title text := btrim(coalesce(new_title, ''));
  normalized_summary text := btrim(coalesce(new_summary, ''));
  normalized_stage_title text := btrim(coalesce(initial_stage_title, ''));
  normalized_stage_detail text := btrim(coalesce(initial_stage_detail, ''));
  normalized_next_action_title text := nullif(btrim(coalesce(new_next_action_title, '')), '');
  normalized_next_action_description text := nullif(btrim(coalesce(new_next_action_description, '')), '');
  selected_client_id uuid;
  created_matter_id uuid;
  selected_client_display_name text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'authorization_required';
  end if;

  if not exists (
    select 1
    from public.organization_members as om
    where om.organization_id = target_organization_id
      and om.user_id = actor_id
      and om.role = 'admin'
  ) then
    raise exception using errcode = '42501', message = 'organization_not_available';
  end if;

  if normalized_email = ''
    or char_length(normalized_email) > 254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(normalized_reference) not between 1 and 80
    or char_length(normalized_title) not between 1 and 240
    or char_length(normalized_summary) > 5000
    or char_length(normalized_stage_title) not between 1 and 200
    or char_length(normalized_stage_detail) > 1000
    or (normalized_next_action_title is not null and char_length(normalized_next_action_title) > 240)
    or (normalized_next_action_description is not null and char_length(normalized_next_action_description) > 2000)
    or (normalized_next_action_title is null and normalized_next_action_description is not null) then
    raise exception using errcode = '22023', message = 'invalid_assignment_input';
  end if;

  select au.id
  into selected_client_id
  from auth.users as au
  where lower(au.email) = normalized_email
    and au.email_confirmed_at is not null
  limit 1;

  if selected_client_id is null then
    raise exception using errcode = 'P0001', message = 'client_not_found';
  end if;

  if target_lawyer_id is not null then
    if target_lawyer_id = selected_client_id then
      raise exception using errcode = 'P0001', message = 'client_conflicts_with_lawyer';
    end if;

    if not exists (
      select 1
      from public.organization_members as om
      where om.organization_id = target_organization_id
        and om.user_id = target_lawyer_id
        and om.role in ('admin', 'lawyer')
    ) then
      raise exception using errcode = 'P0001', message = 'lawyer_not_available';
    end if;
  end if;

  insert into public.matters (
    organization_id,
    reference,
    title,
    summary,
    status,
    next_action_title,
    next_action_description,
    created_by
  ) values (
    target_organization_id,
    normalized_reference,
    normalized_title,
    normalized_summary,
    'active',
    normalized_next_action_title,
    normalized_next_action_description,
    actor_id
  )
  returning id into created_matter_id;

  insert into public.matter_participants (matter_id, user_id, role)
  values (created_matter_id, selected_client_id, 'client'::public.matter_participant_role);

  if target_lawyer_id is not null then
    insert into public.matter_participants (matter_id, user_id, role)
    values (created_matter_id, target_lawyer_id, 'lawyer'::public.matter_participant_role);
  end if;

  insert into public.matter_stages (matter_id, position, title, detail, status)
  values (
    created_matter_id,
    1,
    normalized_stage_title,
    normalized_stage_detail,
    'current'
  );

  select coalesce(p.display_name, 'Клиент')
  into selected_client_display_name
  from public.profiles as p
  where p.id = selected_client_id;

  return query
  select
    created_matter_id,
    selected_client_id,
    coalesce(selected_client_display_name, 'Клиент')::text;
end;
$$;

revoke all on function public.create_matter_for_client_email(
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

grant execute on function public.create_matter_for_client_email(
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

comment on function public.list_assignable_staff(uuid)
  is 'Lists staff assignment options for an authenticated administrator of the target organization.';

comment on function public.create_matter_for_client_email(uuid, text, text, text, text, uuid, text, text, text, text)
  is 'Atomically creates a matter and assigns a confirmed client and optional staff member after an organization admin check.';
