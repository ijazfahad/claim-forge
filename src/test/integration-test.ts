import { ValidationWorkflow } from '../services/validation-workflow';
import { ClaimPayload } from '../types/claim-types';
import { EvaluationResult } from '../agents/evaluate-agent';

/**
 * Comprehensive integration test suite for the complete validation workflow
 * Tests the full flow: Sanity Check → Planner → Research → Evaluate
 */

interface TestCase {
  name: string;
  claim: ClaimPayload;
  expectedResults: {
    overallStatus: string;
    confidence: string;
    goNoGo: string;
    expectedBlockers?: string[];
    expectedRecommendations?: string[];
    processingTimeMax?: number;
  };
}

const testCases: TestCase[] = [
  {
    name: 'Simple Office Visit - Should Pass',
    claim: {
      cpt_codes: ['99213'],
      icd10_codes: ['M54.5'],
      note_summary: 'Established patient office visit for back pain. Patient reports chronic lumbar pain. Low complexity visit, 15 minutes spent. Physical exam shows tenderness in lumbar spine. Plan: NSAIDs and physical therapy.',
      payer: 'Medicare'
    },
    expectedResults: {
      overallStatus: 'GO',
      confidence: 'high',
      goNoGo: 'GO',
      expectedRecommendations: ['Proceed with claim submission'],
      processingTimeMax: 30000
    }
  },
  {
    name: 'Complex Visit with Policy Issues - Should Require Review',
    claim: {
      cpt_codes: ['99215', '36415'],
      icd10_codes: ['I10', 'E11.9'],
      note_summary: 'Patient with diabetes and hypertension. Blood pressure elevated at 150/95. Blood glucose 180. Discussed medication adherence. Ordered lab work and blood draw.',
      payer: 'Medicare'
    },
    expectedResults: {
      overallStatus: 'NO_GO',
      confidence: 'medium',
      goNoGo: 'NO_GO',
      expectedBlockers: ['Policy verification required'],
      expectedRecommendations: ['Verify LCD requirements', 'Check medical necessity'],
      processingTimeMax: 45000
    }
  },
  {
    name: 'Emergency Department Visit - High Risk',
    claim: {
      cpt_codes: ['99284'],
      icd10_codes: ['R50.9'],
      note_summary: 'Emergency department visit for fever. Patient presents with high fever, chills, and malaise. Comprehensive history and physical exam performed. Lab work ordered. Moderate complexity medical decision making.',
      payer: 'Medicare'
    },
    expectedResults: {
      overallStatus: 'NO_GO',
      confidence: 'medium',
      goNoGo: 'NO_GO',
      expectedBlockers: ['ED documentation requirements'],
      expectedRecommendations: ['Verify ED coding guidelines', 'Check state requirements'],
      processingTimeMax: 40000
    }
  },
  {
    name: 'Inappropriate Code Level - Should Fail',
    claim: {
      cpt_codes: ['99215'],
      icd10_codes: ['Z00.00'],
      note_summary: 'Quick blood pressure check, 5 minutes. Routine visit. BP 120/80. No complaints.',
      payer: 'Medicare'
    },
    expectedResults: {
      overallStatus: 'NO_GO',
      confidence: 'high',
      goNoGo: 'NO_GO',
      expectedBlockers: ['Inappropriate CPT code level'],
      expectedRecommendations: ['Use appropriate CPT code level', 'Consider 99211 for simple visit'],
      processingTimeMax: 35000
    }
  },
  {
    name: 'Missing Documentation - Should Fail',
    claim: {
      cpt_codes: ['99213'],
      icd10_codes: ['M54.5'],
      note_summary: '',
      payer: 'Medicare'
    },
    expectedResults: {
      overallStatus: 'NO_GO',
      confidence: 'high',
      goNoGo: 'NO_GO',
      expectedBlockers: ['Missing clinical documentation'],
      expectedRecommendations: ['Provide clinical documentation'],
      processingTimeMax: 25000
    }
  }
];

class IntegrationTestSuite {
  private workflow: ValidationWorkflow;
  private results: Array<{
    testCase: string;
    passed: boolean;
    actual: EvaluationResult;
    expected: any;
    errors: string[];
    processingTime: number;
  }> = [];

  constructor() {
    this.workflow = new ValidationWorkflow();
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Integration Test Suite\n');
    console.log(`📋 Running ${testCases.length} test cases...\n`);

    for (const testCase of testCases) {
      await this.runTest(testCase);
    }

    this.printResults();
  }

