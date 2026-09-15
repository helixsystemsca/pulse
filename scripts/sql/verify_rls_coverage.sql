-- RLS coverage verification (run in Supabase SQL editor or psql as owner).
-- Target after alembic upgrade head (1051_rls_coverage): zero public tables
-- without RLS, and pulse_rls_* helpers with a fixed search_path.

-- 1) Tables in public without RLS (must be empty — advisor rls_disabled_in_public)
SELECT c.relname AS table_without_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY 1;

-- 2) Tables with RLS but not FORCE (alembic_version is the only expected row)
SELECT c.relname AS rls_not_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity
  AND NOT c.relforcerowsecurity
ORDER BY 1;

-- 3) Application tables missing policies (alembic_version is expected: lockdown, no policies)
SELECT c.relname AS missing_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname <> 'alembic_version'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname
  )
ORDER BY 1;

-- 4) Helper search_path (must be non-null / include pg_catalog — not mutable)
SELECT p.proname, p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE 'pulse_rls_%'
ORDER BY 1;

-- 5) pulse_app must not bypass RLS (empty if the role is not created yet)
SELECT rolname, rolsuper, rolbypassrls
FROM pg_roles
WHERE rolname = 'pulse_app';
