-- Migration: 007_cleanup_claim_validations_table.sql
-- Description: Remove redundant columns from claim_validations table
-- Created: 2025-10-19

-- Set search path to claim_forge schema
SET search_path TO claim_forge, public;

-- Drop redundant columns from claim_validations table
-- These columns are redundant because we have dedicated tables for this data

-- Drop validation_steps column (redundant with validation_steps table)
ALTER TABLE claim_forge.claim_validations 
  DROP COLUMN IF EXISTS validation_steps;

-- Drop final_findings column (redundant with evaluator output)
ALTER TABLE claim_forge.claim_validations 
  DROP COLUMN IF EXISTS final_findings;

-- Drop metadata column (unused generic field)
ALTER TABLE claim_forge.claim_validations 
  DROP COLUMN IF EXISTS metadata;

-- Drop research_results column (redundant with research_results table)
ALTER TABLE claim_forge.claim_validations 
  DROP COLUMN IF EXISTS research_results;

-- Drop planner_questions column (redundant with planner_questions table)
ALTER TABLE claim_forge.claim_validations 
  DROP COLUMN IF EXISTS planner_questions;

-- Drop sanity_check_results column (redundant with sanity_check_results table)
ALTER TABLE claim_forge.claim_validations 
  DROP COLUMN IF EXISTS sanity_check_results;

-- Add comments for the cleaned up table structure
COMMENT ON TABLE claim_forge.claim_validations IS 'Main claim validation records with core data and evaluator outputs';
COMMENT ON COLUMN claim_forge.claim_validations.id IS 'Primary key UUID';
COMMENT ON COLUMN claim_forge.claim_validations.claim_id IS 'Unique claim identifier';
COMMENT ON COLUMN claim_forge.claim_validations.original_claim IS 'Original claim payload for audit trail';
COMMENT ON COLUMN claim_forge.claim_validations.overall_status IS 'Final validation decision: APPROVED, DENIED, or REQUIRES_REVIEW';
COMMENT ON COLUMN claim_forge.claim_validations.confidence IS 'Overall confidence level: low, medium, or high';
COMMENT ON COLUMN claim_forge.claim_validations.processing_time_ms IS 'Total processing time in milliseconds';
COMMENT ON COLUMN claim_forge.claim_validations.question_analysis IS 'Evaluator Agent per-question analysis';
COMMENT ON COLUMN claim_forge.claim_validations.overall_assessment IS 'Evaluator Agent overall claim assessment';
COMMENT ON COLUMN claim_forge.claim_validations.insurance_insights IS 'Evaluator Agent insurance-specific insights';

