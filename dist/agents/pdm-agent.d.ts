import { BaseAgent } from './base-agent';
import { ClaimPayload, PDMResult } from '../types/claim-types';
export declare class PDMAgent extends BaseAgent {
    private agent;
    constructor();
    initialize(): Promise<void>;
    predictDenialRisks(payload: ClaimPayload, sspResult: any, historicalData?: any): Promise<PDMResult>;
}
//# sourceMappingURL=pdm-agent.d.ts.map