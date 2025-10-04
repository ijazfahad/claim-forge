import { BaseAgent } from './base-agent';
import { ResearchResult } from './research-agent';
import { ValidationQuestion } from './planner-agent';
import { ClaimPayload } from '../types/claim-types';

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
      "escalation_reason": "string (if applicable)"
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
   * Evaluate research results and make final claim decision
   */
  async evaluateClaim(
    claimId: string,
    researchResults: ResearchResult[],
    questions: ValidationQuestion[],
    startTime: number
  ): Promise<EvaluatorDecision> {
    if (!this.agent) {
      await this.initialize();
    }

    // Prepare consolidated input for evaluation
    const evaluationInput = this.prepareEvaluationInput(researchResults, questions);

    const input = `
Evaluate this medical claim based on research results:

CLAIM ID: ${claimId}

RESEARCH RESULTS:
${JSON.stringify(evaluationInput, null, 2)}

Make a final decision on claim approval, denial, or review requirement.
Consider all confidence levels, recommendations, and risk factors.
`;

    try {
      const result = await this.executeAgent(this.agent!, input);
      
      const processingTime = Date.now() - startTime;

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
    researchResults: ResearchResult[], 
    questions: ValidationQuestion[]
  ): any {
    return {
      questions_count: questions.length,
      research_summary: {
        total_questions: researchResults.length,
        firecrawl_success: researchResults.filter(r => r.metadata.extraction_method === 'firecrawl').length,
        multi_model_escalations: researchResults.filter(r => r.metadata.extraction_method === 'multi-model').length,
        average_confidence: researchResults.reduce((sum, r) => sum + r.confidence, 0) / researchResults.length
      },
      detailed_results: researchResults.map((result, index) => ({
        question_id: `Q${index + 1}`,
        question: result.question,
        answer: result.answer,
        confidence: result.confidence,
        method: result.metadata.extraction_method,
        processing_time: result.metadata.processing_time,
        escalation_reason: result.metadata.escalation_reason,
        recommendations: result.recommendations,
        firecrawl_data: result.firecrawl_data,
        multi_model_data: result.multi_model_data,
        question_type: questions[index]?.type || 'unknown',
        risk_flags: questions[index]?.risk_flags || {}
      })),
      risk_analysis: {
        high_risk_questions: researchResults.filter(r => r.confidence < 0.6).length,
        medium_risk_questions: researchResults.filter(r => r.confidence >= 0.6 && r.confidence < 0.8).length,
        low_risk_questions: researchResults.filter(r => r.confidence >= 0.8).length,
        total_recommendations: researchResults.reduce((sum, r) => sum + r.recommendations.length, 0)
      }
    };
  }

  /**
   * Calculate approval probability based on research results
   */
  private calculateApprovalProbability(researchResults: ResearchResult[]): number {
    if (researchResults.length === 0) return 0;

    const avgConfidence = researchResults.reduce((sum, r) => sum + r.confidence, 0) / researchResults.length;
    const highConfidenceCount = researchResults.filter(r => r.confidence >= 0.8).length;
    const lowConfidenceCount = researchResults.filter(r => r.confidence < 0.6).length;
    
    // Base probability from average confidence
    let probability = avgConfidence * 100;
    
    // Adjust based on high confidence questions
    probability += (highConfidenceCount / researchResults.length) * 20;
    
    // Penalize low confidence questions
    probability -= (lowConfidenceCount / researchResults.length) * 30;
    
    return Math.max(0, Math.min(100, Math.round(probability)));
  }

  /**
   * Determine overall risk level
   */
  private determineRiskLevel(researchResults: ResearchResult[]): 'low' | 'medium' | 'high' {
    const avgConfidence = researchResults.reduce((sum, r) => sum + r.confidence, 0) / researchResults.length;
    const lowConfidenceCount = researchResults.filter(r => r.confidence < 0.6).length;
    
    if (avgConfidence >= 0.8 && lowConfidenceCount === 0) return 'low';
    if (avgConfidence >= 0.6 && lowConfidenceCount <= researchResults.length * 0.3) return 'medium';
    return 'high';
  }
}
