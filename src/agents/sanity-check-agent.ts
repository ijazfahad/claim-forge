import { BaseAgent } from './base-agent';
import { Agent } from '@openai/agents';
import { ClaimPayload } from '../types/claim-types';
import { CMSNCCIService, ValidationIssue } from '../services/cms-ncci-service';
import { validateClaim, isDatabaseBuilt, buildLatest, ValidationResult } from '../services/cms-ncci-validator';

export interface SanityCheckResult {
  is_valid: boolean;
  sanitized_payload: ClaimPayload;
  ssp_prediction: {
    specialty: string;
    subspecialty: string;
    confidence: 'low' | 'medium' | 'high';
  };
  issues: string[];
  warnings: string[];
  cms_ncci_checks: {
    bundling_issues: string[];
    modifier_requirements: string[];
    frequency_limits: string[];
  };
  ai_clinical_validation: {
    overall_appropriate: boolean;
    specialty: string;
    subspecialty: string;
    cpt_validation: Array<{
      code: string;
      appropriate: boolean;
      confidence: string;
      reasoning: string;
      suggested_code?: string;
    }>;
    icd_validation: Array<{
      code: string;
      appropriate: boolean;
      confidence: string;
      reasoning: string;
      suggested_code?: string;
    }>;
    modifier_validation: Array<{
      code: string;
      appropriate: boolean;
      confidence: string;
      reasoning: string;
      suggested_code?: string;
    }>;
    place_of_service_validation: {
      code: string;
      appropriate: boolean;
      confidence: string;
      reasoning: string;
      suggested_code?: string;
    };
    clinical_concerns: string[];
    documentation_quality: string;
    recommendations: string[];
  };
  policy_check_required: boolean;
  policy_check_details: any;
  validation_issues: ValidationIssue[];
  cms_ncci_validation: ValidationResult;
}

export class SanityCheckAgent extends BaseAgent {
  private agent: Agent | null = null;
  private cmsNCCIService: CMSNCCIService;

  constructor() {
    super();
    this.cmsNCCIService = new CMSNCCIService();
  }

  /**
   * Initialize the Sanity Check agent
   */
  async initialize(): Promise<void> {
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

    const tools: any[] = [];

    this.agent = this.createAgent('Sanity Check Agent', instructions, tools);
  }

