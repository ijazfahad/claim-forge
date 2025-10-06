import { OpenRouterService } from '../services/openrouter-service';
import { FirecrawlService } from '../services/firecrawl-service';
import { GoogleSearchAgent } from './google-search-agent';
import { ValidationQuestion } from './planner-agent';
import { IndividualResearchResult, ConflictInfo, EnhancedResearchResult, PolicyReference } from '../types/claim-types';

export interface ResearchResult {
  question: string;
  answer: string;
  confidence: number;
  source: string;
  metadata: {
    extraction_method: 'firecrawl' | 'multi-model' | 'enhanced-analysis';
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

  constructor() {
    this.firecrawl = new FirecrawlService();
    this.googleSearch = new GoogleSearchAgent();
    this.openRouter = new OpenRouterService();
  }

  /**
   * Main research method implementing cascading validation strategy
   */
  async executeResearch(questions: ValidationQuestion[]): Promise<ResearchResult[]> {
    console.log(`🔍 Research Agent: Processing ${questions.length} questions with parallel strategy`);
    
    const results: ResearchResult[] = [];
    let firecrawlSuccessCount = 0;
    let multiModelSuccessCount = 0;
    const startTime = Date.now();

    for (const question of questions) {
      try {
        // Always run Google search first to get URLs
        console.log(`🚀 Running parallel research for: ${question.q.substring(0, 50)}...`);
        
        const searchResults = await this.googleSearch.executeSearches([question]);
        const hasUrls = searchResults.firecrawl_inputs.length > 0;
        
        console.log(`   🔍 Google search results: ${searchResults.firecrawl_inputs.length} URLs found`);
        
        // Run all methods in parallel
        const promises: Promise<any>[] = [
          this.executeMultiModelAnalysis([question])
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

        // Compare results and select the best one
        const bestResult = this.selectBestResult(firecrawlResult, multiModelResult, question, startTime);
        
        if (bestResult) {
          results.push(bestResult);
          
          // Count based on which sources contributed to the consensus
          const enhancedAnalysis = bestResult.enhanced_analysis;
          if (enhancedAnalysis?.individual_results.firecrawl) {
            firecrawlSuccessCount++;
          }
          if (enhancedAnalysis?.individual_results.claude || enhancedAnalysis?.individual_results.gpt || enhancedAnalysis?.individual_results.deepseek) {
            multiModelSuccessCount++;
          }
          
          console.log(`✅ Consensus result for: ${question.q.substring(0, 50)}...`);
          console.log(`   📊 Sources: ${bestResult.source}`);
          console.log(`   🎯 Confidence: ${(bestResult.confidence * 100).toFixed(1)}%`);
          console.log(`   📝 Answer preview: ${bestResult.answer.substring(0, 100)}...`);
        } else {
          // Fallback: create a basic result
          console.log(`⚠️  No results available for: ${question.q.substring(0, 50)}...`);
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
        console.error(`❌ Research failed for question: ${question.q}`, error);
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

    console.log(`📊 Research complete: ${firecrawlSuccessCount} Firecrawl, ${multiModelSuccessCount} Multi-Model`);
    console.log(`📈 Success rate: ${((firecrawlSuccessCount + multiModelSuccessCount) / questions.length * 100).toFixed(1)}%`);
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
   * Analyze all 4 results for conflicts and consensus
   */
  analyzeAllResults(firecrawlResult: ResearchResult[], multiModelResult: any[], question: ValidationQuestion, startTime: number): EnhancedResearchResult | null {
    const firecrawl = firecrawlResult.length > 0 ? firecrawlResult[0] : null;
    const multiModel = multiModelResult.length > 0 ? multiModelResult[0] : null;

    // If neither result is available
    if (!firecrawl && !multiModel) {
      console.log(`   ❌ No results from either method`);
      return null;
    }

    // Build individual results array
    const individualResults: IndividualResearchResult[] = [];
    
    if (firecrawl) {
      individualResults.push({
        source: 'Firecrawl',
        answer: firecrawl.answer,
        confidence: firecrawl.confidence,
        policy_reference: firecrawl.metadata?.structured_data?.policy_reference,
        metadata: firecrawl.metadata
      });
    }

    if (multiModel) {
      // Add individual model results
      if (multiModel.multi_model_data?.claude) {
        individualResults.push({
          source: 'Claude-3.5',
          answer: multiModel.multi_model_data.claude.answer,
          confidence: multiModel.multi_model_data.claude.confidence,
          metadata: multiModel.multi_model_data.claude
        });
      }
      if (multiModel.multi_model_data?.gpt5) {
        individualResults.push({
          source: 'GPT-4',
          answer: multiModel.multi_model_data.gpt5.answer,
          confidence: multiModel.multi_model_data.gpt5.confidence,
          metadata: multiModel.multi_model_data.gpt5
        });
      }
      if (multiModel.multi_model_data?.deepseek) {
        individualResults.push({
          source: 'DeepSeek-V3',
          answer: multiModel.multi_model_data.deepseek.answer,
          confidence: multiModel.multi_model_data.deepseek.confidence,
          metadata: multiModel.multi_model_data.deepseek
        });
      }
    }

    // Detect conflicts
    const conflicts = this.detectConflicts(individualResults);
    
    // Calculate consensus level
    const consensusLevel = this.calculateConsensusLevel(individualResults);
    
    // Determine final answer and confidence
    let finalAnswer: string;
    let confidence: number;
    let recommendations: string[] = [];

    if (conflicts.length > 0) {
      console.log(`   ⚠️  Conflicts detected: ${conflicts.length} conflict(s)`);
      finalAnswer = 'CONFLICTING_INFORMATION_DETECTED';
      confidence = 0.3;
      recommendations = [
        '⚠️ CONFLICT: Multiple sources provide different information',
        '📞 Contact payer directly for clarification',
        '📄 Review policy documents manually'
      ];
      conflicts.forEach(conflict => {
        recommendations.push(`🔍 ${conflict.type}: ${conflict.description}`);
      });
    } else {
      // Use consensus or highest confidence result
      if (individualResults.length === 0) {
        finalAnswer = 'No research results available';
        confidence = 0.1;
        recommendations = ['❌ No results from any research method - Manual review required'];
      } else {
        const avgConfidence = individualResults.reduce((sum, r) => sum + r.confidence, 0) / individualResults.length;
        const highestConfidenceResult = individualResults.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        
        finalAnswer = highestConfidenceResult.answer;
        confidence = avgConfidence;
        
        // Generate recommendations based on consensus
        if (consensusLevel === '4/4_AGREE') {
          recommendations = ['✅ Strong consensus - All sources agree', '📊 High confidence result'];
        } else if (consensusLevel === '3/4_AGREE') {
          recommendations = ['✅ Good consensus - Majority agreement', '📊 Medium-high confidence result'];
        } else if (consensusLevel === '2/4_AGREE') {
          recommendations = ['⚠️ Partial consensus - Some disagreement', '📊 Medium confidence result'];
        } else {
          recommendations = ['⚠️ Low consensus - Significant disagreement', '📊 Low confidence result'];
        }

        // Add policy reference if available
        if (firecrawl?.metadata?.structured_data?.policy_reference) {
          const ref = firecrawl.metadata.structured_data.policy_reference;
          recommendations.push(`📄 Policy Reference: ${ref.url}`);
          if (ref.sentence) {
            recommendations.push(`📝 Specific sentence: "${ref.sentence}"`);
          }
        }
      }
    }

    console.log(`   📊 Analysis complete: ${consensusLevel}, ${conflicts.length} conflicts, ${confidence.toFixed(2)} confidence`);
    
    // Log individual source contributions
    console.log(`   🔍 Source Analysis:`);
    if (individualResults.find(r => r.source === 'Firecrawl')) {
      const firecrawl = individualResults.find(r => r.source === 'Firecrawl')!;
      console.log(`      🔥 Firecrawl: ${(firecrawl.confidence * 100).toFixed(1)}% - "${firecrawl.answer.substring(0, 100)}${firecrawl.answer.length > 100 ? '...' : ''}"`);
    }
    if (individualResults.find(r => r.source === 'Claude-3.5')) {
      const claude = individualResults.find(r => r.source === 'Claude-3.5')!;
      console.log(`      🧠 Claude: ${(claude.confidence * 100).toFixed(1)}% - "${claude.answer.substring(0, 100)}${claude.answer.length > 100 ? '...' : ''}"`);
    }
    if (individualResults.find(r => r.source === 'GPT-4')) {
      const gpt = individualResults.find(r => r.source === 'GPT-4')!;
      console.log(`      🤖 GPT-4: ${(gpt.confidence * 100).toFixed(1)}% - "${gpt.answer.substring(0, 100)}${gpt.answer.length > 100 ? '...' : ''}"`);
    }
    if (individualResults.find(r => r.source === 'DeepSeek-V3')) {
      const deepseek = individualResults.find(r => r.source === 'DeepSeek-V3')!;
      console.log(`      🎯 DeepSeek: ${(deepseek.confidence * 100).toFixed(1)}% - "${deepseek.answer.substring(0, 100)}${deepseek.answer.length > 100 ? '...' : ''}"`);
    }
    
    // Log conflicts if any
    if (conflicts.length > 0) {
      console.log(`   ⚠️  Conflicts detected:`);
      conflicts.forEach((conflict, index) => {
        console.log(`      ${index + 1}. ${conflict.type}: ${conflict.description}`);
        console.log(`         Sources: ${conflict.conflicting_sources.join(', ')}`);
      });
    }
    
    // Log recommendations
    console.log(`   💡 Recommendations:`);
    recommendations.forEach((rec, index) => {
      console.log(`      ${index + 1}. ${rec}`);
    });

    return {
      question: question.q,
      final_answer: finalAnswer,
      confidence,
      consensus_level: consensusLevel,
      conflicts,
      individual_results: {
        firecrawl: individualResults.find(r => r.source === 'Firecrawl'),
        claude: individualResults.find(r => r.source === 'Claude-3.5'),
        gpt: individualResults.find(r => r.source === 'GPT-4'),
        deepseek: individualResults.find(r => r.source === 'DeepSeek-V3')
      },
      recommendations,
      metadata: {
        extraction_method: 'conflict-analysis',
        processing_time: Date.now() - startTime,
        escalation_reason: conflicts.length > 0 ? 'Conflicts detected' : 'Consensus analysis complete'
      }
    };
  }

  /**
   * Select the best result from Firecrawl and Multi-Model analysis (legacy method)
   */
  selectBestResult(firecrawlResult: ResearchResult[], multiModelResult: any[], question: ValidationQuestion, startTime: number): ResearchResult | null {
    const enhancedResult = this.analyzeAllResults(firecrawlResult, multiModelResult, question, startTime);
    
    if (!enhancedResult) return null;

    // Convert enhanced result back to legacy format for backward compatibility
    // The source should reflect the consensus approach, not individual sources
    const sourceCount = [
      enhancedResult.individual_results.firecrawl,
      enhancedResult.individual_results.claude,
      enhancedResult.individual_results.gpt,
      enhancedResult.individual_results.deepseek
    ].filter(Boolean).length;
    
    const source = `${sourceCount}/4 Consensus Analysis`;

    return {
      question: enhancedResult.question,
      answer: enhancedResult.final_answer,
      confidence: enhancedResult.confidence,
      source: source,
      metadata: {
        extraction_method: 'enhanced-analysis',
        processing_time: enhancedResult.metadata.processing_time,
        escalation_reason: enhancedResult.metadata.escalation_reason
      },
      recommendations: enhancedResult.recommendations,
      enhanced_analysis: enhancedResult // Include full analysis for debugging
    };
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

  /**
   * Detect conflicts between research results
   */
  private detectConflicts(results: IndividualResearchResult[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];
    
    // Coverage conflicts
    const coverageAnswers = results.map(r => this.extractCoverageAnswer(r.answer));
    const coverageGroups = this.groupByCoverage(coverageAnswers);
    if (coverageGroups.length > 1) {
      conflicts.push({
        type: 'COVERAGE_CONFLICT',
        description: 'Different coverage determinations found',
        conflicting_sources: coverageGroups.map(g => g.sources.join(', ')),
        conflicting_answers: coverageGroups.reduce((acc, group) => {
          group.sources.forEach(source => {
            acc[source] = group.answer;
          });
          return acc;
        }, {} as { [source: string]: string })
      });
    }
    
    // Requirement conflicts
    const requirementAnswers = results.map(r => this.extractRequirements(r.answer));
    const requirementGroups = this.groupByRequirements(requirementAnswers);
    if (requirementGroups.length > 1) {
      conflicts.push({
        type: 'REQUIREMENT_CONFLICT',
        description: 'Different eligibility requirements found',
        conflicting_sources: requirementGroups.map(g => g.sources.join(', ')),
        conflicting_answers: requirementGroups.reduce((acc, group) => {
          group.sources.forEach(source => {
            acc[source] = group.answer;
          });
          return acc;
        }, {} as { [source: string]: string })
      });
    }
    
    return conflicts;
  }

  /**
   * Extract coverage determination from answer
   */
  private extractCoverageAnswer(answer: string): { answer: string; source: string } {
    const lowerAnswer = answer.toLowerCase();
    if (lowerAnswer.includes('covered') || lowerAnswer.includes('eligible')) {
      return { answer: 'COVERED', source: 'unknown' };
    } else if (lowerAnswer.includes('not covered') || lowerAnswer.includes('not eligible') || lowerAnswer.includes('denied')) {
      return { answer: 'NOT_COVERED', source: 'unknown' };
    } else if (lowerAnswer.includes('prior authorization') || lowerAnswer.includes('pa required')) {
      return { answer: 'PA_REQUIRED', source: 'unknown' };
    }
    return { answer: 'UNCLEAR', source: 'unknown' };
  }

  /**
   * Extract requirements from answer
   */
  private extractRequirements(answer: string): { answer: string; source: string } {
    const requirements = [];
    const lowerAnswer = answer.toLowerCase();
    
    if (lowerAnswer.includes('modifier')) requirements.push('modifier');
    if (lowerAnswer.includes('documentation')) requirements.push('documentation');
    if (lowerAnswer.includes('frequency')) requirements.push('frequency');
    if (lowerAnswer.includes('age')) requirements.push('age');
    
    return { 
      answer: requirements.length > 0 ? requirements.join(', ') : 'none', 
      source: 'unknown' 
    };
  }

  /**
   * Group answers by coverage determination
   */
  private groupByCoverage(answers: { answer: string; source: string }[]): Array<{ answer: string; sources: string[] }> {
    const groups: { [key: string]: string[] } = {};
    answers.forEach((answer, index) => {
      if (!groups[answer.answer]) {
        groups[answer.answer] = [];
      }
      groups[answer.answer].push(`Source${index + 1}`);
    });
    
    return Object.entries(groups).map(([answer, sources]) => ({
      answer,
      sources
    }));
  }

  /**
   * Group answers by requirements
   */
  private groupByRequirements(answers: { answer: string; source: string }[]): Array<{ answer: string; sources: string[] }> {
    const groups: { [key: string]: string[] } = {};
    answers.forEach((answer, index) => {
      if (!groups[answer.answer]) {
        groups[answer.answer] = [];
      }
      groups[answer.answer].push(`Source${index + 1}`);
    });
    
    return Object.entries(groups).map(([answer, sources]) => ({
      answer,
      sources
    }));
  }

  /**
   * Calculate consensus level
   */
  private calculateConsensusLevel(results: IndividualResearchResult[]): '4/4_AGREE' | '3/4_AGREE' | '2/4_AGREE' | '1/4_AGREE' | 'NO_CONSENSUS' {
    const coverageAnswers = results.map(r => this.extractCoverageAnswer(r.answer));
    const coverageGroups = this.groupByCoverage(coverageAnswers);
    
    if (coverageGroups.length === 1) return '4/4_AGREE';
    if (coverageGroups.length === 2) {
      const largestGroup = Math.max(...coverageGroups.map(g => g.sources.length));
      if (largestGroup === 3) return '3/4_AGREE';
      if (largestGroup === 2) return '2/4_AGREE';
    }
    return 'NO_CONSENSUS';
  }

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