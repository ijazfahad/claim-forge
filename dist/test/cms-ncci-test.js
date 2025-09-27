"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testCMSNCCI = testCMSNCCI;
const dotenv_1 = __importDefault(require("dotenv"));
const cms_ncci_validator_1 = require("../services/cms-ncci-validator");
dotenv_1.default.config();
async function testCMSNCCI() {
    console.log('🧪 Testing CMS/NCCI Integration...\n');
    try {
        console.log('1. Checking database status...');
        if (!(await (0, cms_ncci_validator_1.isDatabaseBuilt)())) {
            console.log('   Database not found. Building...');
            await (0, cms_ncci_validator_1.buildLatest)({ verbose: true });
            console.log('   ✅ Database built successfully');
        }
        else {
            console.log('   ✅ Database already exists');
        }
        console.log('\n2. Testing claim validation...');
        const sampleClaim = {
            cpt_codes: ['99213', '99214'],
            icd10_codes: ['M54.5', 'G89.29'],
            modifiers: ['25'],
            place_of_service: '11',
            note_summary: 'Office visit for back pain'
        };
        const result = await (0, cms_ncci_validator_1.validateClaim)(sampleClaim);
        console.log('   Sample Claim:', JSON.stringify(sampleClaim, null, 2));
        console.log('   Validation Result:');
        console.log('   - Valid:', result.is_valid);
        console.log('   - Risk Score:', result.risk_score);
        console.log('   - Errors:', result.errors.length);
        console.log('   - Warnings:', result.warnings.length);
        console.log('   - Passes:', result.passes.length);
        if (result.errors.length > 0) {
            console.log('\n   ❌ Errors found:');
            result.errors.forEach(error => {
                console.log(`     - ${error.type}: ${error.message}`);
            });
        }
        if (result.warnings.length > 0) {
            console.log('\n   ⚠️  Warnings:');
            result.warnings.forEach(warning => {
                console.log(`     - ${warning.type}: ${warning.message}`);
            });
        }
        if (result.passes.length > 0) {
            console.log('\n   ✅ Passes:');
            result.passes.forEach(pass => {
                console.log(`     - ${pass.type}: ${pass.message}`);
            });
        }
        console.log('\n3. Testing with potentially problematic codes...');
        const problematicClaim = {
            cpt_codes: ['64635', '64636'],
            icd10_codes: ['M54.5'],
            modifiers: [],
            place_of_service: '11',
            note_summary: 'Radiofrequency ablation procedure'
        };
        const problematicResult = await (0, cms_ncci_validator_1.validateClaim)(problematicClaim);
        console.log('   Problematic Claim Result:');
        console.log('   - Valid:', problematicResult.is_valid);
        console.log('   - Risk Score:', problematicResult.risk_score);
        console.log('   - Errors:', problematicResult.errors.length);
        console.log('\n✅ CMS/NCCI integration test completed successfully!');
    }
    catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    testCMSNCCI();
}
//# sourceMappingURL=cms-ncci-test.js.map