import { Agent, run, Tool } from '@openai/agents';
import { FirecrawlService } from '../services/firecrawl-service';
import { GoogleSearchService } from '../services/google-search';
import { OpenRouterService } from '../services/openrouter-service';
import { AuditLogger } from '../services/audit-logger';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export abstract class BaseAgent {
  protected firecrawl: FirecrawlService;
  protected googleSearch: GoogleSearchService;
  protected openRouter: OpenRouterService;
  protected auditLogger?: AuditLogger;

  constructor() {
    this.firecrawl = new FirecrawlService();
    this.googleSearch = new GoogleSearchService();
    this.openRouter = new OpenRouterService();
  }

  /**
   * Set audit logger for this agent instance
   */
  setAuditLogger(auditLogger: AuditLogger): void {
    this.auditLogger = auditLogger;
  }

  /**
   * Create an OpenAI agent with tools
   */
  protected createAgent(
    name: string,
    instructions: string,
    tools: any[] = []
  ): Agent {
    try {
      const agent = new Agent({
        name,
        instructions,
        tools,
        model: 'gpt-4o',
      });

      return agent;
    } catch (error) {
      console.error(`Error creating agent ${name}:`, error);
      throw error;
    }
  }

  /**
   * Execute agent with input using OpenRouter
   */
  protected async executeAgent(agent: Agent, input: string, options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    claimId?: string;
  }): Promise<any> {
    const startTime = Date.now();
    const model = options?.model || process.env.BASE_AGENT_MODEL || 'gpt-4o-mini';
    const agentName = agent.name || 'Unknown Agent';
    
    try {
      // Use OpenRouter for agent execution instead of direct OpenAI
      const response = await this.openRouter.generateResponse(
        input,
        model,
        {
          temperature: options?.temperature || parseFloat(process.env.BASE_AGENT_TEMPERATURE || '0.1'),
          max_tokens: options?.max_tokens || parseInt(process.env.BASE_AGENT_MAX_TOKENS || '2000'),
          system_prompt: typeof agent.instructions === 'string' ? agent.instructions : 'You are a helpful AI assistant.'
        }
      );

      const processingTime = Date.now() - startTime;
      let responseText = response || '{}';
      
      // Remove markdown code blocks if present
      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Find JSON object boundaries
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}') + 1;
      
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        responseText = responseText.substring(jsonStart, jsonEnd);
      }
      
      // Try to parse JSON with better error handling
      let parsedResult: any;
      let parseSuccess = true;
      let parseError: any = null;
      
      try {
        parsedResult = JSON.parse(responseText);
      } catch (parseErr) {
        parseSuccess = false;
        parseError = parseErr;
        console.error('JSON parse error:', parseErr);
        console.error('Raw response:', responseText.substring(0, 500) + '...');
        
        // Try to fix common JSON issues
        let fixedText = responseText;
        
        // Fix unescaped quotes in string values
        fixedText = fixedText.replace(/"([^"]*)"([^"]*)"([^"]*)":/g, '"$1\\"$2\\"$3":');
        fixedText = fixedText.replace(/"([^"]*)"([^"]*)"([^"]*)",/g, '"$1\\"$2\\"$3",');
        fixedText = fixedText.replace(/"([^"]*)"([^"]*)"([^"]*)"}/g, '"$1\\"$2\\"$3"}');
        
        // Try parsing the fixed version
        try {
          parsedResult = JSON.parse(fixedText);
          parseSuccess = true;
        } catch (secondError) {
          console.error('Second JSON parse error:', secondError);
          // Return a default structure if all parsing fails
          parsedResult = {
            error: 'Failed to parse agent response',
            raw_response: responseText.substring(0, 200)
          };
        }
      }

      // Log LLM interaction to audit system
      if (this.auditLogger) {
        await this.auditLogger.logLLMInteraction(
          agentName,
          model,
          input,
          responseText,
          processingTime,
          parseSuccess,
          parseError ? parseError.message : undefined,
          undefined, // tokens_used - not available from OpenRouter
          options?.claimId
        );
      }

      return parsedResult;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Log failed LLM interaction
      if (this.auditLogger) {
        await this.auditLogger.logLLMInteraction(
          agentName,
          model,
          input,
          '',
          processingTime,
          false,
          error instanceof Error ? error.message : 'Unknown error',
          undefined,
          options?.claimId
        );
      }
      
      console.error('Error executing agent:', error);
      throw error;
    }
  }

  /**
   * Tool: Search web for information
   */
  protected createWebSearchTool() {
    return {
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Search the web for medical coding information, payer policies, or denial patterns',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for medical coding information'
            },
            num_results: {
              type: 'number',
              description: 'Number of results to return (default: 5)',
              default: 5
            }
          },
          required: ['query']
        }
      }
    };
  }

  /**
   * Tool: Scrape URL for content
   */
  protected createScrapeTool() {
    return {
      type: 'function',
      function: {
        name: 'scrape_url',
        description: 'Scrape a URL for content using Firecrawl',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to scrape for content'
            }
          },
          required: ['url']
        }
      }
    };
  }

  /**
   * Tool: Make direct HTTP request to Firecrawl
   */
  protected createFirecrawlTool() {
    return {
      type: 'function',
      function: {
        name: 'firecrawl_request',
        description: 'Make direct HTTP request to Firecrawl API for document extraction with structured JSON output',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to extract content from'
            },
            formats: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['json', 'markdown', 'html', 'text'],
                    description: 'Output format type'
                  },
                  schema: {
                    type: 'object',
                    description: 'JSON schema for structured extraction (required for json type)'
                  },
                  prompt: {
                    type: 'string',
                    description: 'Extraction prompt for structured data (required for json type)'
                  }
                },
                required: ['type']
              },
              description: 'Output formats to extract',
              default: [{'type': 'markdown'}]
            },
            onlyMainContent: {
              type: 'boolean',
              description: 'Extract only main content',
              default: true
            }
          },
          required: ['url']
        }
      }
    };
  }



  /**
   * Handle tool calls
   */
  protected async handleToolCall(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case 'web_search':
        return await this.googleSearch.searchMedicalCoding(args.query, args.num_results);
      
      case 'scrape_url':
        return await this.firecrawl.scrapeUrl(args.url);
      
      case 'firecrawl_request':
        return await this.makeFirecrawlRequest(args.url, args.formats, args.onlyMainContent);
      
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Make direct HTTP request to Firecrawl
   */
  private async makeFirecrawlRequest(
    url: string, 
    formats: any[] = [{ type: 'markdown' }], 
    onlyMainContent: boolean = true
  ): Promise<any> {
    try {
      const axios = require('axios');
      const firecrawlUrl = process.env.FIRECRAWL_API_URL;
      const apiKey = process.env.FIRECRAWL_API_KEY;
      
      if (!firecrawlUrl || !apiKey) {
        throw new Error('FIRECRAWL_API_URL and FIRECRAWL_API_KEY environment variables are required');
      }

      const response = await axios.post(
        `${firecrawlUrl}/v2/scrape`,
        {
          url,
          formats,
          onlyMainContent,
          removeBase64Images: true,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      return {
        success: true,
        data: response.data.data || response.data,
        metadata: {
          title: response.data.metadata?.title || '',
          description: response.data.metadata?.description || '',
          url: url,
        },
      };
    } catch (error) {
      console.error('Firecrawl HTTP request error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
