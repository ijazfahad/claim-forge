import { BaseAgent } from './base-agent';
import { ClaimPayload } from '../types/claim-types';
import { SanityCheckResult } from './sanity-check-agent';
export interface ValidationQuestion {
    n: number;
    type: 'basic' | 'specialty' | 'subspecialty';
    q: string;
    accept_if: string[];
    search_queries: string[];
    risk_flags: {
        PA: boolean;
        POS: boolean;
        NCCI: boolean;
        Modifiers: boolean;
        Frequency: boolean;
        Diagnosis: boolean;
        StateSpecific: boolean;
        LOBSpecific: boolean;
        Thresholds: boolean;
    };
}
export interface PlannerResult {
    questions: ValidationQuestion[];
    meta: {
        specialty: string;
        subspecialty: string;
        rationale: string;
        derived: {
            cpt_codes: string[];
            icd10_codes: string[];
            place_of_service: string;
            member_plan_type: string;
            state: string;
        };
    };
}
export declare class PlannerAgent extends BaseAgent {
    private agent;
    constructor();
    initialize(): Promise<void>;
    generateQuestions(payload: ClaimPayload, sanityResult: SanityCheckResult): Promise<PlannerResult>;
}
//# sourceMappingURL=planner-agent.d.ts.map