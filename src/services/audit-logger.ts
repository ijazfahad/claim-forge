import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogEntry {
  id: string;
  session_id: string;
  claim_id?: string;
  step: string;
  agent_name: string;
  action: string;
  input_data?: any;
  output_data?: any;
  metadata?: any;
  processing_time_ms: number;
  timestamp: string;
  success: boolean;
  error_message?: string;
}

export interface LLMAuditLog {
  id: string;
  session_id: string;
  claim_id?: string;
  agent_name: string;
  model: string;
  prompt: string;
  response: string;
  tokens_used?: number;
  processing_time_ms: number;
  timestamp: string;
  success: boolean;
  error_message?: string;
}

export interface ServiceAuditLog {
  id: string;
  session_id: string;
  claim_id?: string;
  service_name: string;
  operation: string;
  request_data: any;
  response_data: any;
  processing_time_ms: number;
  timestamp: string;
  success: boolean;
  error_message?: string;
}

export class AuditLogger {
  private pool: Pool;
  private sessionId: string;

  constructor(pool: Pool, sessionId?: string) {
    this.pool = pool;
    this.sessionId = sessionId || uuidv4();
  }

  /**
   * Log general audit events
   */
  async logAuditEvent(
    step: string,
    agentName: string,
    action: string,
    inputData?: any,
    outputData?: any,
    metadata?: any,
    processingTimeMs: number = 0,
    success: boolean = true,
    errorMessage?: string,
    claimId?: string
  ): Promise<void> {
    const logEntry: AuditLogEntry = {
      id: uuidv4(),
      session_id: this.sessionId,
      claim_id: claimId,
      step,
      agent_name: agentName,
      action,
      input_data: inputData,
      output_data: outputData,
      metadata: metadata,
      processing_time_ms: processingTimeMs,
      timestamp: new Date().toISOString(),
      success,
      error_message: errorMessage
    };

    try {
      await this.pool.query(`
        INSERT INTO claim_forge.audit_logs (
          id, session_id, claim_id, step, agent_name, action, 
          input_data, output_data, metadata, processing_time_ms, 
          timestamp, success, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        logEntry.id,
        logEntry.session_id,
        logEntry.claim_id,
        logEntry.step,
        logEntry.agent_name,
        logEntry.action,
        JSON.stringify(logEntry.input_data),
        JSON.stringify(logEntry.output_data),
        JSON.stringify(logEntry.metadata),
        logEntry.processing_time_ms,
        logEntry.timestamp,
        logEntry.success,
        logEntry.error_message
      ]);

      // Also log to console for immediate visibility
      console.log(`\n📋 AUDIT LOG: ${agentName} - ${action}`);
      console.log(`   Session: ${this.sessionId}`);
      console.log(`   Step: ${step}`);
      console.log(`   Processing Time: ${processingTimeMs}ms`);
      console.log(`   Success: ${success}`);
      if (inputData) {
        console.log(`   Input: ${JSON.stringify(inputData, null, 2).substring(0, 500)}...`);
      }
      if (outputData) {
        console.log(`   Output: ${JSON.stringify(outputData, null, 2).substring(0, 500)}...`);
      }
      if (errorMessage) {
        console.log(`   Error: ${errorMessage}`);
      }
      console.log('');

    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  /**
   * Log LLM interactions
   */
  async logLLMInteraction(
    agentName: string,
    model: string,
    prompt: string,
    response: string,
    processingTimeMs: number,
    success: boolean = true,
    errorMessage?: string,
    tokensUsed?: number,
    claimId?: string
  ): Promise<void> {
    const logEntry: LLMAuditLog = {
      id: uuidv4(),
      session_id: this.sessionId,
      claim_id: claimId,
      agent_name: agentName,
      model,
      prompt,
      response,
      tokens_used: tokensUsed,
      processing_time_ms: processingTimeMs,
      timestamp: new Date().toISOString(),
      success,
      error_message: errorMessage
    };

    try {
      await this.pool.query(`
        INSERT INTO claim_forge.llm_audit_logs (
          id, session_id, claim_id, agent_name, model, prompt, 
          response, tokens_used, processing_time_ms, timestamp, 
          success, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        logEntry.id,
        logEntry.session_id,
        logEntry.claim_id,
        logEntry.agent_name,
        logEntry.model,
        logEntry.prompt,
        logEntry.response,
        logEntry.tokens_used,
        logEntry.processing_time_ms,
        logEntry.timestamp,
        logEntry.success,
        logEntry.error_message
      ]);

      // Console logging for LLM interactions
      console.log(`\n🤖 LLM AUDIT: ${agentName} (${model})`);
      console.log(`   Session: ${this.sessionId}`);
      console.log(`   Processing Time: ${processingTimeMs}ms`);
      console.log(`   Tokens Used: ${tokensUsed || 'N/A'}`);
      console.log(`   Success: ${success}`);
      console.log(`   Prompt: ${prompt.substring(0, 200)}...`);
      console.log(`   Response: ${response.substring(0, 200)}...`);
      if (errorMessage) {
        console.log(`   Error: ${errorMessage}`);
      }
      console.log('');

    } catch (error) {
      console.error('Failed to log LLM interaction:', error);
    }
  }

  /**
   * Log service interactions (Firecrawl, Google Search, etc.)
   */
  async logServiceInteraction(
    serviceName: string,
    operation: string,
    requestData: any,
    responseData: any,
    processingTimeMs: number,
    success: boolean = true,
    errorMessage?: string,
    claimId?: string
  ): Promise<void> {
    const logEntry: ServiceAuditLog = {
      id: uuidv4(),
      session_id: this.sessionId,
      claim_id: claimId,
      service_name: serviceName,
      operation,
      request_data: requestData,
      response_data: responseData,
      processing_time_ms: processingTimeMs,
      timestamp: new Date().toISOString(),
      success,
      error_message: errorMessage
    };

    try {
      await this.pool.query(`
        INSERT INTO claim_forge.service_audit_logs (
          id, session_id, claim_id, service_name, operation, 
          request_data, response_data, processing_time_ms, 
          timestamp, success, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        logEntry.id,
        logEntry.session_id,
        logEntry.claim_id,
        logEntry.service_name,
        logEntry.operation,
        JSON.stringify(logEntry.request_data),
        JSON.stringify(logEntry.response_data),
        logEntry.processing_time_ms,
        logEntry.timestamp,
        logEntry.success,
        logEntry.error_message
      ]);

      // Console logging for service interactions
      console.log(`\n🔧 SERVICE AUDIT: ${serviceName} - ${operation}`);
      console.log(`   Session: ${this.sessionId}`);
      console.log(`   Processing Time: ${processingTimeMs}ms`);
      console.log(`   Success: ${success}`);
      console.log(`   Request: ${JSON.stringify(requestData, null, 2).substring(0, 300)}...`);
      console.log(`   Response: ${JSON.stringify(responseData, null, 2).substring(0, 300)}...`);
      if (errorMessage) {
        console.log(`   Error: ${errorMessage}`);
      }
      console.log('');

    } catch (error) {
      console.error('Failed to log service interaction:', error);
    }
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Create a new session
   */
  static createSession(pool: Pool): AuditLogger {
    return new AuditLogger(pool);
  }
}
