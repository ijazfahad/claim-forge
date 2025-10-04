import axios, { AxiosResponse } from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();
import { FirecrawlResponse } from '../types/claim-types';

export class FirecrawlService {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.FIRECRAWL_API_URL || 'http://localhost:3002';
    this.apiKey = process.env.FIRECRAWL_API_KEY || '';
    
    if (!this.apiUrl) {
      throw new Error('FIRECRAWL_API_URL environment variable is required');
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
            ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
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

  /**
   * Extract content from URLs for specific claim validation questions
   * This is the primary method for Firecrawl Agent integration
   * 
   * Based on Firecrawl /extract documentation:
   * - Uses correct API structure: urls, prompt, schema
   * - Structured data extraction with JSON schema
   * - Optimized for medical policy extraction
   */
  async extractContentForQuestion(
    question: string,
    questionType: string,
    urls: string[],
    query?: string
  ): Promise<FirecrawlResponse> {
    try {
      // Extract content from multiple URLs in parallel (limit to top 3 for performance)
      const urlsToProcess = urls.slice(0, 3);
      
      const extractPromises = urlsToProcess.map(async (url) => {
        try {
          // Try /v1/extract endpoint first (cost-effective choice)
          const extractResponse = await axios.post(
            `${this.apiUrl}/v1/extract`,
            {
              urls: [url],
              prompt: `Extract relevant information about: ${question}. Focus on policies, coverage rules, eligibility requirements, and coding guidelines. Query context: ${query || question}`,
              schema: {
                type: "object",
                properties: {
                  extracted_content: {
                    type: "string",
                    description: "Relevant policy or coverage information extracted from the page"
                  },
                  confidence_score: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    description: "Confidence score (0-1) indicating how well the content answers the question"
                  },
                  key_points: {
                    type: "array",
                    items: { type: "string" },
                    description: "Key points related to the question"
                  },
                  policy_details: {
                    type: "object",
                    properties: {
                      coverage_rules: { type: "array", items: { type: "string" } },
                      eligibility_requirements: { type: "array", items: { type: "string" } },
                      coding_guidelines: { type: "array", items: { type: "string" } }
                    }
                  }
                },
                required: ["extracted_content", "confidence_score"]
              }
            },
            {
              headers: {
                ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
                'Content-Type': 'application/json',
              },
              timeout: 45000,
            }
          );

          // Handle /v1/extract endpoint response first, fallback to v2/scrape if needed  
          let extractedData = extractResponse.data.data;
          
          if (!extractedData) {
            // Fallback to /v2/scrape endpoint
            console.log(`🔍 Fallback: Using /v2/scrape for: ${url}`);
            const scrapeResponse = await axios.post(
              `${this.apiUrl}/v2/scrape`,
              {
                url: url,
                formats: [{
                  type: "json",
                  prompt: `Extract relevant information about: ${question}. Focus on policies, coverage rules, eligibility requirements, and coding guidelines. Query context: ${query || question}`,
                  schema: {
                  type: "object",
                  properties: {
                    extracted_content: { type: "string", description: "Relevant policy information" },
                    confidence_score: { type: "number", minimum: 0, maximum: 1, description: "Confidence score (0-1) indicating how well the content answers the question" },
                    key_points: { type: "array", items: { type: "string" }, description: "Key points" },
                    policy_details: {
                      type: "object",
                      properties: {
                        coverage_rules: { type: "array", items: { type: "string" } },
                        eligibility_requirements: { type: "array", items: { type: "string" } },
                        coding_guidelines: { type: "array", items: { type: "string" } }
                      }
                    }
                  },
                  required: ["extracted_content", "confidence_score"]
                  }
                }]
              },
              {
                headers: { ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }), 'Content-Type': 'application/json' },
                timeout: 45000,
              }
            );
            
            // Handle response from /v2/scrape fallback
            extractedData = scrapeResponse.data.data?.json;
            
            if (!extractedData) {
              throw new Error('No extracted data returned from either Firecrawl endpoint');
            }
          }
          
          console.log(`🔍 Successfully extracted data from: ${url}`);
          return {
            url,
            success: true,
            content: extractedData?.extracted_content || '',
            markdown: extractedData?.extracted_content || '', // Use extracted content as markdown
            structured_data: extractedData,
            metadata: {
              title: `Extracted Data for ${url}`,
              description: `Medical policy data extracted for claim validation`,
              url: url,
            }
          };
        } catch (error) {
          console.error(`Extraction failed for ${url}:`, error);
          return {
            url,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown extraction error'
          };
        }
      });

