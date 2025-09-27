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
        const claimId = `CLM-${Date.now()}`;
        try {
            console.log(`🚀 Starting validation for claim ${claimId}`);
            console.log(`📋 Payer: ${payload.payer}`);
            console.log(`🏥 CPT Codes: ${payload.cpt_codes.join(', ')}`);
            console.log(`📊 ICD-10 Codes: ${payload.icd10_codes.join(', ')}`);
            console.log('\n🔍 Step 1: Running sanity check...');
            const sanityResult = await this.sanityCheckAgent.performSanityCheck(payload);
            console.log(`✅ Sanity check completed. Valid: ${sanityResult.is_valid}`);
            console.log(`🎯 Specialty: ${sanityResult.ssp_prediction.specialty} / ${sanityResult.ssp_prediction.subspecialty}`);
            console.log(`⚠️  Issues found: ${sanityResult.issues.length}`);
            console.log(`⚠️  Warnings: ${sanityResult.warnings.length}`);
            if (!sanityResult.is_valid) {
                console.log('❌ Claim failed sanity check, stopping workflow');
                return this.createFailureResult(claimId, startTime, 'Sanity check failed', sanityResult.issues);
            }
            console.log('\n📋 Step 2: Generating validation questions...');
            const plannerResult = await this.plannerAgent.generateQuestions(payload, sanityResult);
            console.log(`✅ Generated ${plannerResult.questions.length} validation questions`);
            console.log(`📊 Question breakdown:`);
            const basicQuestions = plannerResult.questions.filter(q => q.type === 'basic').length;
            const specialtyQuestions = plannerResult.questions.filter(q => q.type === 'specialty').length;
            const subspecialtyQuestions = plannerResult.questions.filter(q => q.type === 'subspecialty').length;
            console.log(`   - Basic: ${basicQuestions}`);
            console.log(`   - Specialty: ${specialtyQuestions}`);
            console.log(`   - Subspecialty: ${subspecialtyQuestions}`);
            console.log('\n🔍 Step 3: Executing Google search...');
            const searchQueries = plannerResult.questions.flatMap(q => q.search_queries);
            console.log(`🔍 Search queries: ${searchQueries.length}`);
            let searchResults = [];
            for (const query of searchQueries) {
                try {
                    console.log(`   Searching: ${query}`);
                    const results = await this.googleSearchService.searchMedicalCoding(query);
                    searchResults.push(...results);
                    console.log(`   Found ${results.length} results`);
                }
                catch (error) {
                    console.log(`   ❌ Search failed for: ${query}`);
                }
            }
            console.log(`✅ Google search completed. Total results: ${searchResults.length}`);
            console.log('\n🕷️ Step 4: Extracting with Firecrawl...');
            let firecrawlResults = [];
            const urlsToExtract = searchResults.slice(0, 5);
            for (const result of urlsToExtract) {
                try {
                    console.log(`   Extracting: ${result.url}`);
                    const firecrawlResult = await this.researchAgent.extractDocumentWithFirecrawl(result.url, payload.cpt_codes, `Extract information about CPT codes ${payload.cpt_codes.join(', ')} from this document`);
                    if (firecrawlResult.success) {
                        firecrawlResults.push(firecrawlResult);
                        console.log(`   ✅ Extracted successfully`);
                    }
                    else {
                        console.log(`   ❌ Extraction failed: ${firecrawlResult.error}`);
                    }
                }
                catch (error) {
                    console.log(`   ❌ Firecrawl error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
            console.log(`✅ Firecrawl completed. Extracted: ${firecrawlResults.length} documents`);
            console.log('\n🧠 Step 5: Research agent analysis...');
            const researchResults = await this.researchAgent.researchQuestions(plannerResult.questions, payload);
            console.log(`✅ Research completed. Processed ${researchResults.length} questions`);
            const okResults = researchResults.filter(r => r.status === 'ok').length;
            const insufficientResults = researchResults.filter(r => r.status === 'insufficient').length;
            console.log(`📊 Results: ${okResults} OK, ${insufficientResults} insufficient`);
            let retryResults = [];
            if (insufficientResults > 0) {
                console.log(`\n🔄 Step 6: Retrying ${insufficientResults} insufficient results...`);
                const insufficientQuestions = researchResults.filter(r => r.status === 'insufficient');
                retryResults = await this.retryAgent.retryQuestions(insufficientQuestions, payload);
                console.log(`✅ Retry completed. Processed ${retryResults.length} questions`);
            }
            else {
                console.log('\n⏭️ Step 6: Skipping retry (all questions answered)');
            }
            console.log('\n🔀 Step 7: Shaping evidence...');
            const shapedEvidence = this.evidenceShapingService.shapeEvidence(researchResults, plannerResult.questions, payload);
            console.log(`✅ Evidence shaped. Items: ${shapedEvidence.length}`);
            console.log('\n⚖️ Step 8: Final evaluation...');
            const evaluationResult = await this.evaluateAgent.evaluateResults(claimId, shapedEvidence, startTime);
            console.log(`\n🎉 Validation completed for claim ${claimId}`);
            console.log(`📊 Final Status: ${evaluationResult.overall_status}`);
            console.log(`🎯 Confidence: ${evaluationResult.confidence}`);
            console.log(`⏱️  Processing Time: ${evaluationResult.processing_time_ms}ms`);
            return evaluationResult;
        }
        catch (error) {
            console.error(`\n💥 Validation failed for claim ${claimId}:`, error);
            return this.createFailureResult(claimId, startTime, 'Validation workflow failed', [error instanceof Error ? error.message : 'Unknown error']);
        }
    }
    createFailureResult(claimId, startTime, reason, issues) {
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
                rationale: reason,
                blockers: issues.map((issue, index) => ({
                    n: String(index + 1),
                    reason: issue
                })),
                recommendations: ['Fix validation issues', 'Retry validation']
            }
        };
    }
}
exports.ValidationWorkflow = ValidationWorkflow;
//# sourceMappingURL=validation-workflow-new.js.map