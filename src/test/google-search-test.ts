import { GoogleSearchService } from '../services/google-search';

/**
 * Comprehensive test suite for Google Search Service
 * Tests medical coding search functionality
 */

interface TestCase {
  name: string;
  query: string;
  expectedResults: {
    minResults: number;
    expectedSources?: string[];
    expectedContent?: string[];
  };
}

const testCases: TestCase[] = [
  {
    name: 'Basic CPT Code Search',
    query: 'CPT 99213 documentation requirements',
    expectedResults: {
      minResults: 3,
      expectedSources: ['cms.gov', 'ama-assn.org', 'medicare.gov'],
      expectedContent: ['documentation', 'requirements', '99213']
    }
  },
  {
    name: 'Modifier Search',
    query: 'CPT modifier 25 guidelines',
    expectedResults: {
      minResults: 3,
      expectedSources: ['ama-assn.org', 'cms.gov'],
      expectedContent: ['modifier', '25', 'guidelines']
    }
  },
  {
    name: 'NCCI Edits Search',
    query: 'NCCI edits CPT 99213 36415',
    expectedResults: {
      minResults: 2,
      expectedSources: ['cms.gov'],
      expectedContent: ['ncci', 'edits', 'bundling']
    }
  },
  {
    name: 'LCD Search',
    query: 'Local Coverage Determination diabetes CPT 99215',
    expectedResults: {
      minResults: 2,
      expectedSources: ['cms.gov', 'medicare.gov'],
      expectedContent: ['lcd', 'coverage', 'determination']
    }
  },
  {
    name: 'Medical Necessity Search',
    query: 'medical necessity blood glucose monitoring',
    expectedResults: {
      minResults: 3,
      expectedSources: ['cms.gov', 'medicare.gov'],
      expectedContent: ['medical', 'necessity', 'glucose']
    }
  },
  {
    name: 'Emergency Department Search',
    query: 'emergency department coding guidelines level 4',
    expectedResults: {
      minResults: 2,
      expectedSources: ['acep.org', 'cms.gov'],
      expectedContent: ['emergency', 'department', 'coding']
    }
  }
];

class GoogleSearchTestSuite {
  private service: GoogleSearchService;
  private results: Array<{
    testCase: string;
    passed: boolean;
    actual: any[];
    expected: any;
    errors: string[];
  }> = [];

  constructor() {
    this.service = new GoogleSearchService();
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Google Search Service Test Suite\n');
    console.log(`📋 Running ${testCases.length} test cases...\n`);

    for (const testCase of testCases) {
      await this.runTest(testCase);
    }

    this.printResults();
  }

  private async runTest(testCase: TestCase): Promise<void> {
    console.log(`🔍 Testing: ${testCase.name}`);
    console.log(`   Query: ${testCase.query}`);
    
    try {
      const result = await this.service.searchMedicalCoding(testCase.query);
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

  private validateResult(actual: any[], expected: any): string[] {
    const errors: string[] = [];

    // Check minimum results
    if (actual.length < expected.minResults) {
      errors.push(`Expected at least ${expected.minResults} results, got ${actual.length}`);
    }

    // Check expected sources
    if (expected.expectedSources) {
      const actualSources = actual.map(r => r.link || '').join(' ').toLowerCase();
      for (const expectedSource of expected.expectedSources) {
        if (!actualSources.includes(expectedSource.toLowerCase())) {
          errors.push(`Expected source not found: ${expectedSource}`);
        }
      }
    }

    // Check expected content
    if (expected.expectedContent) {
      const actualContent = actual.map(r => `${r.title || ''} ${r.snippet || ''}`).join(' ').toLowerCase();
      for (const expectedContent of expected.expectedContent) {
        if (!actualContent.includes(expectedContent.toLowerCase())) {
          errors.push(`Expected content not found: ${expectedContent}`);
        }
      }
    }

    return errors;
  }

  private printTestDetails(actual: any[], expected: any): void {
    console.log(`    📊 Results:`);
    console.log(`      - Total Results: ${actual.length}`);
    console.log(`      - Expected Min: ${expected.minResults}`);

    if (actual.length > 0) {
      console.log(`    🔍 Search Results:`);
      actual.slice(0, 3).forEach((result, index) => {
        console.log(`      ${index + 1}. ${result.title || 'No title'}`);
        console.log(`         URL: ${result.link || 'No URL'}`);
        console.log(`         Snippet: ${result.snippet ? result.snippet.substring(0, 100) + '...' : 'No snippet'}`);
      });

      if (actual.length > 3) {
        console.log(`      ... and ${actual.length - 3} more results`);
      }
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
async function runGoogleSearchTests(): Promise<void> {
  const testSuite = new GoogleSearchTestSuite();
  await testSuite.runAllTests();
}

// Export for use in other test files
export { GoogleSearchTestSuite, runGoogleSearchTests };

// Run if this file is executed directly
if (require.main === module) {
  runGoogleSearchTests().catch(console.error);
}
