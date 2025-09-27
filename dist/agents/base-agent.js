"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = void 0;
const agents_1 = require("@openai/agents");
const firecrawl_service_1 = require("../services/firecrawl-service");
const google_search_1 = require("../services/google-search");
const redis_service_1 = require("../services/redis-service");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class BaseAgent {
    constructor() {
        this.firecrawl = new firecrawl_service_1.FirecrawlService();
        this.googleSearch = new google_search_1.GoogleSearchService();
        this.redis = new redis_service_1.RedisService();
    }
    createAgent(name, instructions, tools = []) {
        try {
            const agent = new agents_1.Agent({
                name,
                instructions,
                tools,
                model: 'gpt-4o',
            });
            return agent;
        }
        catch (error) {
            console.error(`Error creating agent ${name}:`, error);
            throw error;
        }
    }
    async executeAgent(agent, input) {
        try {
            const result = await (0, agents_1.run)(agent, input);
            return JSON.parse(result.finalOutput || '{}');
        }
        catch (error) {
            console.error('Error executing agent:', error);
            throw error;
        }
    }
    createWebSearchTool() {
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
    createScrapeTool() {
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
    createFirecrawlTool() {
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
                            default: [{ 'type': 'markdown' }]
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
    createCacheTool() {
        return {
            type: 'function',
            function: {
                name: 'cache_data',
                description: 'Cache data in Redis for future use',
                parameters: {
                    type: 'object',
                    properties: {
                        key: {
                            type: 'string',
                            description: 'Cache key'
                        },
                        value: {
                            type: 'string',
                            description: 'Data to cache (JSON string)'
                        },
                        ttl: {
                            type: 'number',
                            description: 'Time to live in seconds (default: 3600)',
                            default: 3600
                        }
                    },
                    required: ['key', 'value']
                }
            }
        };
    }
    createGetCacheTool() {
        return {
            type: 'function',
            function: {
                name: 'get_cached_data',
                description: 'Get cached data from Redis',
                parameters: {
                    type: 'object',
                    properties: {
                        key: {
                            type: 'string',
                            description: 'Cache key to retrieve'
                        }
                    },
                    required: ['key']
                }
            }
        };
    }
    async handleToolCall(toolName, args) {
        switch (toolName) {
            case 'web_search':
                return await this.googleSearch.searchMedicalCoding(args.query, args.num_results);
            case 'scrape_url':
                return await this.firecrawl.scrapeUrl(args.url);
            case 'firecrawl_request':
                return await this.makeFirecrawlRequest(args.url, args.formats, args.onlyMainContent);
            case 'cache_data':
                await this.redis.redis.setex(args.key, args.ttl || 3600, args.value);
                return { success: true, message: 'Data cached successfully' };
            case 'get_cached_data':
                const cached = await this.redis.redis.get(args.key);
                return cached ? JSON.parse(cached) : null;
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }
    async makeFirecrawlRequest(url, formats = [{ type: 'markdown' }], onlyMainContent = true) {
        try {
            const axios = require('axios');
            const firecrawlUrl = process.env.FIRECRAWL_API_URL;
            const apiKey = process.env.FIRECRAWL_API_KEY;
            if (!firecrawlUrl || !apiKey) {
                throw new Error('FIRECRAWL_API_URL and FIRECRAWL_API_KEY environment variables are required');
            }
            const response = await axios.post(`${firecrawlUrl}/v2/scrape`, {
                url,
                formats,
                onlyMainContent,
                removeBase64Images: true,
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            });
            return {
                success: true,
                data: response.data.data || response.data,
                metadata: {
                    title: response.data.metadata?.title || '',
                    description: response.data.metadata?.description || '',
                    url: url,
                },
            };
        }
        catch (error) {
            console.error('Firecrawl HTTP request error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}
exports.BaseAgent = BaseAgent;
//# sourceMappingURL=base-agent.js.map