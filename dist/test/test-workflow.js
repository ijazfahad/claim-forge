"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testClaimPayload = exports.testCases = void 0;
exports.runAllTests = runAllTests;
const validation_workflow_new_1 = require("../services/validation-workflow-new");
const testClaimPayload = {
    payer: "Molina Healthcare",
    domains: ["molinahealthcare.com"],
    seed_urls: ["https://www.molinahealthcare.com/policies"],
    cpt_codes: ["99230", "64636"],
    icd10_codes: ["Z00.00"],
    place_of_service: "11",
    modifiers: [],
    prior_treatments: [],
    member_plan_type: "PPO",
    state: "NM",
    note_summary: "Lumbar facet radiofrequency ablation at L4–S1 following two diagnostic medial branch blocks with >80% temporary pain relief."
};
exports.testClaimPayload = testClaimPayload;
const testCases = [
    {
        name: "Basic Pain Management Claim",
        payload: testClaimPayload,
        expected: "GO"
    },
    {
        name: "Cardiology Claim",
        payload: {
            ...testClaimPayload,
            cpt_codes: ["93000"],
            icd10_codes: ["I48.91"],
            note_summary: "Routine ECG with interpretation for atrial fibrillation"
        },
        expected: "GO"
    },
    {
        name: "Invalid CPT Code",
        payload: {
            ...testClaimPayload,
            cpt_codes: ["99999"],
        },
        expected: "NO_GO"
    },
    {
        name: "Missing Required Fields",
        payload: {
            ...testClaimPayload,
            cpt_codes: [],
        },
        expected: "NO_GO"
    }
];
exports.testCases = testCases;
async function runTest(testCase, index) {
    console.log(`\n🧪 Running Test ${index + 1}: ${testCase.name}`);
    console.log('='.repeat(60));
    try {
        const startTime = Date.now();
        console.log('📋 Initializing validation workflow...');
        const workflow = new validation_workflow_new_1.ValidationWorkflow();
        console.log('🚀 Starting claim validation...');
        const result = await workflow.validateClaim(testCase.payload);
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        console.log(`\n✅ Test ${index + 1} completed in ${processingTime}ms`);
        console.log(`📊 Overall Status: ${result.overall_status}`);
        console.log(`🎯 Confidence: ${result.confidence}`);
        console.log(`⏱️  Processing Time: ${result.processing_time_ms}ms`);
        if (result.overall_status === testCase.expected) {
            console.log(`✅ PASS: Expected ${testCase.expected}, got ${result.overall_status}`);
        }
        else {
            console.log(`❌ FAIL: Expected ${testCase.expected}, got ${result.overall_status}`);
        }
        if (result.per_question && result.per_question.length > 0) {
            console.log('\n📝 Question Results:');
            result.per_question.forEach((q, i) => {
                console.log(`  ${i + 1}. ${q.q}`);
                console.log(`     Decision: ${q.decision}`);
                console.log(`     Confidence: ${q.confidence}`);
                if (q.notes)
                    console.log(`     Notes: ${q.notes}`);
            });
        }
        if (result.overall && result.overall.blockers && result.overall.blockers.length > 0) {
            console.log('\n🚫 Blockers:');
            result.overall.blockers.forEach((blocker, i) => {
                console.log(`  ${i + 1}. Question ${blocker.n}: ${blocker.reason}`);
            });
        }
        if (result.overall && result.overall.recommendations && result.overall.recommendations.length > 0) {
            console.log('\n💡 Recommendations:');
            result.overall.recommendations.forEach((rec, i) => {
                console.log(`  ${i + 1}. ${rec}`);
            });
        }
        return {
            testName: testCase.name,
            status: 'PASS',
            expected: testCase.expected,
            actual: result.overall_status,
            processingTime,
            result
        };
    }
    catch (error) {
        console.error(`❌ Test ${index + 1} failed with error:`, error);
        return {
            testName: testCase.name,
            status: 'FAIL',
            expected: testCase.expected,
            actual: 'ERROR',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
async function runAllTests() {
    console.log('🚀 Starting ClaimForge Validation Workflow Tests');
    console.log('='.repeat(80));
    const results = [];
    for (let i = 0; i < testCases.length; i++) {
        const result = await runTest(testCases[i], i);
        results.push(result);
        if (i < testCases.length - 1) {
            console.log('\n⏳ Waiting 2 seconds before next test...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`✅ Passed: ${passed}/${results.length}`);
    console.log(`❌ Failed: ${failed}/${results.length}`);
    if (failed > 0) {
        console.log('\n❌ Failed Tests:');
        results.filter(r => r.status === 'FAIL').forEach(result => {
            console.log(`  - ${result.testName}: ${result.error || 'Unexpected result'}`);
        });
    }
    const avgProcessingTime = results
        .filter(r => r.processingTime)
        .reduce((sum, r) => sum + (r.processingTime || 0), 0) / results.length;
    console.log(`\n⏱️  Average Processing Time: ${Math.round(avgProcessingTime)}ms`);
    return results;
}
if (require.main === module) {
    runAllTests()
        .then(() => {
        console.log('\n🎉 All tests completed!');
        process.exit(0);
    })
        .catch((error) => {
        console.error('\n💥 Test suite failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=test-workflow.js.map