export interface ClaimPayload {
    payer: string;
    domains?: string[];
    seed_urls?: string[];
    cpt_codes: string[];
    icd10_codes: string[];
    place_of_service?: string;
    modifiers?: string[];
    prior_treatments?: string[];
    member_plan_type?: string;
    state?: string;
    note_summary: string;
}
export interface ClaimValidationRequest {
    callback_url: string;
    payload: ClaimPayload;
}
export interface SSPResult {
    specialty: string;
    subspecialty: string;
    confidence: 'low' | 'medium' | 'high';
    rationale: string;
    derived: {
        cpt_codes: string[];
        icd10_codes: string[];
        place_of_service: string;
        member_plan_type: string;
        state: string;
    };
}
export interface PDMResult {
    denial_risks: DenialRisk[];
    overall_risk_score: number;
    recommendations: string[];
    fixes: ClaimFix[];
}
export interface DenialRisk {
    code: string;
    risk_percentage: number;
    reason: string;
    category: 'PA' | 'coding' | 'necessity' | 'eligibility' | 'modifiers' | 'frequency';
}
export interface ClaimFix {
    action: 'add' | 'remove' | 'modify' | 'skip';
    target: string;
    value?: string;
    reason: string;
}
export interface ValidationResponse {
    claim_id: string;
    ssp_result: SSPResult;
    pdm_result: PDMResult;
    processing_time_ms: number;
    timestamp: string;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface FirecrawlResponse {
    success: boolean;
    data?: {
        content: string;
        markdown: string;
        metadata: {
            title: string;
            description: string;
            url: string;
        };
    };
    error?: string;
}
export interface GoogleSearchResult {
    title: string;
    link: string;
    snippet: string;
}
export interface GoogleSearchResponse {
    items: GoogleSearchResult[];
    searchInformation: {
        totalResults: string;
    };
}
//# sourceMappingURL=claim-types.d.ts.map