"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class RedisService {
    constructor() {
        const redisUrl = process.env.REDIS_URL;
        const redisPassword = process.env.REDIS_PASSWORD;
        if (!redisUrl) {
            throw new Error('REDIS_URL environment variable is required');
        }
        this.redis = new ioredis_1.default(redisUrl, {
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
    async cacheSSPResult(cptCodes, icdCodes, result, ttl = 86400) {
        const key = `ssp:${cptCodes.join(',')}:${icdCodes.join(',')}`;
        await this.redis.setex(key, ttl, JSON.stringify(result));
    }
    async getCachedSSPResult(cptCodes, icdCodes) {
        const key = `ssp:${cptCodes.join(',')}:${icdCodes.join(',')}`;
        const cached = await this.redis.get(key);
        return cached ? JSON.parse(cached) : null;
    }
    async cachePDMResult(claimHash, result, ttl = 3600) {
        const key = `pdm:${claimHash}`;
        await this.redis.setex(key, ttl, JSON.stringify(result));
    }
    async getCachedPDMResult(claimHash) {
        const key = `pdm:${claimHash}`;
        const cached = await this.redis.get(key);
        return cached ? JSON.parse(cached) : null;
    }
    async storeDenialPattern(payer, cptCode, pattern, ttl = 604800) {
        const key = `denial_pattern:${payer}:${cptCode}`;
        await this.redis.setex(key, ttl, JSON.stringify(pattern));
    }
    async getDenialPattern(payer, cptCode) {
        const key = `denial_pattern:${payer}:${cptCode}`;
        const cached = await this.redis.get(key);
        return cached ? JSON.parse(cached) : null;
    }
    async storeProviderPerformance(providerId, cptCode, payer, approvalRate, ttl = 2592000) {
        const key = `provider_perf:${providerId}:${cptCode}:${payer}`;
        await this.redis.setex(key, ttl, approvalRate.toString());
    }
    async getProviderPerformance(providerId, cptCode, payer) {
        const key = `provider_perf:${providerId}:${cptCode}:${payer}`;
        const cached = await this.redis.get(key);
        return cached ? parseFloat(cached) : null;
    }
    async storeSpecialtyMapping(cptCode, icdCode, specialty, subspecialty, ttl = 2592000) {
        const key = `specialty_map:${cptCode}:${icdCode}`;
        const value = { specialty, subspecialty };
        await this.redis.setex(key, ttl, JSON.stringify(value));
    }
    async getSpecialtyMapping(cptCode, icdCode) {
        const key = `specialty_map:${cptCode}:${icdCode}`;
        const cached = await this.redis.get(key);
        return cached ? JSON.parse(cached) : null;
    }
    generateClaimHash(payload) {
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256');
        hash.update(JSON.stringify(payload));
        return hash.digest('hex').substring(0, 16);
    }
    async close() {
        await this.redis.quit();
    }
}
exports.RedisService = RedisService;
//# sourceMappingURL=redis-service.js.map