      const results = await Promise.all(extractPromises);
      
      // Combine successful extractions
      const successfulResults = results.filter(r => r.success && typeof r === 'object' && 'content' in r && r.metadata);
      const combinedContent = successfulResults.map(r => {
        return this.formatPolicyResponse(r.structured_data, r.url, r.metadata);
      }).join('\n\n---\n\n');
      
      if (successfulResults.length === 0) {
        return {
          success: false,
          error: 'No successful extractions from any URL'
        };
      }

      return {
        success: true,
        data: {
          content: combinedContent,
          markdown: combinedContent,
          metadata: {
            title: `${successfulResults.length} URLs extracted for validation question`,
            description: `Question: ${question} | Type: ${questionType}`,
            url: urls[0], // Primary URL for reference
          },
        },
      };
    } catch (error) {
      console.error('Firecrawl extract error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Scrape content using /v2/scrape endpoint
   */
  async scrapeContentForQuestion(
    question: string,
    questionType: string,
    urls: string[],
    query?: string
  ): Promise<FirecrawlResponse> {
    try {
      const urlsToProcess = urls.slice(0, 3);
      
      const scrapePromises = urlsToProcess.map(async (url) => {
        try {
          const scrapeResponse = await axios.post(
            `${this.apiUrl}/v2/scrape`,
            {
              url: url,
              formats: [{
                type: "json",
                prompt: `Extract relevant information about: ${question}. Focus on policies, coverage rules, eligibility requirements, and coding guidelines. Query context: ${query || question}`,
                schema: {
                  type: "object",
                  properties: {
                    extracted_content: { type: "string", description: "Relevant policy information" },
                    key_points: { type: "array", items: { type: "string" }, description: "Key points" },
                    policy_details: {
                      type: "object",
                      properties: {
                        coverage_rules: { type: "array", items: { type: "string" } },
                        eligibility_requirements: { type: "array", items: { type: "string" } },
                        coding_guidelines: { type: "array", items: { type: "string" } }
                      }
                    }
                  },
                  required: ["extracted_content"]
                }
              }]
            },
            {
              headers: { ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }), 'Content-Type': 'application/json' },
              timeout: 45000,
            }
          );

          const extractedData = scrapeResponse.data.data?.json;
          
          if (!extractedData) {
            throw new Error('No scraped data returned from Firecrawl');
          }
          
          console.log(`🔍 Successfully scraped data from: ${url}`);
          return {
            url,
            success: true,
            content: extractedData.extracted_content || '',
            markdown: extractedData.extracted_content || '',
            structured_data: extractedData,
            metadata: {
              title: `Scraped: ${url}`,
              description: `Data scraped for claim validation`,
              url: url,
            }
          };
        } catch (error) {
          console.error(`Scraping failed for ${url}:`, error);
          return {
            url,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown scraping error'
          };
        }
      });

      const results = await Promise.all(scrapePromises);
      
      // Combine successful scrapes
      const successfulResults = results.filter(r => r.success);
      const combinedContent = successfulResults.map(r => {
        return this.formatPolicyResponse(r.structured_data, r.url, r.metadata);
      }).join('\n\n---\n\n');

      return {
        success: successfulResults.length > 0,
        data: {
          content: combinedContent || 'No content extracted',
          markdown: combinedContent || 'No markdown available',
          metadata: {
            title: `Scraped Policy Data for ${questionType} Question`,
            description: `Policy information extracted from ${successfulResults.length} URLs`,
            url: urlsToProcess.join(', '),
          },
        },
        error: successfulResults.length === 0 ? 'No successful scrapes from any URL' : undefined,
      };
    } catch (error) {
      console.error('Firecrawl scraping error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown scraping error',
      };
    }
  }

  /**
   * Extract content from a single URL with specific extraction instructions
   */
  async extractSingleUrl(url: string, extractionInstructions: string): Promise<FirecrawlResponse> {
    try {
      // Use /scrape endpoint for single URL extraction
      const scrapeResponse = await axios.post(
        `${this.apiUrl}/scrape`,
        {
          url: url,
          formats: [{
            type: "json",
            prompt: extractionInstructions,
            schema: {
              type: "object",
              properties: {
                content: { type: "string", description: "Main extracted content" },
                key_points: { type: "array", items: { type: "string" }, description: "Key points extracted" },
                summary: { type: "string", description: "Brief summary" }
              },
              required: ["content"]
            }
          }]
        },
        {
          headers: {
            ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        }
      );

      const extractedData = scrapeResponse.data.data?.json;
      if (!extractedData) {
        throw new Error('No extracted data returned from Firecrawl');
      }

      console.log(`🔍 Successfully scraped single URL: ${url}`);
      
      return {
        success: true,
        data: {
          content: extractedData.content || '',
          markdown: extractedData.content || '',
          metadata: {
            title: `Scraped: ${url}`,
            description: `Data scraped from ${url}`,
            url: url,
          },
        },
      };
    } catch (error) {
      console.error('Firecrawl single extract error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Format policy response with citations and snippets for credibility
   */
  private formatPolicyResponse(structuredData: any, url: string, metadata: any): string {
    const content = structuredData?.extracted_content || '';
    const keyPoints = structuredData?.key_points || [];
    const coverageRules = structuredData?.policy_details?.coverage_rules || [];
    const eligibilityReq = structuredData?.policy_details?.eligibility_requirements || [];
    const codingGuide = structuredData?.policy_details?.coding_guidelines || [];

    // Create source citation with snippet
    const sourceInfo = this.getSourceCitation(url, metadata);
    const snippet = this.extractTitleSnippet(content, url);

    let formatted = `## 📋 Policy Analysis\n`;
    formatted += `${sourceInfo}\n\n`;
    
    if (content) {
      formatted += `### 📄 Policy Summary\n${content}\n\n`;
    }
    
    if (snippet) {
      formatted += `### 📖 Source Snippet\n> "${snippet}"\n\n`;
    }

    if (keyPoints.length > 0) {
      formatted += `### 🎯 Key Points\n${keyPoints.map((p: any) => `• ${p}`).join('\n')}\n\n`;
    }

    if (coverageRules.length > 0) {
      formatted += `### ✅ Coverage Rules\n${coverageRules.map((r: any) => `• ${r}`).join('\n')}\n\n`;
    }

    if (eligibilityReq.length > 0) {
      formatted += `### 👥 Eligibility Requirements\n${eligibilityReq.map((r: any) => `• ${r}`).join('\n')}\n\n`;
    }

    if (codingGuide.length > 0) {
      formatted += `### 📝 Coding Guidelines\n${codingGuide.map((g: any) => `• ${g}`).join('\n')}\n\n`;
    }

    return formatted;
  }

  /**
   * Generate professional source citation
   */
  private getSourceCitation(url: string, metadata: any): string {
    const domain = new URL(url).hostname.replace('www.', '');
    const title = metadata?.title || 'Government Policy Document';
    
    return `**📊 Source**: [${title}](${url}) • ${domain}`;
  }

  /**
   * Extract a relevant snippet from content based on URL domain context
   */
  private extractTitleSnippet(content: string, url: string): string {
    // Define context-aware snippets for different domains
    const urlContext: {[key: string]: string} = {
      'cms.gov': 'Medicare Physician Fee Schedule',
      'medicare.gov': 'Medicare Official Guidelines', 
      'hhs.gov': 'Health and Human Services Policy',
      'federalregister.gov': 'Federal Regulation'
    };

    const domain = Object.keys(urlContext).find(d => url.includes(d));
    const contextType = domain ? urlContext[domain] : 'Official Policy Document';

    // Extract first meaningful sentence
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const firstRelevantSentence = sentences[0]?.trim();

    return firstRelevantSentence ? `${contextType}: ${firstRelevantSentence}` : '';
  }

  /**
   * Poll for extraction results using extract ID
   */
  private async pollExtractResult(extractId: string, originalUrl: string, maxAttempts: number = 10): Promise<any> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`  🔍 Polling extract result (attempt ${attempt}/${maxAttempts}): ${extractId}`);
        
        const getResponse = await axios.get(
          `${this.apiUrl}/v1/extract/${extractId}`,
          {
            headers: {
              ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
            },
            timeout: 30000,
          }
        );

        const result = getResponse.data;
        if (result.success) {
          console.log(`  ✅ Extract completed successfully`);
          return result.data;
        } else {
          console.log(`  ⏳ Extract still processing: ${result.error || 'Processing...'}`);
          // Wait before next attempt
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('Extract job not found')) {
          console.log(`  ⏳ Extract job not found yet (attempt ${attempt}), retrying...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }
        console.error(`  ❌ Polling error (attempt ${attempt}):`, error instanceof Error ? error.message : error);
        if (attempt === maxAttempts) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    throw new Error(`Extract polling failed after ${maxAttempts} attempts`);
  }
}
