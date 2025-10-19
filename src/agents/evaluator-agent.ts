import { BaseAgent } from './base-agent';
import { ResearchResult } from './research-agent';
import { ValidationQuestion } from './planner-agent';
import { ClaimPayload } from '../types/claim-types';
import { ReviewerResult } from './reviewer-agent';

export interface EvaluatorDecision {
  claim_id: string;
  overall_status: 'APPROVED' | 'DENIED' | 'REQUIRES_REVIEW';
  confidence: 'low' | 'medium' | 'high';
  processing_time_ms: number;
  timestamp: string;
  
  // Per-question analysis
  question_analysis: Array<{
    question_id: string;
    question: string;
    answer: string;
    confidence: number;
    method: 'firecrawl' | 'multi-model';
    status: 'PASS' | 'FAIL' | 'REVIEW_REQUIRED';
    risk_level: 'low' | 'medium' | 'high';
    recommendations: string[];
    escalation_reason?: string;
  }>;
  
  // Overall claim assessment
  overall_assessment: {
    decision_rationale: string;
    risk_factors: string[];
    approval_criteria_met: boolean;
    blockers: Array<{
      question_id: string;
      reason: string;
      severity: 'critical' | 'warning' | 'info';
    }>;
    next_steps: string[];
    estimated_approval_probability: number; // 0-100%
  };
  
  // Insurance-specific insights
  insurance_insights: {
    payer_compliance: 'compliant' | 'non_compliant' | 'uncertain';
    coverage_verification: 'verified' | 'unverified' | 'partial';
    prior_auth_status: 'not_required' | 'required' | 'unknown';
    coding_compliance: 'compliant' | 'non_compliant' | 'review_needed';
    state_regulations: 'compliant' | 'non_compliant' | 'unknown';
  };
}

export class EvaluatorAgent extends BaseAgent {
  private agent: any = null;

  constructor() {
    super();
  }

  /**
   * Initialize the Evaluator agent
   */
  async initialize(): Promise<void> {
    const instructions = `
You are the Evaluator Agent - the final decision maker in the medical claim validation process.

CRITICAL JSON REQUIREMENTS:
1. Respond with ONLY valid JSON - no markdown, no explanations, no additional text
2. Use double quotes for all strings
3. Ensure all arrays and objects are properly closed
4. No trailing commas
5. Escape any special characters in strings
6. Keep strings under 200 characters to avoid parsing issues

INPUT
- Research results from Research Agent containing consolidated Firecrawl + Multi-Model analysis
- Each question includes: answer, confidence, method, recommendations, and structured data
- Questions are categorized as: basic, specialty, subspecialty with risk flags

DECISION FRAMEWORK

1. PER-QUESTION EVALUATION:
   - PASS: High confidence (≥80%) + clear policy compliance + no critical blockers
   - FAIL: Low confidence (<60%) + policy violations + critical blockers
   - REVIEW_REQUIRED: Medium confidence (60-79%) + mixed signals + warnings

2. RISK ASSESSMENT:
   - Low Risk: High confidence + strong consensus + compliant policies
   - Medium Risk: Moderate confidence + some uncertainty + minor warnings
   - High Risk: Low confidence + conflicts + policy violations + blockers

3. CLAIM-LEVEL DECISION:
   - APPROVED: All basic questions PASS + ≥1 specialty/subspecialty PASS + high overall confidence
   - DENIED: Any critical blockers + policy violations + low confidence
   - REQUIRES_REVIEW: Mixed results + medium confidence + manual review needed

4. INSURANCE COMPLIANCE:
   - Check payer-specific policies, state regulations, coding compliance
   - Verify prior authorization requirements, coverage rules
   - Assess documentation completeness and accuracy

OUTPUT FORMAT (JSON only):
{
  "claim_id": "string",
  "overall_status": "APPROVED|DENIED|REQUIRES_REVIEW",
  "confidence": "low|medium|high",
  "processing_time_ms": number,
  "timestamp": "ISO string",
  "question_analysis": [
    {
      "question_id": "string",
      "question": "string", 
      "answer": "string",
      "confidence": number,
      "method": "firecrawl|multi-model",
      "status": "PASS|FAIL|REVIEW_REQUIRED",
      "risk_level": "low|medium|high",
      "recommendations": ["string"],
      "escalation_reason": "string"
    }
  ],
  "overall_assessment": {
    "decision_rationale": "string",
    "risk_factors": ["string"],
    "approval_criteria_met": boolean,
    "blockers": [
      {
        "question_id": "string",
        "reason": "string", 
        "severity": "critical|warning|info"
      }
    ],
    "next_steps": ["string"],
    "estimated_approval_probability": number
  },
  "insurance_insights": {
    "payer_compliance": "compliant|non_compliant|uncertain",
    "coverage_verification": "verified|unverified|partial",
    "prior_auth_status": "not_required|required|unknown",
    "coding_compliance": "compliant|non_compliant|review_needed",
    "state_regulations": "compliant|non_compliant|unknown"
  }
}

EVALUATION CRITERIA:
- Focus on policy compliance, coverage verification, and risk assessment
- Consider confidence levels, consensus quality, and recommendation quality
- Prioritize patient safety and payer compliance
- Provide actionable next steps for each decision
- Be conservative with approvals - err on side of caution
`;

    const tools: any[] = []; // Temporarily disable tools to avoid API errors

    this.agent = this.createAgent('Evaluator Agent', instructions, tools);
  }

