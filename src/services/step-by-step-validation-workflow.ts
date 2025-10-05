import { ClaimPayload } from '../types/claim-types';
import { SanityCheckAgent, SanityCheckResult } from '../agents/sanity-check-agent';
import { PlannerAgent, PlannerResult, ValidationQuestion } from '../agents/planner-agent';
import { ResearchAgent, ResearchResult } from '../agents/research-agent';
import { EvaluatorAgent, EvaluatorDecision } from '../agents/evaluator-agent';
import { ClaimStorageService } from './claim-storage-service';
import { GoogleSearchService } from './google-search';
import { FirecrawlService } from './firecrawl-service';

export interface ValidationStepResult {
  step_name: string;
  step_order: number;
  status: 'completed' | 'failed' | 'skipped';
  start_time: Date;
  end_time: Date;
  duration_ms: number;
  input_data: any;
  output_data: any;
  errors?: string[];
  warnings?: string[];
  confidence_score?: number;
  agent_type: string;
  model_used?: string;
  escalation_reason?: string;
}

export class StepByStepValidationWorkflow {
  private sanityCheckAgent: SanityCheckAgent;
  private plannerAgent: PlannerAgent;
  private researchAgent: ResearchAgent;
  private evaluatorAgent: EvaluatorAgent;
  private claimStorageService: ClaimStorageService;
  private googleSearchService: GoogleSearchService;
  private firecrawlService: FirecrawlService;

  constructor() {
    this.sanityCheckAgent = new SanityCheckAgent();
    this.plannerAgent = new PlannerAgent();
    this.researchAgent = new ResearchAgent();
    this.evaluatorAgent = new EvaluatorAgent();
    this.claimStorageService = new ClaimStorageService();
    this.googleSearchService = new GoogleSearchService();
    this.firecrawlService = new FirecrawlService();
  }

  /**
   * Execute the complete validation workflow with step-by-step storage
   */
  async validateClaim(payload: ClaimPayload): Promise<EvaluatorDecision> {
    const startTime = Date.now();
    const claimId = `CLM-${Date.now()}`;
    let claimValidationId: string | null = null;
    const stepResults: ValidationStepResult[] = [];

    try {
      console.log(`🚀 Starting validation for claim ${claimId}`);
      console.log(`📋 Payer: ${payload.payer}`);
      console.log(`🏥 CPT Codes: ${payload.cpt_codes.join(', ')}`);
      console.log(`📊 ICD-10 Codes: ${payload.icd10_codes.join(', ')}`);

      // Initialize claim validation record
      claimValidationId = await this.initializeClaimValidation(claimId, payload);

      // Step 1: Sanity Check
      const sanityStepResult = await this.executeSanityCheckStep(
        claimValidationId, 
        payload, 
        stepResults.length + 1
      );
      stepResults.push(sanityStepResult);

      if (!sanityStepResult.output_data.is_valid) {
        console.log('❌ Sanity check failed - stopping workflow');
        return await this.createFailureResult(claimId, stepResults, startTime);
      }

      // Step 2: Planner Agent
      const plannerStepResult = await this.executePlannerStep(
        claimValidationId,
        payload,
        sanityStepResult.output_data,
        stepResults.length + 1
      );
      stepResults.push(plannerStepResult);

      if (plannerStepResult.status === 'failed') {
        console.log('❌ Planner step failed - stopping workflow');
        return await this.createFailureResult(claimId, stepResults, startTime);
      }

      // Step 3: Research Agent (for each question)
      const researchStepResults = await this.executeResearchSteps(
        claimValidationId,
        plannerStepResult.output_data.questions,
        stepResults.length + 1
      );
      stepResults.push(...researchStepResults);

      // Step 4: Evaluator Agent
      const evaluatorStepResult = await this.executeEvaluatorStep(
        claimValidationId,
        researchStepResults.map(r => r.output_data).filter(r => r),
        plannerStepResult.output_data.questions,
        stepResults.length + 1
      );
      stepResults.push(evaluatorStepResult);

      // Store final results
      await this.storeFinalResults(claimValidationId, evaluatorStepResult.output_data, Date.now() - startTime);

      const processingTime = Date.now() - startTime;
      console.log(`✅ Validation completed in ${processingTime}ms`);
      console.log(`📊 Final Status: ${evaluatorStepResult.output_data.overall_status}`);

      // Include claim_id in the final result
      return {
        ...evaluatorStepResult.output_data,
        claim_id: claimId
      };

    } catch (error) {
      console.error('❌ Validation workflow failed:', error);
      
      // Store error information
      if (claimValidationId) {
        await this.storeErrorStep(claimValidationId, 'workflow_error', error, stepResults.length + 1);
      }

      const failureResult = await this.createFailureResult(claimId, stepResults, startTime, error);
      return {
        ...failureResult,
        claim_id: claimId
      };
    }
  }

