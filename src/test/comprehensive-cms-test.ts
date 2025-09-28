import { validateClaim } from '../services/cms-ncci-validator';

interface TestCase {
  name: string;
  claim: any;
  expectedErrors: string[];
  expectedWarnings: string[];
  expectedPasses: string[];
}

class ComprehensiveCMSTest {
  private testCases: TestCase[] = [];

  constructor() {
    this.setupTestCases();
  }

  private setupTestCases(): void {
    // Test Case 1: Valid claim
    this.testCases.push({
      name: 'Valid Basic Claim',
      claim: {
        cpt_codes: ['99213'],
        icd10_codes: ['M54.5'],
        modifiers: ['25'],
        place_of_service: '11',
        provider_type: 'practitioner',
        claim_date: '2025-01-15'
      },
      expectedErrors: [],
      expectedWarnings: ['EFFECTIVE_DATE_INVALID', 'NEEDS_POLICY_CHECK'],
      expectedPasses: ['ICD_FORMAT']
    });

    // Test Case 2: Invalid modifier format
    this.testCases.push({
      name: 'Invalid Modifier Format',
      claim: {
        cpt_codes: ['99213'],
        icd10_codes: ['M54.5'],
        modifiers: ['25', 'ABC'], // Invalid modifier
        provider_type: 'practitioner'
      },
      expectedErrors: ['MODIFIER_INVALID'],
      expectedWarnings: ['EFFECTIVE_DATE_INVALID', 'NEEDS_POLICY_CHECK'],
      expectedPasses: ['ICD_FORMAT']
    });

    // Test Case 3: Invalid place of service
    this.testCases.push({
      name: 'Invalid Place of Service',
      claim: {
        cpt_codes: ['99213'],
        icd10_codes: ['M54.5'],
        place_of_service: '999', // Invalid POS
        provider_type: 'practitioner'
      },
      expectedErrors: ['POS_INVALID'],
      expectedWarnings: ['EFFECTIVE_DATE_INVALID', 'NEEDS_POLICY_CHECK'],
      expectedPasses: ['ICD_FORMAT']
    });

    // Test Case 4: Invalid revenue codes
    this.testCases.push({
      name: 'Invalid Revenue Codes',
      claim: {
        cpt_codes: ['99213'],
        icd10_codes: ['M54.5'],
        revenue_codes: ['123', 'ABC'], // Invalid revenue code
        provider_type: 'hospital'
      },
      expectedErrors: ['REVENUE_CODE_INVALID'],
      expectedWarnings: ['EFFECTIVE_DATE_INVALID', 'NEEDS_POLICY_CHECK'],
      expectedPasses: ['ICD_FORMAT']
    });

    // Test Case 5: MUE exceeded
    this.testCases.push({
      name: 'MUE Exceeded',
      claim: {
        cpt_codes: ['J0139'],
        icd10_codes: ['M54.5'],
        units: { 'J0139': 200 }, // Exceeds MUE limit of 160
        provider_type: 'dme'
      },
      expectedErrors: ['MUE_EXCEEDED'],
      expectedWarnings: ['EFFECTIVE_DATE_INVALID', 'NEEDS_POLICY_CHECK'],
      expectedPasses: ['ICD_FORMAT']
    });

    // Test Case 6: PTP conflict without modifier
    this.testCases.push({
      name: 'PTP Conflict Without Modifier',
      claim: {
        cpt_codes: ['0010U', '87513'],
        icd10_codes: ['M54.5'],
        modifiers: [], // No bypass modifier
        provider_type: 'hospital'
      },
      expectedErrors: ['PTP_NEEDS_MODIFIER'],
      expectedWarnings: ['EFFECTIVE_DATE_INVALID', 'NEEDS_POLICY_CHECK'],
      expectedPasses: ['ICD_FORMAT']
    });

    // Test Case 7: PTP conflict with bypass modifier
    this.testCases.push({
      name: 'PTP Conflict With Bypass Modifier',
      claim: {
        cpt_codes: ['0010U', '87513'],
        icd10_codes: ['M54.5'],
        modifiers: ['59'], // Bypass modifier
        provider_type: 'hospital'
      },
      expectedErrors: [],
      expectedWarnings: ['EFFECTIVE_DATE_INVALID', 'NEEDS_POLICY_CHECK'],
      expectedPasses: ['ICD_FORMAT', 'PTP_BYPASSED']
    });

    // Test Case 8: AOC missing primary
    this.testCases.push({
      name: 'AOC Missing Primary',
      claim: {
        cpt_codes: ['0054T'], // Add-on code without primary
        icd10_codes: ['M54.5'],
        provider_type: 'practitioner'
      },
      expectedErrors: ['AOC_PRIMARY_MISSING'],
      expectedWarnings: ['EFFECTIVE_DATE_INVALID', 'NEEDS_POLICY_CHECK'],
      expectedPasses: ['ICD_FORMAT']
    });

    // Test Case 9: Invalid ICD format
    this.testCases.push({
      name: 'Invalid ICD Format',
      claim: {
        cpt_codes: ['99213'],
        icd10_codes: ['M54.5', 'INVALID'], // Invalid ICD
        provider_type: 'practitioner'
      },
      expectedErrors: ['ICD_FORMAT'],
      expectedWarnings: ['EFFECTIVE_DATE_INVALID', 'NEEDS_POLICY_CHECK'],
      expectedPasses: []
    });

    // Test Case 10: Inappropriate modifier combination
    this.testCases.push({
      name: 'Inappropriate Modifier Combination',
      claim: {
        cpt_codes: ['99213'],
        icd10_codes: ['M54.5'],
        modifiers: ['50', '51'], // Conflicting anatomical modifiers
        provider_type: 'practitioner'
      },
      expectedErrors: [],
      expectedWarnings: ['EFFECTIVE_DATE_INVALID', 'MODIFIER_INAPPROPRIATE', 'NEEDS_POLICY_CHECK'],
      expectedPasses: ['ICD_FORMAT']
    });

    // Test Case 11: Provider type specific validation
    this.testCases.push({
      name: 'Hospital Provider Type',
      claim: {
        cpt_codes: ['99213'],
        icd10_codes: ['M54.5'],
        provider_type: 'hospital',
        revenue_codes: ['131'] // Valid revenue code
      },
      expectedErrors: [],
      expectedWarnings: ['EFFECTIVE_DATE_INVALID', 'NEEDS_POLICY_CHECK'],
      expectedPasses: ['ICD_FORMAT']
    });

    // Test Case 12: Inappropriate Modifier 59 on E/M Service
    this.testCases.push({
      name: 'Inappropriate Modifier 59 on E/M Service',
      claim: {
        cpt_codes: ['99213'],
        icd10_codes: ['M54.5'],
        modifiers: ['25', '59'],
        place_of_service: '11',
        provider_type: 'practitioner',
        claim_date: '2025-01-15'
      },
      expectedErrors: [],
      expectedWarnings: ['EFFECTIVE_DATE_INVALID', 'NEEDS_POLICY_CHECK'],
      expectedPasses: ['ICD_FORMAT']
    });

    // Test Case 13: Complex claim with multiple validations
    this.testCases.push({
      name: 'Complex Valid Claim',
      claim: {
        cpt_codes: ['99213', '36415'],
        icd10_codes: ['M54.5', 'G89.29'],
        modifiers: ['25', '59'],
        place_of_service: '11',
        provider_type: 'practitioner',
        claim_date: '2025-01-15',
        units: { '99213': 1, '36415': 1 }
      },
      expectedErrors: [],
      expectedWarnings: ['EFFECTIVE_DATE_INVALID', 'NEEDS_POLICY_CHECK'],
      expectedPasses: ['ICD_FORMAT']
    });
  }

