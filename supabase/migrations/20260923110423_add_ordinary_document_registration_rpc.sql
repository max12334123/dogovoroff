-- Expand phase for a rolling release: register owned Storage objects before the app
-- switches to this RPC. Keep the legacy authenticated table INSERT until the
-- existing 20260923110424 contract migration runs after the new app is live.
-- Ordinary documents must be registered through a database boundary like
-- request-linked documents. A table INSERT could bypass the server-side Storage check.
create or replace function private.register_matter_document(
  target_matter_id uuid,
  new_document_id uuid,
  new_storage_path text,
  new_original_name text,
  new_mime_type text,
  new_size_bytes bigint
)
returns table (
  document_id uuid,
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
  existing_document public.documents%rowtype;
  inserted_status public.document_status;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if target_matter_id is null
    or not coalesce((select private.can_access_matter(target_matter_id)), false) then
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
    raise exception 'invalid_document_registration';
  end if;

  if not coalesce((
    normalized_mime = 'application/pdf'
      and char_length(normalized_name) > 4
      and right(lower(normalized_name), 4) = '.pdf'
      and new_storage_path = target_matter_id::text || '/' || new_document_id::text || '/document.pdf'
  ) or (
    normalized_mime = 'application/msword'
      and char_length(normalized_name) > 4
      and right(lower(normalized_name), 4) = '.doc'
      and new_storage_path = target_matter_id::text || '/' || new_document_id::text || '/document.doc'
  ) or (
    normalized_mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      and char_length(normalized_name) > 5
      and right(lower(normalized_name), 5) = '.docx'
      and new_storage_path = target_matter_id::text || '/' || new_document_id::text || '/document.docx'
  ) or (
    normalized_mime = 'image/jpeg'
      and (
        (char_length(normalized_name) > 4
          and right(lower(normalized_name), 4) = '.jpg'
          and new_storage_path = target_matter_id::text || '/' || new_document_id::text || '/document.jpg')
        or (char_length(normalized_name) > 5
          and right(lower(normalized_name), 5) = '.jpeg'
          and new_storage_path = target_matter_id::text || '/' || new_document_id::text || '/document.jpeg')
      )
  ) or (
    normalized_mime = 'image/png'
      and char_length(normalized_name) > 4
      and right(lower(normalized_name), 4) = '.png'
      and new_storage_path = target_matter_id::text || '/' || new_document_id::text || '/document.png'
  ), false) then
    raise exception 'invalid_document_registration';
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

  perform pg_advisory_xact_lock(hashtextextended(new_document_id::text, 0));

  select document.*
  into existing_document
  from public.documents as document
  where document.id = new_document_id;

  if found then
    if existing_document.request_id is null
      and existing_document.matter_id = target_matter_id
      and existing_document.storage_path = new_storage_path
      and existing_document.original_name = normalized_name
      and existing_document.mime_type = normalized_mime
      and existing_document.size_bytes = new_size_bytes
      and existing_document.uploaded_by = actor_id then
      return query select existing_document.id, existing_document.status;
      return;
    end if;
    raise exception 'document_registration_conflict';
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
    target_matter_id,
    null,
    new_storage_path,
    normalized_name,
    normalized_mime,
    new_size_bytes,
    actor_id
  )
  returning documents.status into inserted_status;

  return query select new_document_id, inserted_status;
end;
$$;

create or replace function public.register_matter_document(
  target_matter_id uuid,
  new_document_id uuid,
  new_storage_path text,
  new_original_name text,
  new_mime_type text,
  new_size_bytes bigint
)
returns table (
  document_id uuid,
  document_status public.document_status
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.register_matter_document($1, $2, $3, $4, $5, $6);
$$;

revoke all on function private.register_matter_document(uuid, uuid, text, text, text, bigint)
from public, anon, authenticated;
grant execute on function private.register_matter_document(uuid, uuid, text, text, text, bigint)
to authenticated;

revoke all on function public.register_matter_document(uuid, uuid, text, text, text, bigint)
from public, anon, authenticated;
grant execute on function public.register_matter_document(uuid, uuid, text, text, text, bigint)
to authenticated;
