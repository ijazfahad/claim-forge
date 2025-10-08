## Configuration

Set these environment variables (e.g., in `.env`).

### Core Server
- `PORT`: default `3000`
- `NODE_ENV`: `development` | `production`

### Database (PostgreSQL)
- `DATABASE_URL`: connection string

CMS/NCCI ingestion creates/uses schema `claim_forge`.

### Google Custom Search
- `GOOGLE_SEARCH_API_KEY`
- `GOOGLE_SEARCH_ENGINE_ID`

### Firecrawl
- `FIRECRAWL_API_URL` (e.g., `http://localhost:3002`)
- `FIRECRAWL_API_KEY` (optional)

### OpenRouter (LLM gateway)
- `OPENROUTER_API_KEY`
- Optional model overrides:
  - `RESEARCH_CLAUDE_MODEL`, `RESEARCH_GPT5_MODEL`, `RESEARCH_DEEPSEEK_MODEL`
  - `BASE_AGENT_MODEL`, `SANITY_CHECK_MODEL`, `PLANNER_MODEL`, `EVALUATOR_MODEL`, `REVIEWER_MODEL`
  - Token/temperature knobs: `*_MAX_TOKENS`, `*_TEMPERATURE`

### Redis
- `REDIS_URL`
- `REDIS_PASSWORD` (optional)

### API Key (for middleware)
- `API_KEY`: value expected in `x-api-key`

