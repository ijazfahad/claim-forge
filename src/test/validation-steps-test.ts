import dotenv from 'dotenv';
import { validateClaim, isDatabaseBuilt, buildLatest } from '../services/cms-ncci-validator';
import { SanityCheckAgent } from '../agents/sanity-check-agent';
import { PlannerAgent } from '../agents/planner-agent';
import { ResearchAgent } from '../agents/research-agent';
import { EvaluateAgent } from '../agents/evaluate-agent';
import { ClaimPayload } from '../types/claim-types';

// Load environment variables
dotenv.config();

interface TestResult {
  step: string;
  success: boolean;
  duration: number;
  result?: any;
  error?: string;
}

class ValidationStepsTest {
  private testResults: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Running Validation Steps Tests...\n');

    // Test data
    const testClaim: ClaimPayload = {
      cpt_codes: ['99213', '99214'],
      icd10_codes: ['M54.5', 'G89.29'],
      note_summary: 'Office visit for back pain with associated neuropathic pain. Patient reports chronic lower back pain with radiation to left leg.',
      payer: 'Medicare',
      place_of_service: '11',
      state: 'CA',
      modifiers: ['25']
    };

    console.log('📋 Test Claim:');
    console.log(JSON.stringify(testClaim, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');

    // Step 1: CMS/NCCI Validation
    await this.testCMSNCCIValidation(testClaim);

    // Step 2: Sanity Check Agent
    await this.testSanityCheckAgent(testClaim);

    // Step 3: Planner Agent
    await this.testPlannerAgent(testClaim);

    // Step 4: Research Agent (optional - requires API keys)
    // await this.testResearchAgent(testClaim);

    // Step 5: Evaluate Agent
    await this.testEvaluateAgent(testClaim);

    // Print summary
    this.printSummary();
  }

  private async testCMSNCCIValidation(claim: ClaimPayload): Promise<void> {
    const startTime = Date.now();
    console.log('🔍 Step 1: Testing CMS/NCCI Validation...');

    try {
      // Ensure database is built
      if (!(await isDatabaseBuilt())) {
        console.log('   Building CMS/NCCI database...');
        throw new Error('CMS/NCCI database not available. Run npm run update:cms to build the database.');
      }

      const result = await validateClaim({
        cpt_codes: claim.cpt_codes,
        icd10_codes: claim.icd10_codes,
        modifiers: claim.modifiers,
        place_of_service: claim.place_of_service,
        note_summary: claim.note_summary
      });

      const duration = Date.now() - startTime;
      
      console.log('   ✅ CMS/NCCI Validation Results:');
      console.log(`   - Valid: ${result.is_valid}`);
      console.log(`   - Risk Score: ${result.risk_score}`);
      console.log(`   - Errors: ${result.errors.length}`);
      console.log(`   - Warnings: ${result.warnings.length}`);
      console.log(`   - Passes: ${result.passes.length}`);
      console.log(`   - Duration: ${duration}ms`);

      if (result.errors.length > 0) {
        console.log('   ❌ Errors:');
        result.errors.forEach(error => {
          console.log(`     - ${error.type}: ${error.message}`);
        });
      }

      if (result.warnings.length > 0) {
        console.log('   ⚠️  Warnings:');
        result.warnings.forEach(warning => {
          console.log(`     - ${warning.type}: ${warning.message}`);
        });
      }

      if (result.passes.length > 0) {
        console.log('   ✅ Passes:');
        result.passes.forEach(pass => {
          console.log(`     - ${pass.type}: ${pass.message}`);
        });
      }

      this.testResults.push({
        step: 'CMS/NCCI Validation',
        success: true,
        duration,
        result
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`   ❌ CMS/NCCI Validation failed: ${(error as Error).message}`);
      
      this.testResults.push({
        step: 'CMS/NCCI Validation',
        success: false,
        duration,
        error: (error as Error).message
      });
    }

    console.log('\n' + '-'.repeat(80) + '\n');
  }

  private async testSanityCheckAgent(claim: ClaimPayload): Promise<void> {
    const startTime = Date.now();
    console.log('🔍 Step 2: Testing Sanity Check Agent...');

    try {
      const sanityAgent = new SanityCheckAgent();
      await sanityAgent.initialize();

      const result = await sanityAgent.performSanityCheck(claim);
      const duration = Date.now() - startTime;

      console.log('   ✅ Sanity Check Results:');
      console.log(`   - Valid: ${result.is_valid}`);
      console.log(`   - Specialty: ${result.ssp_prediction.specialty}`);
      console.log(`   - Subspecialty: ${result.ssp_prediction.subspecialty}`);
      console.log(`   - Confidence: ${result.ssp_prediction.confidence}`);
      console.log(`   - Issues: ${result.issues.length}`);
      console.log(`   - Warnings: ${result.warnings.length}`);
      console.log(`   - Duration: ${duration}ms`);

      if (result.issues.length > 0) {
        console.log('   ❌ Issues:');
        result.issues.forEach(issue => {
          console.log(`     - ${issue}`);
        });
      }

      if (result.warnings.length > 0) {
        console.log('   ⚠️  Warnings:');
        result.warnings.forEach(warning => {
          console.log(`     - ${warning}`);
        });
      }

      this.testResults.push({
        step: 'Sanity Check Agent',
        success: true,
        duration,
        result
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`   ❌ Sanity Check Agent failed: ${(error as Error).message}`);
      
      this.testResults.push({
        step: 'Sanity Check Agent',
        success: false,
        duration,
        error: (error as Error).message
      });
    }

    console.log('\n' + '-'.repeat(80) + '\n');
  }

  private async testPlannerAgent(claim: ClaimPayload): Promise<void> {
    const startTime = Date.now();
    console.log('🔍 Step 3: Testing Planner Agent...');

    try {
      const plannerAgent = new PlannerAgent();
      await plannerAgent.initialize();

      // Mock sanity check result for testing
      const mockSanityResult = {
        is_valid: true,
        sanitized_payload: claim,
        ssp_prediction: {
          specialty: 'Internal Medicine',
          subspecialty: 'General',
          confidence: 'medium' as const
        },
        issues: [],
        warnings: [],
        cms_ncci_checks: {
          bundling_issues: [],
          modifier_requirements: [],
          frequency_limits: []
        },
        validation_issues: [],
        cms_ncci_validation: {
          errors: [],
          warnings: [],
          passes: [],
          is_valid: true,
          risk_score: 10
        },
        ai_clinical_validation: {
          overall_appropriate: true,
          specialty: 'Internal Medicine',
          subspecialty: 'General',
          cpt_validation: [],
          icd_validation: [],
          modifier_validation: [],
          place_of_service_validation: {
            code: '11',
            appropriate: true,
            confidence: 'high',
            reasoning: 'Office visit appropriate'
          },
          documentation_quality: 'good',
          issues: [],
          warnings: [],
          clinical_concerns: [],
          recommendations: []
        },
        policy_check_required: false,
        policy_check_details: []
      };

      const result = await plannerAgent.generateQuestions(claim, mockSanityResult);
      const duration = Date.now() - startTime;

      console.log('   ✅ Planner Agent Results:');
      console.log(`   - Questions Generated: ${result.questions.length}`);
      console.log(`   - Duration: ${duration}ms`);

      if (result.questions.length > 0) {
        console.log('   📝 Questions:');
        result.questions.forEach((question, index) => {
          console.log(`     ${index + 1}. ${question.q}`);
          console.log(`        Type: ${question.type}`);
          console.log(`        Search Queries: ${question.search_queries.length}`);
        });
      }

      this.testResults.push({
        step: 'Planner Agent',
        success: true,
        duration,
        result
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`   ❌ Planner Agent failed: ${(error as Error).message}`);
      
      this.testResults.push({
        step: 'Planner Agent',
        success: false,
        duration,
        error: (error as Error).message
      });
    }

    console.log('\n' + '-'.repeat(80) + '\n');
  }

  private async testResearchAgent(claim: ClaimPayload): Promise<void> {
    const startTime = Date.now();
    console.log('🔍 Step 4: Testing Research Agent...');

    try {
      const researchAgent = new ResearchAgent();
      await researchAgent.initialize();

      const questions = [
        {
          n: 1,
          type: 'basic' as const,
          q: 'What are the Medicare coverage requirements for CPT code 99213?',
          accept_if: ['Medicare coverage confirmed'],
          search_queries: ['medicare CPT 99213 coverage'],
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

      const result = await researchAgent.researchQuestions(questions, claim);
      const duration = Date.now() - startTime;

      console.log('   ✅ Research Agent Results:');
      console.log(`   - Questions Researched: ${result.length}`);
      console.log(`   - Duration: ${duration}ms`);

      result.forEach((research, index) => {
        console.log(`   📊 Research ${index + 1}:`);
        console.log(`     - Question: ${research.q}`);
        console.log(`     - Summary: ${research.summary.substring(0, 100)}...`);
        console.log(`     - Status: ${research.status}`);
        console.log(`     - Confidence: ${research.confidence}`);
      });

      this.testResults.push({
        step: 'Research Agent',
        success: true,
        duration,
        result
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`   ❌ Research Agent failed: ${(error as Error).message}`);
      
      this.testResults.push({
        step: 'Research Agent',
        success: false,
        duration,
        error: (error as Error).message
      });
    }

    console.log('\n' + '-'.repeat(80) + '\n');
  }

  private async testEvaluateAgent(claim: ClaimPayload): Promise<void> {
    const startTime = Date.now();
    console.log('🔍 Step 5: Testing Evaluate Agent...');

    try {
      const evaluateAgent = new EvaluateAgent();
      await evaluateAgent.initialize();

      // Mock research results for testing
      const mockResearchResults = [
        {
          n: '1',
          type: 'basic' as const,
          q: 'What are the Medicare coverage requirements for CPT code 99213?',
          status: 'ok' as const,
          model_only: 'true',
          summary: 'CPT code 99213 is covered by Medicare for established patient office visits.',
          likely_accept_if: 'Medicare coverage confirmed',
          confidence: 'high' as const,
          disclaimers: 'Standard coverage applies',
          next_checks: []
        }
      ];

      const result = await evaluateAgent.evaluateResults(
        'test_claim_123',
        mockResearchResults,
        Date.now() - 1000
      );

      const duration = Date.now() - startTime;

      console.log('   ✅ Evaluate Agent Results:');
      console.log(`   - Overall Status: ${result.overall_status}`);
      console.log(`   - Confidence: ${result.confidence}`);
      console.log(`   - Processing Time: ${result.processing_time_ms}ms`);
      console.log(`   - Duration: ${duration}ms`);

      if (result.overall) {
        console.log('   📊 Overall Assessment:');
        console.log(`     - Go/No-Go: ${result.overall.go_no_go}`);
        console.log(`     - Rationale: ${result.overall.rationale}`);
        console.log(`     - Blockers: ${result.overall.blockers.length}`);
        console.log(`     - Recommendations: ${result.overall.recommendations.length}`);
      }

      this.testResults.push({
        step: 'Evaluate Agent',
        success: true,
        duration,
        result
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`   ❌ Evaluate Agent failed: ${(error as Error).message}`);
      
      this.testResults.push({
        step: 'Evaluate Agent',
        success: false,
        duration,
        error: (error as Error).message
      });
    }

    console.log('\n' + '-'.repeat(80) + '\n');
  }

  private printSummary(): void {
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    
    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);

    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Successful: ${successfulTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
    console.log('');

    this.testResults.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${result.step} (${result.duration}ms)`);
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log('\n' + '='.repeat(80));
    
    if (failedTests === 0) {
      console.log('🎉 All tests passed successfully!');
    } else {
      console.log(`⚠️  ${failedTests} test(s) failed. Check the errors above.`);
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const testSuite = new ValidationStepsTest();

  try {
    switch (command) {
      case 'all':
        await testSuite.runAllTests();
        break;
      case 'cms':
        // Run only CMS/NCCI test
        const testClaim: ClaimPayload = {
          cpt_codes: ['99213'],
          icd10_codes: ['M54.5'],
          note_summary: 'Office visit for back pain',
          payer: 'Medicare',
          place_of_service: '11',
          state: 'CA'
        };
        await testSuite['testCMSNCCIValidation'](testClaim);
        break;
      default:
        console.log('Usage: npm run test:steps [all|cms]');
        console.log('  all - Run all validation step tests');
        console.log('  cms - Run only CMS/NCCI validation test');
    }
  } catch (error) {
    console.error('Test suite error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { ValidationStepsTest };
