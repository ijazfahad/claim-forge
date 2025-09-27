"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = exports.validateApiKey = exports.validateClaimPayload = void 0;
const joi_1 = __importDefault(require("joi"));
const claimValidationRequestSchema = joi_1.default.object({
    callback_url: joi_1.default.string().uri().required(),
    payload: joi_1.default.object({
        payer: joi_1.default.string().required().min(1).max(100),
        domains: joi_1.default.array().items(joi_1.default.string().domain()).optional(),
        seed_urls: joi_1.default.array().items(joi_1.default.string().uri()).optional(),
        cpt_codes: joi_1.default.array().items(joi_1.default.string().pattern(/^\d{5}$/)).min(1).required(),
        icd10_codes: joi_1.default.array().items(joi_1.default.string().pattern(/^[A-Z]\d{2}(\.\d{1,3})?$/)).min(1).required(),
        place_of_service: joi_1.default.string().optional().pattern(/^\d{2}$/),
        modifiers: joi_1.default.array().items(joi_1.default.string().pattern(/^[A-Z0-9]{2}$/)).optional(),
        prior_treatments: joi_1.default.array().items(joi_1.default.string().pattern(/^\d{5}$/)).optional(),
        member_plan_type: joi_1.default.string().optional().max(50),
        state: joi_1.default.string().optional().length(2).pattern(/^[A-Z]{2}$/),
        note_summary: joi_1.default.string().required().min(1).max(5000),
    }).required(),
});
const validateClaimPayload = (req, res, next) => {
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
exports.validateClaimPayload = validateClaimPayload;
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        res.status(401).json({
            success: false,
            error: 'API key required',
        });
        return;
    }
    if (apiKey !== process.env.API_KEY) {
        res.status(401).json({
            success: false,
            error: 'Invalid API key',
        });
        return;
    }
    next();
};
exports.validateApiKey = validateApiKey;
const requestCounts = new Map();
const rateLimit = (maxRequests = 100, windowMs = 60000) => {
    return (req, res, next) => {
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
exports.rateLimit = rateLimit;
//# sourceMappingURL=validation.js.map