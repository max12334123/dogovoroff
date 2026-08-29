create or replace function private.prevent_matter_organization_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception using errcode = '42501', message = 'organization_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists matters_organization_immutable on public.matters;
create trigger matters_organization_immutable
before update on public.matters
for each row execute function private.prevent_matter_organization_change();

revoke all on function private.prevent_matter_organization_change() from public, anon, authenticated;

create or replace function public.update_matter_workflow(
  target_matter_id uuid,
  new_status public.matter_status,
  target_stage_id uuid,
  new_next_action_title text,
  new_next_action_description text,
  new_next_action_due_at timestamptz,
  update_assignment boolean,
  target_lawyer_id uuid
)
returns table (
  matter_id uuid,
  status public.matter_status,
  active_stage_id uuid,
  assigned_lawyer_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_organization_id uuid;
  selected_stage_id uuid;
  selected_lawyer_id uuid;
  normalized_title text := nullif(btrim(coalesce(new_next_action_title, '')), '');
  normalized_description text := nullif(btrim(coalesce(new_next_action_description, '')), '');
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'authorization_required';
  end if;

  if new_status is null then
    raise exception using errcode = '22023', message = 'invalid_workflow_input';
  end if;

  if not exists (select 1 from public.matters where id = target_matter_id) then
    raise exception using errcode = 'P0001', message = 'matter_not_found';
  end if;

  if not (select private.can_manage_matter(target_matter_id)) then
    raise exception using errcode = '42501', message = 'organization_not_available';
  end if;

  if char_length(coalesce(normalized_title, '')) > 240
    or char_length(coalesce(normalized_description, '')) > 2000
    or (normalized_title is null and normalized_description is not null) then
    raise exception using errcode = '22023', message = 'invalid_workflow_input';
  end if;

  select organization_id
  into target_organization_id
  from public.matters
  where id = target_matter_id;

  if target_stage_id is not null then
    select id
    into selected_stage_id
    from public.matter_stages
    where id = target_stage_id
      and matter_id = target_matter_id;

    if selected_stage_id is null then
      raise exception using errcode = 'P0001', message = 'stage_not_available';
    end if;
  end if;

  if new_status not in ('completed', 'archived') and selected_stage_id is null then
    select id
    into selected_stage_id
    from public.matter_stages
    where matter_id = target_matter_id
      and status = 'current'
    order by position
    limit 1;

    if selected_stage_id is null then
      select id
      into selected_stage_id
      from public.matter_stages
      where matter_id = target_matter_id
      order by position
      limit 1;
    end if;

    if selected_stage_id is null then
      raise exception using errcode = 'P0001', message = 'stage_required_for_active';
    end if;
  end if;

  if update_assignment then
    if not (select private.is_org_admin(target_organization_id)) then
      raise exception using errcode = '42501', message = 'assignment_requires_admin';
    end if;

    if target_lawyer_id is not null and not exists (
      select 1
      from public.organization_members as om
      where om.organization_id = target_organization_id
        and om.user_id = target_lawyer_id
        and om.role in ('admin', 'lawyer')
    ) then
      raise exception using errcode = 'P0001', message = 'lawyer_not_available';
    end if;

    if target_lawyer_id is not null and exists (
      select 1
      from public.matter_participants as mp
      where mp.matter_id = target_matter_id
        and mp.user_id = target_lawyer_id
        and mp.role = 'client'
    ) then
      raise exception using errcode = 'P0001', message = 'client_conflicts_with_lawyer';
    end if;
  end if;

  update public.matters
  set
    status = new_status,
    next_action_title = case when new_status in ('completed', 'archived') then null else normalized_title end,
    next_action_description = case when new_status in ('completed', 'archived') then null else normalized_description end,
    next_action_due_at = case
      when new_status in ('completed', 'archived') or normalized_title is null then null
      else new_next_action_due_at
    end
  where id = target_matter_id;

  if new_status in ('completed', 'archived') then
    update public.matter_stages
    set status = 'complete', completed_at = coalesce(completed_at, now())
    where matter_id = target_matter_id;
  elsif selected_stage_id is not null then
    update public.matter_stages
    set status = 'future', completed_at = null
    where matter_id = target_matter_id;

    update public.matter_stages
    set status = 'current', completed_at = null
    where id = selected_stage_id;
  end if;

  if update_assignment then
    delete from public.matter_participants
    where matter_id = target_matter_id
      and role = 'lawyer'
      and (target_lawyer_id is null or user_id <> target_lawyer_id);

    if target_lawyer_id is not null then
      insert into public.matter_participants (matter_id, user_id, role)
      values (target_matter_id, target_lawyer_id, 'lawyer'::public.matter_participant_role)
      on conflict (matter_id, user_id) do update set role = excluded.role;
    end if;
  end if;

  select mp.user_id
  into selected_lawyer_id
  from public.matter_participants as mp
  where mp.matter_id = target_matter_id
    and mp.role = 'lawyer'
  order by mp.created_at
  limit 1;

  return query
  select
    target_matter_id,
    new_status,
    case
      when new_status in ('completed', 'archived') then null::uuid
      else coalesce(selected_stage_id, (select ms.id from public.matter_stages as ms where ms.matter_id = target_matter_id and ms.status = 'current' limit 1))
    end,
    selected_lawyer_id;
end;
$$;

revoke all on function public.update_matter_workflow(uuid, public.matter_status, uuid, text, text, timestamptz, boolean, uuid)
from public, anon, authenticated;
grant execute on function public.update_matter_workflow(uuid, public.matter_status, uuid, text, text, timestamptz, boolean, uuid)
to authenticated;

comment on function public.update_matter_workflow(uuid, public.matter_status, uuid, text, text, timestamptz, boolean, uuid)
  is 'Atomically updates a manager-visible matter workflow and optionally reassigns its lawyer without allowing organization changes.';
