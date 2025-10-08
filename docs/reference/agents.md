## Agents

### StepByStepValidationWorkflow
High-level orchestrator to run sanity → planner → research+review → evaluator with persistence.

Public method:
- `validateClaim(payload: ClaimPayload): Promise<EvaluatorDecision>`

Sequence details and step outputs are persisted via `ClaimStorageService`.

### SanityCheckAgent
- `initialize()`
- `performSanityCheck(payload: ClaimPayload): Promise<SanityCheckResult>`

Key result type:
```startLine:endLine:src/agents/sanity-check-agent.ts
7:62:src/agents/sanity-check-agent.ts
```

### PlannerAgent
- `initialize()`
- `generateQuestions(payload: ClaimPayload, sanity: SanityCheckResult): Promise<PlannerResult>`

Planner types:
```startLine:endLine:src/agents/planner-agent.ts
7:40:src/agents/planner-agent.ts
```

### ResearchAgent
- `executeResearch(questions: ValidationQuestion[]): Promise<ResearchResult[]>`
- `executeFirecrawlResearchWithUrls(questions, firecrawlInput)`
- `executeFirecrawlResearch(questions)`
- `executeMultiModelAnalysis(questions)`

Research types:
```startLine:endLine:src/agents/research-agent.ts
7:59:src/agents/research-agent.ts
```

### ReviewerAgent
- `initialize()`
- `reviewResearchResults(researchResults, questions, startTime): Promise<ReviewerResult[]>`

Reviewer types:
```startLine:endLine:src/agents/reviewer-agent.ts
6:24:src/agents/reviewer-agent.ts
```

### EvaluatorAgent
- `initialize()`
- `evaluateClaim(claimId, reviewerResults, questions, startTime): Promise<EvaluatorDecision>`

Evaluator types:
```startLine:endLine:src/agents/evaluator-agent.ts
7:49:src/agents/evaluator-agent.ts
```

