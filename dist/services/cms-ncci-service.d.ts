import { ClaimPayload } from '../types/claim-types';
export interface CMSNCCIRule {
    description: string;
    category: string;
    bundling_rules: {
        bundled_with: string[];
        bundles: string[];
        modifier_requirements: string[];
        frequency_limits: {
            per_day: number;
            per_year?: number;
            per_episode?: number;
        };
    };
    prior_auth: {
        required: boolean;
        conditions: string[];
    };
    valid_icd10: string[];
}
export interface CMSNCCIDatabase {
    version: string;
    last_updated: string;
    cpt_codes: Record<string, CMSNCCIRule>;
    bundling_edits: Record<string, {
        primary: string;
        secondary: string;
        modifier_required: string;
        description: string;
    }>;
    modifier_rules: Record<string, {
        description: string;
        usage: string;
    }>;
    frequency_limits: {
        global_periods: Record<string, number>;
        annual_limits: Record<string, number>;
    };
}
export interface ValidationIssue {
    code: string;
    risk_percentage: number;
    reason: string;
    category: 'bundling' | 'modifier' | 'frequency' | 'icd10' | 'prior_auth';
    fix?: string;
}
export declare class CMSNCCIService {
    private database;
    constructor();
    private loadDatabase;
    validateClaim(payload: ClaimPayload): Promise<ValidationIssue[]>;
    private validateCPTCode;
    private validateICD10Compatibility;
    private validateBundling;
    private validateModifiers;
    private validateFrequency;
    getCPTInfo(cptCode: string): CMSNCCIRule | null;
    getBundlingEdit(code1: string, code2: string): any;
    getModifierInfo(modifier: string): any;
    isLoaded(): boolean;
    getVersion(): string;
    private mapValidationType;
    private getCategoryFromType;
    private getFixFromType;
}
//# sourceMappingURL=cms-ncci-service.d.ts.map