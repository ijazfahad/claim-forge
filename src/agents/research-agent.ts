import { OpenRouterService } from '../services/openrouter-service';
import { FirecrawlService } from '../services/firecrawl-service';
import { GoogleSearchAgent } from './google-search-agent';
import { OpenAIWebSearchService } from '../services/openai-websearch-service';
import { AuditLogger } from '../services/audit-logger';
import { ValidationQuestion } from './planner-agent';
import { IndividualResearchResult, ConflictInfo, EnhancedResearchResult, PolicyReference } from '../types/claim-types';

export interface ResearchResult {
  question: string;
  answer: string;
  confidence: number;
  source: string;
  metadata: {
    extraction_method: 'firecrawl' | 'multi-model' | 'enhanced-analysis' | 'openai-websearch' | 'multi-source';
    processing_time: number;
    escalation_reason?: string;
    structured_data?: any;
  };
  // New consolidated fields
  firecrawl_data?: {
    confidence: number;
    content_length: number;
    structured_data?: any;
    urls_processed: string[];
  };
  multi_model_data?: {
    claude: {
      answer: string;
      confidence: number;
      reasoning: string;
    };
    gpt5: {
      answer: string;
      confidence: number;
      reasoning: string;
    };
    deepseek: {
      answer: string;
      confidence: number;
      reasoning: string;
    };
    individual_confidences: {
      claude: number;
      gpt5: number;
      deepseek: number;
    };
    consensus: {
      final_confidence: number;
      agreement_level: 'high' | 'medium' | 'low';
      conflicting_models: string[];
    };
    answer_previews: {
      claude: string;
      gpt5: string;
      deepseek: string;
    };
  };
  openai_websearch_data?: {
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
  };
  recommendations: string[];
  enhanced_analysis?: EnhancedResearchResult;
}

export interface ConsensusResult {
  question: string;
  answers: {
    claude: { answer: string; confidence: number; reasoning: string };
    gpt5: { answer: string; confidence: number; reasoning: string };
    deepseek: { answer: string; confidence: number; reasoning: string };
  };
  consensus: {
    final_answer: string;
    confidence: number;
    agreement_level: 'high' | 'medium' | 'low';
    conflicting_models: string[];
  };
  multi_model_data?: {
    claude: {
      answer: string;
      confidence: number;
      reasoning: string;
    };
    gpt5: {
      answer: string;
      confidence: number;
      reasoning: string;
    };
    deepseek: {
      answer: string;
      confidence: number;
      reasoning: string;
    };
    individual_confidences: {
      claude: number;
      gpt5: number;
      deepseek: number;
    };
    consensus: {
      final_confidence: number;
      agreement_level: 'high' | 'medium' | 'low';
      conflicting_models: string[];
    };
    answer_previews: {
      claude: string;
      gpt5: string;
      deepseek: string;
    };
  };
  recommendations: string[];
}


export class ResearchAgent {
  private firecrawl: FirecrawlService;
  private googleSearch: GoogleSearchAgent;
  private openRouter: OpenRouterService;
  private openaiWebSearch: OpenAIWebSearchService;
  private auditLogger?: AuditLogger;

  constructor() {
    this.firecrawl = new FirecrawlService();
    this.googleSearch = new GoogleSearchAgent();
    this.openRouter = new OpenRouterService();
    this.openaiWebSearch = new OpenAIWebSearchService();
  }

  /**
   * Set audit logger for this agent instance
   */
  setAuditLogger(auditLogger: AuditLogger): void {
    this.auditLogger = auditLogger;
    // Pass audit logger to services
    this.firecrawl.setAuditLogger(auditLogger);
    this.openaiWebSearch.setAuditLogger(auditLogger);
  }

