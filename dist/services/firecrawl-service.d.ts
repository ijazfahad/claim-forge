import { FirecrawlResponse } from '../types/claim-types';
export declare class FirecrawlService {
    private apiUrl;
    private apiKey;
    constructor();
    scrapeUrl(url: string): Promise<FirecrawlResponse>;
    searchPayerPolicy(payer: string, specialty: string, cptCode: string, year?: number): Promise<FirecrawlResponse>;
    getDenialPatterns(payer: string, cptCode: string): Promise<FirecrawlResponse>;
    getSpecialtyGuidelines(specialty: string, subspecialty?: string): Promise<FirecrawlResponse>;
}
//# sourceMappingURL=firecrawl-service.d.ts.map