  /**
   * Initialize claim validation record
   */
  private async initializeClaimValidation(claimId: string, payload: ClaimPayload): Promise<string> {
    const stepStartTime = Date.now();
    
    try {
      // Create a minimal evaluator result for initialization
      const initialResult: EvaluatorDecision = {
        claim_id: claimId,
        overall_status: 'REQUIRES_REVIEW',
        confidence: 'low',
        processing_time_ms: 0,
        timestamp: new Date().toISOString(),
        question_analysis: [],
        overall_assessment: {
          decision_rationale: 'Workflow in progress',
          risk_factors: [],
          approval_criteria_met: false,
          blockers: [],
          next_steps: ['Processing...'],
          estimated_approval_probability: 0
        },
        insurance_insights: {
          payer_compliance: 'uncertain',
          coverage_verification: 'unverified',
          prior_auth_status: 'unknown',
          coding_compliance: 'review_needed',
          state_regulations: 'unknown'
        }
      };

      let claimValidationId: string;
      try {
        claimValidationId = await this.claimStorageService.storeClaimValidation(
          claimId,
          payload,
          initialResult,
          [],
          [],
          {
            is_valid: false,
            sanitized_payload: payload,
            ssp_prediction: { specialty: 'Unknown', subspecialty: 'Unknown', confidence: 'low' },
            issues: [],
            warnings: [],
            cms_ncci_checks: { bundling_issues: [], modifier_requirements: [], frequency_limits: [] },
            ai_clinical_validation: {
              overall_appropriate: false,
              specialty: 'Unknown',
              subspecialty: 'Unknown',
              cpt_validation: [],
              icd_validation: [],
              modifier_validation: [],
              place_of_service_validation: { code: '', appropriate: false, confidence: 'low', reasoning: '' },
              clinical_concerns: [],
              documentation_quality: 'Unknown',
              recommendations: []
            },
            policy_check_required: false,
            policy_check_details: {},
            validation_issues: [],
            cms_ncci_validation: { is_valid: false, errors: [], warnings: [], passes: [], risk_score: 100 }
          }
        );
        console.log('✅ Claim validation record stored with ID:', claimValidationId);
      } catch (error) {
        console.error('❌ Failed to store claim validation record:', error);
        throw error;
      }

      console.log(`📊 Initialized claim validation: ${claimValidationId}`);
      return claimValidationId;

    } catch (error) {
      console.error('❌ Failed to initialize claim validation:', error);
      throw error;
    }
  }

  /**
   * Execute Sanity Check step and store results
   */
  private async executeSanityCheckStep(
    claimValidationId: string,
    payload: ClaimPayload,
    stepOrder: number
  ): Promise<ValidationStepResult> {
    const stepStartTime = Date.now();
    console.log(`\n🔍 Step ${stepOrder}: Running sanity check...`);

    try {
      const sanityResult = await this.sanityCheckAgent.performSanityCheck(payload);
      const stepEndTime = Date.now();
      const duration = stepEndTime - stepStartTime;

      console.log(`✅ Sanity check completed in ${duration}ms`);
      console.log(`🎯 Valid: ${sanityResult.is_valid}`);
      console.log(`🏥 Specialty: ${sanityResult.ssp_prediction.specialty} / ${sanityResult.ssp_prediction.subspecialty}`);

      const stepResult: ValidationStepResult = {
        step_name: 'sanity_check',
        step_order: stepOrder,
        status: 'completed',
        start_time: new Date(stepStartTime),
        end_time: new Date(stepEndTime),
        duration_ms: duration,
        input_data: payload,
        output_data: sanityResult,
        confidence_score: sanityResult.ssp_prediction.confidence === 'high' ? 0.9 : 
                         sanityResult.ssp_prediction.confidence === 'medium' ? 0.7 : 0.5,
        agent_type: 'sanity_check',
        model_used: 'gpt-4o'
      };

      // Store step result
      await this.claimStorageService.storeValidationStep({
        claim_validation_id: claimValidationId,
        ...stepResult
      });

      // Store detailed sanity check results
      await this.claimStorageService.storeSanityCheckResults(claimValidationId, sanityResult);

      return stepResult;

    } catch (error) {
      console.error('❌ Sanity check failed:', error);
      
      const stepResult: ValidationStepResult = {
        step_name: 'sanity_check',
        step_order: stepOrder,
        status: 'failed',
        start_time: new Date(stepStartTime),
        end_time: new Date(),
        duration_ms: Date.now() - stepStartTime,
        input_data: payload,
        output_data: null,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        agent_type: 'sanity_check',
        model_used: 'gpt-4o'
      };

      await this.claimStorageService.storeValidationStep({
        claim_validation_id: claimValidationId,
        ...stepResult
      });

      return stepResult;
    }
  }