  /**
   * Main research method - returns raw individual results for Reviewer Agent
   */
  async executeResearch(questions: ValidationQuestion[]): Promise<ResearchResult[]> {
    console.log(`\n🔬 RESEARCH AGENT: Starting research for ${questions.length} question(s)`);
    console.log('📊 Strategy: Parallel Firecrawl + Multi-Model analysis');
    
    const results: ResearchResult[] = [];
    let firecrawlSuccessCount = 0;
    let multiModelSuccessCount = 0;
    const startTime = Date.now();

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🔍 QUESTION ${i + 1}/${questions.length}`);
      console.log(`${'='.repeat(50)}`);
      console.log(`📝 Question: ${question.q}`);
      console.log(`🏷️  Type: ${question.type}`);
      console.log(`⚠️  Risk Flags: ${Object.entries(question.risk_flags).filter(([k,v]) => v).map(([k,v]) => k).join(', ') || 'None'}`);
      
      try {
        // Always run Google search first to get URLs
        console.log(`\n🔍 STEP 1: Google Search`);
        console.log(`   📋 Search Queries: ${question.search_queries.join(', ')}`);
        
        const searchResults = await this.googleSearch.executeSearches([question]);
        const hasUrls = searchResults.firecrawl_inputs.length > 0;
        
        console.log(`   ✅ URLs Found: ${searchResults.firecrawl_inputs.length}`);
        if (hasUrls) {
          searchResults.firecrawl_inputs[0].urls.forEach((url, idx) => {
            console.log(`      ${idx + 1}. ${url}`);
          });
        }
        
        // Run all methods in parallel
        console.log(`\n🚀 STEP 2: Parallel Analysis`);
        const promises: Promise<any>[] = [
          this.executeMultiModelAnalysis([question])
          // OpenAI Web Search removed - too expensive (searches 20-24 URLs per question)
        ];
        
        // Only add Firecrawl if we have URLs
        if (hasUrls) {
          promises.push(this.executeFirecrawlResearchWithUrls([question], searchResults.firecrawl_inputs[0]));
        } else {
          console.log(`   ⚠️  Skipping Firecrawl - no URLs found from Google search`);
        }
        
        const results_array = await Promise.all(promises);
        const multiModelResult = results_array[0];
        const firecrawlResult = hasUrls ? results_array[1] : [];

        // Combine raw results - let Reviewer Agent handle conflict detection
        const combinedResult = this.combineRawResults(firecrawlResult, multiModelResult, [], question, startTime);
        
        if (combinedResult) {
          results.push(combinedResult);
          
          // Count successes for logging
          if (combinedResult.firecrawl_data) {
            firecrawlSuccessCount++;
          }
          if (combinedResult.multi_model_data) {
            multiModelSuccessCount++;
          }
          
          console.log(`\n✅ QUESTION ${i + 1} COMPLETED`);
          console.log(`   📊 Sources: ${combinedResult.source}`);
          console.log(`   🎯 Confidence: ${(combinedResult.confidence * 100).toFixed(1)}%`);
          console.log(`   📝 Answer Preview: ${combinedResult.answer.substring(0, 100)}...`);
        } else {
          // Fallback: create a basic result
          console.log(`\n⚠️  QUESTION ${i + 1} - NO RESULTS`);
          results.push({
            question: question.q,
            answer: 'Unable to find relevant information for this question.',
            confidence: 0.1,
            source: 'No Results',
            metadata: {
              extraction_method: 'multi-model',
              processing_time: Date.now() - startTime,
              escalation_reason: 'No results from any method'
            },
            recommendations: ['❌ No results found - Manual review required', '📞 Contact payer directly for policy clarification']
          });
        }
      } catch (error) {
        console.error(`\n❌ QUESTION ${i + 1} FAILED:`, error);
        // Fallback to basic answer
        results.push({
          question: question.q,
          answer: 'Unable to find specific policy information for this question.',
          confidence: 0.1,
          source: 'Fallback',
          metadata: {
            extraction_method: 'firecrawl',
            processing_time: Date.now() - startTime,
            escalation_reason: 'Error in research process'
          },
          recommendations: ['❌ Research failed - Manual review required', '📞 Contact payer directly for policy clarification']
        });
      }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`📊 RESEARCH AGENT SUMMARY`);
    console.log(`${'='.repeat(50)}`);
    console.log(`📝 Total Questions: ${questions.length}`);
    console.log(`🔥 Firecrawl Successes: ${firecrawlSuccessCount}`);
    console.log(`🤖 Multi-Model Successes: ${multiModelSuccessCount}`);
    console.log(`📈 Success Rate: ${((firecrawlSuccessCount + multiModelSuccessCount) / questions.length * 100).toFixed(1)}%`);
    console.log(`⏱️  Total Processing Time: ${Date.now() - startTime}ms`);
    
    // Log Research Agent execution to audit system
    if (this.auditLogger) {
      await this.auditLogger.logAuditEvent(
        'research',
        'ResearchAgent',
        'execute_research',
        { 
          questions_count: questions.length,
          firecrawl_successes: firecrawlSuccessCount,
          multi_model_successes: multiModelSuccessCount
        },
        { 
          total_results: results.length,
          success_rate: ((firecrawlSuccessCount + multiModelSuccessCount) / questions.length * 100).toFixed(1) + '%',
          processing_time_ms: Date.now() - startTime
        },
        { 
          strategy: 'Parallel Firecrawl + Multi-Model analysis',
          results_summary: results.map(r => ({
            question: r.question.substring(0, 50) + '...',
            confidence: r.confidence,
            source: r.source
          }))
        },
        Date.now() - startTime,
        true,
        undefined,
        undefined
      );
    }
    
    return results;
  }

  /**
   * Execute Firecrawl research with pre-provided URLs
   */
  async executeFirecrawlResearchWithUrls(questions: ValidationQuestion[], firecrawlInput: any): Promise<ResearchResult[]> {
    const results: ResearchResult[] = [];
    const startTime = Date.now();

    for (const question of questions) {
      try {
        console.log(`   🔍 Firecrawl processing ${firecrawlInput.urls.length} URLs...`);
        
        // Extract content using Firecrawl
        const firecrawlResponse = await this.firecrawl.extractContentForQuestion(
          firecrawlInput.question,
          firecrawlInput.question_type,
          firecrawlInput.urls,
          firecrawlInput.query
        );

        if (firecrawlResponse.success && firecrawlResponse.data) {
          // Calculate confidence based on content quality and relevance
          const confidence = this.calculateContentConfidence(firecrawlResponse.data, question);
          
          // Log Firecrawl extraction details
          console.log(`   🔍 Firecrawl extraction details:`);
          console.log(`      📊 Confidence score: ${confidence.toFixed(3)}`);
          console.log(`      📝 Content length: ${firecrawlResponse.data.content.length} chars`);
          console.log(`      🔗 URLs processed: ${firecrawlInput.urls.length}`);
          if (firecrawlResponse.data.structured_data) {
            console.log(`      🏗️  Structured data available: ${!!firecrawlResponse.data.structured_data}`);
            console.log(`      🔑 Answer length: ${firecrawlResponse.data.structured_data.answer?.length || 0} chars`);
            console.log(`      📋 Policy reference: ${!!firecrawlResponse.data.structured_data.policy_reference}`);
            
            // Show the actual Firecrawl answer
            if (firecrawlResponse.data.structured_data.answer) {
              console.log(`      📄 Firecrawl Answer: "${firecrawlResponse.data.structured_data.answer.substring(0, 200)}${firecrawlResponse.data.structured_data.answer.length > 200 ? '...' : ''}"`);
            }
            
            // Show policy reference details
            if (firecrawlResponse.data.structured_data.policy_reference) {
              const ref = firecrawlResponse.data.structured_data.policy_reference;
              console.log(`      📍 Policy Reference:`);
              console.log(`         🔗 URL: ${ref.url || 'N/A'}`);
              console.log(`         📄 Document Type: ${ref.document_type || 'N/A'}`);
              if (ref.sentence) {
                console.log(`         📝 Key Sentence: "${ref.sentence.substring(0, 150)}${ref.sentence.length > 150 ? '...' : ''}"`);
              }
            }
          }
          
          // Generate recommendations based on Firecrawl results
          const recommendations = this.generateRecommendations(question, firecrawlResponse.data, confidence, 'firecrawl');
          
          results.push({
            question: question.q,
            answer: firecrawlResponse.data.content,
            confidence,
            source: 'Firecrawl Extraction',
            metadata: {
              extraction_method: 'firecrawl',
              processing_time: Date.now() - startTime,
              escalation_reason: 'Firecrawl extraction successful'
            },
            recommendations
          });
        } else {
          console.log(`   ❌ Firecrawl extraction failed: ${firecrawlResponse.error}`);
        }
      } catch (error) {
        console.error(`   ❌ Firecrawl research failed for question: ${question.q}`, error);
      }
    }

    return results;
  }

  /**
   * Phase 1: Execute Firecrawl research (cost-effective) - Legacy method
   */
  async executeFirecrawlResearch(questions: ValidationQuestion[]): Promise<ResearchResult[]> {
    const results: ResearchResult[] = [];
    const startTime = Date.now();

    for (const question of questions) {
      try {
        // Get URLs from Google Search
        const searchResults = await this.googleSearch.executeSearches([question]);
        
        if (searchResults.firecrawl_inputs.length > 0) {
          const firecrawlInput = searchResults.firecrawl_inputs[0];
          
          // Extract content using Firecrawl
          const firecrawlResponse = await this.firecrawl.extractContentForQuestion(
            firecrawlInput.question,
            firecrawlInput.question_type,
            firecrawlInput.urls,
            firecrawlInput.query
          );

          if (firecrawlResponse.success && firecrawlResponse.data) {
            // Calculate confidence based on content quality and relevance
            const confidence = this.calculateContentConfidence(firecrawlResponse.data, question);
            
            // Log Firecrawl extraction details
            console.log(`🔍 Firecrawl extraction details:`);
            console.log(`   📊 Confidence score: ${confidence.toFixed(3)}`);
            console.log(`   📝 Content length: ${firecrawlResponse.data.content.length} chars`);
            if (firecrawlResponse.data.structured_data) {
              console.log(`   🏗️  Structured data available: ${!!firecrawlResponse.data.structured_data}`);
              console.log(`   🔑 Answer length: ${firecrawlResponse.data.structured_data.answer?.length || 0} chars`);
              console.log(`   📋 Policy reference: ${!!firecrawlResponse.data.structured_data.policy_reference}`);
            }
            
            // Generate recommendations based on Firecrawl results
            const recommendations = this.generateRecommendations(question, firecrawlResponse.data, confidence, 'firecrawl');
            
            results.push({
              question: question.q,
              answer: firecrawlResponse.data.content,
              confidence,
              source: 'Firecrawl Extraction',
              metadata: {
                extraction_method: 'firecrawl',
                processing_time: Date.now() - startTime
              },
              firecrawl_data: {
                confidence,
                content_length: firecrawlResponse.data.content.length,
                structured_data: firecrawlResponse.data.structured_data,
                urls_processed: [firecrawlInput.urls[0]] // Simplified for now
              },
              recommendations
            });
          }
        }
      } catch (error) {
        console.error(`Firecrawl research failed for: ${question.q}`, error);
      }
    }

    return results;
  }

  /**
   * Phase 2: Execute multi-model analysis (escalation only)
   */
  async executeMultiModelAnalysis(questions: ValidationQuestion[]): Promise<ConsensusResult[]> {
    const results: ConsensusResult[] = [];
    const startTime = Date.now();

    for (const question of questions) {
      try {
        // Execute parallel analysis across Claude, GPT-5, and DeepSeek using OpenRouter
        const parallelResults = await this.openRouter.executeParallelAnalysis(question.q);
        
        // Log individual model confidence levels
        console.log(`🤖 Multi-Model Analysis Results:`);
        console.log(`   🧠 Claude confidence: ${(parallelResults.claude.confidence * 100).toFixed(1)}%`);
        console.log(`   🧠 GPT-5 confidence: ${(parallelResults.gpt5.confidence * 100).toFixed(1)}%`);
        console.log(`   🧠 DeepSeek confidence: ${(parallelResults.deepseek.confidence * 100).toFixed(1)}%`);
        console.log(`   📝 Claude answer preview: ${parallelResults.claude.answer.substring(0, 100)}...`);
        console.log(`   📝 GPT-5 answer preview: ${parallelResults.gpt5.answer.substring(0, 100)}...`);
        console.log(`   📝 DeepSeek answer preview: ${parallelResults.deepseek.answer.substring(0, 100)}...`);
        
        // Build consensus
        const consensus = this.buildConsensus(parallelResults.claude, parallelResults.gpt5, parallelResults.deepseek);
        
        console.log(`🎯 Consensus Result:`);
        console.log(`   📊 Final confidence: ${(consensus.confidence * 100).toFixed(1)}%`);
        console.log(`   🤝 Agreement level: ${consensus.agreement_level}`);
        console.log(`   ⚠️  Conflicting models: ${consensus.conflicting_models.length > 0 ? consensus.conflicting_models.join(', ') : 'None'}`);
        
        // Generate recommendations based on multi-model results
        const recommendations = this.generateRecommendations(question, null, consensus.confidence, 'multi-model', consensus);
        
        results.push({
          question: question.q,
          answers: {
            claude: {
              answer: parallelResults.claude.answer,
              confidence: parallelResults.claude.confidence,
              reasoning: parallelResults.claude.reasoning
            },
            gpt5: {
              answer: parallelResults.gpt5.answer,
              confidence: parallelResults.gpt5.confidence,
              reasoning: parallelResults.gpt5.reasoning
            },
            deepseek: {
              answer: parallelResults.deepseek.answer,
              confidence: parallelResults.deepseek.confidence,
              reasoning: parallelResults.deepseek.reasoning
            }
          },
          consensus,
          // Add consolidated data for Evaluator Agent
          multi_model_data: {
            claude: {
              answer: parallelResults.claude.answer,
              confidence: parallelResults.claude.confidence,
              reasoning: parallelResults.claude.reasoning
            },
            gpt5: {
              answer: parallelResults.gpt5.answer,
              confidence: parallelResults.gpt5.confidence,
              reasoning: parallelResults.gpt5.reasoning
            },
            deepseek: {
              answer: parallelResults.deepseek.answer,
              confidence: parallelResults.deepseek.confidence,
              reasoning: parallelResults.deepseek.reasoning
            },
            individual_confidences: {
              claude: parallelResults.claude.confidence,
              gpt5: parallelResults.gpt5.confidence,
              deepseek: parallelResults.deepseek.confidence
            },
            consensus: {
              final_confidence: consensus.confidence,
              agreement_level: consensus.agreement_level,
              conflicting_models: consensus.conflicting_models
            },
            answer_previews: {
              claude: parallelResults.claude.answer.substring(0, 100),
              gpt5: parallelResults.gpt5.answer.substring(0, 100),
              deepseek: parallelResults.deepseek.answer.substring(0, 100)
            }
          },
          recommendations
        });
      } catch (error) {
        console.error(`Multi-model analysis failed for: ${question.q}`, error);
      }
    }

    return results;
  }

  /**
   * Extract domains from search queries (e.g., "site:cms.gov" -> "cms.gov")
   */
  private extractDomainsFromQueries(searchQueries: string[]): string[] {
    const domains: string[] = [];
    
    for (const query of searchQueries) {
      // Look for site:domain patterns
      const siteMatches = query.match(/site:([a-zA-Z0-9.-]+)/g);
      if (siteMatches) {
        siteMatches.forEach(match => {
          const domain = match.replace('site:', '');
          if (!domains.includes(domain)) {
            domains.push(domain);
          }
        });
      }
    }
    
    return domains;
  }

  /**
   * Execute OpenAI web search analysis
   */
  async executeOpenAIWebSearch(questions: ValidationQuestion[], claimId?: string): Promise<any[]> {
    const results: any[] = [];
    const startTime = Date.now();

    for (const question of questions) {
      try {
        console.log(`\n🔍 OpenAI Web Search for: ${question.q}`);
        
        // Extract domains from search queries
        const domains = this.extractDomainsFromQueries(question.search_queries);
        console.log(`   🎯 Target domains: ${domains.length > 0 ? domains.join(', ') : 'Using default domains'}`);
        
        const openaiResult = await this.openaiWebSearch.searchMedicalCoding(question.q, domains, claimId);
        
        if (openaiResult.success && openaiResult.data) {
          const result = {
            question: question.q,
            answer: openaiResult.data.answer,
            confidence: openaiResult.data.confidence,
            source: 'OpenAI Web Search',
            metadata: {
              extraction_method: 'openai-websearch',
              processing_time: Date.now() - startTime,
              escalation_reason: 'OpenAI web search analysis'
            },
            openai_websearch_data: {
              answer: openaiResult.data.answer,
              confidence: openaiResult.data.confidence,
              sources: openaiResult.data.sources,
              reasoning: openaiResult.data.reasoning,
              search_query: openaiResult.data.search_query,
              processing_time_ms: Date.now() - startTime
            },
            recommendations: this.generateOpenAIRecommendations(question, openaiResult.data)
          };
          
          results.push(result);
          
          console.log(`✅ OpenAI Web Search completed`);
          console.log(`   📊 Confidence: ${(openaiResult.data.confidence * 100).toFixed(1)}%`);
          console.log(`   🔗 Sources: ${openaiResult.data.sources.length}`);
          console.log(`   📝 Answer preview: ${openaiResult.data.answer.substring(0, 100)}...`);
        } else {
          console.log(`❌ OpenAI Web Search failed: ${openaiResult.error}`);
          // Add fallback result
          results.push({
            question: question.q,
            answer: 'OpenAI web search failed to find relevant information.',
            confidence: 0.1,
            source: 'OpenAI Web Search (Failed)',
            metadata: {
              extraction_method: 'openai-websearch',
              processing_time: Date.now() - startTime,
              escalation_reason: 'OpenAI web search failed'
            },
            recommendations: ['❌ OpenAI web search failed - Manual review required']
          });
        }
      } catch (error) {
        console.error(`OpenAI web search failed for: ${question.q}`, error);
        // Add error result
        results.push({
          question: question.q,
          answer: 'Error occurred during OpenAI web search.',
          confidence: 0.1,
          source: 'OpenAI Web Search (Error)',
          metadata: {
            extraction_method: 'openai-websearch',
            processing_time: Date.now() - startTime,
            escalation_reason: 'OpenAI web search error'
          },
          recommendations: ['❌ OpenAI web search error - Manual review required']
        });
      }
    }

    return results;
  }

  /**
   * Generate recommendations based on OpenAI web search results
   */
  private generateOpenAIRecommendations(question: ValidationQuestion, openaiData: any): string[] {
    const recommendations: string[] = [];
    
    // Confidence-based recommendations
    if (openaiData.confidence < 0.6) {
      recommendations.push('⚠️ Low confidence from OpenAI web search - Consider manual review');
    } else if (openaiData.confidence < 0.8) {
      recommendations.push('🔍 Moderate confidence from OpenAI web search - Verify with additional sources');
    } else {
      recommendations.push('✅ High confidence from OpenAI web search - Good source reliability');
    }
    
    // Source-based recommendations
    if (openaiData.sources.length === 0) {
      recommendations.push('📝 No specific sources cited - Verify information independently');
    } else if (openaiData.sources.length > 0) {
      recommendations.push(`🔗 ${openaiData.sources.length} source(s) found - Review cited sources for verification`);
    }
    
    // Question-type specific recommendations
    if (question.risk_flags.PA) {
      recommendations.push('📋 Prior authorization flagged - Verify PA requirements with payer');
    }
    if (question.risk_flags.StateSpecific) {
      recommendations.push('🗺️ State-specific policy - Confirm state regulations');
    }
    if (question.risk_flags.LOBSpecific) {
      recommendations.push('🏥 Line of business specific - Verify LOB coverage rules');
    }
    
    return recommendations;
  }

  /**
   * Generate recommendations based on research results
   */
  private generateRecommendations(
    question: ValidationQuestion, 
    firecrawlData: any, 
    confidence: number, 
    method: 'firecrawl' | 'multi-model',
    consensus?: any
  ): string[] {
    const recommendations: string[] = [];
    
    // Confidence-based recommendations
    if (confidence < 0.6) {
      recommendations.push('⚠️ Low confidence - Consider manual review of policy documents');
    } else if (confidence < 0.8) {
      recommendations.push('🔍 Moderate confidence - Verify with additional sources');
    } else {
      recommendations.push('✅ High confidence - Policy appears well-documented');
    }
    
    // Method-specific recommendations
    if (method === 'firecrawl') {
      if (firecrawlData?.structured_data?.policy_details) {
        recommendations.push('📋 Structured policy data available - Review coverage rules and eligibility requirements');
      }
      if (firecrawlData?.content?.length < 200) {
        recommendations.push('📝 Limited content extracted - May need additional research');
      }
    } else if (method === 'multi-model') {
      if (consensus?.agreement_level === 'low') {
        recommendations.push('🤔 Models disagree - Cross-reference with official payer policies');
      } else if (consensus?.agreement_level === 'high') {
        recommendations.push('🎯 Strong model consensus - High reliability expected');
      }
    }
    
    // Question-type specific recommendations
    if (question.risk_flags.PA) {
      recommendations.push('📋 Prior authorization flagged - Verify PA requirements with payer');
    }
    if (question.risk_flags.StateSpecific) {
      recommendations.push('🗺️ State-specific policy - Confirm state regulations');
    }
    if (question.risk_flags.LOBSpecific) {
      recommendations.push('🏥 Line of business specific - Verify LOB coverage rules');
    }
    
    return recommendations;
  }

  /**
   * Combine raw results from Firecrawl, Multi-Model, and OpenAI Web Search analysis
   * Let Reviewer Agent handle conflict detection and resolution
   */
  combineRawResults(firecrawlResult: ResearchResult[], multiModelResult: any[], openaiWebSearchResult: any[], question: ValidationQuestion, startTime: number): ResearchResult | null {
    const firecrawl = firecrawlResult.length > 0 ? firecrawlResult[0] : null;
    const multiModel = multiModelResult.length > 0 ? multiModelResult[0] : null;
    const openaiWebSearch = openaiWebSearchResult.length > 0 ? openaiWebSearchResult[0] : null;

    // If no results are available
    if (!firecrawl && !multiModel && !openaiWebSearch) {
      console.log(`   ❌ No results from any method`);
      return null;
    }

    // Don't pick a "best" result - let Reviewer Agent handle all conflict detection and resolution
    // Just create a comprehensive result that includes all available data for the Reviewer Agent
    
    // Use the first available result as the base, but include ALL data sources
    const baseResult = firecrawl || multiModel || openaiWebSearch;
    if (!baseResult) {
      console.log(`   ❌ No valid result found`);
      return null;
    }

    // Create a comprehensive result that includes all available data sources
    const combinedResult: ResearchResult = {
      question: question.q,
      answer: firecrawl?.answer || multiModel?.consensus?.final_answer || openaiWebSearch?.answer || 'No answer available',
      confidence: Math.max(
        firecrawl?.confidence || 0,
        multiModel?.consensus?.confidence || 0,
        openaiWebSearch?.confidence || 0
      ),
      source: 'Multiple Sources (Reviewer Agent will analyze)',
      metadata: {
        extraction_method: 'multi-source',
        processing_time: Date.now() - startTime,
        escalation_reason: 'All sources combined for Reviewer Agent analysis'
      },
      // Include ALL available data sources for Reviewer Agent
      firecrawl_data: firecrawl ? {
        confidence: firecrawl.confidence,
        content_length: firecrawl.answer.length,
        structured_data: firecrawl.metadata?.structured_data,
        urls_processed: firecrawl.firecrawl_data?.urls_processed || []
      } : undefined,
      multi_model_data: multiModel?.multi_model_data,
      openai_websearch_data: openaiWebSearch?.openai_websearch_data,
      recommendations: [
        ...(firecrawl?.recommendations || []),
        ...(multiModel?.recommendations || []),
        ...(openaiWebSearch?.recommendations || [])
      ]
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 RESEARCH AGENT RESULTS (Passing to Reviewer Agent)`);
    console.log(`${'='.repeat(60)}`);
    
