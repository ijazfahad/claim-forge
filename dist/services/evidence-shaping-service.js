"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvidenceShapingService = void 0;
class EvidenceShapingService {
    shapeEvidence(researchResults, questions, claimContext) {
        const shaped = [];
        for (const result of researchResults) {
            const question = questions.find(q => String(q.n) === result.n);
            if (!question)
                continue;
            const shapedItem = {
                n: Number(result.n),
                type: result.type,
                q: result.q,
                mode: this.determineMode(result),
                accept_if: question.accept_if || [],
                claim_context: {
                    payer: claimContext.payer,
                    state: claimContext.state || '',
                    member_plan_type: claimContext.member_plan_type || '',
                    place_of_service: claimContext.place_of_service || '',
                    cpt_codes: claimContext.cpt_codes,
                    icd10_codes: claimContext.icd10_codes
                },
                evidence: {
                    url: '',
                    title: '',
                    snippets: [],
                    used_query: ''
                },
                model_only: null
            };
            if (result.model_only === 'true') {
                shapedItem.mode = 'model_only';
                shapedItem.model_only = {
                    summary: result.summary,
                    likely_accept_if: result.likely_accept_if || null,
                    confidence: this.sanitizeConfidence(result.confidence),
                    next_checks: result.next_checks || [],
                    disclaimers: result.disclaimers || 'Plan, state, and line-of-business rules vary; verify in official policy.'
                };
            }
            else if (result.status === 'ok') {
                shapedItem.mode = 'researched';
                shapedItem.evidence = {
                    url: '',
                    title: '',
                    snippets: [],
                    used_query: ''
                };
            }
            else {
                shapedItem.mode = 'insufficient';
            }
            shaped.push(shapedItem);
        }
        return shaped;
    }
    determineMode(result) {
        if (result.model_only === 'true') {
            return 'model_only';
        }
        if (result.status === 'ok') {
            return 'researched';
        }
        if (result.status === 'insufficient') {
            return 'insufficient';
        }
        return 'unknown';
    }
    sanitizeConfidence(confidence) {
        const normalized = confidence.toLowerCase();
        if (normalized === 'high')
            return 'high';
        if (normalized === 'medium')
            return 'medium';
        return 'low';
    }
    clampSnippets(snippets) {
        if (!Array.isArray(snippets))
            return [];
        return snippets
            .map(snippet => {
            const text = (snippet?.text || '').slice(0, 300);
            const where = snippet?.where || '';
            return text ? { text, where } : null;
        })
            .filter(Boolean);
    }
    toBool(value) {
        if (typeof value === 'boolean')
            return value;
        if (typeof value === 'string')
            return value.trim().toLowerCase() === 'true';
        return false;
    }
    sanitizeString(value) {
        return (value == null ? '' : String(value)).trim();
    }
    aggregateForEvaluation(shapedEvidence) {
        const priority = { basic: 0, specialty: 1, subspecialty: 2 };
        return shapedEvidence
            .sort((a, b) => {
            const pa = priority[a.type] ?? 99;
            const pb = priority[b.type] ?? 99;
            if (pa !== pb)
                return pa - pb;
            return a.n - b.n;
        });
    }
    getStatistics(shapedEvidence) {
        const stats = {
            total: shapedEvidence.length,
            by_mode: {},
            by_type: {},
            by_confidence: {}
        };
        for (const item of shapedEvidence) {
            stats.by_mode[item.mode] = (stats.by_mode[item.mode] || 0) + 1;
            stats.by_type[item.type] = (stats.by_type[item.type] || 0) + 1;
            if (item.model_only) {
                stats.by_confidence[item.model_only.confidence] =
                    (stats.by_confidence[item.model_only.confidence] || 0) + 1;
            }
        }
        return stats;
    }
}
exports.EvidenceShapingService = EvidenceShapingService;
//# sourceMappingURL=evidence-shaping-service.js.map