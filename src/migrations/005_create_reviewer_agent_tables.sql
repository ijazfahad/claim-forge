-- Migration: 005_create_reviewer_agent_tables.sql
-- Description: Create tables for Reviewer Agent results and conflict analysis
-- Created: 2025-01-27

-- Set search path to claim_forge schema
SET search_path TO claim_forge, public;

-- Create table for storing Reviewer Agent results
CREATE TABLE IF NOT EXISTS claim_forge.reviewer_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_validation_id UUID REFERENCES claim_forge.claim_validations(id) ON DELETE CASCADE,
    question_id VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    reviewed_answer TEXT NOT NULL,
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    review_status VARCHAR(20) NOT NULL CHECK (review_status IN ('no_conflict', 'resolved', 'unresolvable')),
    review_analysis JSONB NOT NULL DEFAULT '{}',
    source_analysis JSONB NOT NULL DEFAULT '{}',
    recommendations TEXT[] DEFAULT '{}',
    processing_time_ms INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for storing detected conflicts
CREATE TABLE IF NOT EXISTS claim_forge.detected_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_result_id UUID REFERENCES claim_forge.reviewer_results(id) ON DELETE CASCADE,
    conflict_type VARCHAR(20) NOT NULL CHECK (conflict_type IN ('coverage', 'requirements', 'confidence', 'semantic')),
    description TEXT NOT NULL,
    conflicting_sources TEXT[] NOT NULL DEFAULT '{}',
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    resolution_suggestion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for reviewer_results table
CREATE INDEX IF NOT EXISTS idx_reviewer_results_claim_id ON claim_forge.reviewer_results(claim_validation_id);
CREATE INDEX IF NOT EXISTS idx_reviewer_results_question_id ON claim_forge.reviewer_results(question_id);
CREATE INDEX IF NOT EXISTS idx_reviewer_results_confidence ON claim_forge.reviewer_results(confidence);
CREATE INDEX IF NOT EXISTS idx_reviewer_results_status ON claim_forge.reviewer_results(review_status);
CREATE INDEX IF NOT EXISTS idx_reviewer_results_created_at ON claim_forge.reviewer_results(created_at);

-- Create indexes for detected_conflicts table
CREATE INDEX IF NOT EXISTS idx_detected_conflicts_reviewer_id ON claim_forge.detected_conflicts(reviewer_result_id);
CREATE INDEX IF NOT EXISTS idx_detected_conflicts_type ON claim_forge.detected_conflicts(conflict_type);
CREATE INDEX IF NOT EXISTS idx_detected_conflicts_severity ON claim_forge.detected_conflicts(severity);

-- Add comments for documentation
COMMENT ON TABLE claim_forge.reviewer_results IS 'Stores results from Reviewer Agent analysis and conflict resolution';
COMMENT ON TABLE claim_forge.detected_conflicts IS 'Stores individual conflicts detected by Reviewer Agent';

COMMENT ON COLUMN claim_forge.reviewer_results.question_id IS 'Unique identifier for the question';
COMMENT ON COLUMN claim_forge.reviewer_results.question_text IS 'The actual question text';
COMMENT ON COLUMN claim_forge.reviewer_results.reviewed_answer IS 'The final answer after review and conflict resolution';
COMMENT ON COLUMN claim_forge.reviewer_results.confidence IS 'Final confidence score after review (0.0 to 1.0)';
COMMENT ON COLUMN claim_forge.reviewer_results.review_status IS 'Status of the review: no_conflict, resolved, or unresolvable';
COMMENT ON COLUMN claim_forge.reviewer_results.review_analysis IS 'Analysis data including conflicts, resolution strategy, and confidence adjustment';
COMMENT ON COLUMN claim_forge.reviewer_results.source_analysis IS 'Contribution analysis for each source (Firecrawl, Claude, GPT-5, DeepSeek)';
COMMENT ON COLUMN claim_forge.reviewer_results.recommendations IS 'Recommendations based on review analysis';

COMMENT ON COLUMN claim_forge.detected_conflicts.conflict_type IS 'Type of conflict: coverage, requirements, confidence, or semantic';
COMMENT ON COLUMN claim_forge.detected_conflicts.description IS 'Description of the conflict';
COMMENT ON COLUMN claim_forge.detected_conflicts.conflicting_sources IS 'Array of sources that are in conflict';
COMMENT ON COLUMN claim_forge.detected_conflicts.severity IS 'Severity level: low, medium, or high';
COMMENT ON COLUMN claim_forge.detected_conflicts.resolution_suggestion IS 'Suggested resolution for the conflict';
