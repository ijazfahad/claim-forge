import { Pool, PoolClient } from 'pg';
import { ClaimPayload } from '../types/claim-types';
import { EvaluatorDecision } from '../agents/evaluator-agent';
import { ResearchResult } from '../agents/research-agent';
import { ValidationQuestion } from '../agents/planner-agent';
import { SanityCheckResult } from '../agents/sanity-check-agent';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface ClaimValidationRecord {
  id: string;
  claim_id: string;
  original_claim: ClaimPayload;
  overall_status: 'APPROVED' | 'DENIED' | 'REQUIRES_REVIEW';
  confidence: 'low' | 'medium' | 'high';
  processing_time_ms: number;
  question_analysis: any[];
  overall_assessment: any;
  insurance_insights: any;
  research_results: ResearchResult[];
  planner_questions: ValidationQuestion[];
  sanity_check_results: SanityCheckResult;
  created_at: Date;
  updated_at: Date;
}

export interface ValidationStepRecord {
  id: string;
  claim_validation_id: string;
  step_name: string;
  step_order: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  start_time: Date;
  end_time?: Date;
  duration_ms?: number;
  input_data?: any;
  output_data?: any;
  errors?: string[];
  warnings?: string[];
  confidence_score?: number;
  agent_type?: string;
  model_used?: string;
  token_usage?: any;
  cost_metrics?: any;
  escalation_reason?: string;
  created_at: Date;
}

export class ClaimStorageService {
  private pool: Pool;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1') 
        ? false 
        : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  /**
   * Store just the claim payload (initial storage)
   */
  async storeClaimPayload(claimId: string, payload: ClaimPayload): Promise<string> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Insert initial claim validation record with minimal data
      const claimValidationQuery = `
        INSERT INTO claim_forge.claim_validations (
          claim_id, original_claim, overall_status, confidence, processing_time_ms,
          question_analysis, overall_assessment, insurance_insights,
          research_results, planner_questions, sanity_check_results
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `;

      const claimValidationResult = await client.query(claimValidationQuery, [
        claimId,
        JSON.stringify(payload),
        'REQUIRES_REVIEW', // Initial status
        'low', // Initial confidence
        0, // Initial processing time
        JSON.stringify([]), // Empty question analysis
        JSON.stringify({}), // Empty overall assessment
        JSON.stringify({}), // Empty insurance insights
        JSON.stringify([]), // Empty research results
        JSON.stringify([]), // Empty planner questions
        JSON.stringify({}) // Empty sanity check results
      ]);

      const claimValidationId = claimValidationResult.rows[0].id;
      
      await client.query('COMMIT');
      console.log(`✅ Claim payload stored with validation ID: ${claimValidationId}`);
      return claimValidationId;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to store claim payload:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Store a complete claim validation record
   */
  async storeClaimValidation(
    claimId: string,
    originalClaim: ClaimPayload,
    evaluatorResult: EvaluatorDecision,
    researchResults: ResearchResult[],
    plannerQuestions: ValidationQuestion[],
    sanityCheckResults: SanityCheckResult
  ): Promise<string> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Insert main claim validation record
      const claimValidationQuery = `
        INSERT INTO claim_forge.claim_validations (
          claim_id, original_claim, overall_status, confidence, processing_time_ms,
          question_analysis, overall_assessment, insurance_insights,
          research_results, planner_questions, sanity_check_results
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `;

      const claimValidationResult = await client.query(claimValidationQuery, [
        claimId,
        JSON.stringify(originalClaim),
        evaluatorResult.overall_status,
        evaluatorResult.confidence,
        evaluatorResult.processing_time_ms,
        JSON.stringify(evaluatorResult.question_analysis),
        JSON.stringify(evaluatorResult.overall_assessment),
        JSON.stringify(evaluatorResult.insurance_insights),
        JSON.stringify(researchResults),
        JSON.stringify(plannerQuestions),
        JSON.stringify(sanityCheckResults)
      ]);

      const claimValidationId = claimValidationResult.rows[0].id;

      // Store individual research results
      for (let i = 0; i < researchResults.length; i++) {
        const result = researchResults[i];
        await this.storeResearchResult(claimValidationId, result);
      }

      // Store planner questions
      for (const question of plannerQuestions) {
        await this.storePlannerQuestion(client, claimValidationId, question);
      }

      // Store sanity check results
      await this.storeSanityCheckResult(client, claimValidationId, sanityCheckResults);