  private async runTest(testCase: TestCase): Promise<void> {
    console.log(`🔍 Testing: ${testCase.name}`);
    console.log(`   CPT Codes: ${testCase.claim.cpt_codes.join(', ')}`);
    console.log(`   ICD-10 Codes: ${testCase.claim.icd10_codes.join(', ')}`);
    console.log(`   Payer: ${testCase.claim.payer}`);
    
    const startTime = Date.now();
    
    try {
      const result = await this.workflow.validateClaim(testCase.claim);
      const processingTime = Date.now() - startTime;
      const errors = this.validateResult(result, testCase.expectedResults, processingTime);
      
      this.results.push({
        testCase: testCase.name,
        passed: errors.length === 0,
        actual: result,
        expected: testCase.expectedResults,
        errors,
        processingTime
      });

      if (errors.length === 0) {
        console.log(`  ✅ PASSED (${processingTime}ms)`);
      } else {
        console.log(`  ❌ FAILED: ${errors.join(', ')} (${processingTime}ms)`);
      }

      // Print detailed results
      this.printTestDetails(result, testCase.expectedResults, processingTime);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.log(`  💥 ERROR: ${error instanceof Error ? error.message : 'Unknown error'} (${processingTime}ms)`);
      this.results.push({
        testCase: testCase.name,
        passed: false,
        actual: {} as EvaluationResult,
        expected: testCase.expectedResults,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        processingTime
      });
    }

    console.log('');
  }

  private validateResult(actual: EvaluationResult, expected: any, processingTime: number): string[] {
    const errors: string[] = [];

    // Check overall status
    if (actual.overall_status !== expected.overallStatus) {
      errors.push(`Expected overall_status: ${expected.overallStatus}, got: ${actual.overall_status}`);
    }

    // Check confidence
    if (actual.confidence !== expected.confidence) {
      errors.push(`Expected confidence: ${expected.confidence}, got: ${actual.confidence}`);
    }

    // Check go/no-go
    if (actual.overall.go_no_go !== expected.goNoGo) {
      errors.push(`Expected go_no_go: ${expected.goNoGo}, got: ${actual.overall.go_no_go}`);
    }

    // Check processing time
    if (expected.processingTimeMax && processingTime > expected.processingTimeMax) {
      errors.push(`Processing time too slow: ${processingTime}ms > ${expected.processingTimeMax}ms`);
    }

    // Check expected blockers
    if (expected.expectedBlockers) {
      for (const expectedBlocker of expected.expectedBlockers) {
        const found = actual.overall.blockers.some(blocker => 
          blocker.reason.toLowerCase().includes(expectedBlocker.toLowerCase())
        );
        if (!found) {
          errors.push(`Expected blocker not found: ${expectedBlocker}`);
        }
      }
    }

    // Check expected recommendations
    if (expected.expectedRecommendations) {
      for (const expectedRec of expected.expectedRecommendations) {
        const found = actual.overall.recommendations.some(rec => 
          rec.toLowerCase().includes(expectedRec.toLowerCase())
        );
        if (!found) {
          errors.push(`Expected recommendation not found: ${expectedRec}`);
        }
      }
    }

    return errors;
  }

  private printTestDetails(actual: EvaluationResult, expected: any, processingTime: number): void {
    console.log(`    📊 Results:`);
    console.log(`      - Overall Status: ${actual.overall_status}`);
    console.log(`      - Confidence: ${actual.confidence}`);
    console.log(`      - Go/No-Go: ${actual.overall.go_no_go}`);
    console.log(`      - Processing Time: ${processingTime}ms`);
    console.log(`      - Timestamp: ${actual.timestamp}`);

    console.log(`    📋 Overall Assessment:`);
    console.log(`      - Rationale: ${actual.overall.rationale}`);
    console.log(`      - Blockers: ${actual.overall.blockers.length}`);
    console.log(`      - Recommendations: ${actual.overall.recommendations.length}`);

    if (actual.overall.blockers.length > 0) {
      console.log(`    🚫 Blockers:`);
      actual.overall.blockers.forEach((blocker, index) => {
        console.log(`      ${index + 1}. ${blocker.reason}`);
      });
    }

    if (actual.overall.recommendations.length > 0) {
      console.log(`    💡 Recommendations:`);
      actual.overall.recommendations.forEach((rec, index) => {
        console.log(`      ${index + 1}. ${rec}`);
      });
    }

    if (actual.per_question.length > 0) {
      console.log(`    📝 Per-Question Results (${actual.per_question.length}):`);
      actual.per_question.forEach((qResult, index) => {
      console.log(`      ${index + 1}. Question ${qResult.n}: ${qResult.decision}`);
      console.log(`         Confidence: ${qResult.confidence}`);
      console.log(`         Notes: ${qResult.notes ? qResult.notes.substring(0, 100) + '...' : 'No notes'}`);
      });
    }
  }

  private printResults(): void {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    const avgProcessingTime = this.results.reduce((sum, r) => sum + r.processingTime, 0) / total;

    console.log('📊 Integration Test Results Summary');
    console.log('====================================');
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    console.log(`⏱️  Average Processing Time: ${avgProcessingTime.toFixed(0)}ms\n`);

    if (failed > 0) {
      console.log('❌ Failed Tests:');
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`  - ${result.testCase} (${result.processingTime}ms)`);
        result.errors.forEach(error => {
          console.log(`    • ${error}`);
        });
      });
    }

    console.log('\n🎯 Integration Test Suite Complete');
  }
}

// Run the test suite
async function runIntegrationTests(): Promise<void> {
  const testSuite = new IntegrationTestSuite();
  await testSuite.runAllTests();
}

// Export for use in other test files
export { IntegrationTestSuite, runIntegrationTests };

// Run if this file is executed directly
if (require.main === module) {
  runIntegrationTests().catch(console.error);
}
