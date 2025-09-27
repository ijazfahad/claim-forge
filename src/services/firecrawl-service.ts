import axios, { AxiosResponse } from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();
import { FirecrawlResponse } from '../types/claim-types';

export class FirecrawlService {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.FIRECRAWL_API_URL || '';
    this.apiKey = process.env.FIRECRAWL_API_KEY || '';
    
    if (!this.apiUrl || !this.apiKey) {
      throw new Error('FIRECRAWL_API_URL and FIRECRAWL_API_KEY environment variables are required');
    }
  }

  /**
   * Scrape a URL for content
   */
  async scrapeUrl(url: string): Promise<FirecrawlResponse> {
    try {
      const response: AxiosResponse = await axios.post(
        `${this.apiUrl}/scrape`,
        {
          url,
          formats: ['markdown', 'html'],
          onlyMainContent: true,
          removeBase64Images: true,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      return {
        success: true,
        data: {
          content: response.data.data.content || '',
          markdown: response.data.data.markdown || '',
          metadata: {
            title: response.data.data.metadata?.title || '',
            description: response.data.data.metadata?.description || '',
            url: url,
          },
        },
      };
    } catch (error) {
      console.error('Firecrawl scrape error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Search for payer policies using specialty-specific queries
   */
  async searchPayerPolicy(
    payer: string,
    specialty: string,
    cptCode: string,
    year: number = new Date().getFullYear()
  ): Promise<FirecrawlResponse> {
    const query = `${payer} ${specialty} policy ${cptCode} ${year}`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    
    return this.scrapeUrl(searchUrl);
  }

  /**
   * Get denial patterns for a specific payer and CPT code
   */
  async getDenialPatterns(payer: string, cptCode: string): Promise<FirecrawlResponse> {
    const query = `${payer} denial patterns ${cptCode} medical claims`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    
    return this.scrapeUrl(searchUrl);
  }

  /**
   * Get specialty-specific coding guidelines
   */
  async getSpecialtyGuidelines(specialty: string, subspecialty?: string): Promise<FirecrawlResponse> {
    const query = subspecialty 
      ? `${specialty} ${subspecialty} coding guidelines CPT ICD`
      : `${specialty} coding guidelines CPT ICD`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    
    return this.scrapeUrl(searchUrl);
  }
}
