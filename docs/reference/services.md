## Services

### ClaimStorageService

Public API:
- `storeClaimPayload(claimId, payload): Promise<string>`
- `storeClaimValidation(claimId, originalClaim, evaluatorResult, researchResults, plannerQuestions, sanityCheckResults): Promise<string>`
- `storeValidationStep(stepData): Promise<string>`
- `updateClaimValidation(id, updates): Promise<void>`
- `getClaimValidation(claimId): Promise<ClaimValidationRecord | null>`
- `getValidationSteps(claimValidationId): Promise<ValidationStepRecord[]>`
- `updateValidationStep(stepId, updates): Promise<void>`
- `storeResearchResult(id, researchResult): Promise<void>`
- `storePlannerQuestions(id, questions): Promise<void>`
- `storeSanityCheckResults(id, sanityResult): Promise<void>`
- `storeReviewerResult(id, reviewerResult): Promise<void>`
- `storeDetectedConflict(id, question, conflict): Promise<void>`
- `getValidationStats(): Promise<any>`
- `close(): Promise<void>`

Notes:
- Requires `DATABASE_URL` and a PostgreSQL instance; creates/uses schema `claim_forge`.

### CMS NCCI Validator (PostgreSQL)

Exports:
- `buildLatest({ verbose }): Promise<{ dbPath: string; downloaded: any }>`: downloads+ingests CMS NCCI datasets (PTP, MUE, AOC) into PostgreSQL.
- `validateClaim(claim: ClaimValidationInput, { providerType }): Promise<ValidationResult>`
- `isDatabaseBuilt(): Promise<boolean>`
- `getDatabasePath(): string`

Key types:
```startLine:endLine:src/services/cms-ncci-validator.ts
54:78:src/services/cms-ncci-validator.ts
```

### CMSNCCIService (legacy JSON adapter)
- `validateClaim(payload: ClaimPayload): Promise<ValidationIssue[]>`
- Accessors: `getCPTInfo`, `getBundlingEdit`, `getModifierInfo`, `isLoaded`, `getVersion`

### GoogleSearchService
- Requires `GOOGLE_SEARCH_API_KEY`, `GOOGLE_SEARCH_ENGINE_ID`
- `searchMedicalCoding(query, numResults=3)`
- Convenience methods: `searchCPTRelationships`, `searchSpecialtyInfo`, `searchPayerDenialPatterns`, `searchCodeRelationships`, `searchPriorAuthRequirements`

### FirecrawlService
- Requires `FIRECRAWL_API_URL`; optional `FIRECRAWL_API_KEY`
- `scrapeUrl(url)`
- `extractContentForQuestion(question, questionType, urls, query?)`
- `scrapeContentForQuestion(question, questionType, urls, query?)`
- `extractSingleUrl(url, extractionInstructions)`

### OpenRouterService
- Requires `OPENROUTER_API_KEY`
- `executeClaudeAnalysis`, `executeGPT5Analysis`, `executeDeepSeekAnalysis`
- `generateResponse(prompt, model?, options?)`
- `executeParallelAnalysis(question, context?)`
- `getCostEstimate(tokens, model)`

### RedisService
- Requires `REDIS_URL` (and optional `REDIS_PASSWORD`)
- `storeDenialPattern`, `getDenialPattern`
- `storeProviderPerformance`, `getProviderPerformance`
- `storeSpecialtyMapping`, `getSpecialtyMapping`
- `generateClaimHash(payload)`
- `close()`

