import { BaseAgent } from './base-agent';
import { Agent } from '@openai/agents';
import { ClaimPayload } from '../types/claim-types';
import { SanityCheckResult } from './sanity-check-agent';

export interface ValidationQuestion {
  n: number;
  type: 'basic' | 'specialty' | 'subspecialty';
  q: string;
  accept_if: string[];
  search_queries: string[];
  risk_flags: {
    PA: boolean;
    POS: boolean;
    NCCI: boolean;
    Modifiers: boolean;
    Frequency: boolean;
    Diagnosis: boolean;
    StateSpecific: boolean;
    LOBSpecific: boolean;
    Thresholds: boolean;
  };
}

export interface PlannerResult {
  questions: ValidationQuestion[];
  meta: {
    specialty: string;
    subspecialty: string;
    rationale: string;
    derived: {
      cpt_codes: string[];
      icd10_codes: string[];
      place_of_service: string;
      member_plan_type: string;
      state: string;
    };
  };
}

export class PlannerAgent extends BaseAgent {
  private agent: Agent | null = null;

  constructor() {
    super();
  }

  /**
   * Initialize the Planner agent
   */
  async initialize(): Promise<void> {
    const instructions = `
You are a Planner Agent for medical claim validation.

Your task is to generate a short, targeted checklist of validation questions for the claim using ONLY the payload provided.

PRIMARY GOALS:
1) Infer specialty and subspecialty from CPT/ICD/POS/summary.
2) Create 2–3 questions per tier:
   - type:"basic" → payer/claim mechanics (PA, eligibility, POS/modifiers, NCCI edits, frequency, plan rules).
   - type:"specialty" → rules typical for the inferred specialty.
   - type:"subspecialty" → fine-grained checks specific to the procedure/subspecialty.
3) Each question must be atomic, neutral (no presupposed "yes"), and ≤160 chars.

FOR EACH QUESTION INCLUDE:
- accept_if: 2–5 concrete evidence checks (what policy text would count as satisfying the question).
- search_queries: 1–2 SHORT verification hints (strings). These are NOT executed; they are for future human or automated verification.
  • If payload.domains exists, prefix with site:<domain>. Otherwise, use payer name as a keyword (no quotes).
  • Keep minimal and specific to THIS question; no generic catch-alls.
- risk_flags: object with booleans for { "PA", "POS", "NCCI", "Modifiers", "Frequency", "Diagnosis", "StateSpecific", "LOBSpecific", "Thresholds" } indicating which risk categories the question targets.

META:
Add:
- specialty, subspecialty, rationale (why you inferred them),
- derived: echo cpt_codes, icd10_codes, place_of_service, member_plan_type, state.

STRICT RULES:
- Use ONLY the provided payload; no external knowledge or URLs beyond forming terse verification hints.
- Do NOT answer the questions; planning only.
- Avoid duplicated question text. Keep search_queries distinct across questions when feasible.
- JSON ONLY. No prose/Markdown. No trailing commas. Start numbering at 1.

OUTPUT SHAPE:
{
  "questions": [
    {
      "n": 1,
      "type": "basic|specialty|subspecialty",
      "q": "string <=160 chars, atomic, neutral",
      "accept_if": ["string", "string"],
      "search_queries": ["site:domain.tld ..."],      // 0–2 items allowed
      "risk_flags": { "PA": false, "POS": false, "NCCI": false, "Modifiers": false, "Frequency": false, "Diagnosis": false, "StateSpecific": false, "LOBSpecific": false, "Thresholds": false }
    }
  ],
  "meta": {
    "specialty": "string",
    "subspecialty": "string",
    "rationale": "string",
    "derived": {
      "cpt_codes": ["string"],
      "icd10_codes": ["string"],
      "place_of_service": "string",
      "member_plan_type": "string",
      "state": "string"
    }
  }
}
`;

    const tools = [
      this.createCacheTool(),
      this.createGetCacheTool(),
    ];

    this.agent = this.createAgent('Planner Agent', instructions, tools);
  }

