-- RLS policies execute these private boolean predicates as the authenticated
-- caller. The private schema stays unavailable to anonymous clients, and
-- trigger/audit helpers intentionally remain non-executable by API roles.
revoke usage on schema private from public, anon;
grant usage on schema private to authenticated;

revoke execute on function private.is_org_admin(uuid) from public, anon;
revoke execute on function private.can_access_organization(uuid) from public, anon;
revoke execute on function private.can_access_matter(uuid) from public, anon;
revoke execute on function private.can_manage_matter(uuid) from public, anon;
revoke execute on function private.can_access_matter_text(text) from public, anon;

grant execute on function private.is_org_admin(uuid) to authenticated;
grant execute on function private.can_access_organization(uuid) to authenticated;
grant execute on function private.can_access_matter(uuid) to authenticated;
grant execute on function private.can_manage_matter(uuid) to authenticated;
grant execute on function private.can_access_matter_text(text) to authenticated;
