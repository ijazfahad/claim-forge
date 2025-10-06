import express from 'express';
import { StepByStepValidationWorkflow } from '../services/step-by-step-validation-workflow';
import { ClaimPayload } from '../types/claim-types';
import { ClaimStorageService } from '../services/claim-storage-service';
import crypto from 'crypto';

const router = express.Router();

/**
 * POST /api/validate-claim
 * Validate a claim with real-time status updates via Server-Sent Events
 */
router.post('/validate-claim', async (req, res) => {
  const payload: ClaimPayload = req.body;

  // Set up Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  try {
    // Generate claim ID and store payload immediately
    const claimId = crypto.randomUUID();
    
    console.log('\n' + '='.repeat(80));
    console.log('🚀 STARTING CLAIM VALIDATION WORKFLOW');
    console.log('='.repeat(80));
    console.log('📋 Claim Payload:', JSON.stringify(payload, null, 2));
    console.log('🆔 Generated Claim ID:', claimId);
    const claimStorageService = new ClaimStorageService();
    
    let claimValidationId: string;
    try {
      claimValidationId = await claimStorageService.storeClaimPayload(claimId, payload);
      console.log('✅ Claim payload stored successfully');
      console.log('🆔 Claim Validation ID:', claimValidationId);
    } catch (error) {
      console.error('❌ Failed to store claim payload:', error);
      throw error;
    }

    const workflow = new StepByStepValidationWorkflow();

    // Send initial status
    sendSSE(res, {
      step: null,
      status: 'active',
      message: 'Initializing validation workflow...',
      progress: 0
    });

    // Execute validation with step-by-step updates
    const result = await executeValidationWithUpdates(workflow, payload, claimValidationId, res);

    // Send final result
    sendSSE(res, {
      step: 'evaluator',
      status: 'completed',
      message: 'Validation completed successfully',
      progress: 100,
      result: result
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ CLAIM VALIDATION WORKFLOW COMPLETED');
    console.log('='.repeat(80));
    console.log('📊 Final Status:', result.overall_status);
    console.log('🎯 Confidence:', result.confidence);
    console.log('⏱️  Total Processing Time:', result.processing_time_ms + 'ms');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Validation failed via API:', error);
    
    sendSSE(res, {
      step: null,
      status: 'error',
      message: 'Validation failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
      progress: 0
    });
  } finally {
    res.end();
  }
});

/**
 * Execute validation with real-time updates
 */
async function executeValidationWithUpdates(
  workflow: StepByStepValidationWorkflow,
  payload: ClaimPayload,
  claimValidationId: string,
  res: express.Response
): Promise<any> {
  const startTime = Date.now();

  try {
    console.log('\n' + '-'.repeat(60));
    console.log('🔍 STEP 1: SANITY CHECK');
    console.log('-'.repeat(60));
    
    // Step 1: Sanity Check
    sendSSE(res, {
      step: 'sanity',
      status: 'active',
      message: '🔍 Running sanity check (AI Clinical + CMS/NCCI)...',
      progress: 10
    });

    const sanityResult = await workflow['executeSanityCheckStep'](
      claimValidationId,
      payload,
      1
    );

    if (!sanityResult.output_data?.is_valid) {
      console.log('❌ Sanity check FAILED - stopping workflow');
      sendSSE(res, {
        step: 'sanity',
        status: 'error',
        message: '❌ Sanity check failed - stopping workflow',
        progress: 25
      });
      throw new Error('Sanity check failed');
    }

    console.log('✅ Sanity check PASSED');
    console.log('🏥 Specialty:', sanityResult.output_data.ssp_prediction.specialty);
    console.log('🔬 Subspecialty:', sanityResult.output_data.ssp_prediction.subspecialty);
    
    sendSSE(res, {
      step: 'sanity',
      status: 'completed',
      message: `✅ Sanity check passed - ${sanityResult.output_data.ssp_prediction.specialty}`,
      progress: 25
    });

    console.log('\n' + '-'.repeat(60));
    console.log('📋 STEP 2: PLANNER AGENT');
    console.log('-'.repeat(60));
    
    // Step 2: Planner
    sendSSE(res, {
      step: 'planner',
      status: 'active',
      message: '📋 Generating validation questions...',
      progress: 30
    });

    const plannerResult = await workflow['executePlannerStep'](
      claimValidationId,
      payload,
      sanityResult.output_data,
      2
    );

    if (plannerResult.status === 'failed') {
      console.log('❌ Planner FAILED - stopping workflow');
      sendSSE(res, {
        step: 'planner',
        status: 'error',
        message: '❌ Planner failed - stopping workflow',
        progress: 50
      });
      throw new Error('Planner failed');
    }

    const questionCount = plannerResult.output_data?.questions?.length || 0;
    console.log('✅ Planner COMPLETED');
    console.log('📝 Generated Questions:', questionCount);
    console.log('📋 Questions:', plannerResult.output_data?.questions?.map((q: any, i: number) => `${i + 1}. ${q.q}`).join('\n   '));
    
    sendSSE(res, {
      step: 'planner',
      status: 'completed',
      message: `✅ Generated ${questionCount} validation questions`,
      progress: 50
    });

    console.log('\n' + '-'.repeat(60));
    console.log('🔬 STEP 3: RESEARCH AGENT');
    console.log('-'.repeat(60));
    console.log('📊 Processing Questions:', questionCount);
    
    // Step 3: Research (using automated workflow step for proper database storage)
    sendSSE(res, {
      step: 'research',
      status: 'active',
      message: `🔬 Researching ${questionCount} questions...`,
      progress: 60
    });

    const researchStepResults = await workflow['executeResearchSteps'](
      claimValidationId,
      plannerResult.output_data.questions,
      3
    );

    if (researchStepResults.some(result => result.status === 'failed')) {
      console.log('❌ Research FAILED - stopping workflow');
      sendSSE(res, {
        step: 'research',
        status: 'error',
        message: '❌ Research failed - stopping workflow',
        progress: 80
      });
      throw new Error('Research failed');
    }

    // Extract research results from step results
    const researchResults = researchStepResults.map(step => step.output_data).filter(result => result);
    
    console.log('✅ Research COMPLETED');
    console.log('📊 Results Summary:');
    researchResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.question.substring(0, 60)}...`);
      console.log(`      🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`      🔍 Method: ${result.metadata.extraction_method}`);
      console.log(`      📝 Answer: ${result.answer.substring(0, 80)}...`);
    });

    sendSSE(res, {
      step: 'research',
      status: 'completed',
      message: `✅ Research completed for ${researchResults.length} questions`,
      progress: 80
    });

    console.log('\n' + '-'.repeat(60));
    console.log('🔍 STEP 4: REVIEWER AGENT');
    console.log('-'.repeat(60));
    
    // Step 4: Reviewer Agent (using automated workflow step for proper database storage)
    sendSSE(res, {
      step: 'reviewer',
      status: 'active',
      message: '🔍 Reviewing research results for conflicts...',
      progress: 85
    });

    const reviewerStepResult = await workflow['executeReviewerStep'](
      claimValidationId,
      researchResults,
      plannerResult.output_data.questions,
      4
    );

    if (reviewerStepResult.status === 'failed') {
      console.log('❌ Reviewer FAILED - stopping workflow');
      sendSSE(res, {
        step: 'reviewer',
        status: 'error',
        message: '❌ Reviewer failed - stopping workflow',
        progress: 90
      });
      throw new Error('Reviewer failed');
    }

    console.log('✅ Reviewer COMPLETED');
    console.log('📊 Review Summary:');
    reviewerStepResult.output_data.forEach((result: any, index: number) => {
      console.log(`   ${index + 1}. ${result.question.substring(0, 60)}...`);
      console.log(`      🎯 Final Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`      🔍 Review Status: ${result.review_status}`);
      console.log(`      ⚠️  Conflicts Detected: ${result.review_analysis.detected_conflicts.length}`);
    });

    sendSSE(res, {
      step: 'reviewer',
      status: 'completed',
      message: `✅ Review completed - ${reviewerStepResult.output_data.length} questions analyzed`,
      progress: 90
    });

    console.log('\n' + '-'.repeat(60));
    console.log('🎯 STEP 5: EVALUATOR AGENT');
    console.log('-'.repeat(60));
    
    // Step 5: Evaluator
    sendSSE(res, {
      step: 'evaluator',
      status: 'active',
      message: '🎯 Making final decision...',
      progress: 95
    });

    const evaluatorResult = await workflow['executeEvaluatorStep'](
      claimValidationId,
      reviewerStepResult.output_data,
      plannerResult.output_data.questions,
      5
    );

    if (evaluatorResult.status === 'failed') {
      console.log('❌ Evaluator FAILED - stopping workflow');
      sendSSE(res, {
        step: 'evaluator',
        status: 'error',
        message: '❌ Evaluator failed',
        progress: 100
      });
      throw new Error('Evaluator failed');
    }

    console.log('✅ Evaluator COMPLETED');
    console.log('📊 Final Decision:', evaluatorResult.output_data.overall_status);
    console.log('🎯 Confidence Level:', evaluatorResult.output_data.confidence);
    console.log('⏱️  Processing Time:', evaluatorResult.output_data.processing_time_ms + 'ms');

    sendSSE(res, {
      step: 'evaluator',
      status: 'completed',
      message: `✅ Final decision: ${evaluatorResult.output_data.overall_status}`,
      progress: 100
    });

    return evaluatorResult.output_data;

  } catch (error) {
    console.error('Validation workflow error:', error);
    sendSSE(res, {
      step: 'error',
      status: 'error',
      message: `❌ Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      progress: 100
    });
    throw error;
  }
}

/**
 * Send Server-Sent Event
 */
function sendSSE(res: express.Response, data: any) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export default router;
