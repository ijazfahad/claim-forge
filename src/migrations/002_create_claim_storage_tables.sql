-- Migration: 002_create_claim_storage_tables.sql
-- Description: Create claim validation storage tables
-- Created: 2025-09-27

-- Create claim_forge schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS claim_forge;

-- Set search path to claim_forge schema
SET search_path TO claim_forge, public;

-- Claim validations table
CREATE TABLE IF NOT EXISTS claim_forge.claim_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id VARCHAR(255) UNIQUE NOT NULL,
    original_claim JSONB NOT NULL,
    overall_status VARCHAR(20) NOT NULL CHECK (overall_status IN ('GO', 'NO_GO', 'NEEDS_REVIEW')),
    confidence VARCHAR(10) NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
    processing_time_ms INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validation_steps JSONB NOT NULL DEFAULT '[]',
    final_findings JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Indexes for claim validations
CREATE INDEX IF NOT EXISTS idx_claim_validations_claim_id ON claim_forge.claim_validations(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_validations_created_at ON claim_forge.claim_validations(created_at);
CREATE INDEX IF NOT EXISTS idx_claim_validations_status ON claim_forge.claim_validations(overall_status);
CREATE INDEX IF NOT EXISTS idx_claim_validations_confidence ON claim_forge.claim_validations(confidence);
CREATE INDEX IF NOT EXISTS idx_claim_validations_processing_time ON claim_forge.claim_validations(processing_time_ms);

-- Validation steps table
CREATE TABLE IF NOT EXISTS claim_forge.validation_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_validation_id UUID REFERENCES claim_forge.claim_validations(id) ON DELETE CASCADE,
    step_name VARCHAR(100) NOT NULL,
    step_order INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_ms INTEGER,
    input_data JSONB,
    output_data JSONB,
    errors TEXT[],
    warnings TEXT[],
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for validation steps
CREATE INDEX IF NOT EXISTS idx_validation_steps_claim_id ON claim_forge.validation_steps(claim_validation_id);
CREATE INDEX IF NOT EXISTS idx_validation_steps_step_name ON claim_forge.validation_steps(step_name);
CREATE INDEX IF NOT EXISTS idx_validation_steps_step_order ON claim_forge.validation_steps(step_order);
CREATE INDEX IF NOT EXISTS idx_validation_steps_status ON claim_forge.validation_steps(status);
CREATE INDEX IF NOT EXISTS idx_validation_steps_start_time ON claim_forge.validation_steps(start_time);

-- Test cases table for tracking test results
CREATE TABLE IF NOT EXISTS claim_forge.test_case_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_case_id VARCHAR(100) NOT NULL,
    test_case_name VARCHAR(255) NOT NULL,
    test_case_category VARCHAR(50) NOT NULL,
    expected_result VARCHAR(20) NOT NULL CHECK (expected_result IN ('GO', 'NO_GO', 'NEEDS_REVIEW')),
    actual_result VARCHAR(20) CHECK (actual_result IN ('GO', 'NO_GO', 'NEEDS_REVIEW')),
    matches_expected BOOLEAN,
    processing_time_ms INTEGER,
    confidence VARCHAR(10) CHECK (confidence IN ('low', 'medium', 'high')),
    claim_validation_id UUID REFERENCES claim_forge.claim_validations(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for test case results
CREATE INDEX IF NOT EXISTS idx_test_case_results_test_case_id ON claim_forge.test_case_results(test_case_id);
CREATE INDEX IF NOT EXISTS idx_test_case_results_category ON claim_forge.test_case_results(test_case_category);
CREATE INDEX IF NOT EXISTS idx_test_case_results_matches_expected ON claim_forge.test_case_results(matches_expected);
CREATE INDEX IF NOT EXISTS idx_test_case_results_created_at ON claim_forge.test_case_results(created_at);

-- Add comments for documentation
COMMENT ON TABLE claim_forge.claim_validations IS 'Stores complete claim validation records with original claim and results';
COMMENT ON TABLE claim_forge.validation_steps IS 'Stores individual validation steps for each claim validation';
COMMENT ON TABLE claim_forge.test_case_results IS 'Stores results of automated test case executions';

COMMENT ON COLUMN claim_forge.claim_validations.original_claim IS 'Original claim payload as submitted';
COMMENT ON COLUMN claim_forge.claim_validations.overall_status IS 'Final validation decision (GO/NO_GO/NEEDS_REVIEW)';
COMMENT ON COLUMN claim_forge.claim_validations.confidence IS 'Confidence level of the validation decision';
COMMENT ON COLUMN claim_forge.claim_validations.processing_time_ms IS 'Total time taken to process the claim in milliseconds';
COMMENT ON COLUMN claim_forge.claim_validations.validation_steps IS 'Array of validation steps performed';
COMMENT ON COLUMN claim_forge.claim_validations.final_findings IS 'Final findings including errors, warnings, and recommendations';
COMMENT ON COLUMN claim_forge.claim_validations.metadata IS 'Additional metadata about the validation request';

COMMENT ON COLUMN claim_forge.validation_steps.step_name IS 'Name of the validation step (e.g., sanity_check, planner, research)';
COMMENT ON COLUMN claim_forge.validation_steps.step_order IS 'Order in which the step was executed';
COMMENT ON COLUMN claim_forge.validation_steps.status IS 'Current status of the validation step';
COMMENT ON COLUMN claim_forge.validation_steps.input_data IS 'Input data for the validation step';
COMMENT ON COLUMN claim_forge.validation_steps.output_data IS 'Output data from the validation step';
COMMENT ON COLUMN claim_forge.validation_steps.errors IS 'Array of error messages from the step';
COMMENT ON COLUMN claim_forge.validation_steps.warnings IS 'Array of warning messages from the step';
COMMENT ON COLUMN claim_forge.validation_steps.confidence_score IS 'Confidence score for the step (0.0 to 1.0)';

COMMENT ON COLUMN claim_forge.test_case_results.test_case_id IS 'Unique identifier for the test case';
COMMENT ON COLUMN claim_forge.test_case_results.expected_result IS 'Expected validation result for the test case';
COMMENT ON COLUMN claim_forge.test_case_results.actual_result IS 'Actual validation result from the system';
COMMENT ON COLUMN claim_forge.test_case_results.matches_expected IS 'Whether the actual result matches the expected result';
