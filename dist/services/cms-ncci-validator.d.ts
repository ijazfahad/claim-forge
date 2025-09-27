export interface ClaimValidationInput {
    cpt_codes: string[];
    icd10_codes: string[];
    modifiers?: string[];
    place_of_service?: string;
    note_summary?: string;
}
export interface ValidationIssue {
    type: 'ICD_FORMAT' | 'AOC_PRIMARY_MISSING' | 'MUE_EXCEEDED' | 'PTP_BLOCKED' | 'PTP_NEEDS_MODIFIER' | 'PTP_UNKNOWN_INDICATOR' | 'NEEDS_POLICY_CHECK' | 'AOC' | 'MUE' | 'PTP_BYPASSED';
    message: string;
    data?: any;
}
export interface ValidationResult {
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    passes: ValidationIssue[];
    is_valid: boolean;
    risk_score: number;
}
export declare function buildLatest({ verbose }?: {
    verbose?: boolean | undefined;
}): Promise<{
    dbPath: string;
    downloaded: any;
}>;
export declare function validateClaim(claim: ClaimValidationInput, { providerType }?: {
    providerType?: string | undefined;
}): Promise<ValidationResult>;
export declare function isDatabaseBuilt(): Promise<boolean>;
export declare function getDatabasePath(): string;
//# sourceMappingURL=cms-ncci-validator.d.ts.map