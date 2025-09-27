import { ClaimPayload } from '../types/claim-types';
export interface ValidationStep {
    step_name: string;
    step_order: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    start_time: Date;
    end_time?: Date;
    duration_ms?: number;
    input_data: any;
    output_data: any;
    errors?: string[];
    warnings?: string[];
    confidence_score?: number;
}
export interface ClaimValidationRecord {
    id: string;
    claim_id: string;
    original_claim: ClaimPayload;
    overall_status: 'GO' | 'NO_GO' | 'NEEDS_REVIEW';
    confidence: 'low' | 'medium' | 'high';
    processing_time_ms: number;
    created_at: Date;
    updated_at: Date;
    validation_steps: ValidationStep[];
    final_findings: {
        errors: string[];
        warnings: string[];
        recommendations: string[];
        risk_score: number;
    };
    metadata: {
        user_agent?: string;
        ip_address?: string;
        api_version: string;
        environment: string;
    };
}
export declare class ClaimStorageService {
    private client;
    initialize(): Promise<void>;
    private createTables;
    storeClaimValidation(record: Omit<ClaimValidationRecord, 'id' | 'created_at' | 'updated_at'>): Promise<string>;
    updateValidationStep(claimValidationId: string, stepName: string, stepData: Partial<ValidationStep>): Promise<void>;
    addValidationStep(claimValidationId: string, step: ValidationStep): Promise<void>;
    getClaimValidation(claimId: string): Promise<ClaimValidationRecord | null>;
    getClaimValidations(limit?: number, offset?: number, status?: string): Promise<ClaimValidationRecord[]>;
    getValidationSteps(claimValidationId: string): Promise<ValidationStep[]>;
    getValidationStats(): Promise<{
        total_validations: number;
        go_count: number;
        no_go_count: number;
        needs_review_count: number;
        average_processing_time: number;
        success_rate: number;
    }>;
    close(): Promise<void>;
}
export declare const claimStorage: ClaimStorageService;
//# sourceMappingURL=claim-storage.d.ts.map