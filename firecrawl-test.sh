#!/bin/bash

# Firecrawl v1/extract API request with multiple URLs
# Based on our updated implementation (FIXED - removed extractorOptions)

curl -X POST https://localhost:3002/v2/extract \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer fc-0ee0ddd9151b498094fee2c11dd6def8' \
  -d '{
    "urls": [
      "https://www.cms.gov/medicare/payment/fee-schedules/physician",
      "https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=56273",
      "https://www.medicare.gov/procedure-price-lookup/cost/43239/"
    ],
    "schema": {
      "type": "object",
      "properties": {
        "answer": {
          "type": "string",
          "description": "Direct answer to the question"
        },
        "confidence_level": {
          "type": "string",
          "enum": ["high", "medium", "low"],
          "description": "Confidence level of the answer"
        },
        "policy_reference": {
          "type": "object",
          "properties": {
            "url": { "type": "string", "description": "Source URL" },
            "paragraph": { "type": "string", "description": "Specific paragraph containing the answer" },
            "sentence": { "type": "string", "description": "Exact sentence with the answer" },
            "page_section": { "type": "string", "description": "Section or heading where found" },
            "document_type": { "type": "string", "description": "Type of policy document" }
          }
        }
      },
      "required": ["answer", "confidence_level", "policy_reference"]
    },
    "prompt": "You are analyzing medical policy documents for claim validation. Question: What are the Medicare coverage rules for CPT 99214? Query context: Medicare CPT 99214 coverage. Focus on policies, coverage rules, eligibility requirements, and coding guidelines. Extract specific information that directly answers the question and provide structured data about coverage rules, eligibility requirements, and coding guidelines."
  }' | jq '.'
