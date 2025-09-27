import { BaseAgent } from './base-agent';
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
export declare class RetryAgent extends BaseAgent {
    private agent;
    constructor();
    initialize(): Promise<void>;
    retryQuestions(failedQuestions: ResearchResult[], claimContext: ClaimPayload): Promise<RetryResult[]>;
    shouldRetry(researchResult: ResearchResult): boolean;
    filterQuestionsForRetry(researchResults: ResearchResult[]): ResearchResult[];
}
//# sourceMappingURL=retry-agent.d.ts.map