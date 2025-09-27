import dotenv from 'dotenv';
import { FirecrawlService } from '../services/firecrawl-service';
import { GoogleSearchService } from '../services/google-search';
import { RedisService } from '../services/redis-service';

// Load environment variables
dotenv.config();

interface ServiceTestResult {
  service: string;
  test: string;
  success: boolean;
  duration: number;
  result?: any;
  error?: string;
}

class ServicesTest {
  private testResults: ServiceTestResult[] = [];

  async runAllServiceTests(): Promise<void> {
    console.log('🧪 Running Services Tests...\n');

    // Test Firecrawl Service
    await this.testFirecrawlService();

    // Test Google Search Service
    await this.testGoogleSearchService();

    // Test Redis Service
    await this.testRedisService();

    // Print summary
    this.printSummary();
  }

  private async testFirecrawlService(): Promise<void> {
    console.log('🕷️ Testing Firecrawl Service...\n');

    // Test 1: Basic URL scraping
    await this.testFirecrawlBasicScraping();

    // Test 2: Medical coding URL scraping
    await this.testFirecrawlMedicalCoding();

    // Test 3: Error handling
    await this.testFirecrawlErrorHandling();

    console.log('\n' + '-'.repeat(80) + '\n');
  }

  private async testFirecrawlBasicScraping(): Promise<void> {
    const startTime = Date.now();
    console.log('   🔍 Test 1: Basic URL Scraping...');

    try {
      const firecrawl = new FirecrawlService();
      const result = await firecrawl.scrapeUrl('https://example.com');

      const duration = Date.now() - startTime;

      if (result.success) {
        console.log('   ✅ Basic scraping successful');
        console.log(`   - Content length: ${result.data?.content?.length || 0} characters`);
        console.log(`   - Title: ${result.data?.metadata?.title || 'N/A'}`);
        console.log(`   - Duration: ${duration}ms`);

        this.testResults.push({
          service: 'Firecrawl',
          test: 'Basic URL Scraping',
          success: true,
          duration,
          result: {
            contentLength: result.data?.content?.length || 0,
            title: result.data?.metadata?.title || 'N/A'
          }
        });
      } else {
        console.log('   ❌ Basic scraping failed');
        console.log(`   - Error: ${result.error}`);
        console.log(`   - Duration: ${duration}ms`);

        this.testResults.push({
          service: 'Firecrawl',
          test: 'Basic URL Scraping',
          success: false,
          duration,
          error: result.error || 'Unknown error'
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`   ❌ Basic scraping failed: ${(error as Error).message}`);
      console.log(`   - Duration: ${duration}ms`);

      this.testResults.push({
        service: 'Firecrawl',
        test: 'Basic URL Scraping',
        success: false,
        duration,
        error: (error as Error).message
      });
    }
  }

  private async testFirecrawlMedicalCoding(): Promise<void> {
    const startTime = Date.now();
    console.log('   🔍 Test 2: Medical Coding URL Scraping...');

    try {
      const firecrawl = new FirecrawlService();
      
      // Test with a medical coding related URL
      const medicalUrl = 'https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits';
      const result = await firecrawl.scrapeUrl(medicalUrl);

      const duration = Date.now() - startTime;

      if (result.success) {
        console.log('   ✅ Medical coding scraping successful');
        console.log(`   - Content length: ${result.data?.content?.length || 0} characters`);
        console.log(`   - Title: ${result.data?.metadata?.title || 'N/A'}`);
        console.log(`   - Duration: ${duration}ms`);

        // Check if content contains medical coding keywords
        const content = result.data?.content || '';
        const hasMedicalKeywords = /medicare|ncci|cpt|icd|coding|billing/i.test(content);
        console.log(`   - Contains medical keywords: ${hasMedicalKeywords}`);

        this.testResults.push({
          service: 'Firecrawl',
          test: 'Medical Coding URL Scraping',
          success: true,
          duration,
          result: {
            contentLength: result.data?.content?.length || 0,
            title: result.data?.metadata?.title || 'N/A',
            hasMedicalKeywords
          }
        });
      } else {
        console.log('   ❌ Medical coding scraping failed');
        console.log(`   - Error: ${result.error}`);
        console.log(`   - Duration: ${duration}ms`);

        this.testResults.push({
          service: 'Firecrawl',
          test: 'Medical Coding URL Scraping',
          success: false,
          duration,
          error: result.error || 'Unknown error'
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`   ❌ Medical coding scraping failed: ${(error as Error).message}`);
      console.log(`   - Duration: ${duration}ms`);

      this.testResults.push({
        service: 'Firecrawl',
        test: 'Medical Coding URL Scraping',
        success: false,
        duration,
        error: (error as Error).message
      });
    }
  }

  private async testFirecrawlErrorHandling(): Promise<void> {
    const startTime = Date.now();
    console.log('   🔍 Test 3: Error Handling...');

    try {
      const firecrawl = new FirecrawlService();
      
      // Test with invalid URL
      const result = await firecrawl.scrapeUrl('https://invalid-url-that-does-not-exist.com');

      const duration = Date.now() - startTime;

      if (!result.success) {
        console.log('   ✅ Error handling working correctly');
        console.log(`   - Error: ${result.error}`);
        console.log(`   - Duration: ${duration}ms`);

        this.testResults.push({
          service: 'Firecrawl',
          test: 'Error Handling',
          success: true,
          duration,
          result: { error: result.error }
        });
      } else {
        console.log('   ⚠️  Expected error but got success');
        console.log(`   - Duration: ${duration}ms`);

        this.testResults.push({
          service: 'Firecrawl',
          test: 'Error Handling',
          success: false,
          duration,
          error: 'Expected error but got success'
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log('   ✅ Error handling working correctly (exception caught)');
      console.log(`   - Error: ${(error as Error).message}`);
      console.log(`   - Duration: ${duration}ms`);

      this.testResults.push({
        service: 'Firecrawl',
        test: 'Error Handling',
        success: true,
        duration,
        result: { error: (error as Error).message }
      });
    }
  }

  private async testGoogleSearchService(): Promise<void> {
    console.log('🔍 Testing Google Search Service...\n');

    // Test 1: Basic medical coding search
    await this.testGoogleBasicSearch();

    // Test 2: CPT code specific search
    await this.testGoogleCPTSearch();

    // Test 3: Medicare policy search
    await this.testGoogleMedicareSearch();

    console.log('\n' + '-'.repeat(80) + '\n');
  }

  private async testGoogleBasicSearch(): Promise<void> {
    const startTime = Date.now();
    console.log('   🔍 Test 1: Basic Medical Coding Search...');

    try {
      const googleSearch = new GoogleSearchService();
      const results = await googleSearch.searchMedicalCoding('medicare CPT code 99213 coverage', 3);

      const duration = Date.now() - startTime;

      console.log('   ✅ Basic search successful');
      console.log(`   - Results found: ${results.length}`);
      console.log(`   - Duration: ${duration}ms`);

      if (results.length > 0) {
        console.log('   📊 Sample results:');
        results.slice(0, 2).forEach((result, index) => {
          console.log(`     ${index + 1}. ${result.title}`);
          console.log(`        URL: ${result.link}`);
          console.log(`        Snippet: ${result.snippet.substring(0, 100)}...`);
        });
      }

      this.testResults.push({
        service: 'Google Search',
        test: 'Basic Medical Coding Search',
        success: true,
        duration,
        result: {
          resultsCount: results.length,
          sampleTitles: results.slice(0, 2).map(r => r.title)
        }
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`   ❌ Basic search failed: ${(error as Error).message}`);
      console.log(`   - Duration: ${duration}ms`);

      this.testResults.push({
        service: 'Google Search',
        test: 'Basic Medical Coding Search',
        success: false,
        duration,
        error: (error as Error).message
      });
    }
  }

  private async testGoogleCPTSearch(): Promise<void> {
    const startTime = Date.now();
    console.log('   🔍 Test 2: CPT Code Specific Search...');

    try {
      const googleSearch = new GoogleSearchService();
      const results = await googleSearch.searchMedicalCoding('CPT code 99214 vs 99213 difference bundling', 5);

      const duration = Date.now() - startTime;

      console.log('   ✅ CPT search successful');
      console.log(`   - Results found: ${results.length}`);
      console.log(`   - Duration: ${duration}ms`);

      if (results.length > 0) {
        console.log('   📊 Sample results:');
        results.slice(0, 2).forEach((result, index) => {
          console.log(`     ${index + 1}. ${result.title}`);
          console.log(`        URL: ${result.link}`);
          console.log(`        Snippet: ${result.snippet.substring(0, 100)}...`);
        });
      }

      this.testResults.push({
        service: 'Google Search',
        test: 'CPT Code Specific Search',
        success: true,
        duration,
        result: {
          resultsCount: results.length,
          sampleTitles: results.slice(0, 2).map(r => r.title)
        }
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`   ❌ CPT search failed: ${(error as Error).message}`);
      console.log(`   - Duration: ${duration}ms`);

      this.testResults.push({
        service: 'Google Search',
        test: 'CPT Code Specific Search',
        success: false,
        duration,
        error: (error as Error).message
      });
    }
  }

  private async testGoogleMedicareSearch(): Promise<void> {
    const startTime = Date.now();
    console.log('   🔍 Test 3: Medicare Policy Search...');

    try {
      const googleSearch = new GoogleSearchService();
      const results = await googleSearch.searchMedicalCoding('medicare LCD policy back pain treatment', 4);

      const duration = Date.now() - startTime;

      console.log('   ✅ Medicare policy search successful');
      console.log(`   - Results found: ${results.length}`);
      console.log(`   - Duration: ${duration}ms`);

      if (results.length > 0) {
        console.log('   📊 Sample results:');
        results.slice(0, 2).forEach((result, index) => {
          console.log(`     ${index + 1}. ${result.title}`);
          console.log(`        URL: ${result.link}`);
          console.log(`        Snippet: ${result.snippet.substring(0, 100)}...`);
        });
      }

      this.testResults.push({
        service: 'Google Search',
        test: 'Medicare Policy Search',
        success: true,
        duration,
        result: {
          resultsCount: results.length,
          sampleTitles: results.slice(0, 2).map(r => r.title)
        }
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`   ❌ Medicare policy search failed: ${(error as Error).message}`);
      console.log(`   - Duration: ${duration}ms`);

      this.testResults.push({
        service: 'Google Search',
        test: 'Medicare Policy Search',
        success: false,
        duration,
        error: (error as Error).message
      });
    }
  }

  private async testRedisService(): Promise<void> {
    console.log('📦 Testing Redis Service...\n');

    // Test 1: Basic connection
    await this.testRedisConnection();

    // Test 2: Set and get operations
    await this.testRedisOperations();

    // Test 3: Cache operations
    await this.testRedisCache();

    console.log('\n' + '-'.repeat(80) + '\n');
  }

  private async testRedisConnection(): Promise<void> {
    const startTime = Date.now();
    console.log('   🔍 Test 1: Redis Connection...');

    try {
      const redis = new RedisService();
      
      // Test basic ping
      const pong = await redis.redis.ping();
      const duration = Date.now() - startTime;

      if (pong === 'PONG') {
        console.log('   ✅ Redis connection successful');
        console.log(`   - Ping response: ${pong}`);
        console.log(`   - Duration: ${duration}ms`);

        this.testResults.push({
          service: 'Redis',
          test: 'Connection',
          success: true,
          duration,
          result: { ping: pong }
        });
      } else {
        console.log('   ❌ Redis connection failed');
        console.log(`   - Unexpected ping response: ${pong}`);
        console.log(`   - Duration: ${duration}ms`);

        this.testResults.push({
          service: 'Redis',
          test: 'Connection',
          success: false,
          duration,
          error: `Unexpected ping response: ${pong}`
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`   ❌ Redis connection failed: ${(error as Error).message}`);
      console.log(`   - Duration: ${duration}ms`);

      this.testResults.push({
        service: 'Redis',
        test: 'Connection',
        success: false,
        duration,
        error: (error as Error).message
      });
    }
  }

  private async testRedisOperations(): Promise<void> {
    const startTime = Date.now();
    console.log('   🔍 Test 2: Redis Set/Get Operations...');

    try {
      const redis = new RedisService();
      const testKey = 'test:validation:key';
      const testValue = JSON.stringify({ 
        test: true, 
        timestamp: Date.now(),
        data: 'test validation data'
      });

      // Set value
      await redis.redis.set(testKey, testValue);
      
      // Get value
      const retrievedValue = await redis.redis.get(testKey);
      
      // Clean up
      await redis.redis.del(testKey);

      const duration = Date.now() - startTime;

      if (retrievedValue === testValue) {
        console.log('   ✅ Redis set/get operations successful');
        console.log(`   - Value set and retrieved correctly`);
        console.log(`   - Duration: ${duration}ms`);

        this.testResults.push({
          service: 'Redis',
          test: 'Set/Get Operations',
          success: true,
          duration,
          result: { valueMatch: true }
        });
      } else {
        console.log('   ❌ Redis set/get operations failed');
        console.log(`   - Value mismatch`);
        console.log(`   - Duration: ${duration}ms`);

        this.testResults.push({
          service: 'Redis',
          test: 'Set/Get Operations',
          success: false,
          duration,
          error: 'Value mismatch'
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`   ❌ Redis set/get operations failed: ${(error as Error).message}`);
      console.log(`   - Duration: ${duration}ms`);

      this.testResults.push({
        service: 'Redis',
        test: 'Set/Get Operations',
        success: false,
        duration,
        error: (error as Error).message
      });
    }
  }

  private async testRedisCache(): Promise<void> {
    const startTime = Date.now();
    console.log('   🔍 Test 3: Redis Cache Operations...');

    try {
      const redis = new RedisService();
      const cacheKey = 'test:validation:cache';
      const cacheValue = JSON.stringify({
        claim_id: 'test_123',
        validation_result: { valid: true, risk_score: 10 },
        timestamp: Date.now()
      });
      const ttl = 60; // 60 seconds

      // Set with TTL
      await redis.redis.setex(cacheKey, ttl, cacheValue);
      
      // Get cached value
      const cachedValue = await redis.redis.get(cacheKey);
      
      // Check TTL
      const remainingTtl = await redis.redis.ttl(cacheKey);
      
      // Clean up
      await redis.redis.del(cacheKey);

      const duration = Date.now() - startTime;

      if (cachedValue === cacheValue && remainingTtl > 0) {
        console.log('   ✅ Redis cache operations successful');
        console.log(`   - Value cached and retrieved correctly`);
        console.log(`   - TTL: ${remainingTtl} seconds`);
        console.log(`   - Duration: ${duration}ms`);

        this.testResults.push({
          service: 'Redis',
          test: 'Cache Operations',
          success: true,
          duration,
          result: { 
            valueMatch: true, 
            ttl: remainingTtl 
          }
        });
      } else {
        console.log('   ❌ Redis cache operations failed');
        console.log(`   - Value match: ${cachedValue === cacheValue}`);
        console.log(`   - TTL: ${remainingTtl}`);
        console.log(`   - Duration: ${duration}ms`);

        this.testResults.push({
          service: 'Redis',
          test: 'Cache Operations',
          success: false,
          duration,
          error: `Value match: ${cachedValue === cacheValue}, TTL: ${remainingTtl}`
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`   ❌ Redis cache operations failed: ${(error as Error).message}`);
      console.log(`   - Duration: ${duration}ms`);

      this.testResults.push({
        service: 'Redis',
        test: 'Cache Operations',
        success: false,
        duration,
        error: (error as Error).message
      });
    }
  }

  private printSummary(): void {
    console.log('📊 SERVICES TEST SUMMARY');
    console.log('='.repeat(80));
    
    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);

    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Successful: ${successfulTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
    console.log('');

    // Group by service
    const services = [...new Set(this.testResults.map(r => r.service))];
    
    services.forEach(service => {
      console.log(`🔧 ${service}:`);
      const serviceTests = this.testResults.filter(r => r.service === service);
      
      serviceTests.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        console.log(`   ${index + 1}. ${status} ${result.test} (${result.duration}ms)`);
        if (!result.success && result.error) {
          console.log(`      Error: ${result.error}`);
        }
      });
      console.log('');
    });

    console.log('='.repeat(80));
    
    if (failedTests === 0) {
      console.log('🎉 All service tests passed successfully!');
    } else {
      console.log(`⚠️  ${failedTests} test(s) failed. Check the errors above.`);
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const testSuite = new ServicesTest();

  try {
    switch (command) {
      case 'all':
        await testSuite.runAllServiceTests();
        break;
      case 'firecrawl':
        await testSuite['testFirecrawlService']();
        break;
      case 'google':
        await testSuite['testGoogleSearchService']();
        break;
      case 'redis':
        await testSuite['testRedisService']();
        break;
      default:
        console.log('Usage: npm run test:services [all|firecrawl|google|redis]');
        console.log('  all      - Run all service tests');
        console.log('  firecrawl - Run only Firecrawl service tests');
        console.log('  google   - Run only Google Search service tests');
        console.log('  redis    - Run only Redis service tests');
    }
  } catch (error) {
    console.error('Service test suite error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { ServicesTest };