  /**
   * Execute Planner step and store results
   */
  private async executePlannerStep(
    claimValidationId: string,
    payload: ClaimPayload,
    sanityResult: SanityCheckResult,
    stepOrder: number
  ): Promise<ValidationStepResult> {
    const stepStartTime = Date.now();
    console.log(`\n📋 Step ${stepOrder}: Running planner...`);

    try {
      const plannerResult = await this.plannerAgent.generateQuestions(payload, sanityResult);
      const stepEndTime = Date.now();
      const duration = stepEndTime - stepStartTime;

      console.log(`✅ Planner completed in ${duration}ms`);
      console.log(`📝 Generated ${plannerResult.questions.length} questions`);

      const stepResult: ValidationStepResult = {
        step_name: 'planner',
        step_order: stepOrder,
        status: 'completed',
        start_time: new Date(stepStartTime),
        end_time: new Date(stepEndTime),
        duration_ms: duration,
        input_data: sanityResult,
        output_data: plannerResult,
        confidence_score: 0.8, // Planner typically has high confidence
        agent_type: 'planner',
        model_used: 'gpt-4o'
      };

      // Store step result
      await this.claimStorageService.storeValidationStep({
        claim_validation_id: claimValidationId,
        ...stepResult
      });

      // Store detailed planner questions
      await this.claimStorageService.storePlannerQuestions(claimValidationId, plannerResult.questions);

      return stepResult;

    } catch (error) {
      console.error('❌ Planner failed:', error);
      
      const stepResult: ValidationStepResult = {
        step_name: 'planner',
        step_order: stepOrder,
        status: 'failed',
        start_time: new Date(stepStartTime),
        end_time: new Date(),
        duration_ms: Date.now() - stepStartTime,
        input_data: sanityResult,
        output_data: null,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        agent_type: 'planner',
        model_used: 'gpt-4o'
      };

      await this.claimStorageService.storeValidationStep({
        claim_validation_id: claimValidationId,
        ...stepResult
      });

      return stepResult;
    }
  }

  /**
   * Execute Research steps for each question and store results
   */
  private async executeResearchSteps(
    claimValidationId: string,
    questions: ValidationQuestion[],
    stepOrder: number
  ): Promise<ValidationStepResult[]> {
    const stepResults: ValidationStepResult[] = [];

    console.log(`\n🔬 Step ${stepOrder}: Running research for ${questions.length} questions...`);

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const stepStartTime = Date.now();
      
      console.log(`   🔍 Researching question ${i + 1}: ${question.q.substring(0, 50)}...`);

      try {
        const researchResults = await this.researchAgent.executeResearch([question]);
        const researchResult = researchResults[0]; // Get the first (and only) result
        const stepEndTime = Date.now();
        const duration = stepEndTime - stepStartTime;

        console.log(`   ✅ Question ${i + 1} completed in ${duration}ms (confidence: ${(researchResult.confidence * 100).toFixed(1)}%)`);

        const stepResult: ValidationStepResult = {
          step_name: `research_q${i + 1}`,
          step_order: stepOrder + i,
          status: 'completed',
          start_time: new Date(stepStartTime),
          end_time: new Date(stepEndTime),
          duration_ms: duration,
          input_data: question,
          output_data: researchResult,
          confidence_score: researchResult.confidence,
          agent_type: 'research',
          model_used: researchResult.metadata.extraction_method === 'multi-model' ? 'multi-model' : 'firecrawl',
          escalation_reason: researchResult.metadata.escalation_reason
        };

        // Store step result
        await this.claimStorageService.storeValidationStep({
          claim_validation_id: claimValidationId,
          ...stepResult
        });

        // Store detailed research result
        await this.claimStorageService.storeResearchResult(claimValidationId, researchResult);

        stepResults.push(stepResult);

      } catch (error) {
        console.error(`   ❌ Research failed for question ${i + 1}:`, error);
        
        const stepResult: ValidationStepResult = {
          step_name: `research_q${i + 1}`,
          step_order: stepOrder + i,
          status: 'failed',
          start_time: new Date(stepStartTime),
          end_time: new Date(),
          duration_ms: Date.now() - stepStartTime,
          input_data: question,
          output_data: null,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          agent_type: 'research',
          model_used: 'firecrawl'
        };

        await this.claimStorageService.storeValidationStep({
          claim_validation_id: claimValidationId,
          ...stepResult
        });

        stepResults.push(stepResult);
      }
    }

