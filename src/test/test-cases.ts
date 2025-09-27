import { ClaimPayload } from '../types/claim-types';

export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: 'good' | 'bad' | 'edge_case';
  expected_result: 'GO' | 'NO_GO' | 'NEEDS_REVIEW';
  claim: ClaimPayload;
  expected_issues?: string[];
  expected_warnings?: string[];
  tags: string[];
}

export const TEST_CASES: TestCase[] = [
  // ===== SANITY CHECK TEST CASES =====
  {
    id: 'sanity_001',
    name: 'Valid E/M Visit',
    description: 'Standard office visit with valid codes',
    category: 'good',
    expected_result: 'GO',
    claim: {
      cpt_codes: ['99213'],
      icd10_codes: ['Z00.00'],
      note_summary: 'Annual physical examination',
      payer: 'Medicare',
      place_of_service: '11',
      state: 'CA'
    },
    tags: ['sanity_check', 'e_m_visit', 'valid_codes']
  },
  {
    id: 'sanity_002',
    name: 'Invalid CPT Code Format',
    description: 'CPT code with wrong format',
    category: 'bad',
    expected_result: 'NO_GO',
    claim: {
      cpt_codes: ['9921'], // Missing digit
      icd10_codes: ['Z00.00'],
      note_summary: 'Office visit',
      payer: 'Medicare',
      place_of_service: '11',
      state: 'CA'
    },
    expected_issues: ['Invalid CPT code format'],
    tags: ['sanity_check', 'invalid_cpt', 'format_error']
  },
  {
    id: 'sanity_003',
    name: 'Invalid ICD-10 Format',
    description: 'ICD-10 code with wrong format',
    category: 'bad',
    expected_result: 'NO_GO',
    claim: {
      cpt_codes: ['99213'],
      icd10_codes: ['Z00'], // Missing decimal and digits
      note_summary: 'Office visit',
      payer: 'Medicare',
      place_of_service: '11',
      state: 'CA'
    },
    expected_issues: ['Invalid ICD-10-CM format'],
    tags: ['sanity_check', 'invalid_icd', 'format_error']
  },
  {
    id: 'sanity_004',
    name: 'PTP Bundling Conflict',
    description: 'Two codes that cannot be billed together',
    category: 'bad',
    expected_result: 'NO_GO',
    claim: {
      cpt_codes: ['99213', '99214'], // E/M codes that may conflict
      icd10_codes: ['Z00.00'],
      note_summary: 'Office visit',
      payer: 'Medicare',
      place_of_service: '11',
      state: 'CA'
    },
    expected_issues: ['PTP bundling conflict'],
    tags: ['sanity_check', 'ptp_conflict', 'bundling']
  },

  // ===== PLANNER TEST CASES =====
  {
    id: 'planner_001',
    name: 'Simple Procedure',
    description: 'Single procedure requiring basic validation',
    category: 'good',
    expected_result: 'GO',
    claim: {
      cpt_codes: ['99213'],
      icd10_codes: ['Z00.00'],
      note_summary: 'Annual physical examination',
      payer: 'Medicare',
      place_of_service: '11',
      state: 'CA'
    },
    tags: ['planner', 'simple_procedure', 'basic_validation']
  },
  {
    id: 'planner_002',
    name: 'Complex Procedure',
    description: 'Multiple procedures requiring detailed validation',
    category: 'edge_case',
    expected_result: 'NEEDS_REVIEW',
    claim: {
      cpt_codes: ['64635', '64636', '77003'],
      icd10_codes: ['M54.5', 'G89.29'],
      note_summary: 'Lumbar facet radiofrequency ablation with imaging guidance',
      payer: 'Aetna',
      place_of_service: '11',
      state: 'CA'
    },
    expected_warnings: ['Complex procedure requiring detailed review'],
    tags: ['planner', 'complex_procedure', 'multiple_codes']
  },
  {
    id: 'planner_003',
    name: 'High-Risk Procedure',
    description: 'Procedure with high denial risk',
    category: 'bad',
    expected_result: 'NO_GO',
    claim: {
      cpt_codes: ['64635'],
      icd10_codes: ['M54.5'],
      note_summary: 'Radiofrequency ablation without prior authorization',
      payer: 'UnitedHealthcare',
      place_of_service: '11',
      state: 'CA'
    },
    expected_issues: ['Prior authorization required'],
    tags: ['planner', 'high_risk', 'prior_auth']
  },

  // ===== RESEARCH TEST CASES =====
  {
    id: 'research_001',
    name: 'Well-Documented Procedure',
    description: 'Procedure with clear documentation',
    category: 'good',
    expected_result: 'GO',
    claim: {
      cpt_codes: ['99213'],
      icd10_codes: ['Z00.00'],
      note_summary: 'Comprehensive annual physical examination with detailed history and physical',
      payer: 'Medicare',
      place_of_service: '11',
      state: 'CA'
    },
    tags: ['research', 'well_documented', 'clear_justification']
  },
  {
    id: 'research_002',
    name: 'Insufficient Documentation',
    description: 'Procedure with minimal documentation',
    category: 'bad',
    expected_result: 'NO_GO',
    claim: {
      cpt_codes: ['64635'],
      icd10_codes: ['M54.5'],
      note_summary: 'Procedure performed',
      payer: 'Medicare',
      place_of_service: '11',
      state: 'CA'
    },
    expected_issues: ['Insufficient documentation'],
    tags: ['research', 'insufficient_docs', 'minimal_notes']
  },
  {
    id: 'research_003',
    name: 'Controversial Procedure',
    description: 'Procedure with mixed evidence',
    category: 'edge_case',
    expected_result: 'NEEDS_REVIEW',
    claim: {
      cpt_codes: ['64635'],
      icd10_codes: ['M54.5'],
      note_summary: 'Radiofrequency ablation for chronic pain, patient has failed conservative treatment',
      payer: 'Medicare',
      place_of_service: '11',
      state: 'CA'
    },
    expected_warnings: ['Mixed evidence for procedure effectiveness'],
    tags: ['research', 'controversial', 'mixed_evidence']
  },

  // ===== RETRY TEST CASES =====
  {
    id: 'retry_001',
    name: 'Clear Fallback Case',
    description: 'Case where retry logic provides clear answer',
    category: 'good',
    expected_result: 'GO',
    claim: {
      cpt_codes: ['99213'],
      icd10_codes: ['Z00.00'],
      note_summary: 'Annual physical examination',
      payer: 'Medicare',
      place_of_service: '11',
      state: 'CA'
    },
    tags: ['retry', 'clear_fallback', 'standard_procedure']
  },
  {
    id: 'retry_002',
    name: 'Ambiguous Case',
    description: 'Case where retry logic cannot determine outcome',
    category: 'edge_case',
    expected_result: 'NEEDS_REVIEW',
    claim: {
      cpt_codes: ['64635'],
      icd10_codes: ['M54.5'],
      note_summary: 'Radiofrequency ablation, patient condition unclear',
      payer: 'Medicare',
      place_of_service: '11',
      state: 'CA'
    },
    expected_warnings: ['Unable to determine medical necessity'],
    tags: ['retry', 'ambiguous', 'unclear_necessity']
  },

  // ===== EVALUATE TEST CASES =====
  {
    id: 'evaluate_001',
    name: 'Clear GO Decision',
    description: 'All validation steps pass clearly',
    category: 'good',
    expected_result: 'GO',
    claim: {
      cpt_codes: ['99213'],
      icd10_codes: ['Z00.00'],
      note_summary: 'Annual physical examination with comprehensive history and physical',
      payer: 'Medicare',
      place_of_service: '11',
      state: 'CA'
    },
    tags: ['evaluate', 'clear_go', 'all_passed']
  },
  {
    id: 'evaluate_002',
    name: 'Clear NO_GO Decision',
    description: 'Multiple validation failures',
    category: 'bad',
    expected_result: 'NO_GO',
    claim: {
      cpt_codes: ['9921'], // Invalid format
      icd10_codes: ['Z00'], // Invalid format
      note_summary: 'Insufficient documentation',
      payer: 'Medicare',
      place_of_service: '11',
      state: 'CA'
    },
    expected_issues: ['Invalid CPT format', 'Invalid ICD format', 'Insufficient documentation'],
    tags: ['evaluate', 'clear_no_go', 'multiple_failures']
  },
  {
    id: 'evaluate_003',
    name: 'Borderline Case',
    description: 'Mixed results requiring human review',
    category: 'edge_case',
    expected_result: 'NEEDS_REVIEW',
    claim: {
      cpt_codes: ['64635'],
      icd10_codes: ['M54.5'],
      note_summary: 'Radiofrequency ablation, some documentation present but incomplete',
      payer: 'Medicare',
      place_of_service: '11',
      state: 'CA'
    },
    expected_warnings: ['Borderline case requiring human review'],
    tags: ['evaluate', 'borderline', 'human_review']
  },

  // ===== EDGE CASES =====
  {
    id: 'edge_001',
    name: 'Multiple Payers',
    description: 'Claim with multiple payer considerations',
    category: 'edge_case',
    expected_result: 'NEEDS_REVIEW',
    claim: {
      cpt_codes: ['99213'],
      icd10_codes: ['Z00.00'],
      note_summary: 'Annual physical examination',
      payer: 'Medicare',
      place_of_service: '11',
      state: 'CA'
    },
    expected_warnings: ['Multiple payer policies may apply'],
    tags: ['edge_case', 'multiple_payers', 'policy_conflict']
  },
  {
    id: 'edge_002',
    name: 'State-Specific Rules',
    description: 'Claim subject to state-specific regulations',
    category: 'edge_case',
    expected_result: 'NEEDS_REVIEW',
    claim: {
      cpt_codes: ['99213'],
      icd10_codes: ['Z00.00'],
      note_summary: 'Annual physical examination',
      payer: 'Medicare',
      place_of_service: '11',
      state: 'TX' // Texas has specific rules
    },
    expected_warnings: ['State-specific regulations may apply'],
    tags: ['edge_case', 'state_specific', 'regulations']
  },
  {
    id: 'edge_003',
    name: 'Emergency Procedure',
    description: 'Emergency procedure with different rules',
    category: 'edge_case',
    expected_result: 'GO',
    claim: {
      cpt_codes: ['99281'],
      icd10_codes: ['R50.9'],
      note_summary: 'Emergency department visit for fever',
      payer: 'Medicare',
      place_of_service: '23', // Emergency room
      state: 'CA'
    },
    tags: ['edge_case', 'emergency', 'different_rules']
  }
];

export const TEST_CASES_BY_CATEGORY = {
  sanity_check: TEST_CASES.filter(tc => tc.tags.includes('sanity_check')),
  planner: TEST_CASES.filter(tc => tc.tags.includes('planner')),
  research: TEST_CASES.filter(tc => tc.tags.includes('research')),
  retry: TEST_CASES.filter(tc => tc.tags.includes('retry')),
  evaluate: TEST_CASES.filter(tc => tc.tags.includes('evaluate')),
  edge_case: TEST_CASES.filter(tc => tc.category === 'edge_case'),
  good: TEST_CASES.filter(tc => tc.category === 'good'),
  bad: TEST_CASES.filter(tc => tc.category === 'bad')
};

export function getTestCaseById(id: string): TestCase | undefined {
  return TEST_CASES.find(tc => tc.id === id);
}

export function getTestCasesByTag(tag: string): TestCase[] {
  return TEST_CASES.filter(tc => tc.tags.includes(tag));
}
