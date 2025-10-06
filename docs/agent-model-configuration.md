# Agent Model Configuration

This document explains how to configure different AI models for each agent in the Claim Validator system.

## Overview

Each agent in the system can be configured with specific models, temperature settings, and token limits through environment variables. This allows you to:

- **Optimize for cost**: Use cheaper, faster models
- **Optimize for quality**: Use more capable models
- **Balance both**: Use mid-tier models for good performance at reasonable cost
- **Customize per agent**: Different agents can use different models based on their specific needs

## Quick Start

### Using Pre-configured Profiles

We provide several pre-configured model profiles:

```bash
# List available configurations
./scripts/model-configs.sh list

# Apply a configuration
./scripts/model-configs.sh apply fast-and-cheap
./scripts/model-configs.sh apply high-quality
./scripts/model-configs.sh apply balanced
./scripts/model-configs.sh apply development

# Show current configuration
./scripts/model-configs.sh show
```

### Manual Configuration

Edit the `.env` file directly to set specific model configurations:

```bash
# Sanity Check Agent
SANITY_CHECK_MODEL=gpt-4o-mini
SANITY_CHECK_TEMPERATURE=0.1
SANITY_CHECK_MAX_TOKENS=3000

# Planner Agent
PLANNER_MODEL=gpt-4o-mini
PLANNER_TEMPERATURE=0.1
PLANNER_MAX_TOKENS=2000

# Research Agent (Multi-Model Analysis)
RESEARCH_CLAUDE_MODEL=anthropic/claude-3.5-sonnet
RESEARCH_GPT5_MODEL=openai/gpt-4o-mini
RESEARCH_DEEPSEEK_MODEL=deepseek/deepseek-chat
RESEARCH_TEMPERATURE=0.1
RESEARCH_MAX_TOKENS=2000

# Evaluator Agent
EVALUATOR_MODEL=gpt-4o-mini
EVALUATOR_TEMPERATURE=0.1
EVALUATOR_MAX_TOKENS=2000

# Base Agent (Default for all agents)
BASE_AGENT_MODEL=gpt-4o-mini
BASE_AGENT_TEMPERATURE=0.1
BASE_AGENT_MAX_TOKENS=2000
```

## Agent-Specific Configuration

### Sanity Check Agent
- **Purpose**: Clinical validation and specialty prediction
- **Recommended Models**: `gpt-4o-mini` (fast), `gpt-4o` (accurate)
- **Temperature**: 0.1 (consistent results)
- **Max Tokens**: 2000-4000 (detailed analysis)

### Planner Agent
- **Purpose**: Generate research questions and search queries
- **Recommended Models**: `gpt-4o-mini` (cost-effective), `gpt-4o` (better queries)
- **Temperature**: 0.1 (consistent query generation)
- **Max Tokens**: 1500-3000 (structured output)

### Research Agent (Multi-Model Analysis)
- **Purpose**: Analyze research results using multiple AI models
- **Claude Model**: `anthropic/claude-3.5-haiku` (fast) or `anthropic/claude-3.5-sonnet` (accurate)
- **GPT Model**: `gpt-4o-mini` (fast) or `gpt-4o` (accurate)
- **DeepSeek Model**: `deepseek/deepseek-chat` (good for analysis)
- **Temperature**: 0.1-0.3 (balance consistency and creativity)
- **Max Tokens**: 1500-3000 (detailed analysis)

### Evaluator Agent
- **Purpose**: Make final claim decisions based on research results
- **Recommended Models**: `gpt-4o-mini` (fast), `gpt-4o` (accurate)
- **Temperature**: 0.1 (consistent decisions)
- **Max Tokens**: 2000-4000 (comprehensive evaluation)

## Available Models

### OpenAI Models
- `gpt-4o-mini`: Fast, cost-effective, good for most tasks
- `gpt-4o`: More capable, higher cost, better for complex analysis
- `gpt-4-turbo`: Legacy model, still capable

### Anthropic Models
- `anthropic/claude-3.5-haiku`: Fast Claude model
- `anthropic/claude-3.5-sonnet`: Most capable Claude model
- `anthropic/claude-3-opus`: Most powerful Claude model (expensive)

### DeepSeek Models
- `deepseek/deepseek-chat`: Good for analysis and reasoning

