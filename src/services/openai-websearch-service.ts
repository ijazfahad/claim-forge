import OpenAI from 'openai';
import dotenv from 'dotenv';
import { AuditLogger } from './audit-logger';

// Load environment variables
dotenv.config();

export interface OpenAIWebSearchResult {
  success: boolean;
  data?: {
    answer: string;
    confidence: number;
    sources: Array<{
      title: string;
      url: string;
      snippet: string;
    }>;
    reasoning: string;
    search_query: string;
    processing_time_ms: number;
    data_source: 'training_data' | 'web_search';
  };
  error?: string;
}

export class OpenAIWebSearchService {
  private openai: OpenAI;
  private auditLogger?: AuditLogger;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  /**
   * Set audit logger for this service instance
   */
  setAuditLogger(auditLogger: AuditLogger): void {
    this.auditLogger = auditLogger;
  }

  /**
   * Search and analyze using OpenAI's Responses API with web search
   */
  async searchAndAnalyze(question: string, domains?: string[], claimId?: string): Promise<OpenAIWebSearchResult> {
    const startTime = Date.now();
    const requestData = {
      question,
      model: 'gpt-4o',
      tool: 'web_search'
    };

    try {
      console.log(`🔍 OpenAI Responses API Web Search: "${question}"`);
      console.log(`   🎯 Searching domains: ${domains && domains.length > 0 ? domains.join(', ') : 'default (7 domains)'}`);
      
      // Use the Responses API endpoint for web search
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'responses=v1'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          input: [
            {
              role: 'system',
                      content: `You are a medical coding policy researcher. Search for SPECIFIC, EXACT information only.

SEARCH INSTRUCTIONS:
- Search for EXACT policy documents, coverage determinations, and official guidelines
- Look for SPECIFIC answers to the question asked
- If you cannot find the EXACT information, say "I was unable to locate specific information"
- Do NOT search broadly or provide general information
- Focus on finding the precise answer to the specific question

CONFIDENCE RULES:
- High confidence (0.8-1.0): ONLY when you find the EXACT, specific information requested
- Medium confidence (0.6-0.8): When you find related but not exact information
- LOW confidence (0.2-0.4): When you cannot find specific information (most common case)

RESPONSE:
- Give a direct, specific answer if found
- If not found, say "I was unable to locate specific information" with LOW confidence
- Be brief and focused`
            },
            {
              role: 'user',
              content: question
            }
          ],
          tools: [
            {
              type: 'web_search',
              search_context_size: 'low',
              filters: {
                allowed_domains: domains && domains.length > 0 ? domains : [
                  // Minimal default domains - only the most essential to reduce costs
                  'cms.gov',
                  'aetna.com',
                  'anthem.com',
                  'bcbs.com',
                  'cigna.com',
                  'humana.com',
                  'uhc.com'
                ]
              },
            }
          ],
          include: ['web_search_call.action.sources'],
          temperature: 0.1,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI Responses API Error Response:', errorText);
        throw new Error(`OpenAI Responses API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const responseData = await response.json();

      const processingTime = Date.now() - startTime;
      
      // Extract the response from Responses API
      // The Responses API uses 'output' array instead of 'choices'
      const output = responseData.output;
      if (!output || !Array.isArray(output)) {
        console.log('Response structure:', Object.keys(responseData));
        throw new Error('No output from OpenAI Responses API');
      }

      // Find the message in the output array
      const messageOutput = output.find((item: any) => item.type === 'message');
      if (!messageOutput || !messageOutput.content) {
        throw new Error('No message content in OpenAI Responses API output');
      }

      // Extract the text content
      const textContent = messageOutput.content.find((item: any) => item.type === 'output_text');
      if (!textContent) {
        throw new Error('No text content in OpenAI Responses API message');
      }

      const answer = textContent.text || 'No answer provided';
      
      // Extract sources from Responses API web search results
      const sources: Array<{ title: string; url: string; snippet: string }> = [];
      let searchQuery = question;
      
      // Extract sources from URL citations in the text content
      if (textContent.annotations) {
        textContent.annotations.forEach((annotation: any) => {
          if (annotation.type === 'url_citation') {
            sources.push({
              title: annotation.title || 'Web Search Result',
              url: annotation.url,
              snippet: `Information from web search: ${annotation.url}`
            });
          }
        });
      }
      
      // Also look for web search call in the output to get the search query and sources
      const webSearchOutput = output.find((item: any) => item.type === 'web_search_call');
      if (webSearchOutput && webSearchOutput.action) {
        searchQuery = webSearchOutput.action.query || question;
        
              // Extract sources from the web search action if available
              if (webSearchOutput.action.sources && Array.isArray(webSearchOutput.action.sources)) {
                // Add all sources (no limiting since we already paid for the searches)
                webSearchOutput.action.sources.forEach((source: any) => {
                  // Only add if not already in sources (avoid duplicates)
                  const exists = sources.some(s => s.url === source.url);
                  if (!exists) {
                    sources.push({
                      title: source.title || 'Web Search Result',
                      url: source.url,
                      snippet: source.snippet || `Information from web search: ${source.url}`
                    });
                  }
                });
              }
      }
      
      // If no web search sources found, check if it's from training data
      if (sources.length === 0) {
        sources.push({
          title: 'OpenAI Knowledge Base',
          url: 'https://openai.com',
          snippet: 'Information from OpenAI training data'
        });
      }

      // Calculate confidence based on response quality and sources
      let confidence = 0.7; // Base confidence
      let dataSource: 'training_data' | 'web_search' = 'training_data';
      
      // Check if the answer indicates no specific information was found
      const noSpecificInfoFound = answer.toLowerCase().includes('unable to locate') || 
                                 answer.toLowerCase().includes('could not find') ||
                                 answer.toLowerCase().includes('no specific') ||
                                 answer.toLowerCase().includes('not found') ||
                                 answer.toLowerCase().includes('unable to find') ||
                                 answer.toLowerCase().includes('i cannot find') ||
                                 answer.toLowerCase().includes('no information found');
      
      if (noSpecificInfoFound) {
        // Significantly reduce confidence when no specific information is found
        confidence = 0.2; // Very low confidence for "not found" responses
        console.log(`   ⚠️  OpenAI Web Search: No specific information found - reducing confidence to ${(confidence * 100).toFixed(1)}%`);
      } else {
        // Only give high confidence if we have specific sources and detailed answers
        if (sources.length > 0) confidence += 0.2;
        if (answer.length > 150) confidence += 0.1; // Require more detailed answers
        if (answer.includes('http') || answer.includes('www')) {
          confidence += 0.1;
          dataSource = 'web_search';
        }
        // Cap confidence at 0.8 unless we have very strong evidence
        if (confidence > 0.8 && sources.length < 2) {
          confidence = 0.8;
        }
      }
      
      confidence = Math.min(confidence, 1.0);

      const result: OpenAIWebSearchResult = {
        success: true,
        data: {
          answer,
          confidence,
          sources,
          reasoning: `OpenAI knowledge base analysis with ${sources.length} sources found`,
          search_query: searchQuery,
          processing_time_ms: processingTime,
          data_source: dataSource
        }
      };

      // Log successful OpenAI web search interaction
      if (this.auditLogger) {
        await this.auditLogger.logServiceInteraction(
          'openai_websearch',
          'search_and_analyze',
          requestData,
          {
            success: true,
            answerLength: answer.length,
            confidence,
            sourcesCount: sources.length,
            searchQuery
          },
          processingTime,
          true,
          undefined,
          claimId
        );
      }

      console.log(`✅ OpenAI Responses API Web Search completed in ${processingTime}ms`);
      console.log(`   📊 Confidence: ${(confidence * 100).toFixed(1)}%`);
      console.log(`   🔗 Sources: ${sources.length}`);
      console.log(`   📝 Answer preview: ${answer.substring(0, 100)}...`);

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log failed OpenAI web search interaction
      if (this.auditLogger) {
        await this.auditLogger.logServiceInteraction(
          'openai_websearch',
          'search_and_analyze',
          requestData,
          { success: false, error: errorMessage },
          processingTime,
          false,
          errorMessage,
          claimId
        );
      }

      console.error('OpenAI Responses API Web Search error:', error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Search for medical coding specific information
   */
  async searchMedicalCoding(question: string, domains?: string[], claimId?: string): Promise<OpenAIWebSearchResult> {
    const enhancedQuestion = `Medical coding question: ${question}. Please search for current official policies, guidelines, and coverage determinations from authoritative sources like CMS, payer websites, and medical coding organizations.`;
    return this.searchAndAnalyze(enhancedQuestion, domains, claimId);
  }

  /**
   * Search for payer-specific information
   */
  async searchPayerPolicy(payer: string, question: string, domains?: string[], claimId?: string): Promise<OpenAIWebSearchResult> {
    const enhancedQuestion = `${payer} policy question: ${question}. Please search for official ${payer} policies, coverage determinations, and requirements from their official website and authorized sources.`;
    return this.searchAndAnalyze(enhancedQuestion, domains, claimId);
  }
}
