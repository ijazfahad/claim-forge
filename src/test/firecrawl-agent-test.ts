import { FirecrawlService } from '../services/firecrawl-service';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Test suite for Firecrawl Agent
 * Tests content extraction from URLs for claim validation questions
 * 
 * MVP Focus: Medicare + Primary Care (highest volume, public policies, validation accuracy)
 */

// Single test case - Medicare + Primary Care claim validation question
const testCaseMedicarePrimaryCare = {
  question: "Is CPT 99213 covered under Medicare HMO in California?",
  questionType: "basic",
  testUrls: [
    "https://www.cms.gov/medicare/payment/fee-schedules/physician",
    "https://provider.humana.com/coverage-claims/claims-payment-policies",
    "https://www.cms.gov/medicare/physician-fee-schedule/search/overview"
  ], // URLs from Google Search Agent for CPT 99213 Medicare coverage
  searchQuery: "Medicare HMO coverage 99213 California",
   expectedElements: [
    "Medicare",
    "physician",
    "fee schedule",
    "coverage",
    "payment"
  ],
  expectedStructuredData: {
    extracted_content: "string",
    key_points: "array",
    policy_details: {
      coverage_rules: "array",
      eligibility_requirements: "array", 
      coding_guidelines: "array"
    }
  }
};

export class FirecrawlAgentTestSuite {
  private firecrawlService: FirecrawlService;

  constructor() {
    this.firecrawlService = new FirecrawlService();
  }

  async runTests(): Promise<void> {
    console.log('\n🔬 === FIRECRAWL AGENT TEST SUITE ===\n');
    console.log('📋 MVP Focus: Medicare + Primary Care Claim Validation\n');
    
    let passedTests = 0;
    let totalTests = 0;

    try {
      // Test 1: Basic content extraction from Medicare URLs
      totalTests++;
      const testResult1 = await this.testMedicareContentExtraction();
      if (testResult1) {
        passedTests++;
        console.log('✅ Test 1: Medicare content extraction passed\n');
      } else {
        console.log('❌ Test 1: Medicare content extraction failed\n');
      }

      // Test 2: Question-specific extraction
      totalTests++;
      const testResult2 = await this.testQuestionSpecificExtraction();
      if (testResult2) {
        passedTests++;
        console.log('✅ Test 2: Question-specific extraction passed\n');
      } else {
        console.log('❌ Test 2: Question-specific extraction failed\n');
      }

      // Test 3: Single URL extraction with instructions
      totalTests++;
      const testResult3 = await this.testSingleUrlExtraction();
      if (testResult3) {
        passedTests++;
        console.log('✅ Test 3: Single URL extraction passed\n');
      } else {
        console.log('❌ Test 3: Single URL extraction failed\n');
      }

      // Test 4: Error handling
      totalTests++;
      const testResult4 = await this.testErrorHandling();
      if (testResult4) {
        passedTests++;
        console.log('✅ Test 4: Error handling passed\n');
      } else {
        console.log('❌ Test 4: Error handling failed\n');
      }

    } catch (error) {
      console.error('❌ Test suite error:', error);
    }

    // Results summary
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);
    console.log('📊 === TEST RESULTS SUMMARY ===');
    console.log(`   Tests Passed: ${passedTests}/${totalTests} (${successRate}%)`);
    console.log(`   MVP Scenario: Medicare + Primary Care`);
    console.log(`   Focus: URL content extraction for claim validation\n`);

