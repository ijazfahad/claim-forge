import { PlannerAgent, PlannerResult } from '../agents/planner-agent';
import { SanityCheckResult } from '../agents/sanity-check-agent';
import { ClaimPayload } from '../types/claim-types';

/**
 * Comprehensive test suite for Planner Agent
 * Tests question generation based on Sanity Check results
 */

interface TestCase {
  name: string;
  claim: ClaimPayload;
  sanityResult: SanityCheckResult;
  expectedResults: {
    questionCount: number;
    questionTypes: {
      basic: number;
      specialty: number;
      subspecialty: number;
    };
    expectedQuestions?: string[];
    policyCheckRequired?: boolean;
  };
}

const testCases: TestCase[] = [
  {
    name: 'Basic Claim - No Policy Check Required',
    claim: {
      cpt_codes: ['99213'],
      icd10_codes: ['M54.5'],
      note_summary: 'Office visit for back pain.',
      payer: 'Medicare'
    },
    sanityResult: {
      is_valid: true,
      sanitized_payload: {} as ClaimPayload,
      ssp_prediction: {
        specialty: 'General Practice',
        subspecialty: 'Primary Care',
        confidence: 'medium'
      },
      issues: [],
      warnings: [],
      cms_ncci_checks: {
        bundling_issues: [],
        modifier_requirements: [],
        frequency_limits: []
      },
      ai_clinical_validation: {
        overall_appropriate: true,
        specialty: 'Internal Medicine',
        subspecialty: 'General',
        cpt_validation: [{
          code: '99213',
          appropriate: true,
          confidence: 'high',
          reasoning: 'Appropriate for established patient visit'
        }],
        icd_validation: [{
          code: 'M54.5',
          appropriate: true,
          confidence: 'high',
          reasoning: 'Appropriate for back pain'
        }],
        modifier_validation: [],
        place_of_service_validation: {
          code: '11',
          appropriate: true,
          confidence: 'high',
          reasoning: 'Office visit appropriate'
        },
        clinical_concerns: [],
        documentation_quality: 'good',
        recommendations: []
      },
      policy_check_required: false,
      policy_check_details: null,
      validation_issues: [],
      cms_ncci_validation: {
        is_valid: true,
        risk_score: 10,
        errors: [],
        warnings: [],
        passes: []
      }
    },
    expectedResults: {
      questionCount: 6,
      questionTypes: {
        basic: 2,
        specialty: 2,
        subspecialty: 2
      },
      policyCheckRequired: false
    }
  },
  {
    name: 'Complex Claim - Policy Check Required',
    claim: {
      cpt_codes: ['99215', '36415'],
      icd10_codes: ['I10', 'E11.9'],
      note_summary: 'Complex visit for diabetes and hypertension management.',
      payer: 'Medicare'
    },
    sanityResult: {
      is_valid: true,
      sanitized_payload: {} as ClaimPayload,
      ssp_prediction: {
        specialty: 'Internal Medicine',
        subspecialty: 'Endocrinology',
        confidence: 'high'
      },
      issues: [],
      warnings: [],
      cms_ncci_checks: {
        bundling_issues: [],
        modifier_requirements: [],
        frequency_limits: []
      },
      ai_clinical_validation: {
        overall_appropriate: true,
        specialty: 'Internal Medicine',
        subspecialty: 'General',
        cpt_validation: [
          {
            code: '99215',
            appropriate: true,
            confidence: 'high',
            reasoning: 'Appropriate for complex visit'
          },
          {
            code: '36415',
            appropriate: true,
            confidence: 'high',
            reasoning: 'Appropriate for blood draw'
          }
        ],
        icd_validation: [
          {
            code: 'I10',
            appropriate: true,
            confidence: 'high',
            reasoning: 'Appropriate for hypertension'
          },
          {
            code: 'E11.9',
            appropriate: true,
            confidence: 'high',
            reasoning: 'Appropriate for diabetes'
          }
        ],
        modifier_validation: [],
        place_of_service_validation: {
          code: '11',
          appropriate: true,
          confidence: 'high',
          reasoning: 'Office visit appropriate'
        },
        clinical_concerns: [],
        documentation_quality: 'excellent',
        recommendations: []
      },
      policy_check_required: true,
      policy_check_details: {
        cpt_codes: ['99215', '36415'],
        icd10_codes: ['I10', 'E11.9'],
        provider_type: 'practitioner',
        claim_date: '2025-01-15',
        validation_types: ['Medical Necessity', 'Policy Coverage', 'LCD/NCD Research'],
        research_questions: [
          'Are there any Local Coverage Determinations (LCD) that apply to CPT 99215 with diagnosis I10?',
          'What are the coverage criteria for CPT 36415 with diagnosis E11.9?'
        ]
      },
      validation_issues: [],
      cms_ncci_validation: {
        is_valid: true,
        risk_score: 15,
        errors: [],
        warnings: [],
        passes: []
      }
    },
    expectedResults: {
      questionCount: 6,
      questionTypes: {
        basic: 2,
        specialty: 2,
        subspecialty: 2
      },
      policyCheckRequired: true,
      expectedQuestions: [
        'necessity',
        'coverage',
        'LCD'
      ]
    }
  },
  {
    name: 'Emergency Department Claim',
    claim: {
      cpt_codes: ['99284'],
      icd10_codes: ['R50.9'],
      note_summary: 'Emergency department visit for fever.',
      payer: 'Medicare'
    },
    sanityResult: {
      is_valid: true,
      sanitized_payload: {} as ClaimPayload,
      ssp_prediction: {
        specialty: 'Emergency Medicine',
        subspecialty: 'General Emergency',
        confidence: 'high'
      },
      issues: [],
      warnings: [],
      cms_ncci_checks: {
        bundling_issues: [],
        modifier_requirements: [],
        frequency_limits: []
      },
      ai_clinical_validation: {
        overall_appropriate: true,
        specialty: 'Emergency Medicine',
        subspecialty: 'General',
        cpt_validation: [{
          code: '99284',
          appropriate: true,
          confidence: 'high',
          reasoning: 'Appropriate for ED visit'
        }],
        icd_validation: [{
          code: 'R50.9',
          appropriate: true,
          confidence: 'high',
          reasoning: 'Appropriate for fever'
        }],
        modifier_validation: [],
        place_of_service_validation: {
          code: '11',
          appropriate: true,
          confidence: 'high',
          reasoning: 'Office visit appropriate'
        },
        clinical_concerns: [],
        documentation_quality: 'good',
        recommendations: []
      },
      policy_check_required: true,
      policy_check_details: {
        cpt_codes: ['99284'],
        icd10_codes: ['R50.9'],
        provider_type: 'hospital',
        claim_date: '2025-01-15',
        validation_types: ['Medical Necessity', 'Policy Coverage'],
        research_questions: [
          'Are there any ED-specific coverage policies for CPT 99284?',
          'What documentation requirements exist for fever diagnosis R50.9?'
        ]
      },
      validation_issues: [],
      cms_ncci_validation: {
        is_valid: true,
        risk_score: 20,
        errors: [],
        warnings: [],
        passes: []
      }
    },
    expectedResults: {
      questionCount: 8,
      questionTypes: {
        basic: 3,
        specialty: 3,
        subspecialty: 2
      },
      policyCheckRequired: true,
      expectedQuestions: [
        'emergency department',
        'ED-specific',
        'fever'
      ]
    }
  }
];

