-- ─── NFS-e Emissor - Database Initialization ──────────────────
-- This script runs automatically on first PostgreSQL start.

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE nfse_db TO nfse_user;

-- Log initialization
DO $$
BEGIN
  RAISE NOTICE '✅ NFS-e database initialized successfully';
END $$;