### Other Models
- `meta-llama/llama-3.1-8b-instruct`: Open source option
- `google/gemini-pro`: Google's model
- `mistralai/mistral-7b-instruct`: Fast open source model

## Configuration Profiles

### Fast and Cheap (`fast-and-cheap`)
- **Use Case**: Development, testing, high-volume processing
- **Models**: All `gpt-4o-mini` and `claude-3.5-haiku`
- **Cost**: Lowest
- **Speed**: Fastest
- **Quality**: Good for basic tasks

### Balanced (`balanced`)
- **Use Case**: Production with moderate volume
- **Models**: Mix of `gpt-4o-mini` and `claude-3.5-sonnet`
- **Cost**: Moderate
- **Speed**: Good
- **Quality**: High

### High Quality (`high-quality`)
- **Use Case**: Critical production workloads
- **Models**: All `gpt-4o` and `claude-3.5-sonnet`
- **Cost**: Highest
- **Speed**: Slower
- **Quality**: Highest

### Development (`development`)
- **Use Case**: Local development and testing
- **Models**: All `gpt-4o-mini` and `claude-3.5-haiku`
- **Temperature**: Higher (0.3) for more creative responses
- **Cost**: Very low
- **Speed**: Very fast

## Temperature Guidelines

- **0.0-0.2**: Very consistent, deterministic responses
- **0.3-0.5**: Balanced creativity and consistency
- **0.6-1.0**: More creative, less predictable responses

For medical claim validation, we recommend **0.1** for most agents to ensure consistent, reliable results.

## Max Tokens Guidelines

- **1000-2000**: Short responses, basic analysis
- **3000-4000**: Detailed responses, complex analysis
- **5000+**: Very detailed responses, comprehensive analysis

## Applying Changes

After modifying model configurations:

1. **Restart containers** to apply the new settings:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

2. **Test the configuration** with a sample claim:
   ```bash
   curl -X POST http://localhost:3000/api/validate-claim \
     -H "Content-Type: application/json" \
     -d '{"cpt_codes": ["99213"], "icd10_codes": ["M54.5"], "payer": "Medicare"}'
   ```

## Monitoring and Optimization

### Cost Monitoring
- Monitor your OpenRouter usage dashboard
- Track token consumption per agent
- Adjust models based on usage patterns

### Performance Monitoring
- Check response times in logs
- Monitor accuracy of decisions
- Adjust temperature and max_tokens based on results

### Quality Monitoring
- Review agent outputs for consistency
- Check for appropriate confidence levels
- Adjust models if quality is insufficient

## Troubleshooting

### Common Issues

1. **Model not available**: Check if the model name is correct and available in your OpenRouter plan
2. **High costs**: Switch to cheaper models (`gpt-4o-mini`, `claude-3.5-haiku`)
3. **Slow responses**: Reduce `max_tokens` or use faster models
4. **Inconsistent results**: Lower the `temperature` value
5. **Poor quality**: Use more capable models (`gpt-4o`, `claude-3.5-sonnet`)

### Getting Help

- Check the OpenRouter documentation for model availability
- Review agent logs for specific error messages
- Test with different model configurations to find the best balance

## Best Practices

1. **Start with balanced configuration** and adjust based on needs
2. **Monitor costs** regularly and adjust models accordingly
3. **Test thoroughly** when changing configurations
4. **Use version control** for your `.env` file
5. **Document custom configurations** for team members
6. **Backup configurations** before making changes

## Example Custom Configuration

For a high-volume, cost-sensitive environment:

```bash
# All agents use gpt-4o-mini for cost efficiency
SANITY_CHECK_MODEL=gpt-4o-mini
PLANNER_MODEL=gpt-4o-mini
EVALUATOR_MODEL=gpt-4o-mini
BASE_AGENT_MODEL=gpt-4o-mini

# Research uses Claude for better analysis but cheaper GPT for others
RESEARCH_CLAUDE_MODEL=anthropic/claude-3.5-sonnet
RESEARCH_GPT5_MODEL=gpt-4o-mini
RESEARCH_DEEPSEEK_MODEL=gpt-4o-mini

# Lower token limits for cost control
SANITY_CHECK_MAX_TOKENS=2000
PLANNER_MAX_TOKENS=1500
EVALUATOR_MAX_TOKENS=2000
RESEARCH_MAX_TOKENS=1500
BASE_AGENT_MAX_TOKENS=1500
```