class PlannerAgentTestSuite {
  private agent: PlannerAgent;
  private results: Array<{
    testCase: string;
    passed: boolean;
    actual: PlannerResult;
    expected: any;
    errors: string[];
  }> = [];

  constructor() {
    this.agent = new PlannerAgent();
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Planner Agent Test Suite\n');
    console.log(`📋 Running ${testCases.length} test cases...\n`);

    for (const testCase of testCases) {
      await this.runTest(testCase);
    }

    this.printResults();
  }

  private async runTest(testCase: TestCase): Promise<void> {
    console.log(`🔍 Testing: ${testCase.name}`);
    
    try {
      const result = await this.agent.generateQuestions(testCase.claim, testCase.sanityResult);
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
        actual: {} as PlannerResult,
        expected: testCase.expectedResults,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
    }

    console.log('');
  }

  private validateResult(actual: PlannerResult, expected: any): string[] {
    const errors: string[] = [];

    // Check question count
    if (actual.questions.length !== expected.questionCount) {
      errors.push(`Expected ${expected.questionCount} questions, got ${actual.questions.length}`);
    }

    // Check question types
    const basicQuestions = actual.questions.filter(q => q.type === 'basic').length;
    const specialtyQuestions = actual.questions.filter(q => q.type === 'specialty').length;
    const subspecialtyQuestions = actual.questions.filter(q => q.type === 'subspecialty').length;

    if (basicQuestions !== expected.questionTypes.basic) {
      errors.push(`Expected ${expected.questionTypes.basic} basic questions, got ${basicQuestions}`);
    }
    if (specialtyQuestions !== expected.questionTypes.specialty) {
      errors.push(`Expected ${expected.questionTypes.specialty} specialty questions, got ${specialtyQuestions}`);
    }
    if (subspecialtyQuestions !== expected.questionTypes.subspecialty) {
      errors.push(`Expected ${expected.questionTypes.subspecialty} subspecialty questions, got ${subspecialtyQuestions}`);
    }

    // Check for expected question content
    if (expected.expectedQuestions) {
      for (const expectedQuestion of expected.expectedQuestions) {
        const found = actual.questions.some(q => 
          q.q.toLowerCase().includes(expectedQuestion.toLowerCase()) ||
          q.search_queries.some(sq => sq.toLowerCase().includes(expectedQuestion.toLowerCase()))
        );
        if (!found) {
          errors.push(`Expected question content not found: ${expectedQuestion}`);
        }
      }
    }

    // Check policy check integration
    if (expected.policyCheckRequired) {
      const hasPolicyQuestions = actual.questions.some(q => 
        q.q.toLowerCase().includes('policy') ||
        q.q.toLowerCase().includes('coverage') ||
        q.q.toLowerCase().includes('lcd') ||
        q.q.toLowerCase().includes('ncd') ||
        q.search_queries.some(sq => 
          sq.toLowerCase().includes('policy') ||
          sq.toLowerCase().includes('coverage') ||
          sq.toLowerCase().includes('lcd') ||
          sq.toLowerCase().includes('ncd')
        )
      );
      if (!hasPolicyQuestions) {
        errors.push('Expected policy-related questions not found');
      }
    }

    return errors;
  }

