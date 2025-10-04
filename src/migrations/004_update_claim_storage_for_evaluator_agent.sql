-- Migration: 004_update_claim_storage_for_evaluator_agent.sql
-- Description: Update claim storage tables to support Evaluator Agent workflow
-- Created: 2025-10-04

-- Set search path to claim_forge schema
SET search_path TO claim_forge, public;

-- Update claim_validations table to match Evaluator Agent output
ALTER TABLE claim_forge.claim_validations 
  ALTER COLUMN overall_status TYPE VARCHAR(20),
  DROP CONSTRAINT IF EXISTS claim_validations_overall_status_check,
  ADD CONSTRAINT claim_validations_overall_status_check 
    CHECK (overall_status IN ('APPROVED', 'DENIED', 'REQUIRES_REVIEW'));

-- Add new columns for Evaluator Agent data
ALTER TABLE claim_forge.claim_validations 
  ADD COLUMN IF NOT EXISTS question_analysis JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS overall_assessment JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS insurance_insights JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS research_results JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS planner_questions JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sanity_check_results JSONB DEFAULT '{}';

-- Update validation_steps to include new agent types
ALTER TABLE claim_forge.validation_steps 
  DROP CONSTRAINT IF EXISTS validation_steps_status_check,
  ADD CONSTRAINT validation_steps_status_check 
    CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped'));

-- Add new columns for enhanced step tracking
ALTER TABLE claim_forge.validation_steps 
  ADD COLUMN IF NOT EXISTS agent_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS model_used VARCHAR(100),
  ADD COLUMN IF NOT EXISTS token_usage JSONB,
  ADD COLUMN IF NOT EXISTS cost_metrics JSONB,
  ADD COLUMN IF NOT EXISTS escalation_reason TEXT;

-- Create new table for storing research results per question
CREATE TABLE IF NOT EXISTS claim_forge.research_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_validation_id UUID REFERENCES claim_forge.claim_validations(id) ON DELETE CASCADE,
    question_id VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    answer TEXT NOT NULL,
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    source VARCHAR(100) NOT NULL,
    extraction_method VARCHAR(20) NOT NULL CHECK (extraction_method IN ('firecrawl', 'multi-model')),
    processing_time_ms INTEGER NOT NULL,
    escalation_reason TEXT,
    firecrawl_data JSONB,
    multi_model_data JSONB,
    recommendations TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create new table for storing planner questions
CREATE TABLE IF NOT EXISTS claim_forge.planner_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_validation_id UUID REFERENCES claim_forge.claim_validations(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('basic', 'specialty', 'subspecialty')),
    question_text TEXT NOT NULL,
    accept_if TEXT[] DEFAULT '{}',
    search_queries TEXT[] DEFAULT '{}',
    risk_flags JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create new table for storing sanity check results
CREATE TABLE IF NOT EXISTS claim_forge.sanity_check_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_validation_id UUID REFERENCES claim_forge.claim_validations(id) ON DELETE CASCADE,
    cpt_codes TEXT[] DEFAULT '{}',
    icd_codes TEXT[] DEFAULT '{}',
    modifiers TEXT[] DEFAULT '{}',
    place_of_service VARCHAR(10),
    clinical_assessment JSONB DEFAULT '{}',
    cms_ncci_results JSONB DEFAULT '{}',
    ssp_predictions JSONB DEFAULT '{}',
    recommendations TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for new tables
CREATE INDEX IF NOT EXISTS idx_research_results_claim_id ON claim_forge.research_results(claim_validation_id);
CREATE INDEX IF NOT EXISTS idx_research_results_question_id ON claim_forge.research_results(question_id);
CREATE INDEX IF NOT EXISTS idx_research_results_confidence ON claim_forge.research_results(confidence);
CREATE INDEX IF NOT EXISTS idx_research_results_extraction_method ON claim_forge.research_results(extraction_method);

CREATE INDEX IF NOT EXISTS idx_planner_questions_claim_id ON claim_forge.planner_questions(claim_validation_id);
CREATE INDEX IF NOT EXISTS idx_planner_questions_type ON claim_forge.planner_questions(question_type);
CREATE INDEX IF NOT EXISTS idx_planner_questions_number ON claim_forge.planner_questions(question_number);

CREATE INDEX IF NOT EXISTS idx_sanity_check_results_claim_id ON claim_forge.sanity_check_results(claim_validation_id);

