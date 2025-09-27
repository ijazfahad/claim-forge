import { ResearchResult } from '../agents/research-agent';
import { ValidationQuestion } from '../agents/planner-agent';
import { ClaimPayload } from '../types/claim-types';
export interface ShapedEvidence {
    n: number;
    type: string;
    q: string;
    mode: 'model_only' | 'researched' | 'insufficient' | 'unknown';
    accept_if: string[];
    claim_context: {
        payer: string;
        state: string;
        member_plan_type: string;
        place_of_service: string;
        cpt_codes: string[];
        icd10_codes: string[];
    };
    evidence: {
        url: string;
        title: string;
        snippets: Array<{
            text: string;
            where: string;
        }>;
        used_query: string;
    };
    model_only: {
        summary: string;
        likely_accept_if: string | null;
        confidence: 'low' | 'medium' | 'high';
        next_checks: string[];
        disclaimers: string;
    } | null;
}
export declare class EvidenceShapingService {
    shapeEvidence(researchResults: ResearchResult[], questions: ValidationQuestion[], claimContext: ClaimPayload): ShapedEvidence[];
    private determineMode;
    private sanitizeConfidence;
    private clampSnippets;
    private toBool;
    private sanitizeString;
    aggregateForEvaluation(shapedEvidence: ShapedEvidence[]): ShapedEvidence[];
    getStatistics(shapedEvidence: ShapedEvidence[]): {
        total: number;
        by_mode: Record<string, number>;
        by_type: Record<string, number>;
        by_confidence: Record<string, number>;
    };
}
//# sourceMappingURL=evidence-shaping-service.d.ts.map