    if (passedTests === totalTests) {
      console.log('✅ ALL FIRECRAWL TESTS PASSED - Ready for Research Agent integration!');
    } else {
      console.log('⚠️  Some tests failed - Review before proceeding to Research Agent');
    }
  }

  /**
   * Test 1: Extract content from Medicare-related URLs
   */
  private async testMedicareContentExtraction(): Promise<boolean> {
    console.log('🔍 Test 1: Medicare Content Extraction');
    console.log(`   Question: ${testCaseMedicarePrimaryCare.question}`);
    console.log(`   Query: ${testCaseMedicarePrimaryCare.searchQuery}`);
    console.log(`   URLs: ${testCaseMedicarePrimaryCare.testUrls.length} URLs`);
    
    try {
      const result = await this.firecrawlService.extractContentForQuestion(
        testCaseMedicarePrimaryCare.question,
        testCaseMedicarePrimaryCare.questionType,
        testCaseMedicarePrimaryCare.testUrls,
        testCaseMedicarePrimaryCare.searchQuery
      );

      if (!result.success) {
        console.log(`   ❌ Extraction failed: ${result.error}`);
        return false;
      }

      // Validate extraction results
      console.log(`   ✅ Extraction successful`);
      console.log(`   📄 Content length: ${result.data?.content?.length || 0} characters`);
      console.log(`   📊 Markdown length: ${result.data?.markdown?.length || 0} characters`);
      
      // Display sample content (first 500 chars)
      if (result.data?.content) {
        console.log('\n   📋 Sample extracted content:');
        const sampleContent = result.data.content.substring(0, 500);
        console.log(`   ${sampleContent}...`);
      }

      // Check for expected elements in content
      const content = result.data?.content?.toLowerCase() || '';
      const foundElements = testCaseMedicarePrimaryCare.expectedElements.filter(element =>
        content.includes(element.toLowerCase())
      );

      console.log(`\n   🎯 Expected elements found: ${foundElements.length}/${testCaseMedicarePrimaryCare.expectedElements.length}`);
      foundElements.forEach((element, index) => {
        console.log(`   ${index + 1}. ✓ ${element}`);
      });

      const missingElements = testCaseMedicarePrimaryCare.expectedElements.filter(element =>
        !content.includes(element.toLowerCase()) && 
        // Allow some flexibility with terminology
        !content.includes(element.toLowerCase().replace('medicare', 'medicare coverage').replace('hmo', 'hmo plans'))
      );

      if (missingElements.length > 0) {
        console.log(`   ⚠️  Missing elements:`);
        missingElements.forEach((element, index) => {
          console.log(`   ${index + 1}. ✗ ${element}`);
        });
      }

      return true;

    } catch (error) {
      console.log(`   ❌ Extraction error: ${error}`);
      return false;
    }
  }

  /**
   * Test 2: Question-specific extraction with medical coding context
   */
  private async testQuestionSpecificExtraction(): Promise<boolean> {
    console.log('🔍 Test 2: Question-Specific Extraction');
    
    const medicalCodingQuestion = "Does CPT 99213 with ICD-10 M54.5 comply with Medicare HMO plan rules in California?";
    const medicalUrls = [
      "https://www.cms.gov/medicare/payment/fee-schedules/physician",
      "https://provider.humana.com/coverage-claims/claims-payment-policies"
    ];

    try {
      const result = await this.firecrawlService.extractContentForQuestion(
        medicalCodingQuestion,
        "specialty",
        medicalUrls,
        "Medicare CPT 99213 plan rules"
      );

      if (!result.success) {
        console.log(`   ❌ Medical coding extraction failed: ${result.error}`);
        return false;
      }

      console.log(`   ✅ Medical coding extraction successful`);
      console.log(`   📄 Content: ${result.data?.content?.length || 0} characters`);

      // Validate medical coding terms
      const content = result.data?.content?.toLowerCase() || '';
      const medicalTerms = ['cpt', '99213', 'medicare', 'coverage', 'rules'];
      const foundTerms = medicalTerms.filter(term => content.includes(term));

      console.log(`   🏥 Medical terms found: ${foundTerms.length}/${medicalTerms.length}`);
      foundTerms.forEach(term => console.log(`   ✓ ${term}`));

      return foundTerms.length >= 3; // Need at least 3 medical terms

    } catch (error) {
      console.log(`   ❌ Medical coding extraction error: ${error}`);
      return false;
    }
  }

  /**
   * Test 3: Single URL extraction with specific instructions
   */
  private async testSingleUrlExtraction(): Promise<boolean> {
    console.log('🔍 Test 3: Single URL Extraction');
    
    const singleUrl = "https://www.cms.gov/medicare/payment/fee-schedules/physician";
    const instructions = "Extract information about Medicare physician fee schedules, CPT 99213 coverage, and payment policies. Focus on primary care office visits.";

    try {
      const result = await this.firecrawlService.extractSingleUrl(
        singleUrl,
        instructions
      );

      if (!result.success) {
        console.log(`   ❌ Single URL extraction failed: ${result.error}`);
        return false;
      }

      console.log(`   ✅ Single URL extraction successful`);
      console.log(`   📄 Content: ${result.data?.content?.length || 0} characters`);
      console.log(`   📊 Metadata: ${result.data?.metadata?.title || 'No title'}`);

      // Show first few lines of extracted content
      if (result.data?.content) {
        const lines = result.data.content.split('\n').slice(0, 5);
        console.log('\n   📋 First few lines:');
        lines.forEach((line, index) => {
          if (line.trim()) {
            console.log(`   ${index + 1}. ${line.substring(0, 80)}...`);
          }
        });
      }

      return true;

    } catch (error) {
      console.log(`   ❌ Single URL error: ${error}`);
      return false;
    }
  }

  /**
   * Test 4: Error handling for invalid URLs and API failures
   */
  private async testErrorHandling(): Promise<boolean> {
    console.log('🔍 Test 4: Error Handling');

    try {
      // Test with invalid URL
      const invalidUrls = ["https://invalidurlthatdoesnotexist123.com/test"];
      const result = await this.firecrawlService.extractContentForQuestion(
        "Test question",
        "basic",
        invalidUrls,
        "test query"
      );

      if (result.success) {
        console.log(`   ❌ Expected failure but got success - this is unexpected`);
        return false;
      }

      console.log(`   ✅ Correctly handled invalid URL: ${result.error}`);

      // Test with empty URL array
      const emptyResult = await this.firecrawlService.extractContentForQuestion(
        "Test question",
        "basic",
        [],
        "test query"
      );

      if (emptyResult.success) {
        console.log(`   ❌ Expected failure for empty URLs but got success`);
        return false;
      }

      console.log(`   ✅ Correctly handled empty URL array: ${emptyResult.error}`);
      return true;

    } catch (error) {
      console.log(`   ❌ Error handling test failed: ${error}`);
      return false;
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const testSuite = new FirecrawlAgentTestSuite();
  testSuite.runTests().catch(console.error);
}
