/*
  Pulse procedure training / compliance — companion to Alembic revision 0105_pulse_procedure_training.

  Primary schema changes are applied via Alembic in this repository. Use this file if you manage
  identical tables in Supabase and need Row Level Security for direct PostgREST / client access.

  RLS policy sketch (adjust JWT claims to match your Supabase auth wrapper):

  - pulse_procedure_compliance_settings
    SELECT: auth.uid() is a user in the same company_id as the row (via profiles table).
    INSERT/UPDATE/DELETE: user has role in (company_admin, manager) for that company.

  - pulse_procedure_training_assignments
    SELECT: assignment.employee_user_id = auth.uid() OR user is manager/admin in company.
    INSERT/UPDATE/DELETE: manager+ for company (workers cannot self-assign).

  - pulse_procedure_completion_signoffs / pulse_procedure_acknowledgements
    SELECT: employee_user_id = auth.uid() OR manager+ in company.
    INSERT: employee completes own row, or manager+ for proxy sign-off/ack (match API rules).

  - pulse_training_notification_events
    SELECT/INSERT: restricted to service role or manager+; workers typically have no direct read.

  Enable RLS example (run only if these tables exist in Supabase):
    ALTER TABLE pulse_procedure_compliance_settings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE pulse_procedure_training_assignments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE pulse_procedure_completion_signoffs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE pulse_procedure_acknowledgements ENABLE ROW LEVEL SECURITY;
    ALTER TABLE pulse_training_notification_events ENABLE ROW LEVEL SECURITY;
*/

-- Intentionally empty: policies are tenant-specific (JWT shape, profiles FK). Mirror Alembic DDL in
-- Supabase SQL editor if PostgREST will expose these tables; otherwise FastAPI bypasses RLS.

