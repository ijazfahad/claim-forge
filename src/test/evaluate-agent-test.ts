import { EvaluateAgent, EvaluationResult } from '../agents/evaluate-agent';
import { ResearchResult } from '../agents/research-agent';

/**
 * Comprehensive test suite for Evaluate Agent
 * Tests final decision making based on research results
 */

interface TestCase {
  name: string;
  claimId: string;
  researchResults: ResearchResult[];
  startTime: number;
  expectedResults: {
    overallStatus: string;
    confidence: string;
    goNoGo: string;
    expectedBlockers?: string[];
    expectedRecommendations?: string[];
  };
}

const testCases: TestCase[] = [
  {
    name: 'All Questions Answered Successfully',
    claimId: 'CLM-001',
    researchResults: [
      {
        n: '1',
        type: 'basic',
        q: 'What are the documentation requirements for CPT code 99213?',
        status: 'ok',
        model_only: 'true',
        summary: 'CPT 99213 requires a problem-focused history, problem-focused examination, and straightforward medical decision making. Documentation must support the level of service billed.',
        likely_accept_if: 'Documentation requirements found',
        confidence: 'high',
        disclaimers: 'Based on CMS guidelines',
        next_checks: ['Verify documentation completeness']
      },
      {
        n: '2',
        type: 'basic',
        q: 'What is the appropriate use of modifier 25?',
        status: 'ok',
        model_only: 'true',
        summary: 'Modifier 25 is used to indicate that a significant, separately identifiable evaluation and management service was performed on the same day as a procedure.',
        likely_accept_if: 'Modifier 25 guidelines found',
        confidence: 'high',
        disclaimers: 'Based on AMA CPT guidelines',
        next_checks: ['Verify separate E&M documentation']
      }
    ],
    startTime: Date.now() - 5000,
    expectedResults: {
      overallStatus: 'GO',
      confidence: 'high',
      goNoGo: 'GO',
      expectedRecommendations: ['Proceed with claim submission']
    }
  },
  {
    name: 'Some Questions Insufficient - Policy Issues',
    claimId: 'CLM-002',
    researchResults: [
      {
        n: '1',
        type: 'specialty',
        q: 'Are there any LCD requirements for CPT 99215 with diabetes?',
        status: 'insufficient',
        model_only: 'true',
        summary: 'Local Coverage Determinations vary by region. Specific requirements need to be checked with the local Medicare Administrative Contractor.',
        likely_accept_if: 'LCD requirements confirmed',
        confidence: 'low',
        disclaimers: 'Regional variations apply',
        next_checks: ['Contact local MAC', 'Verify regional requirements']
      },
      {
        n: '2',
        type: 'specialty',
        q: 'What are the medical necessity requirements for blood glucose monitoring?',
        status: 'ok',
        model_only: 'true',
        summary: 'Blood glucose monitoring is medically necessary for patients with diabetes. Documentation must show the medical necessity for the frequency of testing.',
        likely_accept_if: 'Medical necessity criteria met',
        confidence: 'high',
        disclaimers: 'Based on Medicare coverage guidelines',
        next_checks: ['Verify documentation supports frequency']
      }
    ],
    startTime: Date.now() - 8000,
    expectedResults: {
      overallStatus: 'NO_GO',
      confidence: 'medium',
      goNoGo: 'NO_GO',
      expectedBlockers: ['LCD requirements not confirmed'],
      expectedRecommendations: ['Verify LCD requirements', 'Contact local MAC']
    }
  },
  {
    name: 'Critical Policy Violations Found',
    claimId: 'CLM-003',
    researchResults: [
      {
        n: '1',
        type: 'basic',
        q: 'Are there any NCCI edits that prevent billing CPT 99213 with 36415?',
        status: 'ok',
        model_only: 'true',
        summary: 'NCCI edits show that CPT 99213 and 36415 cannot be billed together without appropriate modifiers. Modifier 25 may be required.',
        likely_accept_if: 'NCCI edit information found',
        confidence: 'high',
        disclaimers: 'Based on CMS NCCI edits',
        next_checks: ['Verify modifier 25 documentation']
      },
      {
        n: '2',
        type: 'basic',
        q: 'What documentation is required for modifier 25?',
        status: 'ok',
        model_only: 'true',
        summary: 'Modifier 25 requires documentation showing a significant, separately identifiable E&M service was performed on the same day as a procedure.',
        likely_accept_if: 'Documentation requirements found',
        confidence: 'high',
        disclaimers: 'Based on AMA CPT guidelines',
        next_checks: ['Verify separate E&M documentation']
      }
    ],
    startTime: Date.now() - 6000,
    expectedResults: {
      overallStatus: 'NO_GO',
      confidence: 'high',
      goNoGo: 'NO_GO',
      expectedBlockers: ['NCCI edit violation', 'Missing modifier 25 documentation'],
      expectedRecommendations: ['Add modifier 25', 'Document separate E&M service']
    }
  },
  {
    name: 'Emergency Department - High Risk',
    claimId: 'CLM-004',
    researchResults: [
      {
        n: '1',
        type: 'subspecialty',
        q: 'What are the ED-specific coding guidelines for level 4 visits?',
        status: 'ok',
        model_only: 'true',
        summary: 'ED level 4 visits require comprehensive history, comprehensive examination, and high complexity medical decision making. Documentation must support all three key components.',
        likely_accept_if: 'ED coding guidelines found',
        confidence: 'high',
        disclaimers: 'Based on ACEP coding guidelines',
        next_checks: ['Verify all three key components documented']
      },
      {
        n: '2',
        type: 'subspecialty',
        q: 'Are there any state-specific requirements for ED documentation?',
        status: 'insufficient',
        model_only: 'true',
        summary: 'State requirements vary. Some states require specific documentation for emergency services, including time-based documentation.',
        likely_accept_if: 'State requirements confirmed',
        confidence: 'low',
        disclaimers: 'State variations apply',
        next_checks: ['Contact state medical board', 'Verify state-specific requirements']
      }
    ],
    startTime: Date.now() - 7000,
    expectedResults: {
      overallStatus: 'NO_GO',
      confidence: 'medium',
      goNoGo: 'NO_GO',
      expectedBlockers: ['State requirements not confirmed'],
      expectedRecommendations: ['Verify state requirements', 'Check time-based documentation']
    }
  }
];

