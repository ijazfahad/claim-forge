"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const validation_1 = require("../middleware/validation");
const validation_workflow_1 = require("../services/validation-workflow");
const router = express_1.default.Router();
const validationWorkflow = new validation_workflow_1.ValidationWorkflow();
router.post('/validate', (0, validation_1.rateLimit)(50, 60000), validation_1.validateClaimPayload, async (req, res) => {
    try {
        const request = req.body;
        const payload = request.payload;
        console.log(`Processing claim for payer ${payload.payer}`);
        const result = await validationWorkflow.validateClaim(payload);
        console.log(`Claim ${result.claim_id} processed in ${result.processing_time_ms}ms`);
        console.log(`Final status: ${result.overall_status}`);
        const apiResponse = {
            success: true,
            data: result,
            message: 'Claim validation completed successfully',
        };
        res.json(apiResponse);
    }
    catch (error) {
        console.error('Claim validation error:', error);
        const apiResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            message: 'Claim validation failed',
        };
        res.status(500).json(apiResponse);
    }
});
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Claims API is healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});
router.get('/specialty/:cpt/:icd', (0, validation_1.rateLimit)(100, 60000), async (req, res) => {
    try {
        const { cpt, icd } = req.params;
        const mockPayload = {
            cpt_codes: [cpt],
            icd10_codes: [icd],
            note_summary: 'Test claim for specialty prediction',
            payer: 'Test',
        };
        const sspResult = {
            specialty: 'General Practice',
            subspecialty: 'Primary Care',
            confidence: 'medium',
            rationale: 'Test specialty prediction',
            derived: {
                cpt_codes: [cpt],
                icd10_codes: [icd],
                place_of_service: '11',
                member_plan_type: 'HMO',
                state: 'CA'
            }
        };
        const apiResponse = {
            success: true,
            data: sspResult,
            message: 'Specialty prediction completed',
        };
        res.json(apiResponse);
    }
    catch (error) {
        console.error('Specialty prediction error:', error);
        const apiResponse = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            message: 'Specialty prediction failed',
        };
        res.status(500).json(apiResponse);
    }
});
exports.default = router;
//# sourceMappingURL=claims.js.map