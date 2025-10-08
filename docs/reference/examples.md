## Examples

### Start the server

```bash
npm run build && npm start
```

### Validate a claim with curl (SSE)

```bash
curl -N -H "Content-Type: application/json" \
     -H "x-api-key: $API_KEY" \
     -X POST \
     --data '{
       "payload": {
         "payer": "Medicare",
         "cpt_codes": ["99213"],
         "icd10_codes": ["M54.50"],
         "place_of_service": "11",
         "modifiers": ["25"],
         "note_summary": "Office visit for low back pain"
       },
       "callback_url": "https://example.org/callback"
     }' \
     http://localhost:3000/api/validate-claim
```

You will receive streamed events until completion. The final event contains the evaluator decision.

### Programmatic usage: Orchestrated validation

```typescript
import { StepByStepValidationWorkflow } from './src/services/step-by-step-validation-workflow';

const workflow = new StepByStepValidationWorkflow();
const result = await workflow.validateClaim({
  payer: 'Aetna',
  cpt_codes: ['99213'],
  icd10_codes: ['M54.50'],
  place_of_service: '11',
  modifiers: ['25'],
  note_summary: 'Office visit for low back pain'
});
console.log(result.overall_status, result.confidence);
```

### Using GoogleSearchService

```typescript
import { GoogleSearchService } from './src/services/google-search';

const google = new GoogleSearchService();
const results = await google.searchCPTRelationships('99213');
console.log(results.map(r => r.title));
```

### Using FirecrawlService

```typescript
import { FirecrawlService } from './src/services/firecrawl-service';

const firecrawl = new FirecrawlService();
const data = await firecrawl.extractSingleUrl(
  'https://www.cms.gov/medicare-coverage-database/',
  'Extract coverage criteria for CPT 99213'
);
console.log(data.success, data.data?.metadata?.title);
```

### Update CMS/NCCI data

```bash
npm run update:cms
```

This will fetch the latest CMS datasets and ingest them into PostgreSQL under the `claim_forge` schema.

