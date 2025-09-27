import { BaseAgent } from './base-agent';
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
export declare class ResearchAgent extends BaseAgent {
    private agent;
    constructor();
    initialize(): Promise<void>;
    researchQuestions(questions: ValidationQuestion[], claimContext: ClaimPayload): Promise<ResearchResult[]>;
    executeWebSearch(query: string): Promise<any[]>;
    extractDocumentWithFirecrawl(url: string, cptCodes?: string[], extractionPrompt?: string): Promise<any>;
}
//# sourceMappingURL=research-agent.d.ts.map