      await client.query('COMMIT');
      return claimValidationId;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error storing claim validation:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Store a validation step
   */
  async storeValidationStep(stepData: Partial<ValidationStepRecord>): Promise<string> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO claim_forge.validation_steps (
          claim_validation_id, step_name, step_order, status, start_time, end_time,
          duration_ms, input_data, output_data, errors, warnings, confidence_score,
          agent_type, model_used, token_usage, cost_metrics, escalation_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id
      `;

      const result = await client.query(query, [
        stepData.claim_validation_id,
        stepData.step_name,
        stepData.step_order,
        stepData.status,
        stepData.start_time,
        stepData.end_time,
        stepData.duration_ms,
        stepData.input_data ? JSON.stringify(stepData.input_data) : null,
        stepData.output_data ? JSON.stringify(stepData.output_data) : null,
        stepData.errors,
        stepData.warnings,
        stepData.confidence_score,
        stepData.agent_type,
        stepData.model_used,
        stepData.token_usage ? JSON.stringify(stepData.token_usage) : null,
        stepData.cost_metrics ? JSON.stringify(stepData.cost_metrics) : null,
        stepData.escalation_reason
      ]);

      return result.rows[0].id;

    } catch (error) {
      console.error('Error storing validation step:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update a claim validation record
   */
  async updateClaimValidation(claimValidationId: string, updates: {
    overall_status?: string;
    confidence?: string;
    processing_time_ms?: number;
    overall_assessment?: any;
    insurance_insights?: any;
  }): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.overall_status !== undefined) {
        updateFields.push(`overall_status = $${paramIndex}`);
        values.push(updates.overall_status);
        paramIndex++;
      }

      if (updates.confidence !== undefined) {
        updateFields.push(`confidence = $${paramIndex}`);
        values.push(updates.confidence);
        paramIndex++;
      }

      if (updates.processing_time_ms !== undefined) {
        updateFields.push(`processing_time_ms = $${paramIndex}`);
        values.push(updates.processing_time_ms);
        paramIndex++;
      }

      if (updates.overall_assessment !== undefined) {
        updateFields.push(`overall_assessment = $${paramIndex}`);
        values.push(JSON.stringify(updates.overall_assessment));
        paramIndex++;
      }

      if (updates.insurance_insights !== undefined) {
        updateFields.push(`insurance_insights = $${paramIndex}`);
        values.push(JSON.stringify(updates.insurance_insights));
        paramIndex++;
      }

      if (updateFields.length === 0) {
        console.log('No fields to update');
        return;
      }

      values.push(claimValidationId); // Add ID as last parameter

      const query = `
        UPDATE claim_forge.claim_validations 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
      `;

      await client.query(query, values);
      console.log(`✅ Claim validation ${claimValidationId} updated successfully`);

    } catch (error) {
      console.error('Error updating claim validation:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a claim validation record by claim ID
   */
  async getClaimValidation(claimId: string): Promise<ClaimValidationRecord | null> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM claim_forge.claim_validations 
        WHERE claim_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const result = await client.query(query, [claimId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        claim_id: row.claim_id,
        original_claim: row.original_claim,
        overall_status: row.overall_status,
        confidence: row.confidence,
        processing_time_ms: row.processing_time_ms,
        question_analysis: row.question_analysis,
        overall_assessment: row.overall_assessment,
        insurance_insights: row.insurance_insights,
        research_results: row.research_results,
        planner_questions: row.planner_questions,
        sanity_check_results: row.sanity_check_results,
        created_at: row.created_at,
        updated_at: row.updated_at
      };

    } catch (error) {
      console.error('Error getting claim validation:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get validation steps for a claim
   */
  async getValidationSteps(claimValidationId: string): Promise<ValidationStepRecord[]> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM claim_forge.validation_steps 
        WHERE claim_validation_id = $1
        ORDER BY step_order, created_at
      `;

      const result = await client.query(query, [claimValidationId]);
      
      return result.rows.map(row => ({
        id: row.id,
        claim_validation_id: row.claim_validation_id,
        step_name: row.step_name,
        step_order: row.step_order,
        status: row.status,
        start_time: row.start_time,
        end_time: row.end_time,
        duration_ms: row.duration_ms,
        input_data: row.input_data,
        output_data: row.output_data,
        errors: row.errors,
        warnings: row.warnings,
        confidence_score: row.confidence_score,
        agent_type: row.agent_type,
        model_used: row.model_used,
        token_usage: row.token_usage,
        cost_metrics: row.cost_metrics,
        escalation_reason: row.escalation_reason,
        created_at: row.created_at
      }));

    } catch (error) {
      console.error('Error getting validation steps:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update validation step status
   */
  async updateValidationStep(
    stepId: string,
    updates: Partial<ValidationStepRecord>
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const setClause = [];
      const values = [];
      let paramCount = 1;

      if (updates.status) {
        setClause.push(`status = $${paramCount++}`);
        values.push(updates.status);
      }
      if (updates.end_time) {
        setClause.push(`end_time = $${paramCount++}`);
        values.push(updates.end_time);
      }
      if (updates.duration_ms !== undefined) {
        setClause.push(`duration_ms = $${paramCount++}`);
        values.push(updates.duration_ms);
      }
      if (updates.output_data) {
        setClause.push(`output_data = $${paramCount++}`);
        values.push(JSON.stringify(updates.output_data));
      }
      if (updates.errors) {
        setClause.push(`errors = $${paramCount++}`);
        values.push(updates.errors);
      }
      if (updates.warnings) {
        setClause.push(`warnings = $${paramCount++}`);
        values.push(updates.warnings);
      }
      if (updates.confidence_score !== undefined) {
        setClause.push(`confidence_score = $${paramCount++}`);
        values.push(updates.confidence_score);
      }

      if (setClause.length === 0) {
        return;
      }

      values.push(stepId);
      const query = `
        UPDATE claim_forge.validation_steps 
        SET ${setClause.join(', ')}
        WHERE id = $${paramCount}
      `;

      await client.query(query, values);

    } catch (error) {
      console.error('Error updating validation step:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Store planner question
   */
  private async storePlannerQuestion(
    client: PoolClient,
    claimValidationId: string,
    question: ValidationQuestion
  ): Promise<void> {
    const query = `
      INSERT INTO claim_forge.planner_questions (
        claim_validation_id, question_number, question_type, question_text,
        accept_if, search_queries, risk_flags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    await client.query(query, [
      claimValidationId,
      question.n,
      question.type,
      question.q,
      question.accept_if,
      question.search_queries,
      JSON.stringify(question.risk_flags)
    ]);
  }

  /**
   * Store sanity check result
   */
  private async storeSanityCheckResult(
    client: PoolClient,
    claimValidationId: string,
    result: SanityCheckResult
  ): Promise<void> {
    const query = `
      INSERT INTO claim_forge.sanity_check_results (
        claim_validation_id, cpt_codes, icd_codes, modifiers, place_of_service,
        clinical_assessment, cms_ncci_results, ssp_predictions, recommendations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await client.query(query, [
      claimValidationId,
      result.sanitized_payload.cpt_codes || [],
      result.sanitized_payload.icd10_codes || [],
      result.sanitized_payload.modifiers || [],
      result.sanitized_payload.place_of_service,
      JSON.stringify(result.ai_clinical_validation),
      JSON.stringify(result.cms_ncci_checks),
      JSON.stringify(result.ssp_prediction),
      result.warnings || []
    ]);
  }

  /**
   * Get claim validation statistics
   */
  async getValidationStats(): Promise<any> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT 
          overall_status,
          confidence,
          COUNT(*) as count,
          AVG(processing_time_ms) as avg_processing_time,
          AVG(CASE WHEN overall_status = 'APPROVED' THEN 1 ELSE 0 END) as approval_rate
        FROM claim_forge.claim_validations
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY overall_status, confidence
        ORDER BY overall_status, confidence
      `;

      const result = await client.query(query);
      return result.rows;

    } catch (error) {
      console.error('Error getting validation stats:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Store detailed research result
   */
  async storeResearchResult(claimValidationId: string, researchResult: ResearchResult): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO claim_forge.research_results (
          claim_validation_id, question_id, question_text, answer, confidence, source,
          extraction_method, processing_time_ms, escalation_reason, firecrawl_data,
          multi_model_data, recommendations
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;

      await client.query(query, [
        claimValidationId,
        `Q${Date.now()}`, // Generate a unique question ID
        researchResult.question,
        researchResult.answer,
        researchResult.confidence,
        researchResult.source,
        researchResult.metadata.extraction_method,
        researchResult.metadata.processing_time,
        researchResult.metadata.escalation_reason,
        JSON.stringify(researchResult.metadata.structured_data),
        JSON.stringify(researchResult.enhanced_analysis),
        researchResult.recommendations // Remove JSON.stringify for array
      ]);

      console.log(`✅ Research result stored for validation ${claimValidationId}`);

    } catch (error) {
      console.error('Error storing research result:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Store detailed planner questions
   */
  async storePlannerQuestions(claimValidationId: string, questions: ValidationQuestion[]): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO claim_forge.planner_questions (
          claim_validation_id, question_number, question_type, question_text,
          accept_if, search_queries, risk_flags, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `;

      for (const question of questions) {
        await client.query(query, [
          claimValidationId,
          question.n,
          question.type,
          question.q,
          question.accept_if,
          question.search_queries,
          JSON.stringify(question.risk_flags)
        ]);
      }

      console.log(`✅ ${questions.length} planner questions stored for validation ${claimValidationId}`);

    } catch (error) {
      console.error('Error storing planner questions:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Store detailed sanity check results
   */
  async storeSanityCheckResults(claimValidationId: string, sanityResult: SanityCheckResult): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO claim_forge.sanity_check_results (
          claim_validation_id, cpt_codes, icd_codes, modifiers, place_of_service,
          clinical_assessment, cms_ncci_results, ssp_predictions, recommendations
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      await client.query(query, [
        claimValidationId,
        sanityResult.sanitized_payload.cpt_codes,
        sanityResult.sanitized_payload.icd10_codes,
        sanityResult.sanitized_payload.modifiers,
        sanityResult.sanitized_payload.place_of_service,
        JSON.stringify(sanityResult.ai_clinical_validation),
        JSON.stringify(sanityResult.cms_ncci_checks),
        JSON.stringify(sanityResult.ssp_prediction),
        [...sanityResult.issues, ...sanityResult.warnings] // Remove JSON.stringify for array
      ]);

      console.log(`✅ Sanity check results stored for validation ${claimValidationId}`);

    } catch (error) {
      console.error('Error storing sanity check results:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close the database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
