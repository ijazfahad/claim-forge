#!/usr/bin/env node

import dotenv from 'dotenv';
import { runAllTests } from './test-workflow';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🔧 Environment Check');
  console.log('=' .repeat(50));
  
  // Check required environment variables
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
  console.log('=' .repeat(50));
  
  try {
    const results = await runAllTests();
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed! The workflow is working correctly.');
      process.exit(0);
    } else {
      console.log(`\n⚠️  ${failed} test(s) failed. Please review the output above.`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Test suite crashed:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the tests
main();
