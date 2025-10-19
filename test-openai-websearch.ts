import { OpenAIWebSearchService } from './src/services/openai-websearch-service';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testOpenAIWebSearch() {
  console.log('🧪 Testing OpenAI Web Search Service\n');
  console.log('='.repeat(60));

  const service = new OpenAIWebSearchService();

  // Test 1: Simple medical coding question with domain filtering
  console.log('\n📋 Test 1: Medical coding question with domain filtering');
  console.log('-'.repeat(60));
  
  try {
    const result1 = await service.searchMedicalCoding(
      'Does Aetna require prior authorization for CPT 99213 with diagnosis E11.9?',
      ['aetna.com']
    );

    if (result1.success && result1.data) {
      console.log('✅ Test 1 PASSED');
      console.log(`   Confidence: ${(result1.data.confidence * 100).toFixed(1)}%`);
      console.log(`   Answer preview: "${result1.data.answer.substring(0, 150)}..."`);
      console.log(`   Sources found: ${result1.data.sources.length}`);
      console.log(`   Data source: ${result1.data.data_source}`);
      console.log(`   Processing time: ${result1.data.processing_time_ms}ms`);
      
      // Show first source
      if (result1.data.sources.length > 0) {
        console.log(`   First source: ${result1.data.sources[0].title} (${result1.data.sources[0].url})`);
      }
    } else {
      console.log('❌ Test 1 FAILED');
      console.log(`   Error: ${result1.error}`);
    }
  } catch (error) {
    console.log('❌ Test 1 FAILED with exception');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test 2: Broader search without domain filtering
  console.log('\n📋 Test 2: Broader search (default domains)');
  console.log('-'.repeat(60));
  
  try {
    const result2 = await service.searchMedicalCoding(
      'What are the bundling rules for CPT 99213?'
    );

    if (result2.success && result2.data) {
      console.log('✅ Test 2 PASSED');
      console.log(`   Confidence: ${(result2.data.confidence * 100).toFixed(1)}%`);
      console.log(`   Answer preview: "${result2.data.answer.substring(0, 150)}..."`);
      console.log(`   Sources found: ${result2.data.sources.length}`);
      console.log(`   Data source: ${result2.data.data_source}`);
      console.log(`   Processing time: ${result2.data.processing_time_ms}ms`);
    } else {
      console.log('❌ Test 2 FAILED');
      console.log(`   Error: ${result2.error}`);
    }
  } catch (error) {
    console.log('❌ Test 2 FAILED with exception');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test 3: Payer-specific search
  console.log('\n📋 Test 3: Payer-specific search');
  console.log('-'.repeat(60));
  
  try {
    const result3 = await service.searchPayerPolicy(
      'Cigna',
      'What are the medical necessity criteria for CPT 99213?',
      ['cigna.com']
    );

    if (result3.success && result3.data) {
      console.log('✅ Test 3 PASSED');
      console.log(`   Confidence: ${(result3.data.confidence * 100).toFixed(1)}%`);
      console.log(`   Answer preview: "${result3.data.answer.substring(0, 150)}..."`);
      console.log(`   Sources found: ${result3.data.sources.length}`);
      console.log(`   Data source: ${result3.data.data_source}`);
      console.log(`   Processing time: ${result3.data.processing_time_ms}ms`);
    } else {
      console.log('❌ Test 3 FAILED');
      console.log(`   Error: ${result3.error}`);
    }
  } catch (error) {
    console.log('❌ Test 3 FAILED with exception');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 OpenAI Web Search Service Test Complete\n');
}

// Run the test
testOpenAIWebSearch().catch(console.error);

