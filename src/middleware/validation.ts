import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

// Claim validation request schema
const claimValidationRequestSchema = Joi.object({
  callback_url: Joi.string().uri().required(),
  payload: Joi.object({
    payer: Joi.string().required().min(1).max(100),
    domains: Joi.array().items(
      Joi.string().domain()
    ).optional(),
    seed_urls: Joi.array().items(
      Joi.string().uri()
    ).optional(),
    cpt_codes: Joi.array().items(
      Joi.string().pattern(/^\d{5}$/)
    ).min(1).required(),
    icd10_codes: Joi.array().items(
      Joi.string().pattern(/^[A-Z]\d{2}(\.\d{1,3})?$/)
    ).min(1).required(),
    place_of_service: Joi.string().optional().pattern(/^\d{2}$/),
    modifiers: Joi.array().items(
      Joi.string().pattern(/^[A-Z0-9]{2}$/)
    ).optional(),
    prior_treatments: Joi.array().items(
      Joi.string().pattern(/^\d{5}$/)
    ).optional(),
    member_plan_type: Joi.string().optional().max(50),
    state: Joi.string().optional().length(2).pattern(/^[A-Z]{2}$/),
    note_summary: Joi.string().required().min(1).max(5000),
  }).required(),
});

/**
 * Validate claim validation request middleware
 */
export const validateClaimPayload = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = claimValidationRequestSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errorDetails = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errorDetails,
    });
    return;
  }

  req.body = value;
  next();
};

/**
 * Validate API key middleware
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'API key required',
    });
    return;
  }

  // In production, validate against your API key store
  if (apiKey !== process.env.API_KEY) {
    res.status(401).json({
      success: false,
      error: 'Invalid API key',
    });
    return;
  }

  next();
};

/**
 * Rate limiting middleware (simple in-memory implementation)
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (maxRequests: number = 100, windowMs: number = 60000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    const clientData = requestCounts.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      requestCounts.set(clientId, {
        count: 1,
        resetTime: now + windowMs,
      });
      next();
      return;
    }
    
    if (clientData.count >= maxRequests) {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
      });
      return;
    }
    
    clientData.count++;
    next();
  };
};
