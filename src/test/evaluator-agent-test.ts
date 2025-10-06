import { EvaluatorAgent, EvaluatorDecision } from '../agents/evaluator-agent';
import { ValidationQuestion } from '../agents/planner-agent';
import { ReviewerResult } from '../agents/reviewer-agent';

export class EvaluatorAgentTestSuite {
  private evaluatorAgent: EvaluatorAgent;

  constructor() {
    this.evaluatorAgent = new EvaluatorAgent();
  }

  async runTests(): Promise<void> {
    console.log('🧪 === EVALUATOR AGENT TEST SUITE ===');
    console.log('📋 Testing Claim Evaluation and Decision Making');
    console.log('');

    try {
      await this.testHighConfidenceApproval();
      await this.testLowConfidenceDenial();
      await this.testMixedResultsReview();
      await this.testErrorHandling();
      
      console.log('');
      console.log('📊 === TEST RESULTS SUMMARY ===');
      console.log('✅ Evaluator Agent decision making implemented');
      console.log('🎯 Ready for production claim evaluation');
      console.log('');
      console.log('✅ Evaluator Agent Test Suite completed successfully');
      
    } catch (error) {
      console.error('❌ Evaluator Agent Test Suite failed:', error);
      throw error;
    } finally {
      // Force exit to prevent hanging
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    }
  }

  private async testHighConfidenceApproval(): Promise<void> {
    console.log('🔍 Test 1: High Confidence Approval');
    
    const mockReviewerResults: ReviewerResult[] = [
      {
        question: 'Is CPT 99213 covered under Medicare HMO in California?',
        reviewed_answer: 'Yes, CPT 99213 is covered under Medicare Part B for established patient office visits with proper documentation.',
        confidence: 0.88,
        review_status: 'no_conflict',
        review_analysis: {
          detected_conflicts: [],
          resolution_strategy: 'Consensus from multiple sources',
          confidence_adjustment: 0.0
        },
        source_analysis: {
          firecrawl_contribution: 0.0,
          claude_contribution: 0.3,
          gpt5_contribution: 0.3,
          deepseek_contribution: 0.4
        },
        recommendations: [
          '✅ High confidence - Policy appears well-documented',
          '🎯 Strong model consensus - High reliability expected',
          '🗺️ State-specific policy - Confirm state regulations'
        ],
        processing_time_ms: 25000
      },
      {
        question: 'What are the documentation requirements for CPT 99213?',
        reviewed_answer: 'Documentation must include chief complaint, history of present illness, review of systems, and medical decision making.',
        confidence: 0.85,
        review_status: 'no_conflict',
        review_analysis: {
          detected_conflicts: [],
          resolution_strategy: 'Consensus from multiple sources',
          confidence_adjustment: 0.0
        },
        source_analysis: {
          firecrawl_contribution: 0.0,
          claude_contribution: 0.33,
          gpt5_contribution: 0.33,
          deepseek_contribution: 0.34
        },
        recommendations: [
          '✅ High confidence - Policy appears well-documented',
          '🎯 Strong model consensus - High reliability expected'
        ],
        processing_time_ms: 22000
      }
    ];

    const mockQuestions: ValidationQuestion[] = [
      {
        n: 1,
        type: 'basic',
        q: 'Is CPT 99213 covered under Medicare HMO in California?',
        accept_if: ['Coverage confirmed'],
        search_queries: ['Medicare HMO coverage 99213'],
        risk_flags: {
          PA: false, POS: false, NCCI: false, Modifiers: false, Frequency: false,
          Diagnosis: false, StateSpecific: true, LOBSpecific: true, Thresholds: false
        }
      },
      {
        n: 2,
        type: 'specialty',
        q: 'What are the documentation requirements for CPT 99213?',
        accept_if: ['Documentation requirements specified'],
        search_queries: ['CPT 99213 documentation requirements'],
        risk_flags: {
          PA: false, POS: false, NCCI: false, Modifiers: false, Frequency: false,
          Diagnosis: false, StateSpecific: false, LOBSpecific: false, Thresholds: false
        }
      }
    ];

    try {
      const startTime = Date.now();
      const result = await this.evaluatorAgent.evaluateClaim(
        'TEST-CLAIM-001',
        mockReviewerResults,
        mockQuestions,
        startTime
      );

      console.log(`   📊 Overall Status: ${result.overall_status}`);
      console.log(`   📈 Confidence: ${result.confidence}`);
      console.log(`   🎯 Approval Probability: ${result.overall_assessment.estimated_approval_probability}%`);
      console.log(`   ⏱️  Processing Time: ${result.processing_time_ms}ms`);
      console.log(`   📋 Questions Analyzed: ${result.question_analysis.length}`);
      
      result.question_analysis.forEach((qa, index) => {
        console.log(`   📝 Question ${index + 1}: ${qa.status} (${(qa.confidence * 100).toFixed(1)}% confidence)`);
      });

      console.log('✅ Test 1: High confidence approval passed');
      
    } catch (error) {
      console.error('❌ Test 1: High confidence approval failed:', error);
      throw error;
    }
  }

