create or replace function public.list_staff_matter_assignments(target_matter_ids uuid[])
returns table (
  matter_id uuid,
  assigned_lawyer_id uuid,
  assigned_lawyer_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'staff_access_required';
  end if;

  if coalesce(cardinality(target_matter_ids), 0) = 0 then
    return;
  end if;
  if cardinality(target_matter_ids) > 100 or array_ndims(target_matter_ids) <> 1 then
    raise exception using errcode = '22023', message = 'invalid_matter_ids';
  end if;
  if array_position(target_matter_ids, null) is not null then
    raise exception using errcode = '22023', message = 'invalid_matter_ids';
  end if;

  return query
  select m.id, assigned.user_id, assigned.display_name
  from public.matters as m
  left join lateral (
    select mp.user_id, coalesce(p.display_name, 'Сотрудник')::text as display_name
    from public.matter_participants as mp
    left join public.profiles as p on p.id = mp.user_id
    where mp.matter_id = m.id and mp.role = 'lawyer'
    order by mp.created_at, mp.user_id
    limit 1
  ) as assigned on true
  where m.id = any(target_matter_ids)
    and exists (
      select 1
      from public.organization_members as om
      where om.organization_id = m.organization_id
        and om.user_id = (select auth.uid())
        and om.role in ('admin', 'lawyer')
    )
    and (select private.can_manage_matter(m.id));
end;
$$;

revoke all on function public.list_staff_matter_assignments(uuid[]) from public, anon, authenticated;
grant execute on function public.list_staff_matter_assignments(uuid[]) to authenticated;

comment on function public.list_staff_matter_assignments(uuid[]) is
  'Read-only assignment summary for same-organization staff who may manage each requested matter. No client identities or directory access.';
