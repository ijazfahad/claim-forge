-- Migration: 001_create_cms_ncci_tables.sql
-- Description: Create CMS/NCCI validation tables
-- Created: 2025-09-27

-- Create claim_forge schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS claim_forge;

-- Set search path to claim_forge schema
SET search_path TO claim_forge, public;

-- PTP (Procedure-to-Procedure) edits table
CREATE TABLE IF NOT EXISTS claim_forge.ptp_edits (
    id SERIAL PRIMARY KEY,
    column1 VARCHAR(20) NOT NULL,
    column2 VARCHAR(20) NOT NULL,
    modifier_indicator VARCHAR(10),   -- e.g., 0, 1 (CMS semantics)
    effective_date VARCHAR(50),
    provider_type VARCHAR(50),        -- practitioner/hospital if derivable
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for PTP edits
CREATE INDEX IF NOT EXISTS idx_ptp_c1c2 ON claim_forge.ptp_edits(column1, column2);
CREATE INDEX IF NOT EXISTS idx_ptp_provider_type ON claim_forge.ptp_edits(provider_type);
CREATE INDEX IF NOT EXISTS idx_ptp_effective_date ON claim_forge.ptp_edits(effective_date);

-- MUE (Medically Unlikely Edits) table
CREATE TABLE IF NOT EXISTS claim_forge.mue (
    id SERIAL PRIMARY KEY,
    hcpcs_cpt VARCHAR(20) NOT NULL,
    mue_value INTEGER NOT NULL,
    effective_date VARCHAR(50),
    service_type VARCHAR(50),         -- practitioner/hospital/dme etc if derivable
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for MUE
CREATE INDEX IF NOT EXISTS idx_mue_code ON claim_forge.mue(hcpcs_cpt);
CREATE INDEX IF NOT EXISTS idx_mue_service_type ON claim_forge.mue(service_type);
CREATE INDEX IF NOT EXISTS idx_mue_effective_date ON claim_forge.mue(effective_date);

-- AOC (Add-On Code) edits table
CREATE TABLE IF NOT EXISTS claim_forge.aoc (
    id SERIAL PRIMARY KEY,
    addon_code VARCHAR(20) NOT NULL,
    primary_code VARCHAR(20) NOT NULL,
    effective_date VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for AOC
CREATE INDEX IF NOT EXISTS idx_aoc_addon ON claim_forge.aoc(addon_code);
CREATE INDEX IF NOT EXISTS idx_aoc_primary ON claim_forge.aoc(primary_code);
CREATE INDEX IF NOT EXISTS idx_aoc_effective_date ON claim_forge.aoc(effective_date);

-- Add comments for documentation
COMMENT ON TABLE claim_forge.ptp_edits IS 'Procedure-to-Procedure edits from CMS/NCCI';
COMMENT ON TABLE claim_forge.mue IS 'Medically Unlikely Edits from CMS/NCCI';
COMMENT ON TABLE claim_forge.aoc IS 'Add-On Code edits from CMS/NCCI';

COMMENT ON COLUMN claim_forge.ptp_edits.column1 IS 'First CPT/HCPCS code in the edit pair';
COMMENT ON COLUMN claim_forge.ptp_edits.column2 IS 'Second CPT/HCPCS code in the edit pair';
COMMENT ON COLUMN claim_forge.ptp_edits.modifier_indicator IS 'Indicates if modifiers can bypass the edit (0=no, 1=yes)';

COMMENT ON COLUMN claim_forge.mue.hcpcs_cpt IS 'CPT or HCPCS code';
COMMENT ON COLUMN claim_forge.mue.mue_value IS 'Maximum units allowed per day';
COMMENT ON COLUMN claim_forge.mue.service_type IS 'Type of service (practitioner, hospital, dme, etc.)';

COMMENT ON COLUMN claim_forge.aoc.addon_code IS 'Add-on procedure code';
COMMENT ON COLUMN claim_forge.aoc.primary_code IS 'Required primary procedure code';
