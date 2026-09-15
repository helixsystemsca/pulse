-- Pulse application role for PostgreSQL Row Level Security.
--
-- Run as a migration/owner role (postgres or supabase_admin) — NOT as pulse_app.
-- Do not commit a live password. Set the password in the SQL editor / secret store
-- when you execute this, or run ALTER ROLE afterwards.
--
-- Apply order:
--   1. alembic upgrade head          -- includes 1051_rls_coverage
--   2. this script
--   3. Point Render DATABASE_URL at pulse_app (sslmode=require)
--   4. DATABASE_RLS_CONTEXT_ENABLED=true
--   5. DATABASE_RLS_ENFORCED=true

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pulse_app') THEN
    CREATE ROLE pulse_app
      NOINHERIT
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS;
  ELSE
    ALTER ROLE pulse_app
      NOINHERIT
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS;
  END IF;
END
$$;

-- Set a unique password out-of-band, for example:
--   ALTER ROLE pulse_app PASSWORD 'replace-me-from-secret-store';
-- Never store that value in git, tickets, or screenshots.

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO pulse_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO pulse_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pulse_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pulse_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO pulse_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pulse_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO pulse_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO pulse_app;

-- Migration history is not an application table. RLS is enabled with no
-- policies; also revoke table privileges so the app role cannot touch it.
REVOKE ALL ON TABLE alembic_version FROM pulse_app;

COMMIT;

-- Optional: confirm the role cannot bypass RLS
--   SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'pulse_app';
-- Expected: rolbypassrls = false, rolsuper = false
