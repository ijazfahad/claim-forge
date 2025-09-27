import { BaseAgent } from './base-agent';
import { ClaimPayload, SSPResult } from '../types/claim-types';
export declare class SSPAgent extends BaseAgent {
    private agent;
    constructor();
    initialize(): Promise<void>;
    predictSpecialty(payload: ClaimPayload): Promise<SSPResult>;
}
//# sourceMappingURL=ssp-agent.d.ts.map