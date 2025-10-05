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
        question: 'What are the documentation requirements for CPT code 99213?',
        answer: 'CPT 99213 requires a problem-focused history, problem-focused examination, and straightforward medical decision making. Documentation must support the level of service billed.',
        confidence: 0.9,
        source: 'CMS Guidelines',
        metadata: {
          extraction_method: 'firecrawl',
          processing_time: 1500
        },
        recommendations: ['Verify documentation completeness']
      },
      {
        question: 'What is the appropriate use of modifier 25?',
        answer: 'Modifier 25 is used to indicate that a significant, separately identifiable evaluation and management service was performed on the same day as a procedure.',
        confidence: 0.9,
        source: 'CMS Guidelines',
        metadata: {
          extraction_method: 'firecrawl',
          processing_time: 1500
        },
        recommendations: ['Verify separate E&M documentation']
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
        question: 'Are there any LCD requirements for CPT 99215 with diabetes?',
        answer: 'Local Coverage Determinations vary by region. Specific requirements need to be checked with the local Medicare Administrative Contractor.',
        confidence: 0.3,
        source: 'CMS Guidelines',
        metadata: {
          extraction_method: 'multi-model',
          processing_time: 1500
        },
        recommendations: ['Contact local MAC', 'Verify regional requirements']
      },
      {
        question: 'What are the medical necessity requirements for blood glucose monitoring?',
        answer: 'Blood glucose monitoring is medically necessary for patients with diabetes. Documentation must show the medical necessity for the frequency of testing.',
        confidence: 0.9,
        source: 'CMS Guidelines',
        metadata: {
          extraction_method: 'firecrawl',
          processing_time: 1500
        },
        recommendations: ['Verify documentation supports frequency']
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
        question: 'Are there any NCCI edits that prevent billing CPT 99213 with 36415?',
        answer: 'NCCI edits show that CPT 99213 and 36415 cannot be billed together without appropriate modifiers. Modifier 25 may be required.',
        confidence: 0.9,
        source: 'CMS Guidelines',
        metadata: {
          extraction_method: 'firecrawl',
          processing_time: 1500
        },
        recommendations: ['Verify modifier 25 documentation']
      },
      {
        question: 'What documentation is required for modifier 25?',
        answer: 'Modifier 25 requires documentation showing a significant, separately identifiable E&M service was performed on the same day as a procedure.',
        confidence: 0.9,
        source: 'CMS Guidelines',
        metadata: {
          extraction_method: 'firecrawl',
          processing_time: 1500
        },
        recommendations: ['Verify separate E&M documentation']
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
        question: 'What are the ED-specific coding guidelines for level 4 visits?',
        answer: 'ED level 4 visits require comprehensive history, comprehensive examination, and high complexity medical decision making. Documentation must support all three key components.',
        confidence: 0.9,
        source: 'CMS Guidelines',
        metadata: {
          extraction_method: 'firecrawl',
          processing_time: 1500
        },
        recommendations: ['Verify all three key components documented']
      },
      {
        question: 'Are there any state-specific requirements for ED documentation?',
        answer: 'State requirements vary. Some states require specific documentation for emergency services, including time-based documentation.',
        confidence: 0.3,
        source: 'CMS Guidelines',
        metadata: {
          extraction_method: 'multi-model',
          processing_time: 1500
        },
        recommendations: ['Contact state medical board', 'Verify state-specific requirements']
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
