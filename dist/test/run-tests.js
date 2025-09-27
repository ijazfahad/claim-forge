#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const test_workflow_1 = require("./test-workflow");
dotenv_1.default.config();
async function main() {
    console.log('🔧 Environment Check');
    console.log('='.repeat(50));
    const requiredEnvVars = [
        'OPENAI_API_KEY',
        'GOOGLE_SEARCH_API_KEY',
        'GOOGLE_SEARCH_ENGINE_ID',
        'FIRECRAWL_API_KEY',
        'FIRECRAWL_API_URL',
        'REDIS_URL'
    ];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        console.error('❌ Missing required environment variables:');
        missingVars.forEach(varName => {
            console.error(`   - ${varName}`);
        });
        console.error('\nPlease check your .env file and ensure all required variables are set.');
        process.exit(1);
    }
    console.log('✅ All required environment variables are set');
    console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'Set' : 'Missing'}`);
    console.log(`🔍 Google Search: ${process.env.GOOGLE_SEARCH_API_KEY ? 'Set' : 'Missing'}`);
    console.log(`🕷️ Firecrawl: ${process.env.FIRECRAWL_API_KEY ? 'Set' : 'Missing'}`);
    console.log(`📦 Redis: ${process.env.REDIS_URL ? 'Set' : 'Missing'}`);
    console.log('\n🚀 Starting ClaimForge Validation Tests');
    console.log('='.repeat(50));
    try {
        const results = await (0, test_workflow_1.runAllTests)();
        const passed = results.filter(r => r.status === 'PASS').length;
        const failed = results.filter(r => r.status === 'FAIL').length;
        if (failed === 0) {
            console.log('\n🎉 All tests passed! The workflow is working correctly.');
            process.exit(0);
        }
        else {
            console.log(`\n⚠️  ${failed} test(s) failed. Please review the output above.`);
            process.exit(1);
        }
    }
    catch (error) {
        console.error('\n💥 Test suite crashed:', error);
        process.exit(1);
    }
}
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
main();
//# sourceMappingURL=run-tests.js.map