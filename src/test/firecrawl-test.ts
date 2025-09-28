import { FirecrawlService } from '../services/firecrawl-service';

/**
 * Comprehensive test suite for Firecrawl Service
 * Tests web content extraction functionality
 */

interface TestCase {
  name: string;
  url: string;
  cptCodes: string[];
  extractionPrompt: string;
  expectedResults: {
    success: boolean;
    expectedContent?: string[];
    minContentLength?: number;
  };
}

const testCases: TestCase[] = [
  {
    name: 'CMS CPT Documentation Page',
    url: 'https://www.cms.gov/medicare/coding/cpt-codes',
    cptCodes: ['99213'],
    extractionPrompt: 'Extract information about CPT code 99213 documentation requirements',
    expectedResults: {
      success: true,
      expectedContent: ['cpt', 'documentation', 'requirements'],
      minContentLength: 500
    }
  },
  {
    name: 'AMA Modifier Guidelines',
    url: 'https://www.ama-assn.org/practice-management/cpt/cpt-modifiers',
    cptCodes: ['99213'],
    extractionPrompt: 'Extract information about CPT modifier 25 guidelines',
    expectedResults: {
      success: true,
      expectedContent: ['modifier', '25', 'guidelines'],
      minContentLength: 300
    }
  },
  {
    name: 'Medicare NCCI Edits',
    url: 'https://www.cms.gov/medicare/coding/ncci-edits',
    cptCodes: ['99213', '36415'],
    extractionPrompt: 'Extract information about NCCI edits for CPT codes 99213 and 36415',
    expectedResults: {
      success: true,
      expectedContent: ['ncci', 'edits', 'bundling'],
      minContentLength: 400
    }
  },
  {
    name: 'ACEP Emergency Coding',
    url: 'https://www.acep.org/administration/coding-and-reimbursement/',
    cptCodes: ['99284'],
    extractionPrompt: 'Extract information about emergency department coding guidelines',
    expectedResults: {
      success: true,
      expectedContent: ['emergency', 'department', 'coding'],
      minContentLength: 300
    }
  },
  {
    name: 'Invalid URL Test',
    url: 'https://invalid-url-that-does-not-exist.com',
    cptCodes: ['99213'],
    extractionPrompt: 'Extract information about CPT code 99213',
    expectedResults: {
      success: false
    }
  },
  {
    name: 'Non-Medical Website',
    url: 'https://www.google.com',
    cptCodes: ['99213'],
    extractionPrompt: 'Extract information about CPT code 99213',
    expectedResults: {
      success: true,
      expectedContent: [],
      minContentLength: 100
    }
  }
];

class FirecrawlTestSuite {
  private service: FirecrawlService;
  private results: Array<{
    testCase: string;
    passed: boolean;
    actual: any;
    expected: any;
    errors: string[];
  }> = [];

  constructor() {
    this.service = new FirecrawlService();
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Firecrawl Service Test Suite\n');
    console.log(`📋 Running ${testCases.length} test cases...\n`);

    for (const testCase of testCases) {
      await this.runTest(testCase);
    }

    this.printResults();
  }

  private async runTest(testCase: TestCase): Promise<void> {
    console.log(`🔍 Testing: ${testCase.name}`);
    console.log(`   URL: ${testCase.url}`);
    console.log(`   CPT Codes: ${testCase.cptCodes.join(', ')}`);
    
    try {
      const result = await this.service.scrapeUrl(testCase.url);
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
        actual: { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
        expected: testCase.expectedResults,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
    }

    console.log('');
  }

  private validateResult(actual: any, expected: any): string[] {
    const errors: string[] = [];

    // Check success status
    if (actual.success !== expected.success) {
      errors.push(`Expected success: ${expected.success}, got: ${actual.success}`);
    }

    // Check content length
    if (expected.minContentLength && actual.success) {
      const contentLength = actual.data?.content?.length || 0;
      if (contentLength < expected.minContentLength) {
        errors.push(`Expected content length >= ${expected.minContentLength}, got: ${contentLength}`);
      }
    }

    // Check expected content
    if (expected.expectedContent && expected.expectedContent.length > 0 && actual.success) {
      const content = (actual.data?.content || '').toLowerCase();
      for (const expectedContent of expected.expectedContent) {
        if (!content.includes(expectedContent.toLowerCase())) {
          errors.push(`Expected content not found: ${expectedContent}`);
        }
      }
    }

    return errors;
  }

  private printTestDetails(actual: any, expected: any): void {
    console.log(`    📊 Results:`);
    console.log(`      - Success: ${actual.success}`);
    
    if (actual.success && actual.data) {
      console.log(`      - Content Length: ${actual.data.content?.length || 0} characters`);
      console.log(`      - Title: ${actual.data.metadata?.title || 'No title'}`);
      console.log(`      - Description: ${actual.data.metadata?.description || 'No description'}`);
      
      if (actual.data.content) {
        console.log(`      - Content Preview: ${actual.data.content.substring(0, 200)}...`);
      }
    } else if (actual.error) {
      console.log(`      - Error: ${actual.error}`);
    }

    console.log(`    📋 Expected:`);
    console.log(`      - Success: ${expected.success}`);
    if (expected.minContentLength) {
      console.log(`      - Min Content Length: ${expected.minContentLength}`);
    }
    if (expected.expectedContent && expected.expectedContent.length > 0) {
      console.log(`      - Expected Content: ${expected.expectedContent.join(', ')}`);
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
async function runFirecrawlTests(): Promise<void> {
  const testSuite = new FirecrawlTestSuite();
  await testSuite.runAllTests();
}

// Export for use in other test files
export { FirecrawlTestSuite, runFirecrawlTests };

// Run if this file is executed directly
if (require.main === module) {
  runFirecrawlTests().catch(console.error);
}