  async runTests(): Promise<void> {
    console.log('\n🧪 Running Comprehensive CMS/NCCI Validation Tests...\n');

    let passedTests = 0;
    let totalTests = this.testCases.length;

    for (const testCase of this.testCases) {
      console.log(`\n📋 Test: ${testCase.name}`);
      
      try {
        const result = await validateClaim(testCase.claim);
        
        // Check errors
        const actualErrorTypes = result.errors.map(e => e.type);
        const expectedErrorTypes = testCase.expectedErrors;
        const errorMatch = this.arraysEqual(actualErrorTypes.sort(), expectedErrorTypes.sort());
        
        // Check warnings
        const actualWarningTypes = result.warnings.map(w => w.type);
        const expectedWarningTypes = testCase.expectedWarnings;
        const warningMatch = this.arraysEqual(actualWarningTypes.sort(), expectedWarningTypes.sort());
        
        // Check passes
        const actualPassTypes = result.passes.map(p => p.type);
        const expectedPassTypes = testCase.expectedPasses;
        const passMatch = this.arraysEqual(actualPassTypes.sort(), expectedPassTypes.sort());
        
        if (errorMatch && warningMatch && passMatch) {
          console.log('   ✅ PASSED');
          passedTests++;
        } else {
          console.log('   ❌ FAILED');
          console.log(`   Expected Errors: ${expectedErrorTypes.join(', ')}`);
          console.log(`   Actual Errors: ${actualErrorTypes.join(', ')}`);
          console.log(`   Expected Warnings: ${expectedWarningTypes.join(', ')}`);
          console.log(`   Actual Warnings: ${actualWarningTypes.join(', ')}`);
          console.log(`   Expected Passes: ${expectedPassTypes.join(', ')}`);
          console.log(`   Actual Passes: ${actualPassTypes.join(', ')}`);
        }
        
        // Show detailed results
        console.log(`   Valid: ${result.is_valid}, Risk Score: ${result.risk_score}`);
        if (result.errors.length > 0) {
          console.log('   Errors:');
          result.errors.forEach(e => console.log(`     - ${e.message}`));
        }
        if (result.warnings.length > 0) {
          console.log('   Warnings:');
          result.warnings.forEach(w => console.log(`     - ${w.message}`));
        }
        if (result.passes.length > 0) {
          console.log('   Passes:');
          result.passes.forEach(p => console.log(`     - ${p.message}`));
        }
        
      } catch (error) {
        console.log('   ❌ ERROR:', error);
      }
    }

    console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (passedTests === totalTests) {
      console.log('\n🎉 All tests passed! CMS/NCCI validation is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Review the implementation.');
    }
  }

  private arraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((val, index) => val === b[index]);
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new ComprehensiveCMSTest();
  tester.runTests().catch(console.error);
}

export { ComprehensiveCMSTest };
