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
    private createFailureResult;
}
//# sourceMappingURL=validation-workflow-new.d.ts.map