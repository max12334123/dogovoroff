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
          and mp.role = 'client'
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
    and exists (
      select 1
      from public.matters as m
      where m.id = target_matter_id
        and (
          exists (
            select 1
            from public.matter_participants as mp
            where mp.matter_id = m.id
              and mp.user_id = (select auth.uid())
              and (
                mp.role = 'client'
                or (
                  mp.role = 'lawyer'
                  and exists (
                    select 1
                    from public.organization_members as om
                    where om.organization_id = m.organization_id
                      and om.user_id = (select auth.uid())
                      and om.role = 'lawyer'
                  )
                )
              )
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

create or replace function private.can_manage_matter(target_matter_id uuid)
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
      where m.id = target_matter_id
        and (
          exists (
            select 1
            from public.matter_participants as mp
            join public.organization_members as om
              on om.organization_id = m.organization_id
             and om.user_id = mp.user_id
             and om.role = 'lawyer'
            where mp.matter_id = m.id
              and mp.user_id = (select auth.uid())
              and mp.role = 'lawyer'
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
        and (select private.can_access_matter(m.id))
    );
$$;

drop policy if exists matter_participants_select_own on public.matter_participants;
create policy matter_participants_select_own
on public.matter_participants for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (
    role = 'client'
    or (
      role = 'lawyer'
      and (select private.can_access_matter(matter_id))
    )
  )
);
