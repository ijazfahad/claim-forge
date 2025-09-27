import { BaseAgent } from './base-agent';
import { Agent } from '@openai/agents';
import { ClaimPayload, PDMResult, DenialRisk, ClaimFix } from '../types/claim-types';

export class PDMAgent extends BaseAgent {
  private agent: Agent | null = null;

  constructor() {
    super();
  }

  /**
   * Initialize the PDM agent
   */
  async initialize(): Promise<void> {
    const instructions = `
You are a Predictive Denial Management (PDM) Agent for medical claim validation.

Your task is to analyze medical claims and predict denial risks, providing:
1. Denial risk scores for each CPT code
2. Overall claim risk assessment
3. Specific recommendations to reduce denial risk
4. Fixes to apply to the claim

Input: Claim payload with specialty/subspecialty predictions, historical data, and payer information
Output: Denial risks, recommendations, and fixes

Rules:
- Analyze each CPT code for potential denial reasons
- Consider payer-specific patterns and policies
- Use historical data from Redis cache
- Provide actionable recommendations
- Score risks as percentages (0-100%)
- Categorize risks: PA, coding, necessity, eligibility, modifiers, frequency
- Use web search and scraping to find current denial patterns

Example:
Input: CPT 99214 (E/M) + Anthem payer
Output: 70% denial risk due to missing documentation, recommend adding "VAS pain 8/10" to notes
`;

    const tools = [
      this.createWebSearchTool(),
      this.createScrapeTool(),
      this.createCacheTool(),
      this.createGetCacheTool(),
    ];

    this.agent = this.createAgent('PDM Agent', instructions, tools);
  }

  /**
   * Predict denial risks for a claim
   */
  async predictDenialRisks(
    payload: ClaimPayload,
    sspResult: any,
    historicalData?: any
  ): Promise<PDMResult> {
    if (!this.agent) {
      await this.initialize();
    }

    // Check cache first
    const claimHash = this.redis.generateClaimHash(payload);
    const cached = await this.redis.getCachedPDMResult(claimHash);
    if (cached) {
      return cached;
    }

    const input = `
Analyze this medical claim for denial risks:

Claim Payload:
- CPT Codes: ${payload.cpt_codes.join(', ')}
- ICD-10 Codes: ${payload.icd10_codes.join(', ')}
- Notes: ${payload.note_summary}
- Payer: ${payload.payer}
- Place of Service: ${payload.place_of_service || 'Not specified'}
- State: ${payload.state || 'Not specified'}

Specialty Prediction:
- Specialty: ${sspResult.specialty}
- Subspecialty: ${sspResult.subspecialty}
- Confidence: ${sspResult.confidence}

Historical Data: ${historicalData ? JSON.stringify(historicalData) : 'None available'}

Please provide:
1. Denial risk analysis for each CPT code
2. Overall claim risk score (0-100%)
3. Specific recommendations to reduce risk
4. Fixes to apply to the claim
5. Risk categories for each issue

Use web search and scraping tools to find current payer denial patterns and policies.
`;

    try {
      const result = await this.executeAgent(this.agent!, input);
      
      // Parse the result and create PDMResult
      const pdmResult: PDMResult = {
        denial_risks: result.denial_risks || [],
        overall_risk_score: result.overall_risk_score || 0,
        recommendations: result.recommendations || [],
        fixes: result.fixes || [],
      };

      // Cache the result
      await this.redis.cachePDMResult(claimHash, pdmResult);

      return pdmResult;
    } catch (error) {
      console.error('PDM Agent error:', error);
      throw new Error(`PDM prediction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
