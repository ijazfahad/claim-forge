import { GoogleSearchResult } from '../types/claim-types';
export declare class GoogleSearchService {
    private apiKey;
    private searchEngineId;
    private baseUrl;
    constructor();
    searchMedicalCoding(query: string, numResults?: number): Promise<GoogleSearchResult[]>;
    searchCPTRelationships(cptCode: string): Promise<GoogleSearchResult[]>;
    searchSpecialtyInfo(specialty: string, subspecialty?: string): Promise<GoogleSearchResult[]>;
    searchPayerDenialPatterns(payer: string, cptCode: string): Promise<GoogleSearchResult[]>;
    searchCodeRelationships(icdCode: string, cptCode: string): Promise<GoogleSearchResult[]>;
    searchPriorAuthRequirements(cptCode: string, payer: string): Promise<GoogleSearchResult[]>;
}
//# sourceMappingURL=google-search.d.ts.map