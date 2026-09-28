-- Removes the leftover role from the old `yadet` database migration.
--
-- Verified safe (2026-09-28): the role owns no tables, no databases and has no
-- granted members. Only the role entry itself is stale.
--
-- Run as a superuser, because the `yadette` role lacks CREATEROLE + ADMIN:
--
--   psql -U postgres -d yadette -f scripts/drop-stale-role.sql
--
-- In psql, a failure rolls back only that statement, so the transaction below
-- cannot leave the role half-removed.

BEGIN;

DO $$
DECLARE
  owned_tables   bigint;
  owned_databases bigint;
  members        bigint;
BEGIN
  SELECT count(*) INTO owned_tables
  FROM pg_class c
  JOIN pg_roles r ON r.oid = c.relowner
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE r.rolname = 'yadet' AND n.nspname NOT IN ('pg_catalog', 'information_schema');

  SELECT count(*) INTO owned_databases
  FROM pg_database d JOIN pg_roles r ON r.oid = d.datdba
  WHERE r.rolname = 'yadet';

  SELECT count(*) INTO members
  FROM pg_auth_members am JOIN pg_roles r ON r.oid = am.roleid
  WHERE r.rolname = 'yadet';

  IF owned_tables > 0 OR owned_databases > 0 OR members > 0 THEN
    RAISE EXCEPTION
      'yadet still owns % tables, % databases, % grants — inspect before dropping',
      owned_tables, owned_databases, members;
  END IF;
END
$$;

DROP ROLE IF EXISTS "yadet";

COMMIT;

-- Verify: should return zero rows.
-- SELECT rolname FROM pg_roles WHERE rolname = 'yadet';
