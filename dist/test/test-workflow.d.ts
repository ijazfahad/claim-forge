import { ClaimPayload } from '../types/claim-types';
declare const testClaimPayload: ClaimPayload;
declare const testCases: {
    name: string;
    payload: ClaimPayload;
    expected: string;
}[];
declare function runAllTests(): Promise<({
    testName: any;
    status: string;
    expected: any;
    actual: "GO" | "NO_GO";
    processingTime: number;
    result: import("../agents/evaluate-agent").EvaluationResult;
    error?: undefined;
} | {
    testName: any;
    status: string;
    expected: any;
    actual: string;
    error: string;
    processingTime?: undefined;
    result?: undefined;
})[]>;
export { runAllTests, testCases, testClaimPayload };
//# sourceMappingURL=test-workflow.d.ts.map