  /**
   * Evaluate reviewer results and make final claim decision
   */
  async evaluateClaim(
    claimId: string,
    reviewerResults: ReviewerResult[],
    questions: ValidationQuestion[],
    startTime: number
  ): Promise<EvaluatorDecision> {
    if (!this.agent) {
      await this.initialize();
    }

    // Prepare consolidated input for evaluation
    const evaluationInput = this.prepareEvaluationInput(reviewerResults, questions);

    const input = `
Evaluate this medical claim based on reviewer results:

CLAIM ID: ${claimId}

REVIEWER RESULTS:
${JSON.stringify(evaluationInput, null, 2)}

Make a final decision on claim approval, denial, or review requirement.
Consider all confidence levels, conflict analysis, and reviewer recommendations.
`;

    try {
      const result = await this.executeAgent(this.agent!, input, {
        model: process.env.EVALUATOR_MODEL,
        temperature: process.env.EVALUATOR_TEMPERATURE ? parseFloat(process.env.EVALUATOR_TEMPERATURE) : undefined,
        max_tokens: process.env.EVALUATOR_MAX_TOKENS ? parseInt(process.env.EVALUATOR_MAX_TOKENS) : undefined,
        claimId: claimId
      });
      
      const processingTime = Date.now() - startTime;

      // Log evaluator decision to audit system
      if (this.auditLogger) {
        await this.auditLogger.logAuditEvent(
          'evaluator',
          'EvaluatorAgent',
          'make_final_decision',
          { reviewerResults: reviewerResults.length, questions: questions.length },
          { 
            overall_status: result.overall_status || 'REQUIRES_REVIEW',
            confidence: result.confidence || 'medium',
            approval_probability: result.overall_assessment?.estimated_approval_probability || 50
          },
          { 
            processing_time_ms: processingTime,
            decision_rationale: result.overall_assessment?.decision_rationale || 'Evaluation completed'
          },
          processingTime,
          true,
          undefined,
          claimId
        );
      }

      return {
        claim_id: claimId,
        overall_status: result.overall_status || 'REQUIRES_REVIEW',
        confidence: result.confidence || 'medium',
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString(),
        question_analysis: result.question_analysis || [],
        overall_assessment: result.overall_assessment || {
          decision_rationale: 'Evaluation completed',
          risk_factors: [],
          approval_criteria_met: false,
          blockers: [],
          next_steps: ['Manual review required'],
          estimated_approval_probability: 50
        },
        insurance_insights: result.insurance_insights || {
          payer_compliance: 'uncertain',
          coverage_verification: 'unverified',
          prior_auth_status: 'unknown',
          coding_compliance: 'review_needed',
          state_regulations: 'unknown'
        }
      };

    } catch (error) {
      console.error('Evaluator Agent error:', error);
      
      const processingTime = Date.now() - startTime;
      
      return {
        claim_id: claimId,
        overall_status: 'REQUIRES_REVIEW',
        confidence: 'low',
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString(),
        question_analysis: [],
        overall_assessment: {
          decision_rationale: 'Evaluation failed due to error',
          risk_factors: ['System error'],
          approval_criteria_met: false,
          blockers: [{ question_id: '1', reason: 'Evaluator agent error', severity: 'critical' }],
          next_steps: ['Retry evaluation', 'Check system configuration'],
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

  /**
   * Prepare consolidated input for evaluation
   */
  private prepareEvaluationInput(
    reviewerResults: ReviewerResult[], 
    questions: ValidationQuestion[]
  ): any {
    return {
      questions_count: questions.length,
      reviewer_summary: {
        total_questions: reviewerResults.length,
        average_confidence: Math.round((reviewerResults.reduce((sum, r) => sum + r.confidence, 0) / reviewerResults.length) * 100) / 100,
        no_conflict_count: reviewerResults.filter(r => r.review_status === 'no_conflict').length,
        resolved_count: reviewerResults.filter(r => r.review_status === 'resolved').length,
        unresolvable_count: reviewerResults.filter(r => r.review_status === 'unresolvable').length,
        total_conflicts: reviewerResults.reduce((sum, r) => sum + r.review_analysis.detected_conflicts.length, 0)
      },
      // Reviewer-specific results with conflict analysis
      question_summaries: reviewerResults.map((result, index) => ({
        question_id: `Q${index + 1}`,
        question: result.question.substring(0, 100) + (result.question.length > 100 ? '...' : ''),
        reviewed_answer: result.reviewed_answer.substring(0, 150) + (result.reviewed_answer.length > 150 ? '...' : ''),
        confidence: Math.round(result.confidence * 100) / 100,
        review_status: result.review_status,
        conflicts_detected: result.review_analysis.detected_conflicts.length,
        resolution_strategy: result.review_analysis.resolution_strategy,
        source_contributions: result.source_analysis,
        recommendations: result.recommendations
      }))
    };
  }

  /**
   * Calculate approval probability based on reviewer results
   */
  private calculateApprovalProbability(reviewerResults: ReviewerResult[]): number {
    if (reviewerResults.length === 0) return 0;

    const avgConfidence = reviewerResults.reduce((sum, r) => sum + r.confidence, 0) / reviewerResults.length;
    const noConflictCount = reviewerResults.filter(r => r.review_status === 'no_conflict').length;
    const resolvedCount = reviewerResults.filter(r => r.review_status === 'resolved').length;
    const unresolvableCount = reviewerResults.filter(r => r.review_status === 'unresolvable').length;
    const totalConflicts = reviewerResults.reduce((sum, r) => sum + r.review_analysis.detected_conflicts.length, 0);
    
    // Base probability from average confidence
    let probability = avgConfidence * 100;
    
    // Boost for no conflicts
    probability += (noConflictCount / reviewerResults.length) * 30;
    
    // Boost for resolved conflicts
    probability += (resolvedCount / reviewerResults.length) * 20;
    
    // Penalty for unresolvable conflicts
    probability -= (unresolvableCount / reviewerResults.length) * 40;
    
    // Penalty for total conflicts
    probability -= (totalConflicts / reviewerResults.length) * 10;
    
    return Math.max(0, Math.min(100, Math.round(probability)));
  }

  /**
   * Determine overall risk level
   */
  private determineRiskLevel(reviewerResults: ReviewerResult[]): 'low' | 'medium' | 'high' {
    if (reviewerResults.length === 0) return 'high';

    const unresolvableCount = reviewerResults.filter(r => r.review_status === 'unresolvable').length;
    const totalConflicts = reviewerResults.reduce((sum, r) => sum + r.review_analysis.detected_conflicts.length, 0);
    const avgConfidence = reviewerResults.reduce((sum, r) => sum + r.confidence, 0) / reviewerResults.length;

    // High risk if many unresolvable conflicts or low confidence
    if (unresolvableCount > reviewerResults.length * 0.3 || avgConfidence < 0.6) {
      return 'high';
    }

    // Medium risk if some conflicts or moderate confidence
    if (totalConflicts > 0 || avgConfidence < 0.8) {
      return 'medium';
    }

    // Low risk if no conflicts and high confidence
    return 'low';
  }
}
