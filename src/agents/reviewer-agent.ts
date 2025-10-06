import { BaseAgent } from './base-agent';
import { Agent } from '@openai/agents';
import { ResearchResult } from './research-agent';
import { ValidationQuestion } from './planner-agent';

export interface ReviewerResult {
  question: string;
  reviewed_answer: string;
  confidence: number;
  review_status: 'no_conflict' | 'resolved' | 'unresolvable';
  review_analysis: {
    detected_conflicts: ConflictInfo[];
    resolution_strategy: string;
    confidence_adjustment: number;
  };
  source_analysis: {
    firecrawl_contribution: number;
    claude_contribution: number;
    gpt5_contribution: number;
    deepseek_contribution: number;
  };
  recommendations: string[];
  processing_time_ms: number;
}

export interface ConflictInfo {
  type: 'coverage' | 'requirements' | 'confidence' | 'semantic';
  description: string;
  conflicting_sources: string[];
  severity: 'low' | 'medium' | 'high';
  resolution_suggestion: string;
}

export class ReviewerAgent extends BaseAgent {
  private agent: Agent | null = null;

  /**
   * Initialize the Reviewer Agent
   */
  async initialize(): Promise<void> {
    const instructions = `You are a Reviewer Agent specializing in medical claim validation research analysis.

Your role is to review and analyze research results from multiple sources (Firecrawl, Claude, GPT-5, DeepSeek) and provide a comprehensive, confident answer. You review all sources for quality, accuracy, and consistency, resolving any conflicts when they occur.

REVIEW STRATEGIES:
1. **Comprehensive Analysis**: Review all sources for quality and relevance
2. **Semantic Analysis**: Look for similar meanings expressed differently
3. **Confidence Weighting**: Give more weight to higher confidence answers
4. **Source Reliability**: Consider source quality and reliability
5. **Contextual Understanding**: Understand medical coding context
6. **Consensus Building**: Find common ground between different perspectives

REVIEW APPROACHES:
- **No Conflicts**: All sources agree → Use consensus answer
- **Minor Differences**: Small differences in phrasing → Synthesize best answer
- **Major Conflicts**: Fundamental disagreement → Use highest confidence + flag
- **Unresolvable**: Complete contradiction → Escalate for manual review

OUTPUT FORMAT:
{
  "reviewed_answer": "string - The final reviewed and unified answer",
  "confidence": number (0-1) - Adjusted confidence based on review analysis,
  "review_status": "no_conflict|resolved|unresolvable",
  "review_analysis": {
    "detected_conflicts": [
      {
        "type": "coverage|requirements|confidence|semantic",
        "description": "string - What conflict was detected",
        "conflicting_sources": ["string"] - Which sources conflict,
        "severity": "low|medium|high",
        "resolution_suggestion": "string - How to resolve"
      }
    ],
    "resolution_strategy": "string - Strategy used to review and resolve",
    "confidence_adjustment": number - How much confidence was adjusted
  },
  "source_analysis": {
    "firecrawl_contribution": number (0-1) - How much Firecrawl contributed,
    "claude_contribution": number (0-1) - How much Claude contributed,
    "gpt5_contribution": number (0-1) - How much GPT-5 contributed,
    "deepseek_contribution": number (0-1) - How much DeepSeek contributed
  },
  "recommendations": ["string"] - Actionable recommendations
}

ANALYSIS CRITERIA:
- Compare answer meanings, not just exact words
- Consider medical coding context and terminology
- Weight sources by confidence and reliability
- Look for partial agreements and common elements
- Identify when conflicts are due to different perspectives vs. actual contradictions`;

    const tools: any[] = [];

    this.agent = this.createAgent('Reviewer Agent', instructions, tools);
  }

