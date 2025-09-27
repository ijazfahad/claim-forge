import { ResearchResult } from '../agents/research-agent';
import { ValidationQuestion } from '../agents/planner-agent';
import { ClaimPayload } from '../types/claim-types';

export interface ShapedEvidence {
  n: number;
  type: string;
  q: string;
  mode: 'model_only' | 'researched' | 'insufficient' | 'unknown';
  accept_if: string[];
  claim_context: {
    payer: string;
    state: string;
    member_plan_type: string;
    place_of_service: string;
    cpt_codes: string[];
    icd10_codes: string[];
  };
  evidence: {
    url: string;
    title: string;
    snippets: Array<{ text: string; where: string }>;
    used_query: string;
  };
  model_only: {
    summary: string;
    likely_accept_if: string | null;
    confidence: 'low' | 'medium' | 'high';
    next_checks: string[];
    disclaimers: string;
  } | null;
}

export class EvidenceShapingService {
  /**
   * Shape evidence from research results and questions
   * Unifies research success, model-only, and insufficient results
   */
  shapeEvidence(
    researchResults: ResearchResult[],
    questions: ValidationQuestion[],
    claimContext: ClaimPayload
  ): ShapedEvidence[] {
    const shaped: ShapedEvidence[] = [];

    for (const result of researchResults) {
      const question = questions.find(q => String(q.n) === result.n);
      if (!question) continue;

      const shapedItem: ShapedEvidence = {
        n: Number(result.n),
        type: result.type,
        q: result.q,
        mode: this.determineMode(result),
        accept_if: question.accept_if || [],
        claim_context: {
          payer: claimContext.payer,
          state: claimContext.state || '',
          member_plan_type: claimContext.member_plan_type || '',
          place_of_service: claimContext.place_of_service || '',
          cpt_codes: claimContext.cpt_codes,
          icd10_codes: claimContext.icd10_codes
        },
        evidence: {
          url: '',
          title: '',
          snippets: [],
          used_query: ''
        },
        model_only: null
      };

      // Handle different modes
      if (result.model_only === 'true') {
        shapedItem.mode = 'model_only';
        shapedItem.model_only = {
          summary: result.summary,
          likely_accept_if: result.likely_accept_if || null,
          confidence: this.sanitizeConfidence(result.confidence),
          next_checks: result.next_checks || [],
          disclaimers: result.disclaimers || 'Plan, state, and line-of-business rules vary; verify in official policy.'
        };
      } else if (result.status === 'ok') {
        shapedItem.mode = 'researched';
        // In a real implementation, this would include actual evidence from web search/Firecrawl
        shapedItem.evidence = {
          url: '',
          title: '',
          snippets: [],
          used_query: ''
        };
      } else {
        shapedItem.mode = 'insufficient';
      }

      shaped.push(shapedItem);
    }

    return shaped;
  }

  /**
   * Determine the mode based on research result
   */
  private determineMode(result: ResearchResult): 'model_only' | 'researched' | 'insufficient' | 'unknown' {
    if (result.model_only === 'true') {
      return 'model_only';
    }
    
    if (result.status === 'ok') {
      return 'researched';
    }
    
    if (result.status === 'insufficient') {
      return 'insufficient';
    }
    
    return 'unknown';
  }

  /**
   * Sanitize confidence level
   */
  private sanitizeConfidence(confidence: string): 'low' | 'medium' | 'high' {
    const normalized = confidence.toLowerCase();
    if (normalized === 'high') return 'high';
    if (normalized === 'medium') return 'medium';
    return 'low';
  }

  /**
   * Clamp snippets to reasonable length
   */
  private clampSnippets(snippets: any[]): Array<{ text: string; where: string }> {
    if (!Array.isArray(snippets)) return [];
    
    return snippets
      .map(snippet => {
        const text = (snippet?.text || '').slice(0, 300);
        const where = snippet?.where || '';
        return text ? { text, where } : null;
      })
      .filter(Boolean) as Array<{ text: string; where: string }>;
  }

  /**
   * Convert boolean-like values to actual booleans
   */
  private toBool(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
    return false;
  }

  /**
   * Sanitize string values
   */
  private sanitizeString(value: any): string {
    return (value == null ? '' : String(value)).trim();
  }

  /**
   * Aggregate shaped evidence for evaluation
   * Sorts BASIC questions first for gatekeeping, then by question number
   */
  aggregateForEvaluation(shapedEvidence: ShapedEvidence[]): ShapedEvidence[] {
    const priority = { basic: 0, specialty: 1, subspecialty: 2 };
    
    return shapedEvidence
      .sort((a, b) => {
        const pa = priority[a.type as keyof typeof priority] ?? 99;
        const pb = priority[b.type as keyof typeof priority] ?? 99;
        if (pa !== pb) return pa - pb;
        return a.n - b.n;
      });
  }

  /**
   * Get statistics from shaped evidence
   */
  getStatistics(shapedEvidence: ShapedEvidence[]): {
    total: number;
    by_mode: Record<string, number>;
    by_type: Record<string, number>;
    by_confidence: Record<string, number>;
  } {
    const stats = {
      total: shapedEvidence.length,
      by_mode: {} as Record<string, number>,
      by_type: {} as Record<string, number>,
      by_confidence: {} as Record<string, number>
    };

    for (const item of shapedEvidence) {
      // Count by mode
      stats.by_mode[item.mode] = (stats.by_mode[item.mode] || 0) + 1;
      
      // Count by type
      stats.by_type[item.type] = (stats.by_type[item.type] || 0) + 1;
      
      // Count by confidence (for model_only items)
      if (item.model_only) {
        stats.by_confidence[item.model_only.confidence] = 
          (stats.by_confidence[item.model_only.confidence] || 0) + 1;
      }
    }

    return stats;
  }
}
