import { BaseAgent } from './base-agent';
import { Agent } from '@openai/agents';
import { ClaimPayload } from '../types/claim-types';
import { SanityCheckResult } from './sanity-check-agent';
import { PayerDomainMappingService } from '../services/payer-domain-mapping';

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
  private payerDomainService: PayerDomainMappingService;

  constructor() {
    super();
    this.payerDomainService = PayerDomainMappingService.getInstance();
  }

  /**
   * Initialize the Planner agent
   */
  async initialize(): Promise<void> {
    const instructions = `
You are a Planner Agent for medical claim validation.

Your task is to generate a short, targeted checklist of validation questions for the claim using ONLY the payload provided.

CRITICAL REQUIREMENTS - MUST FOLLOW:
1) Generate approximately 2-3 questions per tier (basic, specialty, subspecialty) = 6-9 total questions
2) For edge cases with invalid data, generate approximately 2 basic + 1-2 specialty + 1-2 subspecialty = 4-6 total questions
3) For complex scenarios, generate approximately 2-3 basic + 2-3 specialty + 2-3 subspecialty = 6-9 total questions
4) Each question must be atomic, neutral (no presupposed "yes"), and ≤160 chars
5) Each question MUST include specific claim context (CPT codes, ICD codes, payer, state, etc.)

QUESTION DISTRIBUTION RULES:
- BASIC (2-3 questions): payer/claim mechanics (PA, eligibility, POS/modifiers, NCCI edits, frequency, plan rules)
- SPECIALTY (2-3 questions): rules typical for the inferred specialty
- SUBSPECIALTY (2-3 questions): fine-grained checks specific to the procedure/subspecialty
- For edge cases: BASIC (2), SPECIALTY (1-2), SUBSPECIALTY (1-2)

FOR EACH QUESTION INCLUDE:
- accept_if: 2–5 concrete evidence checks (what policy text would count as satisfying the question)
- search_queries: 1–2 STRICT site-specific verification queries using Google dorking techniques

GOOGLE DORKING OPERATORS:
  • site:{domain} - ALWAYS include as first part (e.g., site:cms.gov, site:aetna.com)
  • filetype:pdf - Find policy documents
  • "exact phrases" - Match specific terms exactly
  • (term1 OR term2) - Multiple options

QUERY PATTERNS BY QUESTION INTENT:
  • Authorization: site:{domain} filetype:pdf "prior authorization"
  • Medical Necessity: site:{domain} filetype:pdf "medical necessity"
  • Bundling/NCCI: site:{domain} filetype:pdf "bundling" OR "ncci"
  • Coverage: site:{domain} filetype:pdf "coverage determination"
  • Modifier: site:{domain} filetype:pdf "modifier"

EXAMPLES:
  • Question: "Does Medicare require prior authorization for this?"
    Query: site:cms.gov filetype:pdf "prior authorization"
  
  • Question: "Are there bundling restrictions?"
    Query: site:aetna.com filetype:pdf "bundling" OR "ncci"
  
  • Question: "What is the medical necessity policy?"
    Query: site:bcbs.com filetype:pdf "medical necessity"

RULES:
  • Use site:{domain} + filetype:pdf + "exact phrase"
  • Use quotes around important terms
  • Use OR for multiple relevant terms
  • Keep queries simple and focused
- risk_flags: object with booleans for { "PA", "POS", "NCCI", "Modifiers", "Frequency", "Diagnosis", "StateSpecific", "LOBSpecific", "Thresholds" } indicating which risk categories the question targets

META:
Add:
- specialty, subspecialty, rationale (why you inferred them)
- derived: echo cpt_codes, icd10_codes, place_of_service, member_plan_type, state

STRICT RULES:
- Use ONLY the provided payload; no external knowledge or URLs beyond forming terse verification hints
- Do NOT answer the questions; planning only
- Avoid duplicated question text. Keep search_queries distinct across questions when feasible
- JSON ONLY. No prose/Markdown. No trailing commas. Start numbering at 1
- MUST follow exact question count requirements above
- ALWAYS include specific claim details in questions (e.g., "CPT 99213", "ICD-10 M54.5", "Medicare HMO", "California")
- NEVER use generic terms like "this claim" - always specify the actual codes, payer, state, etc.

OUTPUT SHAPE:
{
  "questions": [
    {
      "n": 1,
      "type": "basic|specialty|subspecialty",
      "q": "string <=160 chars, atomic, neutral, MUST include specific claim context (CPT codes, ICD codes, payer, state, etc.)",
      "accept_if": ["string", "string"],
      "search_queries": ["site:aetna.com CPT 99213 modifier 25", "site:aetna.com authorization requirements"],      // 1–2 items, ALWAYS site-specific
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

    const tools: any[] = [];

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

    // Skip cache for testing - always generate fresh results
    // const cacheKey = `planner:${payload.cpt_codes.join(',')}:${payload.icd10_codes.join(',')}:${payload.payer}`;
    // const cached = await this.redis.redis.get(cacheKey);
    // if (cached) {
    //   return JSON.parse(cached);
    // }

    // Get payer domains for search queries
    const payerDomains = this.payerDomainService.getDomainsForPayer(payload.payer);
    const primaryDomain = payerDomains[0] || 'healthcare.gov';
    const isKnownPayer = payerDomains.length > 0 && payerDomains[0] !== 'healthcare.gov';

    const input = `
Generate validation questions for this medical claim:

Claim Payload:
- CPT Codes: ${payload.cpt_codes.join(', ')}
- ICD-10 Codes: ${payload.icd10_codes.join(', ')}
- Modifiers: ${(payload.modifiers || []).join(', ') || 'None'}
- Notes: ${payload.note_summary}
- Payer: ${payload.payer}
- Payer Domains: ${payerDomains.join(', ')}
- Primary Domain: ${primaryDomain}
- Known Payer: ${isKnownPayer ? 'Yes' : 'No'}
- Place of Service: ${payload.place_of_service || 'Not specified'}
- State: ${payload.state || 'Not specified'}
- Member Plan Type: ${payload.member_plan_type || 'Not specified'}

Specialty Prediction:
- Specialty: ${sanityResult.ssp_prediction.specialty}
- Subspecialty: ${sanityResult.ssp_prediction.subspecialty}
- Confidence: ${sanityResult.ssp_prediction.confidence}

Policy Research Required: ${sanityResult.policy_check_required ? 'Yes' : 'No'}${sanityResult.policy_check_required ? `

Research Questions to Answer:
${sanityResult.policy_check_details?.research_questions?.map((q: any, i: number) => `${i + 1}. ${q}`).join('\n') || 'N/A'}

Validation Types to Research:
- ${sanityResult.policy_check_details?.validation_types?.join('\n- ') || 'N/A'}` : ''}

CRITICAL: Generate approximately the required number of questions based on claim complexity:

${(() => {
  const hasInvalidCodes = payload.cpt_codes.some(code => !/^\d{5}$/.test(code)) || 
                         payload.icd10_codes.some(code => !/^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/.test(code));
  const isComplexScenario = payload.cpt_codes.length > 2 || payload.icd10_codes.length > 2;
  
  if (hasInvalidCodes) {
    return 'EDGE CASE DETECTED: Generate approximately 4-6 questions (2 basic + 1-2 specialty + 1-2 subspecialty)';
  } else if (isComplexScenario) {
    return 'COMPLEX SCENARIO DETECTED: Generate approximately 6-9 questions (2-3 basic + 2-3 specialty + 2-3 subspecialty)';
  } else {
    return 'STANDARD CLAIM: Generate approximately 6-9 questions (2-3 basic + 2-3 specialty + 2-3 subspecialty)';
  }
})()}

${sanityResult.policy_check_required ? 'PRIORITY: Generate questions to research medical necessity policies for the specific CPT/ICD combinations.' : ''}

CRITICAL SEARCH QUERY REQUIREMENTS:
${isKnownPayer ? 
  `- ALWAYS use site:${primaryDomain} as the prefix for ALL search queries` :
  `- PAYER NOT IN MAPPING: Generate your best guess for the payer's official website domain
- Use common patterns like "site:${payload.payer.toLowerCase().replace(/[^a-z0-9]/g, '')}.com" or "site:${payload.payer.toLowerCase().replace(/[^a-z0-9]/g, '')}.org"
- If payer name has spaces, try variations like "site:${payload.payer.toLowerCase().replace(/\s+/g, '')}.com"`
}
- Include specific CPT codes (${payload.cpt_codes.join(', ')}) in search queries
- Include specific ICD codes (${payload.icd10_codes.join(', ')}) in search queries when relevant
- Examples of good search queries:
  * "site:${isKnownPayer ? primaryDomain : payload.payer.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'} CPT ${payload.cpt_codes[0]} authorization requirements"
  * "site:${isKnownPayer ? primaryDomain : payload.payer.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'} ICD ${payload.icd10_codes[0]} medical necessity"
  * "site:${isKnownPayer ? primaryDomain : payload.payer.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'} modifier ${(payload.modifiers || [])[0] || '25'} bundling rules"
- NEVER use generic queries without site: prefix
- NEVER use quotes around the entire query

Follow the exact output format and question count requirements specified in the instructions.
`;

    try {
      const result = await this.executeAgent(this.agent!, input, {
        model: process.env.PLANNER_MODEL,
        temperature: process.env.PLANNER_TEMPERATURE ? parseFloat(process.env.PLANNER_TEMPERATURE) : undefined,
        max_tokens: process.env.PLANNER_MAX_TOKENS ? parseInt(process.env.PLANNER_MAX_TOKENS) : undefined
      });
      
      // Get questions from result
      const questions = result.questions || [];
      
      // Post-process questions to ensure strict search queries
      const processedQuestions = questions.map((question: ValidationQuestion) => {
        const processedQuestion = { ...question };
        
        // Ensure all search queries are site-specific
        if (processedQuestion.search_queries && processedQuestion.search_queries.length > 0) {
          processedQuestion.search_queries = processedQuestion.search_queries.map(query => {
            // If query doesn't start with site:, add the appropriate domain
            if (!query.toLowerCase().startsWith('site:')) {
              if (isKnownPayer) {
                return `site:${primaryDomain} ${query}`;
              } else {
                // For unknown payers, generate a domain guess
                const payerDomainGuess = this.generatePayerDomainGuess(payload.payer);
                return `site:${payerDomainGuess} ${query}`;
              }
            }
            return query;
          });
        }
        
        return processedQuestion;
      });
      
      // Parse and structure the result
      const plannerResult: PlannerResult = {
        questions: processedQuestions,
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

      // Skip cache for testing
      // await this.redis.redis.setex(cacheKey, 1800, JSON.stringify(plannerResult));

      return plannerResult;
    } catch (error) {
      console.error('Planner Agent error:', error);
      throw new Error(`Planner failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a domain guess for unknown payers
   */
  private generatePayerDomainGuess(payerName: string): string {
    // Clean the payer name
    const cleanName = payerName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '') // Remove spaces
      .trim();
    
    // Common domain patterns for insurance companies - just hostnames
    const domainPatterns = [
      `${cleanName}.com`, // Most likely - main site
      `${cleanName}.org`, // Non-profit organizations
      `${cleanName}health.com`, // Health-focused companies
      `${cleanName}healthcare.com`, // Healthcare-focused companies
      `${cleanName}insurance.com` // Insurance-focused companies
    ];
    
    // Return the most likely domain (usually .com)
    return domainPatterns[0];
  }
}
