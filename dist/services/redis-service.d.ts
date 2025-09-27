import Redis from 'ioredis';
export declare class RedisService {
    redis: Redis;
    constructor();
    cacheSSPResult(cptCodes: string[], icdCodes: string[], result: any, ttl?: number): Promise<void>;
    getCachedSSPResult(cptCodes: string[], icdCodes: string[]): Promise<any | null>;
    cachePDMResult(claimHash: string, result: any, ttl?: number): Promise<void>;
    getCachedPDMResult(claimHash: string): Promise<any | null>;
    storeDenialPattern(payer: string, cptCode: string, pattern: any, ttl?: number): Promise<void>;
    getDenialPattern(payer: string, cptCode: string): Promise<any | null>;
    storeProviderPerformance(providerId: string, cptCode: string, payer: string, approvalRate: number, ttl?: number): Promise<void>;
    getProviderPerformance(providerId: string, cptCode: string, payer: string): Promise<number | null>;
    storeSpecialtyMapping(cptCode: string, icdCode: string, specialty: string, subspecialty: string, ttl?: number): Promise<void>;
    getSpecialtyMapping(cptCode: string, icdCode: string): Promise<any | null>;
    generateClaimHash(payload: any): string;
    close(): Promise<void>;
}
//# sourceMappingURL=redis-service.d.ts.map