class EvaluateAgentTestSuite {
  private agent: EvaluateAgent;
  private results: Array<{
    testCase: string;
    passed: boolean;
    actual: EvaluationResult;
    expected: any;
    errors: string[];
  }> = [];

  constructor() {
    this.agent = new EvaluateAgent();
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Evaluate Agent Test Suite\n');
    console.log(`📋 Running ${testCases.length} test cases...\n`);

    for (const testCase of testCases) {
      await this.runTest(testCase);
    }

    this.printResults();
  }

  private async runTest(testCase: TestCase): Promise<void> {
    console.log(`🔍 Testing: ${testCase.name}`);
    
    try {
      const result = await this.agent.evaluateResults(
        testCase.claimId,
        testCase.researchResults,
        testCase.startTime
      );
      const errors = this.validateResult(result, testCase.expectedResults);
      
      this.results.push({
        testCase: testCase.name,
        passed: errors.length === 0,
        actual: result,
        expected: testCase.expectedResults,
        errors
      });

      if (errors.length === 0) {
        console.log(`  ✅ PASSED`);
      } else {
        console.log(`  ❌ FAILED: ${errors.join(', ')}`);
      }

      // Print detailed results
      this.printTestDetails(result, testCase.expectedResults);

    } catch (error) {
      console.log(`  💥 ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.results.push({
        testCase: testCase.name,
        passed: false,
        actual: {} as EvaluationResult,
        expected: testCase.expectedResults,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
    }

    console.log('');
  }

  private validateResult(actual: EvaluationResult, expected: any): string[] {
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

  private printTestDetails(actual: EvaluationResult, expected: any): void {
    console.log(`    📊 Results:`);
    console.log(`      - Overall Status: ${actual.overall_status}`);
    console.log(`      - Confidence: ${actual.confidence}`);
    console.log(`      - Go/No-Go: ${actual.overall.go_no_go}`);
    console.log(`      - Processing Time: ${actual.processing_time_ms}ms`);
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
      console.log(`    📝 Per-Question Results:`);
      actual.per_question.forEach((qResult, index) => {
      console.log(`      ${index + 1}. Question ${qResult.n}: ${qResult.decision}`);
      console.log(`         Notes: ${qResult.notes ? qResult.notes.substring(0, 100) + '...' : 'No notes'}`);
      console.log(`         Confidence: ${qResult.confidence}`);
      console.log(`         Matched Accept If: ${qResult.matched_accept_if || 'None'}`);
      });
    }
  }

  private printResults(): void {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    console.log('📊 Test Results Summary');
    console.log('========================');
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
      console.log('❌ Failed Tests:');
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`  - ${result.testCase}`);
        result.errors.forEach(error => {
          console.log(`    • ${error}`);
        });
      });
    }

    console.log('\n🎯 Test Suite Complete');
  }
}

// Run the test suite
async function runEvaluateAgentTests(): Promise<void> {
  const testSuite = new EvaluateAgentTestSuite();
  await testSuite.runAllTests();
}

// Export for use in other test files
export { EvaluateAgentTestSuite, runEvaluateAgentTests };

// Run if this file is executed directly
if (require.main === module) {
  runEvaluateAgentTests().catch(console.error);
}