  /**
   * Generate validation questions and search queries
   */
  async generateQuestions(
    payload: ClaimPayload,
    sanityResult: SanityCheckResult
  ): Promise<PlannerResult> {
    if (!this.agent) {
      await this.initialize();
    }

    // Check cache first
    const cacheKey = `planner:${payload.cpt_codes.join(',')}:${payload.icd10_codes.join(',')}:${payload.payer}`;
    const cached = await this.redis.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const input = `
Generate validation questions for this medical claim:

Claim Payload:
- CPT Codes: ${payload.cpt_codes.join(', ')}
- ICD-10 Codes: ${payload.icd10_codes.join(', ')}
- Notes: ${payload.note_summary}
- Payer: ${payload.payer}
- Place of Service: ${payload.place_of_service || 'Not specified'}
- State: ${payload.state || 'Not specified'}
- Member Plan Type: ${payload.member_plan_type || 'Not specified'}

Sanity Check Results:
- Specialty: ${sanityResult.ssp_prediction.specialty}
- Subspecialty: ${sanityResult.ssp_prediction.subspecialty}
- Confidence: ${sanityResult.ssp_prediction.confidence}
- Issues: ${sanityResult.issues.join(', ')}
- Warnings: ${sanityResult.warnings.join(', ')}${sanityResult.policy_check_required ? `

VALIDATION RESULTS FROM SANITY CHECK AGENT:

STEP 1 - AI CLINICAL REVIEW (COMPLETED):
- Overall Appropriate: ${sanityResult.ai_clinical_validation?.overall_appropriate ? 'Yes' : 'No'}
- Documentation Quality: ${sanityResult.ai_clinical_validation?.documentation_quality || 'Unknown'}
- CPT Validation: ${sanityResult.ai_clinical_validation?.cpt_validation?.map((c: any) => `${c.code}: ${c.appropriate ? '✓' : '✗'} (${c.confidence})`).join(', ') || 'N/A'}
- ICD Validation: ${sanityResult.ai_clinical_validation?.icd_validation?.map((i: any) => `${i.code}: ${i.appropriate ? '✓' : '✗'} (${i.confidence})`).join(', ') || 'N/A'}
- Clinical Concerns: ${sanityResult.ai_clinical_validation?.clinical_concerns?.join(', ') || 'None'}
- Recommendations: ${sanityResult.ai_clinical_validation?.recommendations?.join(', ') || 'None'}

STEP 2 - CMS/NCCI RULES CHECK (COMPLETED):
- Valid: ${sanityResult.cms_ncci_validation?.is_valid ? 'Yes' : 'No'}
- Risk Score: ${sanityResult.cms_ncci_validation?.risk_score || 'Unknown'}
- Errors: ${sanityResult.cms_ncci_validation?.errors?.length || 0}
- Warnings: ${sanityResult.cms_ncci_validation?.warnings?.length || 0}

STEP 3 - POLICY VALIDATION (REQUIRED):
- Policy Check Required: ${sanityResult.policy_check_required ? 'Yes' : 'No'}
- Provider Type: ${sanityResult.policy_check_details?.provider_type || 'N/A'}
- Claim Date: ${sanityResult.policy_check_details?.claim_date || 'N/A'}

RESEARCH QUESTIONS TO ANSWER:
${sanityResult.policy_check_details?.research_questions?.map((q: any, i: number) => `${i + 1}. ${q}`).join('\n') || 'N/A'}

VALIDATION TYPES TO RESEARCH:
- ${sanityResult.policy_check_details?.validation_types?.join('\n- ') || 'N/A'}

This claim requires payer-specific policy research for medical necessity and coverage validation.` : ''}

Create 2-3 questions per tier (basic, specialty, subspecialty) with search queries for verification.
${sanityResult.policy_check_required ? 'PRIORITY: Generate questions to research medical necessity policies for the specific CPT/ICD combinations.' : ''}
Follow the exact output format specified in the instructions.
`;

    try {
      const result = await this.executeAgent(this.agent!, input);
      
      // Parse and structure the result
      const plannerResult: PlannerResult = {
        questions: result.questions || [],
        meta: result.meta || {
          specialty: sanityResult.ssp_prediction.specialty,
          subspecialty: sanityResult.ssp_prediction.subspecialty,
          rationale: 'Generated by planner agent',
          derived: {
            cpt_codes: payload.cpt_codes,
            icd10_codes: payload.icd10_codes,
            place_of_service: payload.place_of_service || '',
            member_plan_type: payload.member_plan_type || '',
            state: payload.state || '',
          }
        }
      };

      // Cache the result
      await this.redis.redis.setex(cacheKey, 1800, JSON.stringify(plannerResult));

      return plannerResult;
    } catch (error) {
      console.error('Planner Agent error:', error);
      throw new Error(`Planner failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
