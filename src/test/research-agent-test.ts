import { ResearchAgent, ResearchResult } from '../agents/research-agent';
import { ClaimPayload } from '../types/claim-types';

/**
 * Comprehensive test suite for Research Agent
 * Tests both Firecrawl and Google Search functionality
 */

interface TestCase {
  name: string;
  questions: Array<{
    n: number;
    type: 'basic' | 'specialty' | 'subspecialty';
    q: string;
    accept_if: string[];
    search_queries: string[];
    risk_flags: {
      PA: boolean;
      POS: boolean;
      NCCI: boolean;
      Modifiers: boolean;
      Frequency: boolean;
      Diagnosis: boolean;
      StateSpecific: boolean;
      LOBSpecific: boolean;
      Thresholds: boolean;
    };
  }>;
  claim: ClaimPayload;
  expectedResults: {
    minResults: number;
    expectedStatuses: string[];
    expectedSources?: string[];
  };
}

const testCases: TestCase[] = [
  {
    name: 'Basic Medical Coding Questions',
    questions: [
      {
        n: 1,
        type: 'basic',
        q: 'What are the documentation requirements for CPT code 99213?',
        accept_if: ['Documentation requirements found', 'CPT 99213 requirements'],
        search_queries: ['CPT 99213 documentation requirements', '99213 coding guidelines'],
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
      },
      {
        n: 2,
        type: 'basic',
        q: 'What is the appropriate use of modifier 25?',
        accept_if: ['Modifier 25 guidelines', '25 modifier requirements'],
        search_queries: ['CPT modifier 25 guidelines', 'modifier 25 appropriate use'],
        risk_flags: {
          PA: false,
          POS: false,
          NCCI: false,
          Modifiers: true,
          Frequency: false,
          Diagnosis: false,
          StateSpecific: false,
          LOBSpecific: false,
          Thresholds: false
        }
      }
    ],
    claim: {
      cpt_codes: ['99213'],
      icd10_codes: ['M54.5'],
      note_summary: 'Office visit for back pain.',
      payer: 'Medicare'
    },
    expectedResults: {
      minResults: 2,
      expectedStatuses: ['ok', 'insufficient']
    }
  },
  {
    name: 'Policy and Coverage Questions',
    questions: [
      {
        n: 1,
        type: 'specialty',
        q: 'Are there any Local Coverage Determinations (LCD) for CPT 99215 with diabetes?',
        accept_if: ['LCD found', 'Coverage determination', 'Local coverage policy'],
        search_queries: ['LCD CPT 99215 diabetes', 'Local Coverage Determination 99215', 'Medicare coverage 99215 diabetes'],
        risk_flags: {
          PA: true,
          POS: false,
          NCCI: false,
          Modifiers: false,
          Frequency: false,
          Diagnosis: true,
          StateSpecific: true,
          LOBSpecific: true,
          Thresholds: false
        }
      },
      {
        n: 2,
        type: 'specialty',
        q: 'What are the medical necessity requirements for blood glucose monitoring?',
        accept_if: ['Medical necessity criteria', 'Coverage requirements', 'Documentation requirements'],
        search_queries: ['blood glucose monitoring medical necessity', 'diabetes monitoring coverage', 'glucose testing requirements'],
        risk_flags: {
          PA: true,
          POS: false,
          NCCI: false,
          Modifiers: false,
          Frequency: true,
          Diagnosis: true,
          StateSpecific: false,
          LOBSpecific: true,
          Thresholds: true
        }
      }
    ],
    claim: {
      cpt_codes: ['99215', '36415'],
      icd10_codes: ['E11.9', 'I10'],
      note_summary: 'Complex visit for diabetes and hypertension management.',
      payer: 'Medicare'
    },
    expectedResults: {
      minResults: 2,
      expectedStatuses: ['ok', 'insufficient']
    }
  },
  {
    name: 'Emergency Department Specific Questions',
    questions: [
      {
        n: 1,
        type: 'subspecialty',
        q: 'What are the ED-specific coding guidelines for level 4 visits?',
        accept_if: ['ED coding guidelines', 'Emergency department level 4', '99284 guidelines'],
        search_queries: ['emergency department coding guidelines', 'ED level 4 visit requirements', '99284 emergency coding'],
        risk_flags: {
          PA: false,
          POS: true,
          NCCI: false,
          Modifiers: false,
          Frequency: false,
          Diagnosis: false,
          StateSpecific: false,
          LOBSpecific: false,
          Thresholds: false
        }
      },
      {
        n: 2,
        type: 'subspecialty',
        q: 'Are there any state-specific requirements for ED documentation?',
        accept_if: ['State ED requirements', 'Emergency documentation state', 'ED state guidelines'],
        search_queries: ['emergency department state requirements', 'ED documentation state guidelines', 'emergency medicine state coding'],
        risk_flags: {
          PA: false,
          POS: true,
          NCCI: false,
          Modifiers: false,
          Frequency: false,
          Diagnosis: false,
          StateSpecific: true,
          LOBSpecific: false,
          Thresholds: false
        }
      }
    ],
    claim: {
      cpt_codes: ['99284'],
      icd10_codes: ['R50.9'],
      note_summary: 'Emergency department visit for fever.',
      payer: 'Medicare'
    },
    expectedResults: {
      minResults: 2,
      expectedStatuses: ['ok', 'insufficient']
    }
  }
];

