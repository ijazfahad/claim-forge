import { BaseAgent } from './base-agent';
import { Agent } from '@openai/agents';
import { ClaimPayload, SSPResult } from '../types/claim-types';

export class SSPAgent extends BaseAgent {
  private agent: Agent | null = null;

  constructor() {
    super();
  }

  /**
   * Initialize the SSP agent
   */
  async initialize(): Promise<void> {
    const instructions = `
You are a Specialty and Subspecialty Prediction (SSP) Agent for medical claim validation.

Your task is to analyze medical claim payloads and predict:
1. The medical specialty (e.g., "Pain Management", "Cardiology", "Orthopedics")
2. The subspecialty (e.g., "Interventional Pain", "Electrophysiology", "Sports Medicine")

Input: Claim payload with ICD-10 codes, CPT codes, notes, and other claim details
Output: Specialty, subspecialty, confidence level, and rationale

Rules:
- Use ICD-10 and CPT code relationships to determine specialty
- Consider the clinical context from notes
- Provide confidence levels: low, medium, high
- Cache results for similar code combinations
- Use web search and scraping tools to find current specialty mappings
- Be specific and accurate in your predictions

Example:
Input: CPT 64483 (facet injection) + ICD-10 M54.5 (low back pain)
Output: Specialty: "Pain Management", Subspecialty: "Interventional Pain"
`;

    const tools = [
      this.createWebSearchTool(),
      this.createScrapeTool(),
      this.createCacheTool(),
      this.createGetCacheTool(),
    ];

    this.agent = this.createAgent('SSP Agent', instructions, tools);
  }

  /**
   * Predict specialty and subspecialty for a claim
   */
  async predictSpecialty(payload: ClaimPayload): Promise<SSPResult> {
    if (!this.agent) {
      await this.initialize();
    }

    // Check cache first
    const cached = await this.redis.getCachedSSPResult(payload.cpt_codes, payload.icd10_codes);
    if (cached) {
      return cached;
    }

    const input = `
Analyze this medical claim payload and predict the specialty and subspecialty:

Claim Payload:
- CPT Codes: ${payload.cpt_codes.join(', ')}
- ICD-10 Codes: ${payload.icd10_codes.join(', ')}
- Notes: ${payload.note_summary}
- Payer: ${payload.payer}
- Place of Service: ${payload.place_of_service || 'Not specified'}
- State: ${payload.state || 'Not specified'}

Please provide:
1. Specialty prediction
2. Subspecialty prediction
3. Confidence level (low/medium/high)
4. Rationale for your prediction
5. Derived information from the payload

Use web search and scraping tools to find current specialty mappings and coding guidelines.
`;

    try {
      const result = await this.executeAgent(this.agent!, input);
      
      // Parse the result and create SSPResult
      const sspResult: SSPResult = {
        specialty: result.specialty || 'Unknown',
        subspecialty: result.subspecialty || 'General',
        confidence: result.confidence || 'low',
        rationale: result.rationale || 'Analysis completed',
        derived: {
          cpt_codes: payload.cpt_codes,
          icd10_codes: payload.icd10_codes,
          place_of_service: payload.place_of_service || '',
          member_plan_type: payload.member_plan_type || '',
          state: payload.state || '',
        },
      };

      // Cache the result
      await this.redis.cacheSSPResult(payload.cpt_codes, payload.icd10_codes, sspResult);

      return sspResult;
    } catch (error) {
      console.error('SSP Agent error:', error);
      throw new Error(`SSP prediction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
