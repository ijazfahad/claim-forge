import { BaseAgent } from './base-agent';
export interface EvaluationResult {
    claim_id: string;
    overall_status: 'GO' | 'NO_GO';
    confidence: 'low' | 'medium' | 'high';
    processing_time_ms: number;
    timestamp: string;
    per_question: Array<{
        n: string;
        type: 'basic' | 'specialty' | 'subspecialty';
        q: string;
        decision: 'PASS_MODEL' | 'INSUFFICIENT';
        confidence: 'low' | 'medium';
        matched_accept_if: string | null;
        notes: string;
    }>;
    overall: {
        go_no_go: 'GO' | 'NO_GO';
        confidence: 'low' | 'medium';
        rationale: string;
        blockers: Array<{
            n: string;
            reason: string;
        }>;
        recommendations: string[];
    };
}
export declare class EvaluateAgent extends BaseAgent {
    private agent;
    constructor();
    initialize(): Promise<void>;
    evaluateResults(claimId: string, shapedEvidence: any[], startTime: number): Promise<EvaluationResult>;
    private calculateRiskScore;
    private determineStatus;
}
//# sourceMappingURL=evaluate-agent.d.ts.map