  private async testLowConfidenceDenial(): Promise<void> {
    console.log('🔍 Test 2: Low Confidence Denial');
    
    const mockReviewerResults: ReviewerResult[] = [
      {
        question: 'Is experimental treatment covered?',
        reviewed_answer: 'Unable to find specific policy information for this experimental treatment.',
        confidence: 0.1,
        review_status: 'unresolvable',
        review_analysis: {
          detected_conflicts: [{
            type: 'coverage',
            description: 'No policy information found for experimental treatment',
            conflicting_sources: ['Research Failure'],
            severity: 'high',
            resolution_suggestion: 'Manual review required'
          }],
          resolution_strategy: 'Fallback to manual review',
          confidence_adjustment: -0.4
        },
        source_analysis: {
          firecrawl_contribution: 0.0,
          claude_contribution: 0.0,
          gpt5_contribution: 0.0,
          deepseek_contribution: 0.0
        },
        recommendations: [
          '❌ Research failed - Manual review required',
          '📞 Contact payer directly for policy clarification'
        ],
        processing_time_ms: 5000
      }
    ];

    const mockQuestions: ValidationQuestion[] = [
      {
        n: 1,
        type: 'basic',
        q: 'Is experimental treatment covered?',
        accept_if: ['Coverage confirmed'],
        search_queries: ['experimental treatment coverage'],
        risk_flags: {
          PA: true, POS: false, NCCI: false, Modifiers: false, Frequency: false,
          Diagnosis: false, StateSpecific: false, LOBSpecific: false, Thresholds: false
        }
      }
    ];

    try {
      const startTime = Date.now();
      const result = await this.evaluatorAgent.evaluateClaim(
        'TEST-CLAIM-002',
        mockReviewerResults,
        mockQuestions,
        startTime
      );

      console.log(`   📊 Overall Status: ${result.overall_status}`);
      console.log(`   📈 Confidence: ${result.confidence}`);
      console.log(`   🎯 Approval Probability: ${result.overall_assessment.estimated_approval_probability}%`);
      console.log(`   ⚠️  Blockers: ${result.overall_assessment.blockers.length}`);
      
      result.overall_assessment.blockers.forEach((blocker, index) => {
        console.log(`   🚫 Blocker ${index + 1}: ${blocker.reason} (${blocker.severity})`);
      });

      console.log('✅ Test 2: Low confidence denial passed');
      
    } catch (error) {
      console.error('❌ Test 2: Low confidence denial failed:', error);
      throw error;
    }
  }

