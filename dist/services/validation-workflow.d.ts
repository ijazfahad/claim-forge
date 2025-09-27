import { ClaimPayload } from '../types/claim-types';
import { EvaluationResult } from '../agents/evaluate-agent';
export declare class ValidationWorkflow {
    private sanityCheckAgent;
    private plannerAgent;
    private researchAgent;
    private retryAgent;
    private evaluateAgent;
    private evidenceShapingService;
    private googleSearchService;
    constructor();
    validateClaim(payload: ClaimPayload): Promise<EvaluationResult>;
    getWorkflowStatus(): Promise<any>;
    validateSingleQuestion(question: string, claimContext: ClaimPayload): Promise<any>;
}
//# sourceMappingURL=validation-workflow.d.ts.map