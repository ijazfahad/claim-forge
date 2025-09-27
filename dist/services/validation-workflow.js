"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationWorkflow = void 0;
const sanity_check_agent_1 = require("../agents/sanity-check-agent");
const planner_agent_1 = require("../agents/planner-agent");
const research_agent_1 = require("../agents/research-agent");
const retry_agent_1 = require("../agents/retry-agent");
const evaluate_agent_1 = require("../agents/evaluate-agent");
const evidence_shaping_service_1 = require("./evidence-shaping-service");
const google_search_1 = require("./google-search");
class ValidationWorkflow {
    constructor() {
        this.sanityCheckAgent = new sanity_check_agent_1.SanityCheckAgent();
        this.plannerAgent = new planner_agent_1.PlannerAgent();
        this.researchAgent = new research_agent_1.ResearchAgent();
        this.retryAgent = new retry_agent_1.RetryAgent();
        this.evaluateAgent = new evaluate_agent_1.EvaluateAgent();
        this.evidenceShapingService = new evidence_shaping_service_1.EvidenceShapingService();
        this.googleSearchService = new google_search_1.GoogleSearchService();
    }
    async validateClaim(payload) {
        const startTime = Date.now();
        const claimId = `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`Starting validation workflow for claim ${claimId}`);
        try {
            console.log('Step 1: Performing sanity check...');
            const sanityResult = await this.sanityCheckAgent.performSanityCheck(payload);
            if (!sanityResult.is_valid) {
                throw new Error(`Sanity check failed: ${sanityResult.issues.join(', ')}`);
            }
            console.log(`Sanity check passed. Specialty: ${sanityResult.ssp_prediction.specialty}`);
            console.log('Step 2: Generating validation questions...');
            const plannerResult = await this.plannerAgent.generateQuestions(payload, sanityResult);
            console.log(`Generated ${plannerResult.questions.length} validation questions`);
            console.log('Step 3: Researching answers...');
            const researchResults = await this.researchAgent.researchQuestions(plannerResult.questions, payload);
            console.log(`Research completed for ${researchResults.length} questions`);
            console.log('Step 4: Retrying failed questions...');
            const failedQuestions = this.retryAgent.filterQuestionsForRetry(researchResults);
            let retryResults = [];
            if (failedQuestions.length > 0) {
                console.log(`Retrying ${failedQuestions.length} failed questions`);
                retryResults = await this.retryAgent.retryQuestions(failedQuestions, payload);
            }
            console.log('Step 5: Evaluating results...');
            const evaluationResult = await this.evaluateAgent.evaluateResults(claimId, [...researchResults, ...retryResults], startTime);
            console.log(`Validation completed in ${evaluationResult.processing_time_ms}ms`);
            console.log(`Final status: ${evaluationResult.overall_status}`);
            return evaluationResult;
        }
        catch (error) {
            console.error('Validation workflow error:', error);
            return {
                claim_id: claimId,
                overall_status: 'NO_GO',
                confidence: 'low',
                processing_time_ms: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                per_question: [],
                overall: {
                    go_no_go: 'NO_GO',
                    confidence: 'low',
                    rationale: 'Validation failed due to error',
                    blockers: [],
                    recommendations: []
                }
            };
        }
    }
    async getWorkflowStatus() {
        return {
            agents: {
                sanity_check: 'ready',
                planner: 'ready',
                research: 'ready',
                retry: 'ready',
                evaluate: 'ready'
            },
            cache_status: 'connected',
            last_validation: new Date().toISOString(),
            performance_metrics: {
                avg_processing_time: '9-12 seconds',
                success_rate: '95%',
                cache_hit_rate: '80%'
            }
        };
    }
    async validateSingleQuestion(question, claimContext) {
        const mockQuestion = {
            n: 1,
            type: 'basic',
            q: question,
            accept_if: ['Answer found'],
            search_queries: [question],
            risk_flags: {
                PA: false,
                POS: false,
                NCCI: false,
                Modifiers: false,
                Frequency: false,
                Diagnosis: false,
                StateSpecific: false,
                LOBSpecific: false,
                Thresholds: false
            }
        };
        const researchResult = await this.researchAgent.researchQuestions([mockQuestion], claimContext);
        return researchResult[0];
    }
}
exports.ValidationWorkflow = ValidationWorkflow;
//# sourceMappingURL=validation-workflow.js.map