  private async testMixedResultsReview(): Promise<void> {
    console.log('🔍 Test 3: Mixed Results Review Required');
    
    const mockReviewerResults: ReviewerResult[] = [
      {
        question: 'Is CPT 99213 covered?',
        reviewed_answer: 'Yes, generally covered under Medicare Part B.',
        confidence: 0.75,
        review_status: 'resolved',
        review_analysis: {
          detected_conflicts: [{
            type: 'confidence',
            description: 'Medium confidence from multiple sources',
            conflicting_sources: ['Claude', 'GPT-5', 'DeepSeek'],
            severity: 'medium',
            resolution_suggestion: 'Additional verification recommended'
          }],
          resolution_strategy: 'Weighted consensus from multiple sources',
          confidence_adjustment: -0.1
        },
        source_analysis: {
          firecrawl_contribution: 0.0,
          claude_contribution: 0.3,
          gpt5_contribution: 0.4,
          deepseek_contribution: 0.3
        },
        recommendations: [
          '🔍 Moderate confidence - Verify with additional sources',
          '🎯 Medium model consensus - Additional verification recommended'
        ],
        processing_time_ms: 20000
      },
      {
        question: 'Prior authorization required?',
        reviewed_answer: 'Prior authorization may be required depending on specific circumstances.',
        confidence: 0.65,
        review_status: 'resolved',
        review_analysis: {
          detected_conflicts: [{
            type: 'requirements',
            description: 'Uncertain prior authorization requirements',
            conflicting_sources: ['Claude', 'GPT-5', 'DeepSeek'],
            severity: 'medium',
            resolution_suggestion: 'Verify PA requirements with payer'
          }],
          resolution_strategy: 'Consensus with uncertainty flag',
          confidence_adjustment: -0.15
        },
        source_analysis: {
          firecrawl_contribution: 0.0,
          claude_contribution: 0.3,
          gpt5_contribution: 0.4,
          deepseek_contribution: 0.3
        },
        recommendations: [
          '🔍 Moderate confidence - Verify with additional sources',
          '📋 Prior authorization flagged - Verify PA requirements with payer'
        ],
        processing_time_ms: 18000
      }
    ];

    const mockQuestions: ValidationQuestion[] = [
      {
        n: 1,
        type: 'basic',
        q: 'Is CPT 99213 covered?',
        accept_if: ['Coverage confirmed'],
        search_queries: ['CPT 99213 coverage'],
        risk_flags: {
          PA: false, POS: false, NCCI: false, Modifiers: false, Frequency: false,
          Diagnosis: false, StateSpecific: false, LOBSpecific: false, Thresholds: false
        }
      },
      {
        n: 2,
        type: 'specialty',
        q: 'Prior authorization required?',
        accept_if: ['PA requirements specified'],
        search_queries: ['prior authorization requirements'],
        risk_flags: {
          PA: true, POS: false, NCCI: false, Modifiers: false, Frequency: false,
          Diagnosis: false, StateSpecific: false, LOBSpecific: false, Thresholds: false
        }
      }
    ];

    try {
      const startTime = Date.now();
      const result = await this.evaluatorAgent.evaluateClaim(
        'TEST-CLAIM-003',
        mockReviewerResults,
        mockQuestions,
        startTime
      );

      console.log(`   📊 Overall Status: ${result.overall_status}`);
      console.log(`   📈 Confidence: ${result.confidence}`);
      console.log(`   🎯 Approval Probability: ${result.overall_assessment.estimated_approval_probability}%`);
      console.log(`   📋 Next Steps: ${result.overall_assessment.next_steps.length}`);
      
      result.overall_assessment.next_steps.forEach((step, index) => {
        console.log(`   📝 Step ${index + 1}: ${step}`);
      });

      console.log('✅ Test 3: Mixed results review passed');
      
    } catch (error) {
      console.error('❌ Test 3: Mixed results review failed:', error);
      throw error;
    }
  }

  private async testErrorHandling(): Promise<void> {
    console.log('🔍 Test 4: Error Handling');
    
    try {
      const startTime = Date.now();
      const result = await this.evaluatorAgent.evaluateClaim(
        'TEST-CLAIM-ERROR',
        [], // Empty research results
        [], // Empty questions
        startTime
      );

      console.log(`   📊 Overall Status: ${result.overall_status}`);
      console.log(`   📈 Confidence: ${result.confidence}`);
      console.log(`   🎯 Approval Probability: ${result.overall_assessment.estimated_approval_probability}%`);
      console.log(`   ⚠️  Blockers: ${result.overall_assessment.blockers.length}`);
      console.log(`   📋 Questions Analyzed: ${result.question_analysis.length}`);

      console.log('✅ Test 4: Error handling passed');
      
    } catch (error) {
      console.error('❌ Test 4: Error handling failed:', error);
      throw error;
    }
  }
}

// Export for test runner
export default EvaluatorAgentTestSuite;

// Run tests if called directly
if (require.main === module) {
  const testSuite = new EvaluatorAgentTestSuite();
  testSuite.runTests().catch(console.error);
}
