import express from 'express';
import { validateClaimPayload, rateLimit } from '../middleware/validation';
import { ClaimValidationRequest, ClaimPayload, ApiResponse } from '../types/claim-types';
import { ValidationWorkflow } from '../services/validation-workflow';
import { EvaluationResult } from '../agents/evaluate-agent';

const router = express.Router();

// Initialize validation workflow
const validationWorkflow = new ValidationWorkflow();

/**
 * POST /api/claims/validate
 * Validate a medical claim using the complete multi-agent workflow
 */
router.post('/validate', rateLimit(50, 60000), validateClaimPayload, async (req, res) => {
  try {
    const request: ClaimValidationRequest = req.body;
    const payload: ClaimPayload = request.payload;
    
    console.log(`Processing claim for payer ${payload.payer}`);
    
    // Execute the complete validation workflow
    const result: EvaluationResult = await validationWorkflow.validateClaim(payload);
    
    console.log(`Claim ${result.claim_id} processed in ${result.processing_time_ms}ms`);
    console.log(`Final status: ${result.overall_status}`);
    
    const apiResponse: ApiResponse<EvaluationResult> = {
      success: true,
      data: result,
      message: 'Claim validation completed successfully',
    };
    
    res.json(apiResponse);
    
  } catch (error) {
    console.error('Claim validation error:', error);
    
    const apiResponse: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Claim validation failed',
    };
    
    res.status(500).json(apiResponse);
  }
});

/**
 * GET /api/claims/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Claims API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

/**
 * GET /api/claims/specialty/:cpt/:icd
 * Get specialty prediction for specific codes
 */
router.get('/specialty/:cpt/:icd', rateLimit(100, 60000), async (req, res) => {
  try {
    const { cpt, icd } = req.params;
    
    const mockPayload: ClaimPayload = {
      cpt_codes: [cpt],
      icd10_codes: [icd],
      note_summary: 'Test claim for specialty prediction',
      payer: 'Test',
    };
    
    // TODO: Implement SSP agent or remove this endpoint
    const sspResult = {
      specialty: 'General Practice',
      subspecialty: 'Primary Care',
      confidence: 'medium' as const,
      rationale: 'Test specialty prediction',
      derived: {
        cpt_codes: [cpt],
        icd10_codes: [icd],
        place_of_service: '11',
        member_plan_type: 'HMO',
        state: 'CA'
      }
    };
    
    const apiResponse: ApiResponse<any> = {
      success: true,
      data: sspResult,
      message: 'Specialty prediction completed',
    };
    
    res.json(apiResponse);
    
  } catch (error) {
    console.error('Specialty prediction error:', error);
    
    const apiResponse: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Specialty prediction failed',
    };
    
    res.status(500).json(apiResponse);
  }
});

export default router;
