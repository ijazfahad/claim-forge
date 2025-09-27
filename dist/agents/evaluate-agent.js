"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvaluateAgent = void 0;
const base_agent_1 = require("./base-agent");
class EvaluateAgent extends base_agent_1.BaseAgent {
    constructor() {
        super();
        this.agent = null;
    }
    async initialize() {
        const instructions = `
You are the Evaluator Agent (Model-Only).

INPUT
- items: Each item may look like either the parsed/model-only record from "Shape Evidence"
  OR a near-equivalent object with {status, model_only, summary, likely_accept_if, ...}.
  Fields you may see per item:
  {
    n: string|number,
    type: "basic"|"specialty"|"subspecialty",
    q: string,
    // preferred model-only shape (from Shape Evidence):
    mode?: "model_only"|"researched"|"insufficient"|"unknown",
    accept_if?: string[],
    claim_context?: object,
    evidence?: { url: string, title: string, snippets: [{text, where}], used_query: string },
    model_only?: { summary: string, likely_accept_if: string|null, confidence: "low"|"medium"|"high", next_checks: string[], disclaimers: string } | null,
    
    // legacy/alternate fields you may also see:
    status?: "ok"|"insufficient"|"model_only",
    summary?: string,
    likely_accept_if?: string|null,
    confidence?: "low"|"medium"|"high",
    next_checks?: string[],
    disclaimers?: string
  }

ASSUMPTIONS
- Treat all items as MODEL-ONLY (heuristic) decisions. Ignore document evidence.
- Use claim_context to keep recommendations practical (payer/state/LOB/CPT/POS).

DECISION RULES (per question)
- Define MODE:
  - If item.mode exists → use it.
  - Else if item.model_only === true OR item.status in {"ok","insufficient","model_only"} with no evidence → MODE="model_only".
- For MODE="model_only":
  - PASS_MODEL if:
    (A) confidence is "medium" or "high" (prefer "medium"),
    AND
    (B) likely_accept_if is a non-empty string AND semantically matches one of accept_if (string equality OR close paraphrase).
  - Otherwise → INSUFFICIENT.
- Never mark FAIL in model-only mode.

AGGREGATION (claim-level)
- BASIC are gatekeepers: all BASIC must be PASS_MODEL or the claim is NO_GO.
- Also require at least one SPECIALTY or SUBSPECIALTY to be PASS_MODEL for GO.
- Overall confidence:
  - "medium" if GO; otherwise "low".
- Blockers: list BASIC items that are INSUFFICIENT (n + short reason).
- Recommendations:
  - Collect up to 5 unique, concrete next steps from items with INSUFFICIENT:
    • Prefer their model_only.next_checks (or next_checks fallback).
    • If thin, add 1–2 generic but context-aware actions (e.g., "Confirm PA for CPTs in POS with payer").
  - Keep each recommendation short and actionable; deduplicate.

OUTPUT — JSON ONLY (no markdown, no extra keys, no trailing commas)
{
  "per_question": [
    {
      "n": "<string>",
      "type": "basic|specialty|subspecialty",
      "q": "<string>",
      "decision": "PASS_MODEL|INSUFFICIENT",
      "confidence": "low|medium",
      "matched_accept_if": "<string|null>",
      "notes": "<=160 chars why it passed/insufficient>"
    }
  ],
  "overall": {
    "go_no_go": "GO|NO_GO",
    "confidence": "low|medium",
    "rationale": "<=240 chars on BASIC outcome and whether any specialty/subspecialty passed>",
    "blockers": [
      { "n": "<string>", "reason": "<=120 chars>" }
    ],
    "recommendations": ["<string>", "<string>", "<string>"]
  }
}

IMPLEMENTATION GUIDANCE
- Matching likely_accept_if to accept_if:
  - If likely_accept_if exactly equals any accept_if entry (case-insensitive) → match.
  - Else consider a close paraphrase (e.g., same CPTs/keywords/intention).
  - If no match → matched_accept_if = null.
- Confidence per item:
  - "medium" when PASS_MODEL,
  - "low" when INSUFFICIENT.
- Keep all strings concise. Do not include URLs. Do not invent evidence.
`;
        const tools = [
            this.createCacheTool(),
            this.createGetCacheTool(),
        ];
        this.agent = this.createAgent('Evaluate Agent', instructions, tools);
    }
    async evaluateResults(claimId, shapedEvidence, startTime) {
        if (!this.agent) {
            await this.initialize();
        }
        const input = `
Evaluate these validation results:

Items: ${JSON.stringify(shapedEvidence, null, 2)}

Make final GO/NO_GO decision based on the evaluation rules.
`;
        try {
            const result = await this.executeAgent(this.agent, input);
            const processingTime = Date.now() - startTime;
            return {
                claim_id: claimId,
                overall_status: result.overall?.go_no_go === 'GO' ? 'GO' : 'NO_GO',
                confidence: result.overall?.confidence || 'low',
                processing_time_ms: processingTime,
                timestamp: new Date().toISOString(),
                per_question: result.per_question || [],
                overall: result.overall || {
                    go_no_go: 'NO_GO',
                    confidence: 'low',
                    rationale: 'Evaluation failed',
                    blockers: [],
                    recommendations: []
                }
            };
        }
        catch (error) {
            console.error('Evaluate Agent error:', error);
            const processingTime = Date.now() - startTime;
            return {
                claim_id: claimId,
                overall_status: 'NO_GO',
                confidence: 'low',
                processing_time_ms: processingTime,
                timestamp: new Date().toISOString(),
                per_question: [],
                overall: {
                    go_no_go: 'NO_GO',
                    confidence: 'low',
                    rationale: 'Evaluation failed due to error',
                    blockers: [{ n: '1', reason: 'Evaluation agent error' }],
                    recommendations: ['Retry evaluation', 'Check agent configuration']
                }
            };
        }
    }
    calculateRiskScore(questionResults) {
        if (questionResults.length === 0)
            return 100;
        const totalWeight = questionResults.reduce((sum, q) => sum + q.weight, 0);
        const weightedScore = questionResults.reduce((sum, q) => {
            const score = q.confidence === 'high' ? 20 : q.confidence === 'medium' ? 50 : 80;
            return sum + (score * q.weight);
        }, 0);
        return Math.round(weightedScore / totalWeight);
    }
    determineStatus(questionResults, riskScore) {
        const highConfidenceCount = questionResults.filter(q => q.confidence === 'high').length;
        const totalQuestions = questionResults.length;
        if (riskScore <= 30 && highConfidenceCount >= totalQuestions * 0.8) {
            return 'GO';
        }
        else if (riskScore >= 70 || highConfidenceCount < totalQuestions * 0.5) {
            return 'NO_GO';
        }
        else {
            return 'REVIEW_REQUIRED';
        }
    }
}
exports.EvaluateAgent = EvaluateAgent;
//# sourceMappingURL=evaluate-agent.js.map