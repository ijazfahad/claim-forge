import axios, { AxiosResponse } from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();
import { GoogleSearchResponse, GoogleSearchResult } from '../types/claim-types';

export class GoogleSearchService {
  private apiKey: string;
  private searchEngineId: string;
  private baseUrl: string = 'https://www.googleapis.com/customsearch/v1';

  constructor() {
    this.apiKey = process.env.GOOGLE_SEARCH_API_KEY || '';
    this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || '';
    
    if (!this.apiKey || !this.searchEngineId) {
      throw new Error('GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID environment variables are required');
    }
  }

  /**
   * Search for medical coding information
   */
  async searchMedicalCoding(query: string, numResults: number = 2): Promise<GoogleSearchResult[]> {
    try {
      // Log the query being sent to Google
      console.log(`🔍 Sending query to Google Custom Search: "${query}"`);
      console.log(`   📊 Requesting ${numResults} result(s)`);
      
      const response: AxiosResponse<GoogleSearchResponse> = await axios.get(
        this.baseUrl,
        {
          params: {
            key: this.apiKey,
            cx: this.searchEngineId,
            q: query,
            num: numResults,
            safe: 'active',
          },
          timeout: 10000, // 10 second timeout
        }
      );

      const results = response.data.items || [];
      
      // Log Google Search results
      console.log(`🔍 Google Search Results for "${query}":`);
      if (results.length > 0) {
        results.forEach((result, index) => {
          console.log(`   ${index + 1}. ${result.title}`);
          console.log(`      URL: ${result.link}`);
          console.log(`      Snippet: ${result.snippet?.substring(0, 100)}...`);
        });
      } else {
        console.log(`   ❌ No results found for query: "${query}"`);
      }
      
      return results;
    } catch (error) {
      console.error('Google Search error:', error);
      return [];
    }
  }

  /**
   * Search for CPT code relationships and bundling rules
   */
  async searchCPTRelationships(cptCode: string): Promise<GoogleSearchResult[]> {
    const query = `CPT ${cptCode} bundling rules NCCI edits medical coding`;
    return this.searchMedicalCoding(query);
  }

  /**
   * Search for specialty-specific information
   */
  async searchSpecialtyInfo(specialty: string, subspecialty?: string): Promise<GoogleSearchResult[]> {
    const query = subspecialty 
      ? `${specialty} ${subspecialty} medical coding guidelines`
      : `${specialty} medical coding guidelines`;
    return this.searchMedicalCoding(query);
  }

  /**
   * Search for payer-specific denial patterns
   */
  async searchPayerDenialPatterns(payer: string, cptCode: string): Promise<GoogleSearchResult[]> {
    const query = `${payer} denial patterns ${cptCode} medical claims rejection`;
    return this.searchMedicalCoding(query);
  }

  /**
   * Search for ICD-10 and CPT code relationships
   */
  async searchCodeRelationships(icdCode: string, cptCode: string): Promise<GoogleSearchResult[]> {
    const query = `ICD-10 ${icdCode} CPT ${cptCode} medical coding relationship`;
    return this.searchMedicalCoding(query);
  }

  /**
   * Search for prior authorization requirements
   */
  async searchPriorAuthRequirements(cptCode: string, payer: string): Promise<GoogleSearchResult[]> {
    const query = `CPT ${cptCode} prior authorization ${payer} requirements`;
    return this.searchMedicalCoding(query);
  }
}
