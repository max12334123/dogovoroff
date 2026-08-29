create or replace function private.prevent_non_admin_matter_details_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    new.reference is distinct from old.reference
    or new.title is distinct from old.title
    or new.summary is distinct from old.summary
    or new.response_due_at is distinct from old.response_due_at
  ) and not (select private.is_org_admin(old.organization_id)) then
    raise exception using errcode = '42501', message = 'details_requires_admin';
  end if;

  return new;
end;
$$;

drop trigger if exists matters_details_admin_only on public.matters;
create trigger matters_details_admin_only
before update on public.matters
for each row execute function private.prevent_non_admin_matter_details_change();

revoke all on function private.prevent_non_admin_matter_details_change() from public, anon, authenticated;

create or replace function public.update_matter_details(
  target_matter_id uuid,
  new_reference text,
  new_title text,
  new_summary text,
  new_response_due_at timestamptz
)
returns table (
  matter_id uuid,
  reference text,
  title text,
  summary text,
  response_due_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_organization_id uuid;
  normalized_reference text := regexp_replace(btrim(coalesce(new_reference, '')), '[[:space:]]+', ' ', 'g');
  normalized_title text := regexp_replace(btrim(coalesce(new_title, '')), '[[:space:]]+', ' ', 'g');
  normalized_summary text := btrim(coalesce(new_summary, ''));
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'authorization_required';
  end if;

  if not exists (select 1 from public.matters where id = target_matter_id) then
    raise exception using errcode = 'P0001', message = 'matter_not_found';
  end if;

  select organization_id
  into target_organization_id
  from public.matters
  where id = target_matter_id;

  if not (select private.is_org_admin(target_organization_id)) then
    raise exception using errcode = '42501', message = 'details_requires_admin';
  end if;

  if char_length(normalized_reference) < 1
    or char_length(normalized_reference) > 80
    or char_length(normalized_title) < 1
    or char_length(normalized_title) > 240
    or normalized_reference ~ '[[:cntrl:]]'
    or normalized_title ~ '[[:cntrl:]]'
    or char_length(normalized_summary) > 5000
    or translate(normalized_summary, E'\n\r\t', '') ~ '[[:cntrl:]]' then
    raise exception using errcode = '22023', message = 'invalid_matter_details';
  end if;

  if exists (
    select 1
    from public.matters
    where organization_id = target_organization_id
      and reference = normalized_reference
      and id <> target_matter_id
  ) then
    raise exception using errcode = '23505', message = 'reference_conflict';
  end if;

  update public.matters
  set
    reference = normalized_reference,
    title = normalized_title,
    summary = normalized_summary,
    response_due_at = new_response_due_at
  where id = target_matter_id;

  return query
  select m.id, m.reference, m.title, m.summary, m.response_due_at
  from public.matters as m
  where m.id = target_matter_id;
end;
$$;

revoke all on function public.update_matter_details(uuid, text, text, text, timestamptz)
from public, anon, authenticated;
grant execute on function public.update_matter_details(uuid, text, text, text, timestamptz)
to authenticated;

comment on function public.update_matter_details(uuid, text, text, text, timestamptz)
  is 'Updates administrator-only matter metadata without changing organization, workflow, participants, documents, or messages.';