class ResearchAgentTestSuite {
  private agent: ResearchAgent;
  private results: Array<{
    testCase: string;
    passed: boolean;
    actual: ResearchResult[];
    expected: any;
    errors: string[];
  }> = [];

  constructor() {
    this.agent = new ResearchAgent();
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Research Agent Test Suite\n');
    console.log(`📋 Running ${testCases.length} test cases...\n`);

    for (const testCase of testCases) {
      await this.runTest(testCase);
    }

    this.printResults();
  }

  private async runTest(testCase: TestCase): Promise<void> {
    console.log(`🔍 Testing: ${testCase.name}`);
    
    try {
      const result = await this.agent.researchQuestions(testCase.questions, testCase.claim);
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
        actual: [],
        expected: testCase.expectedResults,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
    }

    console.log('');
  }

  private validateResult(actual: ResearchResult[], expected: any): string[] {
    const errors: string[] = [];

    // Check minimum results
    if (actual.length < expected.minResults) {
      errors.push(`Expected at least ${expected.minResults} results, got ${actual.length}`);
    }

    // Check statuses
    const actualStatuses = actual.map(r => r.status);
    const hasExpectedStatus = expected.expectedStatuses.some((status: 'ok' | 'insufficient') => 
      actualStatuses.includes(status)
    );
    if (!hasExpectedStatus) {
      errors.push(`Expected statuses ${expected.expectedStatuses.join(', ')}, got ${actualStatuses.join(', ')}`);
    }

    // Note: Sources validation removed as ResearchResult interface doesn't include sources

    return errors;
  }

  private printTestDetails(actual: ResearchResult[], expected: any): void {
    console.log(`    📊 Results:`);
    console.log(`      - Total Results: ${actual.length}`);
    console.log(`      - Statuses: ${actual.map(r => r.status).join(', ')}`);

    actual.forEach((result, index) => {
      console.log(`    📋 Question ${index + 1}:`);
      console.log(`      - Status: ${result.status}`);
      console.log(`      - Question: ${result.q}`);
      console.log(`      - Summary: ${result.summary ? result.summary.substring(0, 100) + '...' : 'No summary'}`);
      console.log(`      - Confidence: ${result.confidence}`);
      console.log(`      - Likely Accept If: ${result.likely_accept_if}`);
      console.log(`      - Disclaimers: ${result.disclaimers}`);
      console.log(`      - Next Checks: ${result.next_checks.join(', ')}`);
    });
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
async function runResearchAgentTests(): Promise<void> {
  const testSuite = new ResearchAgentTestSuite();
  await testSuite.runAllTests();
}

// Export for use in other test files
export { ResearchAgentTestSuite, runResearchAgentTests };

// Run if this file is executed directly
if (require.main === module) {
  runResearchAgentTests().catch(console.error);
}
