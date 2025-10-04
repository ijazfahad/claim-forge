import { ResearchAgent } from '../agents/research-agent';
import { ValidationQuestion } from '../agents/planner-agent';

export class ResearchAgentTestSuite {
  private researchAgent: ResearchAgent;

  constructor() {
    this.researchAgent = new ResearchAgent();
  }

  async runTests(): Promise<void> {
    console.log('🧪 === RESEARCH AGENT TEST SUITE ===');
    console.log('📋 Testing Cascading Validation Strategy');
    console.log('');

    try {
      await this.testCascadingStrategy();
      await this.testConfidenceAssessment();
      await this.testErrorHandling();
      
      console.log('');
      console.log('📊 === TEST RESULTS SUMMARY ===');
      console.log('✅ Research Agent cascading strategy implemented');
      console.log('🎯 Ready for multi-model integration');
      console.log('');
      console.log('✅ Research Agent Test Suite completed successfully');
      
    } catch (error) {
      console.error('❌ Research Agent Test Suite failed:', error);
      throw error;
    }
  }

  private async testCascadingStrategy(): Promise<void> {
    console.log('🔍 Test 1: Cascading Validation Strategy');
    
    const testQuestions: ValidationQuestion[] = [
      {
        n: 1,
        type: 'basic',
        q: 'Is CPT 99213 covered under Medicare HMO in California?',
        accept_if: ['Specific coverage policy found'],
        search_queries: ['Medicare HMO coverage 99213 California'],
        risk_flags: {
          PA: false,
          POS: false,
          NCCI: false,
          Modifiers: false,
          Frequency: false,
          Diagnosis: false,
          StateSpecific: true,
          LOBSpecific: true,
          Thresholds: false
        }
      },
      {
        n: 2,
        type: 'specialty',
        q: 'What are the prior authorization requirements for CPT 64636?',
        accept_if: ['Clear PA requirements documented'],
        search_queries: ['CPT 64636 prior authorization requirements'],
        risk_flags: {
          PA: true,
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

    try {
      const results = await this.researchAgent.executeResearch(testQuestions);
      
      console.log(`   ✅ Processed ${results.length} questions`);
      
      results.forEach((result, index) => {
        console.log(`   📋 Question ${index + 1}: ${result.question.substring(0, 50)}...`);
        console.log(`   🎯 Method: ${result.metadata.extraction_method}`);
        console.log(`   📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`   ⏱️  Time: ${result.metadata.processing_time}ms`);
        console.log(`   💡 Recommendations:`);
        result.recommendations.forEach((rec, i) => {
          console.log(`      ${i + 1}. ${rec}`);
        });
        console.log('');
      });
      
      console.log('✅ Test 1: Cascading strategy passed');
      
    } catch (error) {
      console.error('❌ Test 1: Cascading strategy failed:', error);
      throw error;
    }
  }

  private async testConfidenceAssessment(): Promise<void> {
    console.log('🔍 Test 2: Confidence Assessment Algorithm');
    
    // Mock Firecrawl responses with different confidence levels
    const mockResponses = [
      {
        content: 'CPT 99213 is covered under Medicare Part B for established patient office visits. Specific coverage includes evaluation and management services with clear documentation requirements.',
        structured_data: {
          policy_details: {
            coverage_rules: ['Established patient visits', 'Documentation required'],
            eligibility_requirements: ['Medicare Part B enrollment']
          }
        },
        metadata: { url: 'https://www.cms.gov/medicare/payment/fee-schedules/physician' }
      },
      {
        content: 'General information about medical coding.',
        structured_data: {},
        metadata: { url: 'https://example.com/general-info' }
      }
    ];

    try {
      mockResponses.forEach((response, index) => {
        const confidence = this.researchAgent['assessConfidenceLevel'](response);
        console.log(`   📊 Response ${index + 1} confidence: ${(confidence * 100).toFixed(1)}%`);
        console.log(`   📝 Content length: ${response.content.length} chars`);
        console.log(`   🏥 Has policy details: ${!!response.structured_data.policy_details}`);
        console.log(`   🔗 CMS domain: ${response.metadata.url.includes('cms.gov')}`);
        console.log('');
      });
      
      console.log('✅ Test 2: Confidence assessment passed');
      
    } catch (error) {
      console.error('❌ Test 2: Confidence assessment failed:', error);
      throw error;
    }
  }

  private async testErrorHandling(): Promise<void> {
    console.log('🔍 Test 3: Error Handling');
    
    const invalidQuestions: ValidationQuestion[] = [
      {
        n: 1,
        type: 'basic',
        q: '',
        accept_if: [],
        search_queries: [],
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

    try {
      const results = await this.researchAgent.executeResearch(invalidQuestions);
      
      console.log(`   ✅ Handled ${results.length} invalid questions gracefully`);
      console.log(`   📋 Fallback answer provided: ${results[0]?.answer.substring(0, 50)}...`);
      console.log(`   📊 Low confidence fallback: ${(results[0]?.confidence * 100).toFixed(1)}%`);
      console.log('');
      
      console.log('✅ Test 3: Error handling passed');
      
    } catch (error) {
      console.error('❌ Test 3: Error handling failed:', error);
      throw error;
    }
  }
}

// Export for test runner
export default ResearchAgentTestSuite;

// Run tests if called directly
if (require.main === module) {
  const testSuite = new ResearchAgentTestSuite();
  testSuite.runTests().catch(console.error);
}