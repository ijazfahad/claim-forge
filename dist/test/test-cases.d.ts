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
export declare const TEST_CASES: TestCase[];
export declare const TEST_CASES_BY_CATEGORY: {
    sanity_check: TestCase[];
    planner: TestCase[];
    research: TestCase[];
    retry: TestCase[];
    evaluate: TestCase[];
    edge_case: TestCase[];
    good: TestCase[];
    bad: TestCase[];
};
export declare function getTestCaseById(id: string): TestCase | undefined;
export declare function getTestCasesByTag(tag: string): TestCase[];
//# sourceMappingURL=test-cases.d.ts.map