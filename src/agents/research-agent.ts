import { OpenRouterService } from '../services/openrouter-service';
import { FirecrawlService } from '../services/firecrawl-service';
import { GoogleSearchAgent } from './google-search-agent';
import { ValidationQuestion } from './planner-agent';

export interface ResearchResult {
  question: string;
  answer: string;
  confidence: number;
  source: string;
  metadata: {
    extraction_method: 'firecrawl' | 'multi-model';
    processing_time: number;
    escalation_reason?: string;
  };
  // New consolidated fields
  firecrawl_data?: {
    confidence: number;
    content_length: number;
    structured_data?: any;
    urls_processed: string[];
  };
  multi_model_data?: {
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
    console.log(`🔍 Research Agent: Processing ${questions.length} questions with cascading strategy`);
    
    const results: ResearchResult[] = [];
    let firecrawlSuccessCount = 0;
    let escalationCount = 0;
    const startTime = Date.now();

    for (const question of questions) {
      try {
        // Phase 1: Try Firecrawl first (cost-effective)
        const firecrawlResult = await this.executeFirecrawlResearch([question]);
        
        if (firecrawlResult.length > 0 && firecrawlResult[0].confidence >= 0.7) {
          // Firecrawl succeeded with high confidence
          console.log(`✅ Firecrawl success for: ${question.q.substring(0, 50)}...`);
          console.log(`📊 Firecrawl confidence: ${(firecrawlResult[0].confidence * 100).toFixed(1)}%`);
          console.log(`📝 Firecrawl content preview: ${firecrawlResult[0].answer.substring(0, 200)}...`);
          results.push(firecrawlResult[0]);
          firecrawlSuccessCount++;
        } else {
          // Phase 2: Escalate to multi-model analysis
          console.log(`🔄 Escalating to multi-model for: ${question.q.substring(0, 50)}...`);
          if (firecrawlResult.length > 0) {
            console.log(`📊 Firecrawl confidence too low: ${(firecrawlResult[0].confidence * 100).toFixed(1)}% (threshold: 70%)`);
            console.log(`📝 Firecrawl content preview: ${firecrawlResult[0].answer.substring(0, 200)}...`);
          } else {
            console.log(`❌ Firecrawl failed - no results returned`);
          }
          const multiModelResult = await this.executeMultiModelAnalysis([question]);
          
          if (multiModelResult.length > 0) {
            const consensusResult = multiModelResult[0];
            results.push({
              question: question.q,
              answer: consensusResult.consensus.final_answer,
              confidence: consensusResult.consensus.confidence,
              source: 'Multi-Model Consensus',
              metadata: {
                extraction_method: 'multi-model',
                processing_time: Date.now() - startTime,
                escalation_reason: 'Low Firecrawl confidence or complex scenario'
              },
              multi_model_data: consensusResult.multi_model_data,
              recommendations: consensusResult.recommendations
            });
            escalationCount++;
          }
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

    console.log(`📊 Research complete: ${firecrawlSuccessCount} Firecrawl, ${escalationCount} Multi-Model`);
    return results;
  }

  /**
   * Phase 1: Execute Firecrawl research (cost-effective)
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
            // Use Firecrawl-provided confidence score if available, otherwise fallback to assessment
            const confidence = firecrawlResponse.data.structured_data?.confidence_score ?? 
                              this.assessConfidenceLevel(firecrawlResponse.data);
            
            // Log Firecrawl extraction details
            console.log(`🔍 Firecrawl extraction details:`);
            console.log(`   📊 Confidence score: ${confidence.toFixed(3)}`);
            console.log(`   📝 Content length: ${firecrawlResponse.data.content.length} chars`);
            if (firecrawlResponse.data.structured_data) {
              console.log(`   🏗️  Structured data available: ${!!firecrawlResponse.data.structured_data}`);
              console.log(`   🔑 Key points: ${firecrawlResponse.data.structured_data.key_points?.length || 0} items`);
              console.log(`   📋 Policy details: ${!!firecrawlResponse.data.structured_data.policy_details}`);
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