  /**
   * Review research results and provide comprehensive analysis
   */
  async reviewResearchResults(
    researchResults: ResearchResult[],
    questions: ValidationQuestion[],
    startTime: number
  ): Promise<ReviewerResult[]> {
    if (!this.agent) {
      await this.initialize();
    }

    const reviewedResults: ReviewerResult[] = [];

    for (let i = 0; i < researchResults.length; i++) {
      const result = researchResults[i];
      const question = questions[i];
      
      try {
        console.log(`\n🔍 REVIEWING Question ${i + 1}:`);
        console.log(`   📝 Question: ${question.q}`);
        
        // Prepare input for review analysis
        const reviewInput = this.prepareReviewAnalysisInput(result, question);
        
        const input = `
Review and analyze this research result:

QUESTION: ${question.q}
QUESTION TYPE: ${question.type}
RISK FLAGS: ${JSON.stringify(question.risk_flags)}

RESEARCH RESULT DATA:
${JSON.stringify(reviewInput, null, 2)}

Perform comprehensive review and provide a unified answer.
`;

        const reviewResult = await this.executeAgent(this.agent!, input, {
          model: process.env.REVIEWER_MODEL || process.env.BASE_AGENT_MODEL,
          temperature: process.env.REVIEWER_TEMPERATURE ? parseFloat(process.env.REVIEWER_TEMPERATURE) : 0.1,
          max_tokens: process.env.REVIEWER_MAX_TOKENS ? parseInt(process.env.REVIEWER_MAX_TOKENS) : 3000
        });

        const processingTime = Date.now() - startTime;

        const reviewedResult: ReviewerResult = {
          question: question.q,
          reviewed_answer: reviewResult.reviewed_answer || result.answer,
          confidence: reviewResult.confidence || result.confidence,
          review_status: reviewResult.review_status || 'no_conflict',
          review_analysis: reviewResult.review_analysis || {
            detected_conflicts: [],
            resolution_strategy: 'No conflicts detected',
            confidence_adjustment: 0
          },
          source_analysis: reviewResult.source_analysis || {
            firecrawl_contribution: 0,
            claude_contribution: 0,
            gpt5_contribution: 0,
            deepseek_contribution: 0
          },
          recommendations: reviewResult.recommendations || [],
          processing_time_ms: processingTime
        };

        // Log review results
        console.log(`   ✅ Review Status: ${reviewedResult.review_status}`);
        console.log(`   📊 Final Confidence: ${(reviewedResult.confidence * 100).toFixed(1)}%`);
        console.log(`   🔍 Conflicts Detected: ${reviewedResult.review_analysis.detected_conflicts.length}`);
        console.log(`   🎯 Review Strategy: ${reviewedResult.review_analysis.resolution_strategy}`);
        
        if (reviewedResult.review_analysis.detected_conflicts.length > 0) {
          console.log(`   ⚠️  Detected Conflicts:`);
          reviewedResult.review_analysis.detected_conflicts.forEach((conflict, index) => {
            console.log(`      ${index + 1}. ${conflict.type.toUpperCase()}: ${conflict.description}`);
            console.log(`         Sources: ${conflict.conflicting_sources.join(', ')}`);
            console.log(`         Severity: ${conflict.severity}`);
            console.log(`         Suggestion: ${conflict.resolution_suggestion}`);
          });
        }

        console.log(`   💡 Recommendations:`);
        reviewedResult.recommendations.forEach((rec, index) => {
          console.log(`      ${index + 1}. ${rec}`);
        });

        reviewedResults.push(reviewedResult);

      } catch (error) {
        console.error(`Review failed for question ${i + 1}:`, error);
        
        // Fallback to original result
        const fallbackResult: ReviewerResult = {
          question: question.q,
          reviewed_answer: result.answer,
          confidence: result.confidence * 0.8, // Reduce confidence due to review failure
          review_status: 'unresolvable',
          review_analysis: {
            detected_conflicts: [{
              type: 'confidence',
              description: 'Review process failed',
              conflicting_sources: ['System Error'],
              severity: 'high',
              resolution_suggestion: 'Manual review required'
            }],
            resolution_strategy: 'Fallback to original result',
            confidence_adjustment: -0.2
          },
          source_analysis: {
            firecrawl_contribution: 0.25,
            claude_contribution: 0.25,
            gpt5_contribution: 0.25,
            deepseek_contribution: 0.25
          },
          recommendations: ['Manual review required due to review failure'],
          processing_time_ms: Date.now() - startTime
        };

        reviewedResults.push(fallbackResult);
      }
    }

    return reviewedResults;
  }

  /**
   * Prepare input data for review analysis
   */
  private prepareReviewAnalysisInput(result: ResearchResult, question: ValidationQuestion): any {
    const input: any = {
      question: question.q,
      question_type: question.type,
      risk_flags: question.risk_flags,
      original_result: {
        answer: result.answer,
        confidence: result.confidence,
        source: result.source,
        method: result.metadata.extraction_method
      }
    };

    // Add Firecrawl data if available
    if (result.firecrawl_data) {
      input.firecrawl_data = {
        answer: 'Firecrawl extraction result', // Firecrawl data doesn't contain direct content
        confidence: result.firecrawl_data.confidence,
        structured_data: result.firecrawl_data.structured_data,
        urls_processed: result.firecrawl_data.urls_processed
      };
    }

    // Add multi-model data if available
    if (result.multi_model_data) {
      input.multi_model_data = {
        claude: {
          answer: result.multi_model_data.claude?.answer,
          confidence: result.multi_model_data.claude?.confidence,
          reasoning: result.multi_model_data.claude?.reasoning
        },
        gpt5: {
          answer: result.multi_model_data.gpt5?.answer,
          confidence: result.multi_model_data.gpt5?.confidence,
          reasoning: result.multi_model_data.gpt5?.reasoning
        },
        deepseek: {
          answer: result.multi_model_data.deepseek?.answer,
          confidence: result.multi_model_data.deepseek?.confidence,
          reasoning: result.multi_model_data.deepseek?.reasoning
        },
        consensus: result.multi_model_data.consensus
      };
    }

    // Add enhanced analysis if available
    if (result.enhanced_analysis) {
      input.enhanced_analysis = result.enhanced_analysis;
    }

    return input;
  }

  /**
   * Calculate Firecrawl confidence from structured data
   */
  private calculateFirecrawlConfidence(firecrawlData: any): number {
    if (firecrawlData.structured_data?.confidence_level) {
      switch (firecrawlData.structured_data.confidence_level) {
        case 'high': return 0.9;
        case 'medium': return 0.7;
        case 'low': return 0.5;
      }
    }
    
    // Fallback to content-based confidence
    const content = firecrawlData.content || firecrawlData.markdown || '';
    if (content.length > 500) return 0.8;
    if (content.length > 200) return 0.6;
    if (content.length > 50) return 0.4;
    return 0.2;
  }
}
