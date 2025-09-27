import { BaseAgent } from './base-agent';
import { ClaimPayload } from '../types/claim-types';
import { ValidationIssue } from '../services/cms-ncci-service';
import { ValidationResult } from '../services/cms-ncci-validator';
export interface SanityCheckResult {
    is_valid: boolean;
    sanitized_payload: ClaimPayload;
    ssp_prediction: {
        specialty: string;
        subspecialty: string;
        confidence: 'low' | 'medium' | 'high';
    };
    issues: string[];
    warnings: string[];
    cms_ncci_checks: {
        bundling_issues: string[];
        modifier_requirements: string[];
        frequency_limits: string[];
    };
    validation_issues: ValidationIssue[];
    cms_ncci_validation: ValidationResult;
}
export declare class SanityCheckAgent extends BaseAgent {
    private agent;
    private cmsNCCIService;
    constructor();
    initialize(): Promise<void>;
    performSanityCheck(payload: ClaimPayload): Promise<SanityCheckResult>;
    private validateCPTCode;
    private validateICD10Code;
    private checkBundlingRules;
}
//# sourceMappingURL=sanity-check-agent.d.ts.map