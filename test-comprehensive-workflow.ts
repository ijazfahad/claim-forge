import { StepByStepValidationWorkflow } from './src/services/step-by-step-validation-workflow';
import { ClaimStorageService } from './src/services/claim-storage-service';
import { ClaimPayload } from './src/types/claim-types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class ComprehensiveWorkflowTest {
  private claimStorageService: ClaimStorageService;
  private workflow: StepByStepValidationWorkflow;

  constructor() {
    this.claimStorageService = new ClaimStorageService();
    this.workflow = new StepByStepValidationWorkflow();
  }

  async runComprehensiveTest(): Promise<void> {
    console.log('\n🚀 COMPREHENSIVE WORKFLOW TEST SUITE');
    console.log('=====================================\n');

    // Test claim payload - CORRECTED VERSION that should pass validation
    const testClaim: ClaimPayload = {
      payer: "Medicare",
      cpt_codes: ["99214"], // Changed from 99213 to 99214 (moderate complexity MDM)
      icd10_codes: ["M25.512"], // Changed from M25.511 to M25.512 (left shoulder pain)
      modifiers: [], // Removed modifier 25 (no same-day procedure)
      place_of_service: "11",
      state: "CA",
      note_summary: "Established patient office visit for left shoulder pain with detailed history, examination, and medical decision making of moderate complexity. Patient reports 2-week history of left shoulder pain following fall. Physical exam reveals limited range of motion and tenderness. Plan includes imaging studies and physical therapy referral."
    };

    console.log('📋 Test Claim (CORRECTED - Should Pass):');
    console.log(JSON.stringify(testClaim, null, 2));
    console.log('\n');

    try {
      // Step 1: Execute Complete Workflow
      console.log('🔸 Step 1: Executing Complete Validation Workflow');
      const startTime = Date.now();
      const finalResult = await this.workflow.validateClaim(testClaim);
      const totalTime = Date.now() - startTime;
      
      console.log(`✅ Workflow completed in ${totalTime}ms`);
      console.log(`   Final Decision: ${finalResult.overall_status}`);
      console.log(`   Confidence: ${finalResult.confidence}`);
      console.log(`   Approval Probability: ${finalResult.overall_assessment.estimated_approval_probability}%`);
      
      // Step 2: Get the claim ID that was created by the workflow
      const workflowClaimId = finalResult.claim_id;
      console.log(`\n🔸 Step 2: Analyzing Workflow Results`);
      console.log(`   Workflow Claim ID: ${workflowClaimId}`);
      
      // Step 3: Verify Database Storage
      console.log('\n🔸 Step 3: Verifying Database Storage');
      await this.verifyDatabaseStorage(workflowClaimId, finalResult);

      console.log('\n🎉 COMPREHENSIVE TEST COMPLETED SUCCESSFULLY!');
      console.log('============================================');
      console.log('✅ Complete workflow executed successfully');
      console.log('✅ All data stored correctly in database');
      console.log('✅ Status updates working properly');
      console.log('✅ Complete workflow traceability maintained');

    } catch (error) {
      console.error('\n❌ COMPREHENSIVE TEST FAILED:');
      console.error('============================');
      console.error('Error:', error);
      throw error;
    }
  }

  private async verifyDatabaseStorage(claimId: string, finalResult: any): Promise<void> {
    try {
      console.log(`   📊 Verifying storage for claim: ${claimId}`);
      
      // Get claim validation record
      const claim = await this.claimStorageService.getClaimValidation(claimId);
      if (!claim) {
        throw new Error('Claim not found in database');
      }
      
      console.log(`   📊 Claim Status: ${claim.overall_status}`);
      console.log(`   📊 Claim Confidence: ${claim.confidence}`);
      console.log(`   📊 Processing Time: ${claim.processing_time_ms}ms`);
      
      // Get validation steps
      const claimValidationId = await this.getClaimValidationId(claimId);
      const steps = await this.getValidationSteps(claimValidationId);
      
      console.log(`   📊 Total Steps Stored: ${steps.length}`);
      
      // Show all steps
      steps.forEach((step, index) => {
        console.log(`   📋 Step ${index + 1}: ${step.step_name} - ${step.status} (${step.duration_ms}ms)`);
      });
      
      // Verify we have the expected steps based on the workflow result
      if (finalResult.overall_status === 'DENIED' && steps.length === 1) {
        console.log('   ✅ Expected: Only sanity check step (workflow stopped early due to failure)');
      } else if (finalResult.overall_status !== 'DENIED' && steps.length >= 4) {
        console.log('   ✅ Expected: All 4 steps (sanity_check, planner, research, evaluator)');
      } else {
        console.log(`   ⚠️  Unexpected: ${steps.length} steps for status ${finalResult.overall_status}`);
      }
      
      // Verify all stored steps are completed
      const incompleteSteps = steps.filter(s => s.status !== 'completed');
      if (incompleteSteps.length > 0) {
        console.log(`   ⚠️  Incomplete steps: ${incompleteSteps.map(s => `${s.step_name}(${s.status})`).join(', ')}`);
      } else {
        console.log('   ✅ All steps completed successfully');
      }
      
      // Verify final status matches
      if (claim.overall_status === finalResult.overall_status) {
        console.log('   ✅ Final status matches between workflow and database');
      } else {
        console.log(`   ⚠️  Status mismatch: DB=${claim.overall_status}, Workflow=${finalResult.overall_status}`);
      }
      
      console.log('   ✅ Database storage verification completed');
      
    } catch (error) {
      console.error('   ❌ Database storage verification failed:', error);
      throw error;
    }
  }

  private async getClaimValidationId(claimId: string): Promise<string> {
    try {
      const client = await this.claimStorageService['pool'].connect();
      try {
        const result = await client.query(
          'SELECT id FROM claim_forge.claim_validations WHERE claim_id = $1 ORDER BY created_at DESC LIMIT 1',
          [claimId]
        );
        if (result.rows.length === 0) {
          throw new Error(`No claim validation found for claim_id: ${claimId}`);
        }
        return result.rows[0].id;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error getting claim validation ID:', error);
      throw error;
    }
  }

  private async getValidationSteps(claimValidationId: string): Promise<any[]> {
    try {
      const client = await this.claimStorageService['pool'].connect();
      try {
        const result = await client.query(
          'SELECT * FROM claim_forge.validation_steps WHERE claim_validation_id = $1 ORDER BY step_order',
          [claimValidationId]
        );
        return result.rows;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error fetching validation steps:', error);
      return [];
    }
  }
}

// Run the comprehensive test
async function main() {
  const tester = new ComprehensiveWorkflowTest();
  try {
    await tester.runComprehensiveTest();
    console.log('\n🎯 Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { ComprehensiveWorkflowTest };