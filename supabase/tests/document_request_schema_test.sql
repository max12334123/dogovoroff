begin;
select plan(25);

select ok(
  to_regtype('public.document_request_status') is not null,
  'document request status type exists'
);

select is(
  (
    select array_agg(value.enumlabel order by value.enumsortorder)::text
    from pg_type as type
    join pg_namespace as namespace on namespace.oid = type.typnamespace
    join pg_enum as value on value.enumtypid = type.oid
    where namespace.nspname = 'public'
      and type.typname = 'document_request_status'
  ),
  '{requested,submitted,changes_requested,accepted,cancelled}',
  'document request states have a stable order'
);

select ok(to_regclass('public.document_requests') is not null, 'document requests table exists');

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name = 'request_id'
      and data_type = 'uuid'
  ),
  'documents can be linked to a request'
);

select ok(
  exists (
    select 1
    from pg_constraint as relation_constraint
    join pg_class as source_table on source_table.oid = relation_constraint.conrelid
    join pg_namespace as source_schema on source_schema.oid = source_table.relnamespace
    join pg_class as target_table on target_table.oid = relation_constraint.confrelid
    join pg_namespace as target_schema on target_schema.oid = target_table.relnamespace
    where relation_constraint.contype = 'f'
      and source_schema.nspname = 'public'
      and source_table.relname = 'documents'
      and target_schema.nspname = 'public'
      and target_table.relname = 'document_requests'
  ),
  'document request links are protected by a foreign key'
);

select ok(
  coalesce((
    select relation.relrowsecurity
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public' and relation.relname = 'document_requests'
  ), false),
  'document requests use row level security'
);

select ok(
  coalesce((
    select relation.relforcerowsecurity
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public' and relation.relname = 'document_requests'
  ), false),
  'document request row level security is forced'
);

select ok(
  coalesce(has_column_privilege('authenticated', to_regclass('public.document_requests'), 'id', 'select'), false),
  'authenticated users can select safe request columns'
);
select ok(
  not coalesce(has_column_privilege('authenticated', to_regclass('public.document_requests'), 'created_by', 'select'), false),
  'request creator identity is not exposed through the Data API'
);
select ok(
  not coalesce(has_column_privilege('authenticated', to_regclass('public.document_requests'), 'reviewed_by', 'select'), false),
  'request reviewer identity is not exposed through the Data API'
);
select ok(
  not coalesce(has_table_privilege('authenticated', to_regclass('public.document_requests'), 'insert'), false),
  'authenticated users cannot insert request rows directly'
);
select ok(
  not coalesce(has_table_privilege('authenticated', to_regclass('public.document_requests'), 'update'), false),
  'authenticated users cannot update request rows directly'
);
select ok(
  not coalesce(has_table_privilege('authenticated', to_regclass('public.document_requests'), 'delete'), false),
  'authenticated users cannot delete request rows directly'
);
select ok(
  not coalesce(has_column_privilege('anon', to_regclass('public.document_requests'), 'id', 'select'), false),
  'anonymous users cannot read document requests'
);

with expected(signature) as (
  values
    ('public.create_document_request(uuid,text,text,date)'),
    ('public.update_document_request(uuid,text,text,date)'),
    ('public.register_document_request_file(uuid,uuid,text,text,text,bigint)'),
    ('public.submit_document_request(uuid)'),
    ('public.review_document_request(uuid,public.document_request_status,text)'),
    ('public.cancel_document_request(uuid)'),
    ('public.withdraw_document_request_file(uuid,uuid)')
)
select ok(
  count(*) = 7 and count(to_regprocedure(signature)) = 7,
  'all public document request RPCs exist'
)
from expected;

with expected(name) as (
  values
    ('create_document_request'),
    ('update_document_request'),
    ('register_document_request_file'),
    ('submit_document_request'),
    ('review_document_request'),
    ('cancel_document_request'),
    ('withdraw_document_request_file')
)
select ok(
  count(*) = 7 and bool_and(not procedure.prosecdef),
  'public RPCs run with caller privileges'
)
from expected
join pg_proc as procedure on procedure.proname = expected.name
join pg_namespace as namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public';

with expected(name) as (
  values
    ('create_document_request'),
    ('update_document_request'),
    ('register_document_request_file'),
    ('submit_document_request'),
    ('review_document_request'),
    ('cancel_document_request'),
    ('withdraw_document_request_file')
)
select ok(
  count(*) = 7
    and bool_and(coalesce(procedure.proconfig, array[]::text[]) @> array['search_path=""']),
  'public RPCs pin an empty search path'
)
from expected
join pg_proc as procedure on procedure.proname = expected.name
join pg_namespace as namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public';

