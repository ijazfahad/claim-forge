import { GoogleSearchService } from '../services/google-search';
import { GoogleSearchResult } from '../types/claim-types';
import { ValidationQuestion } from './planner-agent';

export interface SearchResult {
  question: ValidationQuestion;
  search_queries: string[];
  results: GoogleSearchResult[];
  total_results: number;
  search_timestamp: string;
}

export interface FirecrawlInput {
  question: string;
  query: string;
  urls: string[];
  question_type: string;
}

export interface GoogleSearchAgentResult {
  search_results: SearchResult[];
  firecrawl_inputs: FirecrawlInput[];
  meta: {
    total_questions: number;
    total_searches: number;
    total_results: number;
    search_duration_ms: number;
  };
}

export class GoogleSearchAgent {
  private googleSearchService: GoogleSearchService;

  constructor() {
    this.googleSearchService = new GoogleSearchService();
  }

  /**
   * Execute Google searches for all questions from Planner Agent
   */
  async executeSearches(questions: ValidationQuestion[]): Promise<GoogleSearchAgentResult> {
    const startTime = Date.now();
    const searchResults: SearchResult[] = [];

    console.log(`🔍 Executing Google searches for ${questions.length} questions...`);

    for (const question of questions) {
      console.log(`\n📋 Processing Question ${question.n}: ${question.q}`);
      console.log(`   Type: ${question.type.toUpperCase()}`);
      
      const questionResults: GoogleSearchResult[] = [];
      const allSearchQueries: string[] = [];

      // Execute searches for each search query in the question
      for (const searchQuery of question.search_queries) {
        console.log(`   🔎 Searching: "${searchQuery}"`);
        
        try {
          const results = await this.googleSearchService.searchMedicalCoding(searchQuery, 3);
          questionResults.push(...results);
          allSearchQueries.push(searchQuery);
          
          console.log(`   ✅ Found ${results.length} results`);
          
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`   ❌ Search failed for "${searchQuery}":`, error);
        }
      }

      // Remove duplicates based on URL
      const uniqueResults = this.removeDuplicateResults(questionResults);

      const searchResult: SearchResult = {
        question,
        search_queries: allSearchQueries,
        results: uniqueResults.slice(0, 3), // Limit to top 3 results
        total_results: uniqueResults.length,
        search_timestamp: new Date().toISOString()
      };

      searchResults.push(searchResult);
      
      console.log(`   📊 Total unique results: ${searchResult.results.length}`);
    }

    const endTime = Date.now();
    const searchDuration = endTime - startTime;

    const totalResults = searchResults.reduce((sum, result) => sum + result.results.length, 0);
    const totalSearches = searchResults.reduce((sum, result) => sum + result.search_queries.length, 0);

    console.log(`\n🎯 Google Search Summary:`);
    console.log(`   Questions processed: ${questions.length}`);
    console.log(`   Total searches: ${totalSearches}`);
    console.log(`   Total results: ${totalResults}`);
    console.log(`   Duration: ${searchDuration}ms`);

    // Generate Firecrawl inputs
    const firecrawlInputs = this.generateFirecrawlInputs(searchResults);
    console.log(`   🔗 Generated ${firecrawlInputs.length} Firecrawl inputs`);

    return {
      search_results: searchResults,
      firecrawl_inputs: firecrawlInputs,
      meta: {
        total_questions: questions.length,
        total_searches: totalSearches,
        total_results: totalResults,
        search_duration_ms: searchDuration
      }
    };
  }

  /**
   * Generate Firecrawl inputs from search results
   */
  private generateFirecrawlInputs(searchResults: SearchResult[]): FirecrawlInput[] {
    const firecrawlInputs: FirecrawlInput[] = [];

    for (const result of searchResults) {
      // Create one Firecrawl input per search query
      for (const query of result.search_queries) {
        const urls = result.results.map(r => r.link);
        
        firecrawlInputs.push({
          question: result.question.q,
          query: query,
          urls: urls,
          question_type: result.question.type
        });
      }
    }

    return firecrawlInputs;
  }

  /**
   * Remove duplicate search results based on URL
   */
  private removeDuplicateResults(results: GoogleSearchResult[]): GoogleSearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      if (seen.has(result.link)) {
        return false;
      }
      seen.add(result.link);
      return true;
    });
  }

  /**
   * Get search results for a specific question type
   */
  getResultsByType(searchResults: SearchResult[], type: 'basic' | 'specialty' | 'subspecialty'): SearchResult[] {
    return searchResults.filter(result => result.question.type === type);
  }

  /**
   * Get all unique URLs from search results
   */
  getAllUrls(searchResults: SearchResult[]): string[] {
    const urls = new Set<string>();
    searchResults.forEach(result => {
      result.results.forEach(searchResult => {
        urls.add(searchResult.link);
      });
    });
    return Array.from(urls);
  }

  /**
   * Get search results summary
   */
  getSearchSummary(searchResults: SearchResult[]): {
    by_type: {
      basic: number;
      specialty: number;
      subspecialty: number;
    };
    top_domains: { domain: string; count: number }[];
    total_urls: number;
  } {
    const byType = {
      basic: 0,
      specialty: 0,
      subspecialty: 0
    };

    const domainCounts = new Map<string, number>();
    let totalUrls = 0;

    searchResults.forEach(result => {
      byType[result.question.type]++;
      totalUrls += result.results.length;

      result.results.forEach(searchResult => {
        try {
          const domain = new URL(searchResult.link).hostname;
          domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
        } catch (error) {
          // Invalid URL, skip
        }
      });
    });

    const topDomains = Array.from(domainCounts.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      by_type: byType,
      top_domains: topDomains,
      total_urls: totalUrls
    };
  }
}
