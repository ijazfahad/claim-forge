## Middleware

### validateClaimPayload
Validates request body for `/api/validate-claim`.

```startLine:endLine:src/middleware/validation.ts
4:33:src/middleware/validation.ts
```

Usage:

```typescript
import { validateClaimPayload } from './middleware/validation';
app.post('/api/validate-claim', validateClaimPayload, handler);
```

### validateApiKey
Simple header-based API key validation using `x-api-key`.

```startLine:endLine:src/middleware/validation.ts
61:85:src/middleware/validation.ts
```

Usage:

```typescript
import { validateApiKey } from './middleware/validation';
app.use('/api', validateApiKey, router);
```

### rateLimit(maxRequests=100, windowMs=60000)
In-memory rate limiter for basic protection.

```startLine:endLine:src/middleware/validation.ts
90:121:src/middleware/validation.ts
```