-- Update existing indexes
CREATE INDEX IF NOT EXISTS idx_validation_steps_agent_type ON claim_forge.validation_steps(agent_type);
CREATE INDEX IF NOT EXISTS idx_validation_steps_model_used ON claim_forge.validation_steps(model_used);

-- Add comments for new tables and columns
COMMENT ON TABLE claim_forge.research_results IS 'Stores research results for each validation question';
COMMENT ON TABLE claim_forge.planner_questions IS 'Stores questions generated by the Planner Agent';
COMMENT ON TABLE claim_forge.sanity_check_results IS 'Stores results from the Sanity Check Agent';

COMMENT ON COLUMN claim_forge.research_results.question_id IS 'Unique identifier for the question';
COMMENT ON COLUMN claim_forge.research_results.question_text IS 'The actual question text';
COMMENT ON COLUMN claim_forge.research_results.answer IS 'The answer provided by research';
COMMENT ON COLUMN claim_forge.research_results.confidence IS 'Confidence score (0.0 to 1.0)';
COMMENT ON COLUMN claim_forge.research_results.source IS 'Source of the answer (e.g., Multi-Model Consensus)';
COMMENT ON COLUMN claim_forge.research_results.extraction_method IS 'Method used: firecrawl or multi-model';
COMMENT ON COLUMN claim_forge.research_results.firecrawl_data IS 'Data from Firecrawl extraction';
COMMENT ON COLUMN claim_forge.research_results.multi_model_data IS 'Data from multi-model analysis';
COMMENT ON COLUMN claim_forge.research_results.recommendations IS 'Recommendations based on research';

COMMENT ON COLUMN claim_forge.planner_questions.question_number IS 'Order of the question';
COMMENT ON COLUMN claim_forge.planner_questions.question_type IS 'Type: basic, specialty, or subspecialty';
COMMENT ON COLUMN claim_forge.planner_questions.question_text IS 'The generated question text';
COMMENT ON COLUMN claim_forge.planner_questions.accept_if IS 'Acceptance criteria for the question';
COMMENT ON COLUMN claim_forge.planner_questions.search_queries IS 'Search queries for research';
COMMENT ON COLUMN claim_forge.planner_questions.risk_flags IS 'Risk flags associated with the question';

COMMENT ON COLUMN claim_forge.sanity_check_results.cpt_codes IS 'CPT codes from the claim';
COMMENT ON COLUMN claim_forge.sanity_check_results.icd_codes IS 'ICD codes from the claim';
COMMENT ON COLUMN claim_forge.sanity_check_results.modifiers IS 'Modifiers from the claim';
COMMENT ON COLUMN claim_forge.sanity_check_results.place_of_service IS 'Place of service code';
COMMENT ON COLUMN claim_forge.sanity_check_results.clinical_assessment IS 'Clinical assessment results';
COMMENT ON COLUMN claim_forge.sanity_check_results.cms_ncci_results IS 'CMS/NCCI validation results';
COMMENT ON COLUMN claim_forge.sanity_check_results.ssp_predictions IS 'Specialty/Subspecialty predictions';

-- Update existing column comments
COMMENT ON COLUMN claim_forge.claim_validations.question_analysis IS 'Per-question analysis from Evaluator Agent';
COMMENT ON COLUMN claim_forge.claim_validations.overall_assessment IS 'Overall claim assessment from Evaluator Agent';
COMMENT ON COLUMN claim_forge.claim_validations.insurance_insights IS 'Insurance-specific insights from Evaluator Agent';
COMMENT ON COLUMN claim_forge.claim_validations.research_results IS 'Consolidated research results';
COMMENT ON COLUMN claim_forge.claim_validations.planner_questions IS 'Questions generated by Planner Agent';
COMMENT ON COLUMN claim_forge.claim_validations.sanity_check_results IS 'Results from Sanity Check Agent';

COMMENT ON COLUMN claim_forge.validation_steps.agent_type IS 'Type of agent (sanity_check, planner, research, evaluator)';
COMMENT ON COLUMN claim_forge.validation_steps.model_used IS 'AI model used for processing';
COMMENT ON COLUMN claim_forge.validation_steps.token_usage IS 'Token usage metrics';
COMMENT ON COLUMN claim_forge.validation_steps.cost_metrics IS 'Cost metrics for the step';
COMMENT ON COLUMN claim_forge.validation_steps.escalation_reason IS 'Reason for escalation to multi-model';
