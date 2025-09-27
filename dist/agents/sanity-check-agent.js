"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SanityCheckAgent = void 0;
const base_agent_1 = require("./base-agent");
const cms_ncci_service_1 = require("../services/cms-ncci-service");
const cms_ncci_validator_1 = require("../services/cms-ncci-validator");
class SanityCheckAgent extends base_agent_1.BaseAgent {
    constructor() {
        super();
        this.agent = null;
        this.cmsNCCIService = new cms_ncci_service_1.CMSNCCIService();
    }
    async initialize() {
        const instructions = `
You are a Sanity Check Agent for medical claim validation.

Your task is to perform initial validation of medical claims:

1. **Code Validation**:
   - Validate CPT code formats (5 digits)
   - Validate ICD-10 code formats (A-Z followed by digits)
   - Check code compatibility and relationships
   - Verify codes exist in current coding systems

2. **CMS/NCCI Rules Check**:
   - Check bundling rules and conflicts
   - Verify modifier requirements
   - Check frequency limits
   - Identify NCCI edits

3. **Basic Specialty Prediction**:
   - Predict specialty from CPT/ICD combinations
   - Predict subspecialty when possible
   - Provide confidence levels

4. **Basic Validation**:
   - Check for obvious errors
   - Validate required fields
   - Flag potential issues

Rules:
- Be strict with code validation
- Flag all potential issues
- Provide clear error messages
- Use static CMS/NCCI rules database
- Cache results for similar code combinations

Output Format:
{
  "is_valid": boolean,
  "sanitized_payload": {...},
  "ssp_prediction": {
    "specialty": "string",
    "subspecialty": "string", 
    "confidence": "low|medium|high"
  },
  "issues": ["string"],
  "warnings": ["string"],
  "cms_ncci_checks": {
    "bundling_issues": ["string"],
    "modifier_requirements": ["string"],
    "frequency_limits": ["string"]
  }
}
`;
        const tools = [
            this.createCacheTool(),
            this.createGetCacheTool(),
        ];
        this.agent = this.createAgent('Sanity Check Agent', instructions, tools);
    }
    async performSanityCheck(payload) {
        if (!this.agent) {
            await this.initialize();
        }
        const cacheKey = `sanity:${payload.cpt_codes.join(',')}:${payload.icd10_codes.join(',')}`;
        const cached = await this.redis.redis.get(cacheKey);
        if (cached) {
            const cachedResult = JSON.parse(cached);
            const validationIssues = await this.cmsNCCIService.validateClaim(payload);
            cachedResult.validation_issues = validationIssues;
            return cachedResult;
        }
        let cmsNcciValidation;
        try {
            if (!(await (0, cms_ncci_validator_1.isDatabaseBuilt)())) {
                console.log('CMS/NCCI database not found. Building...');
                await (0, cms_ncci_validator_1.buildLatest)({ verbose: true });
            }
            cmsNcciValidation = await (0, cms_ncci_validator_1.validateClaim)({
                cpt_codes: payload.cpt_codes,
                icd10_codes: payload.icd10_codes,
                modifiers: payload.modifiers,
                place_of_service: payload.place_of_service,
                note_summary: payload.note_summary
            });
        }
        catch (error) {
            console.error('CMS/NCCI validation failed:', error);
            cmsNcciValidation = {
                errors: [{ type: 'NEEDS_POLICY_CHECK', message: 'CMS/NCCI validation unavailable' }],
                warnings: [],
                passes: [],
                is_valid: false,
                risk_score: 50
            };
        }
        const validationIssues = await this.cmsNCCIService.validateClaim(payload);
        const input = `
Perform sanity check on this medical claim payload:

Claim Payload:
- CPT Codes: ${payload.cpt_codes.join(', ')}
- ICD-10 Codes: ${payload.icd10_codes.join(', ')}
- Notes: ${payload.note_summary}
- Payer: ${payload.payer}
- Place of Service: ${payload.place_of_service || 'Not specified'}
- State: ${payload.state || 'Not specified'}

CMS/NCCI VALIDATION RESULTS:
${JSON.stringify(cmsNcciValidation, null, 2)}

LEGACY VALIDATION ISSUES:
${JSON.stringify(validationIssues, null, 2)}

Please validate:
1. Code formats and compatibility
2. CMS/NCCI bundling rules (already checked above)
3. Modifier requirements
4. Frequency limits
5. Basic specialty prediction
6. Overall claim validity

Use the CMS/NCCI validation results and provide detailed analysis.
`;
        const sanityResult = {
            is_valid: cmsNcciValidation.is_valid,
            sanitized_payload: payload,
            ssp_prediction: {
                specialty: 'General Practice',
                subspecialty: 'Primary Care',
                confidence: 'medium'
            },
            issues: cmsNcciValidation.errors.map(e => e.message),
            warnings: cmsNcciValidation.warnings.map(w => w.message),
            cms_ncci_checks: {
                bundling_issues: cmsNcciValidation.errors.filter(e => e.type.includes('PTP')).map(e => e.message),
                modifier_requirements: cmsNcciValidation.errors.filter(e => e.type.includes('MODIFIER')).map(e => e.message),
                frequency_limits: cmsNcciValidation.errors.filter(e => e.type.includes('MUE')).map(e => e.message)
            },
            validation_issues: validationIssues,
            cms_ncci_validation: cmsNcciValidation
        };
        await this.redis.redis.setex(cacheKey, 3600, JSON.stringify(sanityResult));
        return sanityResult;
    }
    validateCPTCode(code) {
        return /^\d{5}$/.test(code);
    }
    validateICD10Code(code) {
        return /^[A-Z]\d{2}(\.\d{1,3})?$/.test(code);
    }
    async checkBundlingRules(cptCodes) {
        return [];
    }
}
exports.SanityCheckAgent = SanityCheckAgent;
//# sourceMappingURL=sanity-check-agent.js.map