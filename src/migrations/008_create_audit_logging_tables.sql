-- Create audit logging tables for comprehensive tracking
-- This migration creates tables to store all LLM interactions, service calls, and agent decisions

-- General audit logs table
CREATE TABLE IF NOT EXISTS claim_forge.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    claim_id VARCHAR(255),
    step VARCHAR(100) NOT NULL,
    agent_name VARCHAR(100) NOT NULL,
    action VARCHAR(200) NOT NULL,
    input_data JSONB,
    output_data JSONB,
    metadata JSONB,
    processing_time_ms INTEGER NOT NULL DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LLM-specific audit logs table
CREATE TABLE IF NOT EXISTS claim_forge.llm_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    claim_id VARCHAR(255),
    agent_name VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    tokens_used INTEGER,
    processing_time_ms INTEGER NOT NULL DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Service-specific audit logs table (Firecrawl, Google Search, etc.)
CREATE TABLE IF NOT EXISTS claim_forge.service_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    claim_id VARCHAR(255),
    service_name VARCHAR(100) NOT NULL,
    operation VARCHAR(200) NOT NULL,
    request_data JSONB NOT NULL,
    response_data JSONB NOT NULL,
    processing_time_ms INTEGER NOT NULL DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON claim_forge.audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_claim_id ON claim_forge.audit_logs(claim_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_agent_name ON claim_forge.audit_logs(agent_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON claim_forge.audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON claim_forge.audit_logs(success);

CREATE INDEX IF NOT EXISTS idx_llm_audit_logs_session_id ON claim_forge.llm_audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_llm_audit_logs_claim_id ON claim_forge.llm_audit_logs(claim_id);
CREATE INDEX IF NOT EXISTS idx_llm_audit_logs_agent_name ON claim_forge.llm_audit_logs(agent_name);
CREATE INDEX IF NOT EXISTS idx_llm_audit_logs_model ON claim_forge.llm_audit_logs(model);
CREATE INDEX IF NOT EXISTS idx_llm_audit_logs_timestamp ON claim_forge.llm_audit_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_service_audit_logs_session_id ON claim_forge.service_audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_service_audit_logs_claim_id ON claim_forge.service_audit_logs(claim_id);
CREATE INDEX IF NOT EXISTS idx_service_audit_logs_service_name ON claim_forge.service_audit_logs(service_name);
CREATE INDEX IF NOT EXISTS idx_service_audit_logs_timestamp ON claim_forge.service_audit_logs(timestamp);

-- Add comments for documentation
COMMENT ON TABLE claim_forge.audit_logs IS 'General audit logs for all agent actions and decisions';
COMMENT ON TABLE claim_forge.llm_audit_logs IS 'Detailed logs of all LLM interactions including prompts and responses';
COMMENT ON TABLE claim_forge.service_audit_logs IS 'Logs of all external service interactions (Firecrawl, Google Search, etc.)';

COMMENT ON COLUMN claim_forge.audit_logs.session_id IS 'Unique session identifier for grouping related operations';
COMMENT ON COLUMN claim_forge.audit_logs.step IS 'Workflow step (sanity, planner, research, reviewer, evaluator)';
COMMENT ON COLUMN claim_forge.audit_logs.agent_name IS 'Name of the agent performing the action';
COMMENT ON COLUMN claim_forge.audit_logs.action IS 'Specific action being performed';
COMMENT ON COLUMN claim_forge.audit_logs.input_data IS 'Input data for the action';
COMMENT ON COLUMN claim_forge.audit_logs.output_data IS 'Output data from the action';
COMMENT ON COLUMN claim_forge.audit_logs.metadata IS 'Additional metadata about the action';

COMMENT ON COLUMN claim_forge.llm_audit_logs.prompt IS 'Full prompt sent to the LLM';
COMMENT ON COLUMN claim_forge.llm_audit_logs.response IS 'Full response received from the LLM';
COMMENT ON COLUMN claim_forge.llm_audit_logs.tokens_used IS 'Number of tokens consumed (if available)';

COMMENT ON COLUMN claim_forge.service_audit_logs.service_name IS 'Name of the external service (firecrawl, google_search, etc.)';
COMMENT ON COLUMN claim_forge.service_audit_logs.operation IS 'Specific operation performed';
COMMENT ON COLUMN claim_forge.service_audit_logs.request_data IS 'Request data sent to the service';
COMMENT ON COLUMN claim_forge.service_audit_logs.response_data IS 'Response data received from the service';
