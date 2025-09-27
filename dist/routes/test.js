"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const test_cases_1 = require("../test/test-cases");
const claim_storage_1 = require("../services/claim-storage");
const validation_workflow_1 = require("../services/validation-workflow");
const router = express_1.default.Router();
let storageInitialized = false;
const initializeStorage = async () => {
    if (!storageInitialized) {
        await claim_storage_1.claimStorage.initialize();
        storageInitialized = true;
    }
};
router.get('/cases', async (req, res) => {
    try {
        const { category, tag, limit = 50, offset = 0 } = req.query;
        let testCases = test_cases_1.TEST_CASES;
        if (category && typeof category === 'string') {
            testCases = test_cases_1.TEST_CASES_BY_CATEGORY[category] || [];
        }
        if (tag && typeof tag === 'string') {
            testCases = testCases.filter(tc => tc.tags.includes(tag));
        }
        const paginatedCases = testCases.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
        res.json({
            success: true,
            data: {
                test_cases: paginatedCases,
                total: testCases.length,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: (parseInt(offset) + parseInt(limit)) < testCases.length
                }
            }
        });
    }
    catch (error) {
        console.error('Error getting test cases:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get test cases',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/cases/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const testCase = (0, test_cases_1.getTestCaseById)(id);
        if (!testCase) {
            return res.status(404).json({
                success: false,
                error: 'Test case not found',
                message: `No test case found with ID: ${id}`
            });
        }
        return res.json({
            success: true,
            data: testCase
        });
    }
    catch (error) {
        console.error('Error getting test case:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get test case',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/run/:id', async (req, res) => {
    try {
        await initializeStorage();
        const { id } = req.params;
        const testCase = (0, test_cases_1.getTestCaseById)(id);
        if (!testCase) {
            return res.status(404).json({
                success: false,
                error: 'Test case not found',
                message: `No test case found with ID: ${id}`
            });
        }
        const startTime = Date.now();
        const claimId = `TEST-${id}-${Date.now()}`;
        const workflow = new validation_workflow_1.ValidationWorkflow();
        const result = await workflow.validateClaim(testCase.claim);
        const processingTime = Date.now() - startTime;
        const validationRecord = {
            claim_id: claimId,
            original_claim: testCase.claim,
            overall_status: result.overall_status,
            confidence: result.confidence,
            processing_time_ms: processingTime,
            validation_steps: result.per_question.map((q, index) => ({
                step_name: `question_${index + 1}`,
                step_order: index + 1,
                status: 'completed',
                start_time: new Date(startTime + (index * 1000)),
                end_time: new Date(startTime + ((index + 1) * 1000)),
                duration_ms: 1000,
                input_data: { question: q.q, type: q.type },
                output_data: { decision: q.decision, confidence: q.confidence },
                confidence_score: q.confidence === 'medium' ? 0.7 : 0.5
            })),
            final_findings: {
                errors: (result.overall.blockers || []).map(b => typeof b === 'string' ? b : b.reason),
                warnings: (result.overall.recommendations || []).map(r => typeof r === 'string' ? r : r),
                recommendations: (result.overall.recommendations || []).map(r => typeof r === 'string' ? r : r),
                risk_score: result.confidence === 'high' ? 10 : result.confidence === 'medium' ? 50 : 90
            },
            metadata: {
                test_case_id: id,
                test_case_name: testCase.name,
                test_case_category: testCase.category,
                api_version: '1.0.0',
                environment: process.env.NODE_ENV || 'development'
            }
        };
        const recordId = await claim_storage_1.claimStorage.storeClaimValidation(validationRecord);
        const matchesExpected = result.overall_status === testCase.expected_result;
        return res.json({
            success: true,
            data: {
                test_case: testCase,
                result: result,
                processing_time_ms: processingTime,
                matches_expected: matchesExpected,
                validation_record_id: recordId,
                analysis: {
                    expected: testCase.expected_result,
                    actual: result.overall_status,
                    confidence: result.confidence,
                    issues_found: result.overall.blockers?.length || 0,
                    warnings_found: result.overall.recommendations?.length || 0
                }
            }
        });
    }
    catch (error) {
        console.error('Error running test case:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to run test case',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/run-batch', async (req, res) => {
    try {
        await initializeStorage();
        const { test_case_ids, category, tag } = req.body;
        let testCases = test_cases_1.TEST_CASES;
        if (test_case_ids && Array.isArray(test_case_ids)) {
            testCases = test_case_ids.map(id => (0, test_cases_1.getTestCaseById)(id)).filter((tc) => tc !== undefined);
        }
        else if (category) {
            testCases = test_cases_1.TEST_CASES_BY_CATEGORY[category] || [];
        }
        else if (tag) {
            testCases = (0, test_cases_1.getTestCasesByTag)(tag);
        }
        if (testCases.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No test cases found',
                message: 'No test cases match the specified criteria'
            });
        }
        const results = [];
        const workflow = new validation_workflow_1.ValidationWorkflow();
        for (const testCase of testCases) {
            try {
                const startTime = Date.now();
                const claimId = `BATCH-${testCase.id}-${Date.now()}`;
                const result = await workflow.validateClaim(testCase.claim);
                const processingTime = Date.now() - startTime;
                const matchesExpected = result.overall_status === testCase.expected_result;
                results.push({
                    test_case_id: testCase.id,
                    test_case_name: testCase.name,
                    expected_result: testCase.expected_result,
                    actual_result: result.overall_status,
                    matches_expected: matchesExpected,
                    processing_time_ms: processingTime,
                    confidence: result.confidence,
                    success: true
                });
            }
            catch (error) {
                results.push({
                    test_case_id: testCase.id,
                    test_case_name: testCase.name,
                    expected_result: testCase.expected_result,
                    actual_result: null,
                    matches_expected: false,
                    processing_time_ms: 0,
                    confidence: 'low',
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        const summary = {
            total_tests: results.length,
            passed: results.filter(r => r.matches_expected).length,
            failed: results.filter(r => !r.matches_expected).length,
            success_rate: (results.filter(r => r.matches_expected).length / results.length) * 100,
            average_processing_time: results.reduce((sum, r) => sum + r.processing_time_ms, 0) / results.length
        };
        return res.json({
            success: true,
            data: {
                summary,
                results
            }
        });
    }
    catch (error) {
        console.error('Error running batch tests:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to run batch tests',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/stats', async (req, res) => {
    try {
        await initializeStorage();
        const stats = await claim_storage_1.claimStorage.getValidationStats();
        return res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        console.error('Error getting stats:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get stats',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/validations', async (req, res) => {
    try {
        await initializeStorage();
        const { limit = 50, offset = 0, status } = req.query;
        const validations = await claim_storage_1.claimStorage.getClaimValidations(parseInt(limit), parseInt(offset), status);
        return res.json({
            success: true,
            data: {
                validations,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            }
        });
    }
    catch (error) {
        console.error('Error getting validations:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get validations',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/validations/:claimId', async (req, res) => {
    try {
        await initializeStorage();
        const { claimId } = req.params;
        const validation = await claim_storage_1.claimStorage.getClaimValidation(claimId);
        if (!validation) {
            return res.status(404).json({
                success: false,
                error: 'Validation not found',
                message: `No validation found with claim ID: ${claimId}`
            });
        }
        const steps = await claim_storage_1.claimStorage.getValidationSteps(validation.id);
        return res.json({
            success: true,
            data: {
                ...validation,
                validation_steps: steps
            }
        });
    }
    catch (error) {
        console.error('Error getting validation:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get validation',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=test.js.map