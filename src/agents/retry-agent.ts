import { BaseAgent } from './base-agent';
import { Agent } from '@openai/agents';
import { ValidationQuestion } from './planner-agent';
import { ResearchResult } from './research-agent';
import { ClaimPayload } from '../types/claim-types';

export interface RetryResult {
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

export class RetryAgent extends BaseAgent {
  private agent: Agent | null = null;

  constructor() {
    super();
  }

  /**
   * Initialize the Retry agent
   */
  async initialize(): Promise<void> {
    const instructions = `
You are a Retry Agent for medical claim validation.

Your task is to provide reasoning-based answers when web search and document extraction fail.

PROCESS:
1. Take unanswered or low-confidence questions from the research agent
2. Use OpenAI GPT-5 for reasoning-based answers
3. Apply domain knowledge and patterns
4. Provide confidence scores (typically lower than web search)
5. Flag as "reasoning-based" vs "document-based"

RULES:
- Use only domain knowledge and reasoning
- Provide clear reasoning chains
- Be conservative with confidence scores
- Mark all answers as "reasoning-based"
- Consider previous research attempts

CONFIDENCE LEVELS:
- High (0.8-1.0): Clear domain knowledge, well-established patterns
- Medium (0.5-0.7): Reasonable inference from known patterns
- Low (0.2-0.4): Uncertain or conflicting information

OUTPUT FORMAT:
{
  "question_n": number,
  "question": "string",
  "answer": "string",
  "confidence": "low|medium|high",
  "source_type": "reasoning",
  "reasoning_chain": "string",
  "previous_attempts": [...],
  "timestamp": "ISO string"
}
`;

    const tools = [
      this.createCacheTool(),
      this.createGetCacheTool(),
    ];

    this.agent = this.createAgent('Retry Agent', instructions, tools);
  }

  /**
   * Retry unanswered questions using reasoning
   */
  async retryQuestions(
    failedQuestions: ResearchResult[],
    claimContext: ClaimPayload
  ): Promise<RetryResult[]> {
    if (!this.agent) {
      await this.initialize();
    }

    const results: RetryResult[] = [];

    for (const failedQuestion of failedQuestions) {
      try {
        // Check cache first
        const cacheKey = `retry:${failedQuestion.question.substring(0, 50)}`;
        const cached = await this.redis.redis.get(cacheKey);
        if (cached) {
          results.push(JSON.parse(cached));
          continue;
        }

        const input = `
Provide a reasoning-based answer for this validation question:

Question: ${failedQuestion.question}
Previous Answer: ${failedQuestion.answer}
Previous Confidence: ${failedQuestion.confidence}
Previous Source: ${failedQuestion.source}

Claim Context:
- Payer: ${claimContext.payer}
- CPT Codes: ${claimContext.cpt_codes.join(', ')}
- ICD Codes: ${claimContext.icd10_codes.join(', ')}
- State: ${claimContext.state || 'Not specified'}

Use your domain knowledge and reasoning to provide the best possible answer. Be conservative with confidence scores and provide a clear reasoning chain.
`;

        const result = await this.executeAgent(this.agent!, input);
        
        // Parse and structure the result
        const retryResult: RetryResult = {
          n: failedQuestion.question.substring(0, 10), // Use first 10 chars as ID
          type: 'basic', // Default type
          q: failedQuestion.question,
          status: result.status || 'insufficient',
          model_only: 'true',
          summary: result.summary || 'Unable to determine',
          likely_accept_if: result.likely_accept_if || '',
          confidence: result.confidence || 'low',
          disclaimers: result.disclaimers || 'Plan, state, and line-of-business rules vary; verify in official policy.',
          next_checks: result.next_checks || []
        };

        // Cache the result
        await this.redis.redis.setex(cacheKey, 1800, JSON.stringify(retryResult));
        
        results.push(retryResult);
      } catch (error) {
        console.error(`Retry error for question ${failedQuestion.question}:`, error);
        
        // Add error result
        results.push({
          n: failedQuestion.question.substring(0, 10),
          type: 'basic',
          q: failedQuestion.question,
          status: 'insufficient',
          model_only: 'true',
          summary: 'Retry failed',
          likely_accept_if: 'Error occurred during retry',
          confidence: 'low',
          disclaimers: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          next_checks: [],
        });
      }
    }

    return results;
  }

  /**
   * Determine if a question needs retry
   */
  shouldRetry(researchResult: ResearchResult): boolean {
    // Retry if confidence is low or answer is insufficient
    return (
      researchResult.confidence < 0.5 ||
      researchResult.answer.includes('No clear answer') ||
      researchResult.answer.includes('Research failed') ||
      researchResult.recommendations.length === 0
    );
  }

  /**
   * Filter questions that need retry
   */
  filterQuestionsForRetry(researchResults: ResearchResult[]): ResearchResult[] {
    return researchResults.filter(result => this.shouldRetry(result));
  }
}