    return stepResults;
  }

  /**
   * Execute Evaluator step and store results
   */
  private async executeEvaluatorStep(
    claimValidationId: string,
    researchResults: ResearchResult[],
    questions: ValidationQuestion[],
    stepOrder: number
  ): Promise<ValidationStepResult> {
    const stepStartTime = Date.now();
    console.log(`\n🎯 Step ${stepOrder}: Running evaluator...`);

    try {
      const evaluatorResult = await this.evaluatorAgent.evaluateClaim(
        claimValidationId,
        researchResults,
        questions,
        stepStartTime
      );
      
      const stepEndTime = Date.now();
      const duration = stepEndTime - stepStartTime;

      console.log(`✅ Evaluator completed in ${duration}ms`);
      console.log(`📊 Final Status: ${evaluatorResult.overall_status}`);
      console.log(`📈 Confidence: ${evaluatorResult.confidence}`);

      const stepResult: ValidationStepResult = {
        step_name: 'evaluator',
        step_order: stepOrder,
        status: 'completed',
        start_time: new Date(stepStartTime),
        end_time: new Date(stepEndTime),
        duration_ms: duration,
        input_data: { researchResults, questions },
        output_data: evaluatorResult,
        confidence_score: evaluatorResult.confidence === 'high' ? 0.9 : 
                         evaluatorResult.confidence === 'medium' ? 0.7 : 0.5,
        agent_type: 'evaluator',
        model_used: 'gpt-4o'
      };

      // Store step result
      await this.claimStorageService.storeValidationStep({
        claim_validation_id: claimValidationId,
        ...stepResult
      });

      return stepResult;

    } catch (error) {
      console.error('❌ Evaluator failed:', error);
      
      const stepResult: ValidationStepResult = {
        step_name: 'evaluator',
        step_order: stepOrder,
        status: 'failed',
        start_time: new Date(stepStartTime),
        end_time: new Date(),
        duration_ms: Date.now() - stepStartTime,
        input_data: { researchResults, questions },
        output_data: null,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        agent_type: 'evaluator',
        model_used: 'gpt-4o'
      };

      await this.claimStorageService.storeValidationStep({
        claim_validation_id: claimValidationId,
        ...stepResult
      });

      return stepResult;
    }
  }

  /**
   * Store final results in claim validation record
   */
  private async storeFinalResults(claimValidationId: string, evaluatorResult: EvaluatorDecision, processingTimeMs: number): Promise<void> {
    try {
      console.log(`📊 Storing final results for claim validation: ${claimValidationId}`);
      console.log(`📋 Final Status: ${evaluatorResult.overall_status}`);
      console.log(`🎯 Approval Probability: ${(evaluatorResult.overall_assessment.estimated_approval_probability * 100).toFixed(1)}%`);
      console.log(`⏱️  Processing Time: ${processingTimeMs}ms`);
      
      // Log detailed evaluation results
      console.log(`\n📋 EVALUATION RESULTS:`);
      console.log(`   🎯 Overall Assessment:`);
      console.log(`      📊 Approval Probability: ${(evaluatorResult.overall_assessment.estimated_approval_probability * 100).toFixed(1)}%`);
      console.log(`      ✅ Approval Criteria Met: ${evaluatorResult.overall_assessment.approval_criteria_met ? 'Yes' : 'No'}`);
      console.log(`      💭 Decision Rationale: ${evaluatorResult.overall_assessment.decision_rationale}`);
      
      // Log risk factors
      if (evaluatorResult.overall_assessment.risk_factors?.length > 0) {
        console.log(`   ⚠️  Risk Factors:`);
        evaluatorResult.overall_assessment.risk_factors.forEach((factor: string, index: number) => {
          console.log(`      ${index + 1}. ${factor}`);
        });
      }
      
      // Log blockers
      if (evaluatorResult.overall_assessment.blockers?.length > 0) {
        console.log(`   🚫 Blockers:`);
        evaluatorResult.overall_assessment.blockers.forEach((blocker: any, index: number) => {
          console.log(`      ${index + 1}. [${blocker.severity.toUpperCase()}] ${blocker.reason}`);
          console.log(`         Question ID: ${blocker.question_id}`);
        });
      }
      
      // Log next steps
      if (evaluatorResult.overall_assessment.next_steps?.length > 0) {
        console.log(`   📋 Next Steps:`);
        evaluatorResult.overall_assessment.next_steps.forEach((step: string, index: number) => {
          console.log(`      ${index + 1}. ${step}`);
        });
      }
      
      // Log question analysis
      if (evaluatorResult.question_analysis?.length > 0) {
        console.log(`   🔍 Question Analysis:`);
        evaluatorResult.question_analysis.forEach((qa: any, index: number) => {
          console.log(`      ${index + 1}. [${qa.status}] ${qa.question.substring(0, 80)}${qa.question.length > 80 ? '...' : ''}`);
          console.log(`         📊 Confidence: ${(qa.confidence * 100).toFixed(1)}% | Risk: ${qa.risk_level} | Method: ${qa.method}`);
          if (qa.recommendations?.length > 0) {
            console.log(`         💡 Recommendations: ${qa.recommendations.join(', ')}`);
          }
        });
      }
      
      // Log insurance insights
      if (evaluatorResult.insurance_insights && Object.keys(evaluatorResult.insurance_insights).length > 0) {
        console.log(`   🏥 Insurance Insights:`);
        Object.entries(evaluatorResult.insurance_insights).forEach(([key, value]) => {
          console.log(`      📋 ${key.replace(/_/g, ' ').toUpperCase()}: ${value}`);
        });
      }
      
      // Update the claim validation record with final results
      await this.claimStorageService.updateClaimValidation(claimValidationId, {
        overall_status: evaluatorResult.overall_status,
        confidence: evaluatorResult.overall_assessment.estimated_approval_probability > 0.8 ? 'high' : 
                   evaluatorResult.overall_assessment.estimated_approval_probability > 0.6 ? 'medium' : 'low',
        processing_time_ms: processingTimeMs,
        overall_assessment: evaluatorResult.overall_assessment,
        insurance_insights: evaluatorResult.insurance_insights || {}
      });
      
      console.log(`\n✅ Final results stored successfully`);
    } catch (error) {
      console.error('❌ Failed to store final results:', error);
      throw error;
    }
  }

  /**
   * Store error step
   */
  private async storeErrorStep(
    claimValidationId: string,
    stepName: string,
    error: any,
    stepOrder: number
  ): Promise<void> {
    try {
      await this.claimStorageService.storeValidationStep({
        claim_validation_id: claimValidationId,
        step_name: stepName,
        step_order: stepOrder,
        status: 'failed',
        start_time: new Date(),
        end_time: new Date(),
        duration_ms: 0,
        input_data: null,
        output_data: null,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        agent_type: 'system',
        model_used: 'none'
      });
    } catch (storageError) {
      console.error('❌ Failed to store error step:', storageError);
    }
  }

  /**
   * Create failure result
   */
  private async createFailureResult(
    claimId: string,
    stepResults: ValidationStepResult[],
    startTime: number,
    error?: any
  ): Promise<EvaluatorDecision> {
    const processingTime = Date.now() - startTime;
    
    return {
      claim_id: claimId,
      overall_status: 'DENIED',
      confidence: 'low',
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString(),
      question_analysis: [],
      overall_assessment: {
        decision_rationale: 'Workflow failed due to error',
        risk_factors: ['System error'],
        approval_criteria_met: false,
        blockers: [{ question_id: '1', reason: 'Workflow failure', severity: 'critical' }],
        next_steps: ['Retry validation', 'Check system logs'],
        estimated_approval_probability: 0
      },
      insurance_insights: {
        payer_compliance: 'uncertain',
        coverage_verification: 'unverified',
        prior_auth_status: 'unknown',
        coding_compliance: 'review_needed',
        state_regulations: 'unknown'
      }
    };
  }
}
