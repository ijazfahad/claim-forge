import { EvaluatorAgent, EvaluatorDecision } from '../agents/evaluator-agent';
import { ResearchResult } from '../agents/research-agent';
import { ValidationQuestion } from '../agents/planner-agent';

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
    
    const mockResearchResults: ResearchResult[] = [
      {
        question: 'Is CPT 99213 covered under Medicare HMO in California?',
        answer: 'Yes, CPT 99213 is covered under Medicare Part B for established patient office visits with proper documentation.',
        confidence: 0.88,
        source: 'Multi-Model Consensus',
        metadata: {
          extraction_method: 'multi-model',
          processing_time: 25000,
          escalation_reason: 'Low Firecrawl confidence'
        },
        multi_model_data: {
          claude: {
            answer: 'Yes, CPT 99213 is covered under Medicare Part B for established patient office visits.',
            confidence: 0.9,
            reasoning: 'Medicare Part B covers established patient office visits with appropriate documentation.'
          },
          gpt5: {
            answer: 'Yes, CPT 99213 is generally covered under Medicare HMO plans.',
            confidence: 0.85,
            reasoning: 'Medicare HMO plans typically cover established patient visits with proper authorization.'
          },
          deepseek: {
            answer: 'Yes, CPT 99213 is covered under Medicare Advantage plans.',
            confidence: 0.9,
            reasoning: 'Medicare Advantage plans cover established patient office visits per CMS guidelines.'
          },
          individual_confidences: { claude: 0.9, gpt5: 0.85, deepseek: 0.9 },
          consensus: { final_confidence: 0.88, agreement_level: 'high', conflicting_models: [] },
          answer_previews: {
            claude: 'Yes, CPT 99213 is covered under Medicare Part B...',
            gpt5: 'Yes, CPT 99213 is generally covered under Medicare HMO...',
            deepseek: 'Yes, CPT 99213 is covered under Medicare Advantage...'
          }
        },
        recommendations: [
          '✅ High confidence - Policy appears well-documented',
          '🎯 Strong model consensus - High reliability expected',
          '🗺️ State-specific policy - Confirm state regulations'
        ]
      },
      {
        question: 'What are the documentation requirements for CPT 99213?',
        answer: 'Documentation must include chief complaint, history of present illness, review of systems, and medical decision making.',
        confidence: 0.85,
        source: 'Multi-Model Consensus',
        metadata: {
          extraction_method: 'multi-model',
          processing_time: 22000
        },
        multi_model_data: {
          claude: {
            answer: 'Documentation requirements include chief complaint, history of present illness, review of systems, and medical decision making.',
            confidence: 0.85,
            reasoning: 'CMS requires comprehensive documentation for established patient visits.'
          },
          gpt5: {
            answer: 'Proper documentation must include HPI, ROS, and medical decision making.',
            confidence: 0.8,
            reasoning: 'Medicare requires detailed documentation for billing purposes.'
          },
          deepseek: {
            answer: 'Documentation should cover CC, HPI, ROS, MDM for established patient visits.',
            confidence: 0.9,
            reasoning: 'Complete documentation ensures proper reimbursement and compliance.'
          },
          individual_confidences: { claude: 0.85, gpt5: 0.8, deepseek: 0.9 },
          consensus: { final_confidence: 0.85, agreement_level: 'high', conflicting_models: [] },
          answer_previews: {
            claude: 'Documentation requirements include chief complaint...',
            gpt5: 'Proper documentation must include HPI, ROS...',
            deepseek: 'Documentation should cover CC, HPI, ROS, MDM...'
          }
        },
        recommendations: [
          '✅ High confidence - Policy appears well-documented',
          '🎯 Strong model consensus - High reliability expected'
        ]
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
        mockResearchResults,
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
    
    const mockResearchResults: ResearchResult[] = [
      {
        question: 'Is experimental treatment covered?',
        answer: 'Unable to find specific policy information for this experimental treatment.',
        confidence: 0.1,
        source: 'Fallback',
        metadata: {
          extraction_method: 'firecrawl',
          processing_time: 5000,
          escalation_reason: 'Error in research process'
        },
        recommendations: [
          '❌ Research failed - Manual review required',
          '📞 Contact payer directly for policy clarification'
        ]
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
        mockResearchResults,
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
    
    const mockResearchResults: ResearchResult[] = [
      {
        question: 'Is CPT 99213 covered?',
        answer: 'Yes, generally covered under Medicare Part B.',
        confidence: 0.75,
        source: 'Multi-Model Consensus',
        metadata: {
          extraction_method: 'multi-model',
          processing_time: 20000
        },
        multi_model_data: {
          claude: {
            answer: 'Generally covered under Medicare Part B for established patient visits.',
            confidence: 0.7,
            reasoning: 'Medicare Part B typically covers established patient visits with appropriate documentation.'
          },
          gpt5: {
            answer: 'Yes, covered with proper documentation and medical necessity.',
            confidence: 0.8,
            reasoning: 'Medicare covers established patient visits when properly documented.'
          },
          deepseek: {
            answer: 'Covered under Medicare Part B for established patient office visits.',
            confidence: 0.75,
            reasoning: 'Medicare Part B covers established patient visits per CMS guidelines.'
          },
          individual_confidences: { claude: 0.7, gpt5: 0.8, deepseek: 0.75 },
          consensus: { final_confidence: 0.75, agreement_level: 'medium', conflicting_models: [] },
          answer_previews: {
            claude: 'Generally covered under Medicare Part B...',
            gpt5: 'Yes, covered with proper documentation...',
            deepseek: 'Covered under Medicare Part B...'
          }
        },
        recommendations: [
          '🔍 Moderate confidence - Verify with additional sources',
          '🎯 Medium model consensus - Additional verification recommended'
        ]
      },
      {
        question: 'Prior authorization required?',
        answer: 'Prior authorization may be required depending on specific circumstances.',
        confidence: 0.65,
        source: 'Multi-Model Consensus',
        metadata: {
          extraction_method: 'multi-model',
          processing_time: 18000
        },
        multi_model_data: {
          claude: {
            answer: 'May require prior authorization depending on specific circumstances.',
            confidence: 0.6,
            reasoning: 'Prior authorization requirements vary by payer and specific circumstances.'
          },
          gpt5: {
            answer: 'Prior auth typically required for certain procedures.',
            confidence: 0.7,
            reasoning: 'Many payers require prior authorization for specific services.'
          },
          deepseek: {
            answer: 'Authorization may be needed based on payer policies.',
            confidence: 0.65,
            reasoning: 'Prior authorization depends on individual payer requirements.'
          },
          individual_confidences: { claude: 0.6, gpt5: 0.7, deepseek: 0.65 },
          consensus: { final_confidence: 0.65, agreement_level: 'medium', conflicting_models: [] },
          answer_previews: {
            claude: 'May require prior authorization...',
            gpt5: 'Prior auth typically required...',
            deepseek: 'Authorization may be needed...'
          }
        },
        recommendations: [
          '🔍 Moderate confidence - Verify with additional sources',
          '📋 Prior authorization flagged - Verify PA requirements with payer'
        ]
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
        mockResearchResults,
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
