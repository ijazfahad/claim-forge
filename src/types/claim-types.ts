// Core claim payload types
export interface ClaimPayload {
  payer: string;
  domains?: string[];
  seed_urls?: string[];
  cpt_codes: string[];
  icd10_codes: string[];
  place_of_service?: string;
  modifiers?: string[];
  prior_treatments?: string[];
  member_plan_type?: string;
  state?: string;
  note_summary: string;
}

// Root request structure
export interface ClaimValidationRequest {
  callback_url: string;
  payload: ClaimPayload;
}

// Validation response types
export interface ValidationResponse {
  claim_id: string;
  processing_time_ms: number;
  timestamp: string;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Firecrawl types
export interface FirecrawlResponse {
  success: boolean;
  data?: {
    content: string;
    markdown: string;
    structured_data?: {
      answer?: string;
      confidence_level?: 'high' | 'medium' | 'low';
      policy_reference?: {
        url?: string;
        paragraph?: string;
        sentence?: string;
        page_section?: string;
        document_type?: string;
      };
    };
    metadata: {
      title: string;
      description: string;
      url: string;
    };
  };
  error?: string;
}

// Google Search types
export interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
}

export interface GoogleSearchResponse {
  items: GoogleSearchResult[];
  searchInformation: {
    totalResults: string;
  };
}

// Enhanced Research Result types for conflict analysis
export interface PolicyReference {
  url: string;
  paragraph?: string;
  sentence?: string;
  page_section?: string;
  line_number?: number;
  document_type?: string;
}

export interface IndividualResearchResult {
  source: 'Firecrawl' | 'Claude-3.5' | 'GPT-4' | 'DeepSeek-V3';
  answer: string;
  confidence: number;
  policy_reference?: PolicyReference;
  metadata?: any;
}

export interface ConflictInfo {
  type: 'COVERAGE_CONFLICT' | 'REQUIREMENT_CONFLICT' | 'MODIFIER_CONFLICT' | 'FREQUENCY_CONFLICT' | 'ELIGIBILITY_CONFLICT';
  description: string;
  conflicting_sources: string[];
  conflicting_answers: { [source: string]: string };
}

export interface EnhancedResearchResult {
  question: string;
  final_answer: string;
  confidence: number;
  consensus_level: '4/4_AGREE' | '3/4_AGREE' | '2/4_AGREE' | '1/4_AGREE' | 'NO_CONSENSUS';
  conflicts: ConflictInfo[];
  individual_results: {
    firecrawl?: IndividualResearchResult;
    claude?: IndividualResearchResult;
    gpt?: IndividualResearchResult;
    deepseek?: IndividualResearchResult;
  };
  recommendations: string[];
  metadata: {
    extraction_method: 'conflict-analysis';
    processing_time: number;
    escalation_reason?: string;
  };
}
