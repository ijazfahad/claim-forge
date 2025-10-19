-- Migration: 006_fix_detected_conflicts_schema.sql
-- Description: Fix detected_conflicts table to include claim_validation_id column
-- Created: 2025-01-27

-- Set search path to claim_forge schema
SET search_path TO claim_forge, public;

-- Add claim_validation_id column to detected_conflicts table
ALTER TABLE claim_forge.detected_conflicts 
ADD COLUMN IF NOT EXISTS claim_validation_id UUID REFERENCES claim_forge.claim_validations(id) ON DELETE CASCADE;

-- Add question_text column to detected_conflicts table (if not already exists)
ALTER TABLE claim_forge.detected_conflicts 
ADD COLUMN IF NOT EXISTS question_text TEXT;

-- Create index for claim_validation_id for better query performance
CREATE INDEX IF NOT EXISTS idx_detected_conflicts_claim_id ON claim_forge.detected_conflicts(claim_validation_id);

-- Add comments for documentation
COMMENT ON COLUMN claim_forge.detected_conflicts.claim_validation_id IS 'Reference to the claim validation this conflict belongs to';
COMMENT ON COLUMN claim_forge.detected_conflicts.question_text IS 'The question text that generated this conflict';
