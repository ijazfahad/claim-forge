import { GoogleSearchAgent } from '../agents/google-search-agent';
import { ValidationQuestion } from '../agents/planner-agent';

/**
 * Test suite for Google Search Agent
 * Tests Google search functionality with Planner Agent output
 */

// Pre-generated test data from Planner Agent (generated once and stored here)
const mockPlannerQuestions: ValidationQuestion[] = [
  {
    n: 1,
    type: 'basic',
    q: 'Is the patient\'s eligibility confirmed for CPT 99213 with ICD-10 M54.5 under Medicare HMO in California?',
    accept_if: ['Eligibility confirmed', 'Plan coverage verified'],
    search_queries: ['site:medicare.gov eligibility HMO', 'Medicare HMO plan coverage'],
    risk_flags: {
      PA: false,
      POS: false,
      NCCI: false,
      Modifiers: false,
      Frequency: false,
      Diagnosis: false,
      StateSpecific: false,
      LOBSpecific: true,
      Thresholds: false
    }
  },
  {
    n: 2,
    type: 'basic',
    q: 'Does CPT 99213 with ICD-10 M54.5 comply with Medicare HMO plan rules in California?',
    accept_if: ['CPT 99213 covered', 'Plan rules satisfied'],
    search_queries: ['site:medicare.gov CPT 99213 coverage', 'Medicare 99213 plan rules'],
    risk_flags: {
      PA: false,
      POS: false,
      NCCI: false,
      Modifiers: false,
      Frequency: false,
      Diagnosis: false,
      StateSpecific: false,
      LOBSpecific: true,
      Thresholds: false
    }
  },
  {
    n: 3,
    type: 'specialty',
    q: 'Is CPT 99213 with ICD-10 M54.5 for back pain consistent with general practice standards under Medicare HMO?',
    accept_if: ['General practice standards met', 'Back pain treatment appropriate'],
    search_queries: ['site:medicare.gov 99213 back pain', 'General practice back pain guidelines'],
    risk_flags: {
      PA: false,
      POS: false,
      NCCI: false,
      Modifiers: false,
      Frequency: false,
      Diagnosis: true,
      StateSpecific: false,
      LOBSpecific: false,
      Thresholds: false
    }
  },
  {
    n: 4,
    type: 'specialty',
    q: 'Are there frequency limits for CPT 99213 office visits under Medicare HMO in California?',
    accept_if: ['No frequency limits', 'Frequency within limits'],
    search_queries: ['Medicare HMO frequency limits', 'Office visit frequency rules'],
    risk_flags: {
      PA: false,
      POS: false,
      NCCI: false,
      Modifiers: false,
      Frequency: true,
      Diagnosis: false,
      StateSpecific: false,
      LOBSpecific: true,
      Thresholds: false
    }
  },
  {
    n: 5,
    type: 'subspecialty',
    q: 'Is POS 11 appropriate for CPT 99213 primary care office visits under Medicare HMO?',
    accept_if: ['POS requirements met', 'Primary care POS appropriate'],
    search_queries: ['Medicare primary care POS', 'Office visit place of service'],
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
    n: 6,
    type: 'subspecialty',
    q: 'Are there California state-specific rules for CPT 99213 with ICD-10 M54.5 under Medicare HMO?',
    accept_if: ['No state-specific rules', 'CA rules satisfied'],
    search_queries: ['California Medicare rules', 'CA state-specific guidelines'],
    risk_flags: {
      PA: false,
      POS: false,
      NCCI: false,
      Modifiers: false,
      Frequency: false,
      Diagnosis: false,
      StateSpecific: true,
      LOBSpecific: false,
      Thresholds: false
    }
  }
];

class GoogleSearchAgentTestSuite {
  private googleSearchAgent: GoogleSearchAgent;

  constructor() {
    this.googleSearchAgent = new GoogleSearchAgent();
  }

