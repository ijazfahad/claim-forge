-- Migration: 003_create_updated_at_triggers.sql
-- Description: Create triggers to automatically update the updated_at timestamp
-- Created: 2025-09-27

-- Create claim_forge schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS claim_forge;

-- Set search path to claim_forge schema
SET search_path TO claim_forge, public;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION claim_forge.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for ptp_edits table
DROP TRIGGER IF EXISTS update_ptp_edits_updated_at ON claim_forge.ptp_edits;
CREATE TRIGGER update_ptp_edits_updated_at
    BEFORE UPDATE ON claim_forge.ptp_edits
    FOR EACH ROW
    EXECUTE FUNCTION claim_forge.update_updated_at_column();

-- Trigger for mue table
DROP TRIGGER IF EXISTS update_mue_updated_at ON claim_forge.mue;
CREATE TRIGGER update_mue_updated_at
    BEFORE UPDATE ON claim_forge.mue
    FOR EACH ROW
    EXECUTE FUNCTION claim_forge.update_updated_at_column();

-- Trigger for aoc table
DROP TRIGGER IF EXISTS update_aoc_updated_at ON claim_forge.aoc;
CREATE TRIGGER update_aoc_updated_at
    BEFORE UPDATE ON claim_forge.aoc
    FOR EACH ROW
    EXECUTE FUNCTION claim_forge.update_updated_at_column();

-- Trigger for claim_validations table
DROP TRIGGER IF EXISTS update_claim_validations_updated_at ON claim_forge.claim_validations;
CREATE TRIGGER update_claim_validations_updated_at
    BEFORE UPDATE ON claim_forge.claim_validations
    FOR EACH ROW
    EXECUTE FUNCTION claim_forge.update_updated_at_column();
