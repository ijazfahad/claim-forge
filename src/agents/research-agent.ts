import { BaseAgent } from './base-agent';
import { Agent } from '@openai/agents';
import { ValidationQuestion } from './planner-agent';
import { ClaimPayload } from '../types/claim-types';

export interface ResearchResult {
  n: string;
  type: 'basic' | 'specialty' | 'subspecialty';
  q: string;
  status: 'ok' | 'insufficient';
  model_only: 'true';
  summary: string;
  likely_accept_if: string;
  confidence: 'low' | 'medium' | 'high';
  disclaimers: string;
  next_checks: string[];
}

export class ResearchAgent extends BaseAgent {
  private agent: Agent | null = null;

  constructor() {
    super();
  }

  /**
   * Initialize the Research agent
   */
  async initialize(): Promise<void> {
    const instructions = `
You are Research Agent (Model-Only, Balanced, Decision-Grade).

INPUT
- question: has n, type, q, accept_if?[]
- claim_context: payer, state, member_plan_type, cpt_codes, icd10_codes, place_of_service, note_summary
- (optional) meta: specialty, subspecialty, rationale

MISSION
Provide a concise, decision-oriented hypothesis for the question using domain knowledge only (no tools). Be balanced:
- Mark "ok" when the stance is supported by widely observed cross-payer norms and you're reasonably confident (medium/high).
- Mark "insufficient" when uncertainty is material or details are likely payer/state/LOB-specific.

WHAT TO WRITE
1) Stance: start summary with exactly one of — "Likely yes—", "Likely no—", or "Unclear—".
2) Reasoning: 1–2 short sentences based on broad industry norms; tailor to claim_context (payer name, state, LOB, CPT/ICD/POS, note summary) without asserting payer-specific rules.
3) If question.accept_if exists, pick exactly ONE line that best aligns with your stance; if none fit, use "" (empty string).
4) Provide 0–3 short, practical next checks (things a verifier could do later).

CONFIDENCE & STATUS (Balanced Gate)
- Default confidence = "low".
- Upgrade to "medium" when:
  • The stance is consistent with common industry norms for the topic (e.g., typical utilization review patterns, standard coding relationships), AND
  • You do not rely on multiple unverified payer/state/LOB assumptions.
- Use "high" only for definitional, near-universal truths (stable coding/claims conventions).
- If confidence is "medium" or "high" ⇒ status = "ok".
- If confidence is "low" OR stance is "Unclear—" ⇒ status = "insufficient".

Topic hints (not hard rules):
- BASIC (PA, POS, frequency, edits/modifiers): medium is acceptable when driven by broad norms; keep low if plan/state specific.
- SPECIALTY (common clinical prerequisites/patterns): often medium unless clearly plan/state specific.
- SUBSPECIALTY (fine-grained, site/level nuances): usually low unless definitional.

FORMAT (ALL STRINGS; JSON ARRAY with exactly one object)
- No numbers/booleans/nulls; arrays are arrays of strings.
- No extra keys, no markdown, no code fences, no trailing commas.

OUTPUT — JSON ARRAY ONLY:
[
  {
    "n": "string",                                // echo question.n (e.g., "1")
    "type": "basic|specialty|subspecialty",       // echo from input
    "q": "string",                                // echo from input
    "status": "ok|insufficient",
    "model_only": "true",
    "summary": "Likely yes—... / Likely no—... / Unclear—... (1–2 short sentences)",
    "likely_accept_if": "string",                 // ONE line from accept_if if available; else ""
    "confidence": "low|medium|high",
    "disclaimers": "Plan, state, and line-of-business rules vary; verify in official policy.",
    "next_checks": ["string", "string"]          // 0–3 items
  }
]

STYLE
- Answer-first; concise; no policy names/numbers, URLs, or quotes.
- Tools are unavailable; domain knowledge only.
- If in doubt, prefer "Unclear—" + low confidence ⇒ "insufficient".
`;

    const tools = [
      this.createCacheTool(),
      this.createGetCacheTool(),
    ];

    this.agent = this.createAgent('Research Agent', instructions, tools);
  }

