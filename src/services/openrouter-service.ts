import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

export interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ModelAnalysis {
  answer: string;
  confidence: number;
  reasoning: string;
  tokens: number;
  model: string;
}

export class OpenRouterService {
  private apiKey: string;
  private baseUrl: string;
  private claudeModel: string;
  private gpt5Model: string;
  private deepseekModel: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.claudeModel = process.env.RESEARCH_CLAUDE_MODEL || process.env.CLAUDE_MODEL || 'anthropic/claude-3.5-sonnet';
    this.gpt5Model = process.env.RESEARCH_GPT5_MODEL || process.env.GPT5_MODEL || 'openai/gpt-4o-mini';
    this.deepseekModel = process.env.RESEARCH_DEEPSEEK_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek/deepseek-chat';

    if (!this.apiKey) {
      console.warn('⚠️  OpenRouter API key not found. Multi-model analysis will use mock responses.');
    }
  }

  /**
   * Execute Claude analysis
   */
  async executeClaudeAnalysis(question: string, context?: string): Promise<ModelAnalysis> {
    const prompt = this.buildAnalysisPrompt(question, context, 'Claude');
    
    try {
      const response = await this.callModel(this.claudeModel, prompt);
      return {
        answer: response.choices[0].message.content,
        confidence: this.extractConfidence(response.choices[0].message.content),
        reasoning: 'Complex policy analysis using Claude\'s advanced reasoning',
        tokens: response.usage.total_tokens,
        model: 'claude'
      };
    } catch (error) {
      console.error('Claude analysis failed:', error);
      return this.getMockResponse('claude', question);
    }
  }

  /**
   * Execute GPT-5 analysis
   */
  async executeGPT5Analysis(question: string, context?: string): Promise<ModelAnalysis> {
    const prompt = this.buildAnalysisPrompt(question, context, 'GPT-5');
    
    try {
      const response = await this.callModel(this.gpt5Model, prompt);
      return {
        answer: response.choices[0].message.content,
        confidence: this.extractConfidence(response.choices[0].message.content),
        reasoning: 'Clinical reasoning using GPT-5\'s medical expertise',
        tokens: response.usage.total_tokens,
        model: 'gpt5'
      };
    } catch (error) {
      console.error('GPT-5 analysis failed:', error);
      return this.getMockResponse('gpt5', question);
    }
  }

  /**
   * Execute DeepSeek analysis
   */
  async executeDeepSeekAnalysis(question: string, context?: string): Promise<ModelAnalysis> {
    const prompt = this.buildAnalysisPrompt(question, context, 'DeepSeek');
    
    try {
      const response = await this.callModel(this.deepseekModel, prompt);
      return {
        answer: response.choices[0].message.content,
        confidence: this.extractConfidence(response.choices[0].message.content),
        reasoning: 'Fast routine check using DeepSeek\'s efficient processing',
        tokens: response.usage.total_tokens,
        model: 'deepseek'
      };
    } catch (error) {
      console.error('DeepSeek analysis failed:', error);
      return this.getMockResponse('deepseek', question);
    }
  }

  /**
   * Generic method to generate response using any model
   */
  async generateResponse(
    prompt: string, 
    model: string = 'gpt-4o-mini', 
    options: {
      temperature?: number;
      max_tokens?: number;
      system_prompt?: string;
    } = {}
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const messages = [];
    
    // Add system prompt if provided
    if (options.system_prompt) {
      messages.push({
        role: 'system',
        content: options.system_prompt
      });
    }
    
    // Add user prompt
    messages.push({
      role: 'user',
      content: prompt
    });

    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model: model,
        messages: messages,
        max_tokens: options.max_tokens || 2000,
        temperature: options.temperature || 0.1
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://claim-validator.local',
          'X-Title': 'Claim Validator Agent'
        },
        timeout: 30000
      }
    );

    return response.data.choices[0]?.message?.content || '';
  }

  /**
   * Execute parallel analysis across all models
   */
  async executeParallelAnalysis(question: string, context?: string): Promise<{
    claude: ModelAnalysis;
    gpt5: ModelAnalysis;
    deepseek: ModelAnalysis;
  }> {
    console.log(`🔄 Executing parallel analysis across Claude, GPT-5, and DeepSeek`);
    
    const [claudeResult, gpt5Result, deepseekResult] = await Promise.all([
      this.executeClaudeAnalysis(question, context),
      this.executeGPT5Analysis(question, context),
      this.executeDeepSeekAnalysis(question, context)
    ]);

    return {
      claude: claudeResult,
      gpt5: gpt5Result,
      deepseek: deepseekResult
    };
  }

  /**
   * Build analysis prompt for medical claim validation
   */
  private buildAnalysisPrompt(question: string, context: string | undefined, model: string): string {
    return `You are a senior medical claim validator specializing in ${model} analysis. 

Question: ${question}

${context ? `Context: ${context}` : ''}

Please provide a detailed analysis including:
1. Direct answer to the question
2. Confidence level (0-100%)
3. Supporting reasoning
4. Risk assessment

Format your response as:
ANSWER: [Your direct answer]
CONFIDENCE: [0-100%]
REASONING: [Your detailed reasoning]
RISK_ASSESSMENT: [Low/Medium/High risk factors]`;
  }

  /**
   * Call OpenRouter API
   */
  private async callModel(model: string, prompt: string): Promise<OpenRouterResponse> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: parseInt(process.env.RESEARCH_MAX_TOKENS || '2000'),
        temperature: parseFloat(process.env.RESEARCH_TEMPERATURE || '0.3')
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://claim-validator.local',
          'X-Title': 'Claim Validator Research Agent'
        },
        timeout: 30000
      }
    );

    return response.data;
  }

  /**
   * Extract confidence from model response
   */
  private extractConfidence(content: string): number {
    const confidenceMatch = content.match(/CONFIDENCE:\s*(\d+)%/i);
    if (confidenceMatch) {
      return parseInt(confidenceMatch[1]) / 100;
    }
    
    // Default confidence based on content length and keywords
    let confidence = 0.5;
    if (content.length > 200) confidence += 0.1;
    if (content.includes('policy') || content.includes('coverage')) confidence += 0.1;
    if (content.includes('specific') || content.includes('documented')) confidence += 0.1;
    
    return Math.min(confidence, 0.9);
  }

  /**
   * Get mock response when API is unavailable
   */
  private getMockResponse(model: string, question: string): ModelAnalysis {
    const mockResponses = {
      claude: {
        answer: `Claude analysis: Based on medical policy review, ${question} requires careful evaluation of coverage criteria and documentation requirements.`,
        confidence: 0.8,
        reasoning: 'Complex policy analysis using Claude\'s advanced reasoning capabilities',
        tokens: 150,
        model: 'claude'
      },
      gpt5: {
        answer: `GPT-5 analysis: Clinical assessment indicates ${question} should be evaluated against current medical guidelines and payer-specific requirements.`,
        confidence: 0.7,
        reasoning: 'Clinical reasoning using GPT-5\'s medical expertise and pattern recognition',
        tokens: 120,
        model: 'gpt5'
      },
      deepseek: {
        answer: `DeepSeek analysis: Quick evaluation suggests ${question} follows standard medical coding practices with standard coverage parameters.`,
        confidence: 0.6,
        reasoning: 'Fast routine check using DeepSeek\'s efficient processing and cost optimization',
        tokens: 80,
        model: 'deepseek'
      }
    };

    return mockResponses[model as keyof typeof mockResponses];
  }

  /**
   * Get cost estimate for analysis
   */
  getCostEstimate(tokens: number, model: string): number {
    // OpenRouter pricing (approximate, in USD per 1M tokens)
    const pricing = {
      'claude': 0.003,      // Claude 3.5 Sonnet
      'gpt5': 0.0005,       // GPT-4o Mini
      'deepseek': 0.00014   // DeepSeek Chat
    };

    const modelKey = model.toLowerCase();
    const pricePerToken = pricing[modelKey as keyof typeof pricing] || 0.001;
    
    return (tokens / 1000000) * pricePerToken;
  }
}