    if (firecrawl) {
      console.log(`🔥 FIRECRAWL (${(firecrawl.confidence * 100).toFixed(1)}% confidence):`);
      console.log(`   📝 Answer: "${firecrawl.answer.substring(0, 150)}${firecrawl.answer.length > 150 ? '...' : ''}"`);
    } else {
      console.log(`🔥 FIRECRAWL: Not available`);
    }
    
    if (multiModel) {
      console.log(`🤖 MULTI-MODEL (${((multiModel.consensus?.confidence || 0) * 100).toFixed(1)}% confidence):`);
      console.log(`   📝 Answer: "${(multiModel.consensus?.final_answer || 'No consensus answer').substring(0, 150)}${(multiModel.consensus?.final_answer || '').length > 150 ? '...' : ''}"`);
    } else {
      console.log(`🤖 MULTI-MODEL: Not available`);
    }
    
    if (openaiWebSearch) {
      console.log(`🔍 OPENAI WEB SEARCH (${(openaiWebSearch.confidence * 100).toFixed(1)}% confidence):`);
      console.log(`   📝 Answer: "${(openaiWebSearch.answer || 'No answer').substring(0, 150)}${(openaiWebSearch.answer || '').length > 150 ? '...' : ''}"`);
    } else {
      console.log(`🔍 OPENAI WEB SEARCH: Not available`);
    }
    
