## HTTP API

Base URL: `/` (server), `/api` (API namespace)

### Health Check
- Method: GET
- Path: `/health`
- Response: 200 OK

Example response:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "environment": "development",
  "version": "1.0.0"
}
```

### API Info
- Method: GET
- Path: `/api`
- Response: 200 OK

Example response:

```json
{
  "message": "ClaimForge Validation API",
  "version": "1.0.0",
  "status": "running",
  "endpoints": {
    "health": "/health",
    "validate": "/api/claims/validate",
    "workflow": "/",
    "test": "/api/test"
  }
}
```

### Validate Claim (SSE streaming)
- Method: POST
- Path: `/api/validate-claim`
- Content-Type: `application/json`
- Accepts: Server-Sent Events (SSE) stream response

Request body shape aligns with `ClaimValidationRequest` and `ClaimPayload`:

```json
{
  "payload": {
    "payer": "Aetna",
    "cpt_codes": ["99213"],
    "icd10_codes": ["M54.5"],
    "place_of_service": "11",
    "modifiers": ["25"],
    "note_summary": "Office visit for low back pain."
  },
  "callback_url": "https://example.com/callback"
}
```

SSE stream events will include JSON lines like:

```json
{
  "step": "planner",
  "status": "active",
  "message": "Generating validation questions...",
  "progress": 30
}
```

On completion, the final event contains the evaluator result:

```json
{
  "step": "evaluator",
  "status": "completed",
  "message": "Validation completed successfully",
  "progress": 100,
  "result": {
    "claim_id": "CLM-173...",
    "overall_status": "REQUIRES_REVIEW",
    "confidence": "medium",
    "processing_time_ms": 12345,
    "timestamp": "2025-01-01T00:00:00.000Z",
    "question_analysis": [],
    "overall_assessment": {},
    "insurance_insights": {}
  }
}
```

#### Validation and Security
- Request body is validated by `validateClaimPayload` middleware.
- API key validation supported via `x-api-key` header (see Middleware docs).
- Basic in-memory rate limiting available.