with expected(signature) as (
  values
    ('public.create_document_request(uuid,text,text,date)'),
    ('public.update_document_request(uuid,text,text,date)'),
    ('public.register_document_request_file(uuid,uuid,text,text,text,bigint)'),
    ('public.submit_document_request(uuid)'),
    ('public.review_document_request(uuid,public.document_request_status,text)'),
    ('public.cancel_document_request(uuid)'),
    ('public.withdraw_document_request_file(uuid,uuid)')
)
select ok(
  bool_and(has_function_privilege('authenticated', to_regprocedure(signature), 'execute')),
  'authenticated users can execute public RPCs'
)
from expected;

with expected(signature) as (
  values
    ('public.create_document_request(uuid,text,text,date)'),
    ('public.update_document_request(uuid,text,text,date)'),
    ('public.register_document_request_file(uuid,uuid,text,text,text,bigint)'),
    ('public.submit_document_request(uuid)'),
    ('public.review_document_request(uuid,public.document_request_status,text)'),
    ('public.cancel_document_request(uuid)'),
    ('public.withdraw_document_request_file(uuid,uuid)')
)
select ok(
  bool_and(not has_function_privilege('anon', to_regprocedure(signature), 'execute')),
  'anonymous users cannot execute public RPCs'
)
from expected;

with expected(signature) as (
  values
    ('private.create_document_request(uuid,text,text,date)'),
    ('private.update_document_request(uuid,text,text,date)'),
    ('private.register_document_request_file(uuid,uuid,text,text,text,bigint)'),
    ('private.submit_document_request(uuid)'),
    ('private.review_document_request(uuid,public.document_request_status,text)'),
    ('private.cancel_document_request(uuid)'),
    ('private.withdraw_document_request_file(uuid,uuid)')
)
select ok(
  count(*) = 7 and count(to_regprocedure(signature)) = 7,
  'all privileged document request implementations exist in the private schema'
)
from expected;

with expected(name) as (
  values
    ('create_document_request'),
    ('update_document_request'),
    ('register_document_request_file'),
    ('submit_document_request'),
    ('review_document_request'),
    ('cancel_document_request'),
    ('withdraw_document_request_file')
)
select ok(
  count(*) = 7 and bool_and(procedure.prosecdef),
  'private request implementations use controlled elevated privileges'
)
from expected
join pg_proc as procedure on procedure.proname = expected.name
join pg_namespace as namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'private';

with expected(name) as (
  values
    ('create_document_request'),
    ('update_document_request'),
    ('register_document_request_file'),
    ('submit_document_request'),
    ('review_document_request'),
    ('cancel_document_request'),
    ('withdraw_document_request_file')
)
select ok(
  count(*) = 7
    and bool_and(coalesce(procedure.proconfig, array[]::text[]) @> array['search_path=""']),
  'private request implementations pin an empty search path'
)
from expected
join pg_proc as procedure on procedure.proname = expected.name
join pg_namespace as namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'private';

with expected(signature) as (
  values
    ('private.create_document_request(uuid,text,text,date)'),
    ('private.update_document_request(uuid,text,text,date)'),
    ('private.register_document_request_file(uuid,uuid,text,text,text,bigint)'),
    ('private.submit_document_request(uuid)'),
    ('private.review_document_request(uuid,public.document_request_status,text)'),
    ('private.cancel_document_request(uuid)'),
    ('private.withdraw_document_request_file(uuid,uuid)')
)
select ok(
  bool_and(has_function_privilege('authenticated', to_regprocedure(signature), 'execute')),
  'authenticated public wrappers can invoke private implementations'
)
from expected;

with expected(signature) as (
  values
    ('private.create_document_request(uuid,text,text,date)'),
    ('private.update_document_request(uuid,text,text,date)'),
    ('private.register_document_request_file(uuid,uuid,text,text,text,bigint)'),
    ('private.submit_document_request(uuid)'),
    ('private.review_document_request(uuid,public.document_request_status,text)'),
    ('private.cancel_document_request(uuid)'),
    ('private.withdraw_document_request_file(uuid,uuid)')
)
select ok(
  bool_and(not has_function_privilege('anon', to_regprocedure(signature), 'execute')),
  'anonymous users cannot invoke private implementations'
)
from expected;

select ok(
  not coalesce(
    has_function_privilege('authenticated', to_regprocedure('private.is_matter_client(uuid)'), 'execute'),
    false
  )
    and not coalesce(has_function_privilege(
      'authenticated',
      to_regprocedure('private.record_document_request_activity(uuid,text,text,uuid)'),
      'execute'
    ), false),
  'private helper functions remain unavailable to API roles'
);

select * from finish();
rollback;
