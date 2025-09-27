"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirecrawlService = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class FirecrawlService {
    constructor() {
        this.apiUrl = process.env.FIRECRAWL_API_URL || '';
        this.apiKey = process.env.FIRECRAWL_API_KEY || '';
        if (!this.apiUrl || !this.apiKey) {
            throw new Error('FIRECRAWL_API_URL and FIRECRAWL_API_KEY environment variables are required');
        }
    }
    async scrapeUrl(url) {
        try {
            const response = await axios_1.default.post(`${this.apiUrl}/scrape`, {
                url,
                formats: ['markdown', 'html'],
                onlyMainContent: true,
                removeBase64Images: true,
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            });
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
        }
        catch (error) {
            console.error('Firecrawl scrape error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async searchPayerPolicy(payer, specialty, cptCode, year = new Date().getFullYear()) {
        const query = `${payer} ${specialty} policy ${cptCode} ${year}`;
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        return this.scrapeUrl(searchUrl);
    }
    async getDenialPatterns(payer, cptCode) {
        const query = `${payer} denial patterns ${cptCode} medical claims`;
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        return this.scrapeUrl(searchUrl);
    }
    async getSpecialtyGuidelines(specialty, subspecialty) {
        const query = subspecialty
            ? `${specialty} ${subspecialty} coding guidelines CPT ICD`
            : `${specialty} coding guidelines CPT ICD`;
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        return this.scrapeUrl(searchUrl);
    }
}
exports.FirecrawlService = FirecrawlService;
//# sourceMappingURL=firecrawl-service.js.map