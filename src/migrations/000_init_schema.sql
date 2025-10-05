-- Initialize the claim_forge schema
CREATE SCHEMA IF NOT EXISTS claim_forge;

-- Grant permissions to the claimvalidator user
GRANT ALL PRIVILEGES ON SCHEMA claim_forge TO claimvalidator;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA claim_forge TO claimvalidator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA claim_forge TO claimvalidator;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA claim_forge GRANT ALL ON TABLES TO claimvalidator;
ALTER DEFAULT PRIVILEGES IN SCHEMA claim_forge GRANT ALL ON SEQUENCES TO claimvalidator;

