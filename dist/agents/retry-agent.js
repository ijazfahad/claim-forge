"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryAgent = void 0;
const base_agent_1 = require("./base-agent");
class RetryAgent extends base_agent_1.BaseAgent {
    constructor() {
        super();
        this.agent = null;
    }
    async initialize() {
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
    async retryQuestions(failedQuestions, claimContext) {
        if (!this.agent) {
            await this.initialize();
        }
        const results = [];
        for (const failedQuestion of failedQuestions) {
            try {
                const cacheKey = `retry:${failedQuestion.n}:${failedQuestion.q.substring(0, 50)}`;
                const cached = await this.redis.redis.get(cacheKey);
                if (cached) {
                    results.push(JSON.parse(cached));
                    continue;
                }
                const input = `
Provide a reasoning-based answer for this validation question:

Question: ${failedQuestion.q}
Previous Summary: ${failedQuestion.summary}
Previous Confidence: ${failedQuestion.confidence}
Previous Status: ${failedQuestion.status}

Claim Context:
- Payer: ${claimContext.payer}
- CPT Codes: ${claimContext.cpt_codes.join(', ')}
- ICD Codes: ${claimContext.icd10_codes.join(', ')}
- State: ${claimContext.state || 'Not specified'}

Use your domain knowledge and reasoning to provide the best possible answer. Be conservative with confidence scores and provide a clear reasoning chain.
`;
                const result = await this.executeAgent(this.agent, input);
                const retryResult = {
                    n: failedQuestion.n,
                    type: failedQuestion.type,
                    q: failedQuestion.q,
                    status: result.status || 'insufficient',
                    model_only: 'true',
                    summary: result.summary || 'Unable to determine',
                    likely_accept_if: result.likely_accept_if || '',
                    confidence: result.confidence || 'low',
                    disclaimers: result.disclaimers || 'Plan, state, and line-of-business rules vary; verify in official policy.',
                    next_checks: result.next_checks || []
                };
                await this.redis.redis.setex(cacheKey, 1800, JSON.stringify(retryResult));
                results.push(retryResult);
            }
            catch (error) {
                console.error(`Retry error for question ${failedQuestion.n}:`, error);
                results.push({
                    n: failedQuestion.n,
                    type: failedQuestion.type,
                    q: failedQuestion.q,
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
    shouldRetry(researchResult) {
        return (researchResult.confidence === 'low' ||
            researchResult.summary.includes('No clear answer') ||
            researchResult.summary.includes('Research failed') ||
            researchResult.next_checks.length === 0);
    }
    filterQuestionsForRetry(researchResults) {
        return researchResults.filter(result => this.shouldRetry(result));
    }
}
exports.RetryAgent = RetryAgent;
//# sourceMappingURL=retry-agent.js.map