  /**
   * Research answers for validation questions
   */
  async researchQuestions(
    questions: ValidationQuestion[],
    claimContext: ClaimPayload
  ): Promise<ResearchResult[]> {
    if (!this.agent) {
      await this.initialize();
    }

    const results: ResearchResult[] = [];

    for (const question of questions) {
      try {
        // Check cache first
        const cacheKey = `research:${question.n}:${question.q.substring(0, 50)}`;
        const cached = await this.redis.redis.get(cacheKey);
        if (cached) {
          results.push(JSON.parse(cached));
          continue;
        }

        const input = `
Research this validation question using domain knowledge only:

Question: ${question.q}
Type: ${question.type}
Accept If: ${question.accept_if.join(', ')}

Claim Context:
- Payer: ${claimContext.payer}
- CPT Codes: ${claimContext.cpt_codes.join(', ')}
- ICD Codes: ${claimContext.icd10_codes.join(', ')}
- State: ${claimContext.state || 'Not specified'}
- Member Plan Type: ${claimContext.member_plan_type || 'Not specified'}
- Place of Service: ${claimContext.place_of_service || 'Not specified'}
- Note Summary: ${claimContext.note_summary}

Provide a balanced, decision-oriented hypothesis using domain knowledge only.
`;

        const result = await this.executeAgent(this.agent!, input);
        
        // Parse and structure the result
        const researchResult: ResearchResult = {
          n: String(question.n),
          type: question.type,
          q: question.q,
          status: result.status || 'insufficient',
          model_only: 'true',
          summary: result.summary || 'Unclear—insufficient information',
          likely_accept_if: result.likely_accept_if || '',
          confidence: result.confidence || 'low',
          disclaimers: result.disclaimers || 'Plan, state, and line-of-business rules vary; verify in official policy.',
          next_checks: result.next_checks || []
        };

        // Cache the result
        await this.redis.redis.setex(cacheKey, 3600, JSON.stringify(researchResult));
        
        results.push(researchResult);
      } catch (error) {
        console.error(`Research error for question ${question.n}:`, error);
        
        // Add error result
        results.push({
          n: String(question.n),
          type: question.type,
          q: question.q,
          status: 'insufficient',
          model_only: 'true',
          summary: 'Unclear—research failed',
          likely_accept_if: '',
          confidence: 'low',
          disclaimers: 'Plan, state, and line-of-business rules vary; verify in official policy.',
          next_checks: [`Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
        });
      }
    }

    return results;
  }

  /**
   * Execute web search for a specific query
   */
  async executeWebSearch(query: string): Promise<any[]> {
    try {
      const results = await this.googleSearch.searchMedicalCoding(query);
      return results;
    } catch (error) {
      console.error('Web search error:', error);
      return [];
    }
  }

  /**
   * Make direct HTTP request to Firecrawl for document extraction
   */
  async extractDocumentWithFirecrawl(
    url: string, 
    cptCodes: string[] = [], 
    extractionPrompt?: string
  ): Promise<any> {
    try {
      const axios = require('axios');
      const firecrawlUrl = process.env.FIRECRAWL_API_URL;
      const apiKey = process.env.FIRECRAWL_API_KEY;
      
      if (!firecrawlUrl || !apiKey) {
        throw new Error('FIRECRAWL_API_URL and FIRECRAWL_API_KEY environment variables are required');
      }

      // Create structured extraction format for CPT codes
      const formats = cptCodes.length > 0 ? [
        {
          type: 'json',
          schema: {
            type: 'object',
            properties: {
              target_codes: {
                type: 'object',
                properties: cptCodes.reduce((acc, code) => {
                  acc[code] = {
                    type: 'object',
                    properties: {
                      pa_required: { type: 'boolean' },
                      procedure_name: { type: 'string' },
                      found_in_list: { type: 'boolean' },
                      coverage_notes: { type: 'string' },
                      restrictions: { type: 'string' }
                    }
                  };
                  return acc;
                }, {} as any)
              }
            }
          },
          prompt: extractionPrompt || `Extract information about CPT codes ${cptCodes.join(', ')} from this document. Determine if these codes require prior authorization, provide procedure names, and note any coverage restrictions or requirements.`
        }
      ] : [{ type: 'markdown' }];

      const response = await axios.post(
        `${firecrawlUrl}/v2/scrape`,
        {
          url,
          formats,
          onlyMainContent: true,
          removeBase64Images: true,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      return {
        success: true,
        data: response.data.data || response.data,
        metadata: {
          title: response.data.metadata?.title || '',
          description: response.data.metadata?.description || '',
          url: url,
        },
      };
    } catch (error) {
      console.error('Firecrawl HTTP request error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
