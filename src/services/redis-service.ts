import Redis from 'ioredis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export class RedisService {
  public redis: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    const redisPassword = process.env.REDIS_PASSWORD;
    
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required');
    }
    
    this.redis = new Redis(redisUrl, {
      password: redisPassword,
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      console.log('Connected to Redis');
    });
  }

  /**
   * Cache SSP results
   */
  async cacheSSPResult(
    cptCodes: string[],
    icdCodes: string[],
    result: any,
    ttl: number = 86400 // 24 hours
  ): Promise<void> {
    const key = `ssp:${cptCodes.join(',')}:${icdCodes.join(',')}`;
    await this.redis.setex(key, ttl, JSON.stringify(result));
  }

  /**
   * Get cached SSP result
   */
  async getCachedSSPResult(cptCodes: string[], icdCodes: string[]): Promise<any | null> {
    const key = `ssp:${cptCodes.join(',')}:${icdCodes.join(',')}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Cache PDM results
   */
  async cachePDMResult(
    claimHash: string,
    result: any,
    ttl: number = 3600 // 1 hour
  ): Promise<void> {
    const key = `pdm:${claimHash}`;
    await this.redis.setex(key, ttl, JSON.stringify(result));
  }

  /**
   * Get cached PDM result
   */
  async getCachedPDMResult(claimHash: string): Promise<any | null> {
    const key = `pdm:${claimHash}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Store denial patterns
   */
  async storeDenialPattern(
    payer: string,
    cptCode: string,
    pattern: any,
    ttl: number = 604800 // 7 days
  ): Promise<void> {
    const key = `denial_pattern:${payer}:${cptCode}`;
    await this.redis.setex(key, ttl, JSON.stringify(pattern));
  }

  /**
   * Get denial patterns
   */
  async getDenialPattern(payer: string, cptCode: string): Promise<any | null> {
    const key = `denial_pattern:${payer}:${cptCode}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Store provider performance data for gold-carding
   */
  async storeProviderPerformance(
    providerId: string,
    cptCode: string,
    payer: string,
    approvalRate: number,
    ttl: number = 2592000 // 30 days
  ): Promise<void> {
    const key = `provider_perf:${providerId}:${cptCode}:${payer}`;
    await this.redis.setex(key, ttl, approvalRate.toString());
  }

  /**
   * Get provider performance data
   */
  async getProviderPerformance(
    providerId: string,
    cptCode: string,
    payer: string
  ): Promise<number | null> {
    const key = `provider_perf:${providerId}:${cptCode}:${payer}`;
    const cached = await this.redis.get(key);
    return cached ? parseFloat(cached) : null;
  }

  /**
   * Store specialty mappings
   */
  async storeSpecialtyMapping(
    cptCode: string,
    icdCode: string,
    specialty: string,
    subspecialty: string,
    ttl: number = 2592000 // 30 days
  ): Promise<void> {
    const key = `specialty_map:${cptCode}:${icdCode}`;
    const value = { specialty, subspecialty };
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  /**
   * Get specialty mapping
   */
  async getSpecialtyMapping(cptCode: string, icdCode: string): Promise<any | null> {
    const key = `specialty_map:${cptCode}:${icdCode}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Generate claim hash for caching
   */
  generateClaimHash(payload: any): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(payload));
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}
