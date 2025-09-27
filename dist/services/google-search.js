"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleSearchService = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class GoogleSearchService {
    constructor() {
        this.baseUrl = 'https://www.googleapis.com/customsearch/v1';
        this.apiKey = process.env.GOOGLE_SEARCH_API_KEY || '';
        this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || '';
        if (!this.apiKey || !this.searchEngineId) {
            throw new Error('GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID environment variables are required');
        }
    }
    async searchMedicalCoding(query, numResults = 5) {
        try {
            const response = await axios_1.default.get(this.baseUrl, {
                params: {
                    key: this.apiKey,
                    cx: this.searchEngineId,
                    q: query,
                    num: numResults,
                    safe: 'active',
                },
                timeout: 10000,
            });
            return response.data.items || [];
        }
        catch (error) {
            console.error('Google Search error:', error);
            return [];
        }
    }
    async searchCPTRelationships(cptCode) {
        const query = `CPT ${cptCode} bundling rules NCCI edits medical coding`;
        return this.searchMedicalCoding(query);
    }
    async searchSpecialtyInfo(specialty, subspecialty) {
        const query = subspecialty
            ? `${specialty} ${subspecialty} medical coding guidelines`
            : `${specialty} medical coding guidelines`;
        return this.searchMedicalCoding(query);
    }
    async searchPayerDenialPatterns(payer, cptCode) {
        const query = `${payer} denial patterns ${cptCode} medical claims rejection`;
        return this.searchMedicalCoding(query);
    }
    async searchCodeRelationships(icdCode, cptCode) {
        const query = `ICD-10 ${icdCode} CPT ${cptCode} medical coding relationship`;
        return this.searchMedicalCoding(query);
    }
    async searchPriorAuthRequirements(cptCode, payer) {
        const query = `CPT ${cptCode} prior authorization ${payer} requirements`;
        return this.searchMedicalCoding(query);
    }
}
exports.GoogleSearchService = GoogleSearchService;
//# sourceMappingURL=google-search.js.map