    console.log(`\n🎯 PASSING ALL DATA TO REVIEWER AGENT FOR CONFLICT ANALYSIS`);
    console.log(`${'='.repeat(60)}\n`);

    return combinedResult;
  }

  /**
   * Select the best result from Firecrawl, Multi-Model, and OpenAI Web Search analysis
   * Simplified approach - let Reviewer Agent handle conflict detection
   */
  selectBestResult(firecrawlResult: ResearchResult[], multiModelResult: any[], openaiWebSearchResult: any[], question: ValidationQuestion, startTime: number): ResearchResult | null {
    return this.combineRawResults(firecrawlResult, multiModelResult, openaiWebSearchResult, question, startTime);
  }

  /**
   * Calculate a score for a research result based on multiple factors
   */
  calculateResultScore(result: ResearchResult, question: ValidationQuestion): number {
    let score = 0;

    // Base confidence score (0-1)
    score += result.confidence * 0.4;

    // Content length bonus (0-0.2)
    const contentLength = result.answer.length;
    if (contentLength > 100) score += 0.1;
    if (contentLength > 300) score += 0.1;

    // Relevance to question (0-0.2)
    const questionKeywords = question.q.toLowerCase().split(' ');
    const answerText = result.answer.toLowerCase();
    const keywordMatches = questionKeywords.filter(keyword => 
      keyword.length > 3 && answerText.includes(keyword)
    ).length;
    score += Math.min(keywordMatches * 0.05, 0.2);

    // Source quality bonus (0-0.1)
    if (result.source === 'Firecrawl Extraction') score += 0.05;
    if (result.source === 'Multi-Model Consensus') score += 0.1;

    // Structured data bonus (0-0.1)
    if (result.metadata?.extraction_method === 'firecrawl' && (result.metadata as any)?.structured_data) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate confidence based on content quality and relevance to the question
   */
  calculateContentConfidence(firecrawlData: any, question: ValidationQuestion): number {
    let confidence = 0.0;
    const content = firecrawlData.content || '';
    const questionText = question.q.toLowerCase();
    const structuredData = firecrawlData.structured_data;
    
    // Use Firecrawl's confidence_level if available
    if (structuredData?.confidence_level) {
      switch (structuredData.confidence_level) {
        case 'high': return 0.9;
        case 'medium': return 0.7;
        case 'low': return 0.5;
      }
    }
    
    // Fallback to content-based calculation
    // Base confidence for having content
    if (content.length > 50) confidence += 0.2;
    if (content.length > 200) confidence += 0.2;
    if (content.length > 500) confidence += 0.1;
    
    // Relevance to question
    if (questionText.includes('cpt') && content.toLowerCase().includes('cpt')) confidence += 0.2;
    if (questionText.includes('coverage') && content.toLowerCase().includes('coverage')) confidence += 0.1;
    if (questionText.includes('policy') && content.toLowerCase().includes('policy')) confidence += 0.1;
    if (questionText.includes('medicare') && content.toLowerCase().includes('medicare')) confidence += 0.1;
    
    // Source quality indicators
    if (firecrawlData.metadata?.url?.includes('cms.gov')) confidence += 0.2;
    if (firecrawlData.metadata?.url?.includes('medicare.gov')) confidence += 0.1;
    if (firecrawlData.metadata?.url?.includes('hhs.gov')) confidence += 0.1;
    
    // Structured data bonus
    if (structuredData?.answer && structuredData.answer.length > 100) confidence += 0.1;
    if (structuredData?.policy_reference) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Assess confidence level of Firecrawl extraction
   */
  assessConfidenceLevel(extractedData: any): number {
    let confidence = 0.0;
    
    // Content Quality Indicators
    if (extractedData.content?.length > 200) confidence += 0.2;
    if (extractedData.structured_data?.policy_details) confidence += 0.3;
    if (extractedData.metadata?.url?.includes('cms.gov')) confidence += 0.2;
    
    // Specificity Indicators
    if (extractedData.content?.includes('CPT')) confidence += 0.1;
    if (extractedData.content?.includes('coverage')) confidence += 0.1;
    if (extractedData.content?.includes('authorization')) confidence += 0.1;
    
    // Completeness Indicators
    if (extractedData.structured_data?.coverage_rules?.length > 0) confidence += 0.2;
    if (extractedData.structured_data?.eligibility_requirements?.length > 0) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  // Conflict detection methods removed - now handled by Reviewer Agent

  /**
   * Build consensus from multiple model results
   */
  private buildConsensus(
    claude: any,
    gpt5: any,
    deepseek: any
  ): {final_answer: string; confidence: number; agreement_level: 'high' | 'medium' | 'low'; conflicting_models: string[]} {
    const answers = [claude.answer, gpt5.answer, deepseek.answer];
    const confidences = [claude.confidence, gpt5.confidence, deepseek.confidence];
    
    // Calculate average confidence
    const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    
    // Determine agreement level based on confidence variance
    const variance = confidences.reduce((sum, conf) => sum + Math.pow(conf - avgConfidence, 2), 0) / confidences.length;
    let agreementLevel: 'high' | 'medium' | 'low' = 'low';
    
    if (variance < 0.01) agreementLevel = 'high';
    else if (variance < 0.05) agreementLevel = 'medium';
    
    // For now, use Claude's answer as final (can be enhanced with voting)
    // TODO: Implement sophisticated voting mechanism
      return {
      final_answer: claude.answer,
      confidence: avgConfidence,
      agreement_level: agreementLevel,
      conflicting_models: []
    };
  }

}