  /**
   * Perform sanity check on claim payload
   */
  async performSanityCheck(payload: ClaimPayload): Promise<SanityCheckResult> {
    console.log(`\n🔍 SANITY CHECK STARTING:`);
    console.log(`   📋 Claim Details:`);
    console.log(`      🏥 Payer: ${payload.payer}`);
    console.log(`      🔢 CPT Codes: ${payload.cpt_codes.join(', ')}`);
    console.log(`      📊 ICD-10 Codes: ${payload.icd10_codes.join(', ')}`);
    console.log(`      🏷️  Modifiers: ${payload.modifiers && payload.modifiers.length > 0 ? payload.modifiers.join(', ') : 'None'}`);
    console.log(`      📍 Place of Service: ${payload.place_of_service}`);
    console.log(`      🗺️  State: ${payload.state}`);
    
    if (!this.agent) {
      await this.initialize();
    }

    // Cache disabled - Redis removed

    // Step 1: AI Clinical Validation
    console.log(`\n   🧠 AI Clinical Validation:`);
    const aiClinicalValidation = await this.performAIClinicalValidation(payload);
    console.log(`      ✅ Overall Appropriate: ${aiClinicalValidation.overall_appropriate ? 'Yes' : 'No'}`);
    console.log(`      🏥 Specialty: ${aiClinicalValidation.specialty}`);
    console.log(`      🔬 Subspecialty: ${aiClinicalValidation.subspecialty}`);
    console.log(`      📝 Documentation Quality: ${aiClinicalValidation.documentation_quality}`);
    
    if (aiClinicalValidation.cpt_validation?.length > 0) {
      console.log(`      🔍 CPT Validation:`);
      aiClinicalValidation.cpt_validation.forEach((cpt, index) => {
        console.log(`         ${index + 1}. ${cpt.code}: ${cpt.appropriate ? '✅ Appropriate' : '❌ Inappropriate'} (${cpt.confidence})`);
      });
    }
    
    if (aiClinicalValidation.clinical_concerns?.length > 0) {
      console.log(`      ⚠️  Clinical Concerns:`);
      aiClinicalValidation.clinical_concerns.forEach((concern, index) => {
        console.log(`         ${index + 1}. ${concern}`);
      });
    }

    // Step 2: CMS/NCCI Rules Validation
    console.log(`\n   📊 CMS/NCCI Rules Validation:`);
    let cmsNcciValidation: ValidationResult;
    try {
      // Retry database connection up to 3 times
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          if (!(await isDatabaseBuilt())) {
            retryCount++;
            if (retryCount < maxRetries) {
              console.log(`      🔄 Database connection failed, retrying... (${retryCount}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
              continue;
            } else {
              console.log('      ❌ CMS/NCCI database connection failed after retries. Please check database connectivity.');
              throw new Error('CMS/NCCI database connection failed after retries. Check database connectivity.');
            }
          }
          break;
        } catch (dbError) {
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`      🔄 Database connection error, retrying... (${retryCount}/${maxRetries}):`, dbError);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            continue;
          } else {
            throw dbError;
          }
        }
      }
      
      console.log(`      🔍 Validating claim against CMS/NCCI rules...`);
      cmsNcciValidation = await validateClaim({
        cpt_codes: payload.cpt_codes,
        icd10_codes: payload.icd10_codes,
        modifiers: payload.modifiers,
        place_of_service: payload.place_of_service,
        note_summary: payload.note_summary
      });
      
      console.log(`      📊 CMS/NCCI Results:`);
      console.log(`         ✅ Valid: ${cmsNcciValidation.is_valid ? 'Yes' : 'No'}`);
      console.log(`         ⚠️  Risk Score: ${cmsNcciValidation.risk_score}/100`);
      console.log(`         ❌ Errors: ${cmsNcciValidation.errors.length}`);
      console.log(`         ⚠️  Warnings: ${cmsNcciValidation.warnings.length}`);
      console.log(`         ✅ Passes: ${cmsNcciValidation.passes.length}`);
      
      if (cmsNcciValidation.errors.length > 0) {
        console.log(`         🔍 Error Details:`);
        cmsNcciValidation.errors.forEach((error, index) => {
          console.log(`            ${index + 1}. [${error.type}] ${error.message}`);
        });
      }
      
      if (cmsNcciValidation.warnings.length > 0) {
        console.log(`         ⚠️  Warning Details:`);
        cmsNcciValidation.warnings.forEach((warning, index) => {
          console.log(`            ${index + 1}. [${warning.type}] ${warning.message}`);
        });
      }
      
      if (cmsNcciValidation.passes.length > 0) {
        console.log(`         ✅ Pass Details:`);
        cmsNcciValidation.passes.forEach((pass, index) => {
          console.log(`            ${index + 1}. [${pass.type}] ${pass.message}`);
        });
      }
      
    } catch (error) {
      console.error('      ❌ CMS/NCCI validation failed:', error);
      // Fallback to basic validation
      cmsNcciValidation = {
        errors: [{ type: 'NEEDS_POLICY_CHECK', message: 'CMS/NCCI validation unavailable' }],
        warnings: [],
        passes: [],
        is_valid: false,
        risk_score: 50
      };
    }

    // Also perform legacy validation for compatibility
    const validationIssues = await this.cmsNCCIService.validateClaim(payload);

    const sanityResult: SanityCheckResult = {
      is_valid: cmsNcciValidation.is_valid && aiClinicalValidation.overall_appropriate,
      sanitized_payload: payload,
      ssp_prediction: {
        specialty: aiClinicalValidation.specialty,
        subspecialty: aiClinicalValidation.subspecialty,
        confidence: 'medium'
      },
      issues: cmsNcciValidation.errors.map(e => e.message),
      warnings: cmsNcciValidation.warnings.map(w => w.message),
      cms_ncci_checks: {
        bundling_issues: cmsNcciValidation.errors.filter(e => e.type.includes('PTP')).map(e => e.message),
        modifier_requirements: cmsNcciValidation.errors.filter(e => e.type.includes('MODIFIER')).map(e => e.message),
        frequency_limits: cmsNcciValidation.errors.filter(e => e.type.includes('MUE')).map(e => e.message)
      },
      ai_clinical_validation: aiClinicalValidation,
      policy_check_required: cmsNcciValidation.warnings.some(w => w.type === 'NEEDS_POLICY_CHECK'),
      policy_check_details: cmsNcciValidation.warnings.find(w => w.type === 'NEEDS_POLICY_CHECK')?.data || null,
      validation_issues: validationIssues,
      cms_ncci_validation: cmsNcciValidation
    };

    // Log final sanity check summary
    console.log(`\n   📋 SANITY CHECK SUMMARY:`);
    console.log(`      ✅ Overall Valid: ${sanityResult.is_valid ? 'Yes' : 'No'}`);
    console.log(`      🏥 Specialty Prediction: ${sanityResult.ssp_prediction.specialty} / ${sanityResult.ssp_prediction.subspecialty}`);
    console.log(`      📊 Policy Check Required: ${sanityResult.policy_check_required ? 'Yes' : 'No'}`);
    console.log(`      ❌ Issues Found: ${sanityResult.issues.length}`);
    console.log(`      ⚠️  Warnings: ${sanityResult.warnings.length}`);
    
    if (sanityResult.issues.length > 0) {
      console.log(`      🔍 Issues:`);
      sanityResult.issues.forEach((issue, index) => {
        console.log(`         ${index + 1}. ${issue}`);
      });
    }
    
    if (sanityResult.warnings.length > 0) {
      console.log(`      ⚠️  Warnings:`);
      sanityResult.warnings.forEach((warning, index) => {
        console.log(`         ${index + 1}. ${warning}`);
      });
    }
    
    if (sanityResult.policy_check_required) {
      console.log(`      📋 Policy Check Details:`);
      console.log(`         Research Questions: ${sanityResult.policy_check_details?.research_questions?.length || 0}`);
      console.log(`         Validation Types: ${sanityResult.policy_check_details?.validation_types?.join(', ') || 'N/A'}`);
    }
    
    console.log(`\n✅ SANITY CHECK COMPLETE\n`);

      // Cache disabled - Redis removed

    return sanityResult;
  }

  /**
   * Perform AI-powered clinical validation
   */
  private async performAIClinicalValidation(payload: ClaimPayload): Promise<{
    overall_appropriate: boolean;
    cpt_validation: Array<{
      code: string;
      appropriate: boolean;
      confidence: string;
      reasoning: string;
      suggested_code?: string;
    }>;
    icd_validation: Array<{
      code: string;
      appropriate: boolean;
      confidence: string;
      reasoning: string;
      suggested_code?: string;
    }>;
    modifier_validation: Array<{
      code: string;
      appropriate: boolean;
      confidence: string;
      reasoning: string;
      suggested_code?: string;
    }>;
    place_of_service_validation: {
      code: string;
      appropriate: boolean;
      confidence: string;
      reasoning: string;
      suggested_code?: string;
    };
    clinical_concerns: string[];
    documentation_quality: string;
    recommendations: string[];
  } & {
    specialty: string;
    subspecialty: string;
  }> {
    if (!payload.note_summary || payload.note_summary.trim() === '') {
      return {
        overall_appropriate: false,
        specialty: 'Unknown',
        subspecialty: 'Unknown',
        cpt_validation: payload.cpt_codes.map(code => ({
          code,
          appropriate: false,
          confidence: 'low',
          reasoning: 'No clinical documentation provided'
        })),
        icd_validation: payload.icd10_codes.map(code => ({
          code,
          appropriate: false,
          confidence: 'low',
          reasoning: 'No clinical documentation provided'
        })),
        modifier_validation: (payload.modifiers || []).map(code => ({
          code,
          appropriate: false,
          confidence: 'low',
          reasoning: 'No clinical documentation provided'
        })),
        place_of_service_validation: {
          code: payload.place_of_service || 'Not specified',
          appropriate: false,
          confidence: 'low',
          reasoning: 'No clinical documentation provided'
        },
        clinical_concerns: ['Missing clinical documentation'],
        documentation_quality: 'poor',
        recommendations: ['Provide clinical documentation for validation']
      };
    }

    try {
      // Use OpenRouter instead of direct OpenAI

      const prompt = `
You are a senior insurance claim validator inspecting claims for a small one to two doctor clinic. 

CLAIM CONTEXT:
- Payer: ${payload.payer}
- CPT codes: ${payload.cpt_codes.join(', ')}
- ICD-10 codes: ${payload.icd10_codes.join(', ')}
- Place of Service: ${payload.place_of_service || 'Not specified'}
- Modifiers: ${(payload.modifiers || []).join(', ') || 'None'}
- Clinical Note: ${payload.note_summary}

Evaluate all the CPT codes, ICD-10 codes, Place of Service (POS), note summary, and modifiers to see if they look correct, plausible, and correspond to the doctor's note. Evaluate all the codes and check if they are correct or not, providing suggestions for any incorrect ICD-10 codes, CPT codes, place of service and modifiers.

Also predict the medical specialty and subspecialty based on the CPT codes, ICD-10 codes, and clinical context.

Respond with ONLY valid JSON (no markdown, no explanations, no unescaped quotes):
{
  "overall_appropriate": boolean,
  "specialty": "string",
  "subspecialty": "string",
  "cpt_validation": [{"code": "string", "appropriate": boolean, "confidence": "low|medium|high", "reasoning": "string", "suggested_code": "string|null"}],
  "icd_validation": [{"code": "string", "appropriate": boolean, "confidence": "low|medium|high", "reasoning": "string", "suggested_code": "string|null"}],
  "modifier_validation": [{"code": "string", "appropriate": boolean, "confidence": "low|medium|high", "reasoning": "string", "suggested_code": "string|null"}],
  "place_of_service_validation": {"code": "string", "appropriate": boolean, "confidence": "low|medium|high", "reasoning": "string", "suggested_code": "string|null"},
  "clinical_concerns": ["string"],
  "documentation_quality": "poor|adequate|good|excellent",
  "recommendations": ["string"]
}

CRITICAL: Ensure all quotes in reasoning and recommendation strings are properly escaped. Use \\" for quotes within strings.

Focus on:
1. Does the documentation support the level of service billed?
2. Are the diagnoses supported by clinical findings?
3. Is there medical necessity for the services?
4. Are the codes appropriate for the documented care?
5. Are the modifiers appropriate and supported by the documentation?
6. Do the modifiers correctly describe the circumstances of the service?
7. Is the Place of Service (POS) appropriate for the services rendered?
8. Does the POS code match the location where services were actually provided?

COMMON POS CODES:
- 11: Office
- 21: Inpatient Hospital
- 22: Outpatient Hospital
- 23: Emergency Room
- 31: Skilled Nursing Facility
- 32: Nursing Facility
- 33: Custodial Care Facility
- 81: Independent Laboratory

MODIFIER VALIDATION GUIDELINES:
- Evaluate if modifiers are appropriate for the specific CPT codes being billed
- Check if modifiers match the clinical circumstances described in the documentation
- Ensure modifiers are used according to standard medical coding practices
- If any modifier appears inappropriate for the service, mark it as such
`;

      const response = await this.openRouter.generateResponse(
        prompt,
        process.env.SANITY_CHECK_MODEL || 'gpt-4o-mini',
        {
          temperature: parseFloat(process.env.SANITY_CHECK_TEMPERATURE || '0.1'),
          max_tokens: parseInt(process.env.SANITY_CHECK_MAX_TOKENS || '3000'),
          system_prompt: 'You are a medical coding expert with deep knowledge of CPT and ICD-10 coding guidelines, medical necessity, and clinical documentation requirements. Always respond with valid JSON only, no markdown formatting.'
        }
      );

      let aiAnalysis;
      try {
        // Clean the response to extract JSON
        let responseText = response || '{}';
        
        // Remove markdown code blocks if present
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        
        // Find JSON object boundaries
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}') + 1;
        
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          responseText = responseText.substring(jsonStart, jsonEnd);
        }
        
        // Fix common JSON issues - more robust approach
        try {
          // First try to parse as-is
          aiAnalysis = JSON.parse(responseText);
        } catch (firstError) {
          // If that fails, try to fix common issues
          let fixedText = responseText;
          
          // Fix unescaped quotes in string values
          fixedText = fixedText.replace(/"([^"]*)"([^"]*)"([^"]*)":/g, '"$1\\"$2\\"$3":');
          fixedText = fixedText.replace(/"([^"]*)"([^"]*)"([^"]*)",/g, '"$1\\"$2\\"$3",');
          fixedText = fixedText.replace(/"([^"]*)"([^"]*)"([^"]*)"}/g, '"$1\\"$2\\"$3"}');
          
          // Try parsing the fixed version
          try {
            aiAnalysis = JSON.parse(fixedText);
          } catch (secondError) {
            // If still failing, try a more aggressive fix
            fixedText = responseText.replace(/"/g, '\\"').replace(/\\\\"/g, '"');
            aiAnalysis = JSON.parse(fixedText);
          }
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Raw response:', response);
        throw new Error('Failed to parse AI response as JSON');
      }

      return aiAnalysis;

    } catch (error) {
      console.error('AI clinical validation error:', error);
      // Fallback to basic validation
      return {
        overall_appropriate: false,
        specialty: 'Unknown',
        subspecialty: 'Unknown',
        cpt_validation: payload.cpt_codes.map(code => ({
          code,
          appropriate: false,
          confidence: 'low',
          reasoning: 'AI validation unavailable'
        })),
        icd_validation: payload.icd10_codes.map(code => ({
          code,
          appropriate: false,
          confidence: 'low',
          reasoning: 'AI validation unavailable'
        })),
        modifier_validation: (payload.modifiers || []).map(code => ({
          code,
          appropriate: false,
          confidence: 'low',
          reasoning: 'AI validation unavailable'
        })),
        place_of_service_validation: {
          code: payload.place_of_service || 'Not specified',
          appropriate: false,
          confidence: 'low',
          reasoning: 'AI validation unavailable'
        },
        clinical_concerns: ['AI clinical validation failed'],
        documentation_quality: 'unknown',
        recommendations: ['Manual review recommended']
      };
    }
  }

  /**
   * Validate CPT code format
   */
  private validateCPTCode(code: string): boolean {
    return /^\d{5}$/.test(code);
  }

  /**
   * Validate ICD-10 code format
   */
  private validateICD10Code(code: string): boolean {
    return /^[A-Z]\d{2}(\.\d{1,3})?$/.test(code);
  }

  /**
   * Check CMS/NCCI bundling rules
   */
  private async checkBundlingRules(cptCodes: string[]): Promise<string[]> {
    // This would integrate with actual CMS/NCCI database
    // For now, return empty array
    return [];
  }
}
