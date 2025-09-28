import { runSanityCheckTests } from './sanity-check-agent-test';
import { runPlannerAgentTests } from './planner-agent-test';
import { runResearchAgentTests } from './research-agent-test';
import { runEvaluateAgentTests } from './evaluate-agent-test';
import { runIntegrationTests } from './integration-test';
import { runGoogleSearchTests } from './google-search-test';
import { runFirecrawlTests } from './firecrawl-test';

/**
 * Master test runner for all validation workflow tests
 * Runs individual agent tests and integration tests
 */

interface TestSuite {
  name: string;
  description: string;
  run: () => Promise<void>;
}

const testSuites: TestSuite[] = [
  {
    name: 'Sanity Check Agent',
    description: 'Tests AI clinical validation and CMS/NCCI rules validation',
    run: runSanityCheckTests
  },
  {
    name: 'Planner Agent',
    description: 'Tests question generation based on Sanity Check results',
    run: runPlannerAgentTests
  },
  {
    name: 'Research Agent',
    description: 'Tests Firecrawl and Google Search functionality',
    run: runResearchAgentTests
  },
  {
    name: 'Evaluate Agent',
    description: 'Tests final decision making based on research results',
    run: runEvaluateAgentTests
  },
  {
    name: 'Google Search Service',
    description: 'Tests Google Search API functionality for medical coding',
    run: runGoogleSearchTests
  },
  {
    name: 'Firecrawl Service',
    description: 'Tests web content extraction functionality',
    run: runFirecrawlTests
  },
  {
    name: 'Integration Tests',
    description: 'Tests complete validation workflow end-to-end',
    run: runIntegrationTests
  }
];

class MasterTestRunner {
  private results: Array<{
    suite: string;
    passed: boolean;
    error?: string;
  }> = [];

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Master Test Suite\n');
    console.log(`📋 Running ${testSuites.length} test suites...\n`);

    for (const testSuite of testSuites) {
      await this.runTestSuite(testSuite);
    }

    this.printResults();
  }

  async runSpecificTest(suiteName: string): Promise<void> {
    const testSuite = testSuites.find(ts => ts.name.toLowerCase().includes(suiteName.toLowerCase()));
    
    if (!testSuite) {
      console.log(`❌ Test suite not found: ${suiteName}`);
      console.log(`Available test suites: ${testSuites.map(ts => ts.name).join(', ')}`);
      return;
    }

    console.log(`🎯 Running specific test suite: ${testSuite.name}\n`);
    await this.runTestSuite(testSuite);
    this.printResults();
  }

  private async runTestSuite(testSuite: TestSuite): Promise<void> {
    console.log(`🧪 Running: ${testSuite.name}`);
    console.log(`📝 Description: ${testSuite.description}\n`);
    
    try {
      await testSuite.run();
      this.results.push({
        suite: testSuite.name,
        passed: true
      });
      console.log(`✅ ${testSuite.name} completed successfully\n`);
    } catch (error) {
      console.log(`💥 ${testSuite.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      this.results.push({
        suite: testSuite.name,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private printResults(): void {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    console.log('📊 Master Test Results Summary');
    console.log('===============================');
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
      console.log('❌ Failed Test Suites:');
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`  - ${result.suite}`);
        if (result.error) {
          console.log(`    • ${result.error}`);
        }
      });
    }

    console.log('\n🎯 Master Test Suite Complete');
  }
}

// Run all tests
async function runAllTests(): Promise<void> {
  const runner = new MasterTestRunner();
  await runner.runAllTests();
}

// Run specific test suite
async function runSpecificTest(suiteName: string): Promise<void> {
  const runner = new MasterTestRunner();
  await runner.runSpecificTest(suiteName);
}

// Export for use in other files
export { MasterTestRunner, runAllTests, runSpecificTest };

// Run if this file is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    runSpecificTest(args[0]).catch(console.error).finally(() => {
      process.exit(0);
    });
  } else {
    runAllTests().catch(console.error).finally(() => {
      process.exit(0);
    });
  }
}