  private printTestDetails(actual: PlannerResult, expected: any): void {
    console.log(`    📊 Results:`);
    console.log(`      - Total Questions: ${actual.questions.length}`);
    console.log(`      - Basic: ${actual.questions.filter(q => q.type === 'basic').length}`);
    console.log(`      - Specialty: ${actual.questions.filter(q => q.type === 'specialty').length}`);
    console.log(`      - Subspecialty: ${actual.questions.filter(q => q.type === 'subspecialty').length}`);

    console.log(`    📋 Questions Generated:`);
    actual.questions.forEach((q, index) => {
      console.log(`      ${index + 1}. [${q.type.toUpperCase()}] ${q.q}`);
      console.log(`         Search Queries: ${q.search_queries.join(', ')}`);
      console.log(`         Accept If: ${q.accept_if.join(', ')}`);
    });

    // Check for policy questions
    const policyQuestions = actual.questions.filter(q => 
      q.q.toLowerCase().includes('policy') ||
      q.q.toLowerCase().includes('coverage') ||
      q.q.toLowerCase().includes('lcd') ||
      q.q.toLowerCase().includes('ncd')
    );

    if (policyQuestions.length > 0) {
      console.log(`    🏛️  Policy Questions (${policyQuestions.length}):`);
      policyQuestions.forEach((q, index) => {
        console.log(`      ${index + 1}. ${q.q}`);
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
async function runPlannerAgentTests(): Promise<void> {
  const testSuite = new PlannerAgentTestSuite();
  await testSuite.runAllTests();
}

// Export for use in other test files
export { PlannerAgentTestSuite, runPlannerAgentTests };

// Run if this file is executed directly
if (require.main === module) {
  runPlannerAgentTests().catch(console.error);
}
