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
    console.log('🚀 Starting claim validation via API');
    console.log('📋 Payload:', JSON.stringify(payload, null, 2));

    // Generate claim ID and store payload immediately
    const claimId = crypto.randomUUID();
    const claimStorageService = new ClaimStorageService();
    
    let claimValidationId: string;
    try {
      claimValidationId = await claimStorageService.storeClaimPayload(claimId, payload);
      console.log('✅ Claim payload stored immediately with ID:', claimValidationId);
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

    console.log('✅ Validation completed via API');
    console.log('📊 Final Status:', result.overall_status);

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
      sendSSE(res, {
        step: 'sanity',
        status: 'error',
        message: '❌ Sanity check failed - stopping workflow',
        progress: 25
      });
      throw new Error('Sanity check failed');
    }

    sendSSE(res, {
      step: 'sanity',
      status: 'completed',
      message: `✅ Sanity check passed - ${sanityResult.output_data.ssp_prediction.specialty}`,
      progress: 25
    });

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
      sendSSE(res, {
        step: 'planner',
        status: 'error',
        message: '❌ Planner failed - stopping workflow',
        progress: 50
      });
      throw new Error('Planner failed');
    }

    const questionCount = plannerResult.output_data?.questions?.length || 0;
    sendSSE(res, {
      step: 'planner',
      status: 'completed',
      message: `✅ Generated ${questionCount} validation questions`,
      progress: 50
    });

    // Step 3: Research (for each question)
    sendSSE(res, {
      step: 'research',
      status: 'active',
      message: `🔬 Researching ${questionCount} questions...`,
      progress: 60
    });

    const researchResults = [];
    const questions = plannerResult.output_data?.questions || [];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      sendSSE(res, {
        step: 'research',
        status: 'active',
        message: `🔬 Researching question ${i + 1}/${questionCount}: ${question.q.substring(0, 50)}...`,
        progress: 60 + (i * 20 / questions.length)
      });

      try {
        const researchResultsArray = await workflow['researchAgent'].executeResearch([question]);
        const researchResult = researchResultsArray[0];
        researchResults.push(researchResult);

        sendSSE(res, {
          step: 'research',
          status: 'active',
          message: `✅ Question ${i + 1} completed (${(researchResult.confidence * 100).toFixed(1)}% confidence)`,
          progress: 60 + ((i + 1) * 20 / questions.length)
        });

      } catch (error) {
        console.error(`Research failed for question ${i + 1}:`, error);
        sendSSE(res, {
          step: 'research',
          status: 'error',
          message: `❌ Research failed for question ${i + 1}`,
          progress: 60 + ((i + 1) * 20 / questions.length)
        });
      }
    }

    sendSSE(res, {
      step: 'research',
      status: 'completed',
      message: `✅ Research completed for ${researchResults.length} questions`,
      progress: 80
    });

    // Step 4: Evaluator
    sendSSE(res, {
      step: 'evaluator',
      status: 'active',
      message: '🎯 Making final decision...',
      progress: 85
    });

    const evaluatorResult = await workflow['executeEvaluatorStep'](
      claimValidationId,
      researchResults,
      questions,
      4
    );

    if (evaluatorResult.status === 'failed') {
      sendSSE(res, {
        step: 'evaluator',
        status: 'error',
        message: '❌ Evaluator failed',
        progress: 90
      });
      throw new Error('Evaluator failed');
    }

    sendSSE(res, {
      step: 'evaluator',
      status: 'completed',
      message: `✅ Final decision: ${evaluatorResult.output_data.overall_status}`,
      progress: 95
    });

    return evaluatorResult.output_data;

  } catch (error) {
    console.error('Validation workflow error:', error);
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