  async runTests(): Promise<void> {
    console.log('🧪 Starting Google Search Agent Test Suite\n');

    try {
      // Test 1: Basic functionality with pre-generated questions
      await this.testBasicFunctionality();
      
      // Test 2: URL validation
      await this.testUrlValidation();
      
      // Test 3: Error handling
      await this.testErrorHandling();

      console.log('\n🎯 Google Search Agent Test Suite Complete');
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
  }

  private async testBasicFunctionality(): Promise<void> {
    console.log('🔍 Test 1: Basic Functionality with Pre-generated Questions');
    
    try {
      console.log(`   📋 Using ${mockPlannerQuestions.length} pre-generated questions`);
      
      // Execute Google searches
      console.log('   🔎 Executing Google searches...');
      const searchResult = await this.googleSearchAgent.executeSearches(mockPlannerQuestions);
      
      // Validate results
      console.log('   📊 Validating results...');
      console.log(`      Total questions: ${searchResult.meta.total_questions}`);
      console.log(`      Total searches: ${searchResult.meta.total_searches}`);
      console.log(`      Total results: ${searchResult.meta.total_results}`);
      console.log(`      Duration: ${searchResult.meta.search_duration_ms}ms`);
      
      // Check that we got results for each question
      if (searchResult.search_results.length === mockPlannerQuestions.length) {
        console.log('   ✅ All questions processed successfully');
      } else {
        console.log('   ❌ Some questions were not processed');
      }
      
      // Check if we got URLs
      const hasUrls = searchResult.search_results.some(result => result.results.length > 0);
      if (hasUrls) {
        console.log('   ✅ Google Search returned URLs');
      } else {
        console.log('   ❌ Google Search returned no URLs');
      }
      
      // Display sample results
      if (searchResult.search_results.length > 0) {
        const firstResult = searchResult.search_results[0];
        console.log(`   📋 Sample Question: ${firstResult.question.q}`);
        console.log(`   🔎 Search Queries: ${firstResult.search_queries.join(', ')}`);
        console.log(`   📊 Results Found: ${firstResult.results.length}`);
        
        if (firstResult.results.length > 0) {
          console.log(`   🔗 Sample URL: ${firstResult.results[0].link}`);
          console.log(`   📝 Sample Title: ${firstResult.results[0].title}`);
        }
      }
      
      // Display Firecrawl inputs
      console.log('\n   🔗 Firecrawl Inputs (what will be passed to next stage):');
      searchResult.firecrawl_inputs.forEach((input, index) => {
        console.log(`   Input ${index + 1}:`);
        console.log(`     Question: ${input.question}`);
        console.log(`     Query: ${input.query}`);
        console.log(`     Type: ${input.question_type}`);
        console.log(`     URLs (${input.urls.length}):`);
        input.urls.forEach((url, urlIndex) => {
          console.log(`       ${urlIndex + 1}. ${url}`);
        });
        console.log('');
      });
      
    } catch (error) {
      console.error('   ❌ Basic functionality test failed:', error);
    }
    
    console.log('');
  }

  private async testUrlValidation(): Promise<void> {
    console.log('🔍 Test 2: URL Validation');
    
    try {
      // Execute searches with pre-generated questions
      const searchResult = await this.googleSearchAgent.executeSearches(mockPlannerQuestions);
      
      // Test URL validation
      console.log('   📊 Validating URLs...');
      
      let validUrls = 0;
      let invalidUrls = 0;
      
      searchResult.search_results.forEach(result => {
        result.results.forEach(searchResult => {
          try {
            new URL(searchResult.link);
            validUrls++;
          } catch (error) {
            invalidUrls++;
          }
        });
      });
      
      console.log(`      Valid URLs: ${validUrls}`);
      console.log(`      Invalid URLs: ${invalidUrls}`);
      
      if (validUrls > 0) {
        console.log('   ✅ Valid URLs found');
      } else {
        console.log('   ❌ No valid URLs found');
      }
      
      // Test result processing methods
      console.log('   📊 Testing result processing methods...');
      
      // Test getResultsByType
      const basicResults = this.googleSearchAgent.getResultsByType(searchResult.search_results, 'basic');
      const specialtyResults = this.googleSearchAgent.getResultsByType(searchResult.search_results, 'specialty');
      const subspecialtyResults = this.googleSearchAgent.getResultsByType(searchResult.search_results, 'subspecialty');
      
      console.log(`      Basic questions: ${basicResults.length}`);
      console.log(`      Specialty questions: ${specialtyResults.length}`);
      console.log(`      Subspecialty questions: ${subspecialtyResults.length}`);
      
      // Test getAllUrls
      const allUrls = this.googleSearchAgent.getAllUrls(searchResult.search_results);
      console.log(`      Total unique URLs: ${allUrls.length}`);
      
      // Test getSearchSummary
      const summary = this.googleSearchAgent.getSearchSummary(searchResult.search_results);
      console.log(`      Results by type: Basic=${summary.by_type.basic}, Specialty=${summary.by_type.specialty}, Subspecialty=${summary.by_type.subspecialty}`);
      console.log(`      Top domains: ${summary.top_domains.slice(0, 3).map(d => d.domain).join(', ')}`);
      
      console.log('   ✅ URL validation test passed');
      
    } catch (error) {
      console.error('   ❌ URL validation test failed:', error);
    }
    
    console.log('');
  }

  private async testErrorHandling(): Promise<void> {
    console.log('🔍 Test 3: Error Handling');
    
    try {
      // Test with empty questions array
      console.log('   📋 Testing with empty questions array...');
      const emptyResult = await this.googleSearchAgent.executeSearches([]);
      
      if (emptyResult.search_results.length === 0 && emptyResult.meta.total_questions === 0) {
        console.log('   ✅ Empty questions array handled correctly');
      } else {
        console.log('   ❌ Empty questions array not handled correctly');
      }
      
      // Test with questions containing invalid search queries
      console.log('   📋 Testing with invalid search queries...');
      const invalidQuestions: ValidationQuestion[] = [
        {
          n: 1,
          type: 'basic',
          q: 'Test question with invalid query for CPT 99213 under Medicare',
          accept_if: ['Test'],
          search_queries: ['', '   ', 'invalid@#$%query'],
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
        }
      ];
      
      const invalidResult = await this.googleSearchAgent.executeSearches(invalidQuestions);
      console.log(`   📊 Invalid queries processed: ${invalidResult.meta.total_searches}`);
      console.log(`   📊 Results found: ${invalidResult.meta.total_results}`);
      
      // Test if URLs are returned even with invalid queries
      const hasUrls = invalidResult.search_results.some(result => result.results.length > 0);
      if (hasUrls) {
        console.log('   ✅ Some URLs returned despite invalid queries');
      } else {
        console.log('   ⚠️  No URLs returned for invalid queries (expected)');
      }
      
      console.log('   ✅ Error handling test passed');
      
    } catch (error) {
      console.error('   ❌ Error handling test failed:', error);
    }
    
    console.log('');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new GoogleSearchAgentTestSuite();
  testSuite.runTests().catch(console.error);
}

export { GoogleSearchAgentTestSuite };
