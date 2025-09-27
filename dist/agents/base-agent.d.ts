import { Agent } from '@openai/agents';
import { FirecrawlService } from '../services/firecrawl-service';
import { GoogleSearchService } from '../services/google-search';
import { RedisService } from '../services/redis-service';
export declare abstract class BaseAgent {
    protected firecrawl: FirecrawlService;
    protected googleSearch: GoogleSearchService;
    protected redis: RedisService;
    constructor();
    protected createAgent(name: string, instructions: string, tools?: any[]): Agent;
    protected executeAgent(agent: Agent, input: string): Promise<any>;
    protected createWebSearchTool(): {
        type: string;
        function: {
            name: string;
            description: string;
            parameters: {
                type: string;
                properties: {
                    query: {
                        type: string;
                        description: string;
                    };
                    num_results: {
                        type: string;
                        description: string;
                        default: number;
                    };
                };
                required: string[];
            };
        };
    };
    protected createScrapeTool(): {
        type: string;
        function: {
            name: string;
            description: string;
            parameters: {
                type: string;
                properties: {
                    url: {
                        type: string;
                        description: string;
                    };
                };
                required: string[];
            };
        };
    };
    protected createFirecrawlTool(): {
        type: string;
        function: {
            name: string;
            description: string;
            parameters: {
                type: string;
                properties: {
                    url: {
                        type: string;
                        description: string;
                    };
                    formats: {
                        type: string;
                        items: {
                            type: string;
                            properties: {
                                type: {
                                    type: string;
                                    enum: string[];
                                    description: string;
                                };
                                schema: {
                                    type: string;
                                    description: string;
                                };
                                prompt: {
                                    type: string;
                                    description: string;
                                };
                            };
                            required: string[];
                        };
                        description: string;
                        default: {
                            type: string;
                        }[];
                    };
                    onlyMainContent: {
                        type: string;
                        description: string;
                        default: boolean;
                    };
                };
                required: string[];
            };
        };
    };
    protected createCacheTool(): {
        type: string;
        function: {
            name: string;
            description: string;
            parameters: {
                type: string;
                properties: {
                    key: {
                        type: string;
                        description: string;
                    };
                    value: {
                        type: string;
                        description: string;
                    };
                    ttl: {
                        type: string;
                        description: string;
                        default: number;
                    };
                };
                required: string[];
            };
        };
    };
    protected createGetCacheTool(): {
        type: string;
        function: {
            name: string;
            description: string;
            parameters: {
                type: string;
                properties: {
                    key: {
                        type: string;
                        description: string;
                    };
                };
                required: string[];
            };
        };
    };
    protected handleToolCall(toolName: string, args: any): Promise<any>;
    private makeFirecrawlRequest;
}
//# sourceMappingURL=base-agent.d.ts.map