"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimStorage = exports.ClaimStorageService = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
}
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
class ClaimStorageService {
    constructor() {
        this.client = null;
    }
    async initialize() {
        this.client = await pool.connect();
        await this.createTables();
    }
    async createTables() {
        if (!this.client)
            throw new Error('Database client not initialized');
        await this.client.query(`
      CREATE SCHEMA IF NOT EXISTS claim_forge;
      
      CREATE TABLE IF NOT EXISTS claim_forge.claim_validations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_id VARCHAR(255) UNIQUE NOT NULL,
        original_claim JSONB NOT NULL,
        overall_status VARCHAR(20) NOT NULL,
        confidence VARCHAR(10) NOT NULL,
        processing_time_ms INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        validation_steps JSONB NOT NULL DEFAULT '[]',
        final_findings JSONB NOT NULL DEFAULT '{}',
        metadata JSONB NOT NULL DEFAULT '{}'
      );
    `);
        await this.client.query(`
      CREATE TABLE IF NOT EXISTS claim_forge.validation_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_validation_id UUID REFERENCES claim_forge.claim_validations(id) ON DELETE CASCADE,
        step_name VARCHAR(100) NOT NULL,
        step_order INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration_ms INTEGER,
        input_data JSONB,
        output_data JSONB,
        errors TEXT[],
        warnings TEXT[],
        confidence_score DECIMAL(3,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        await this.client.query(`
      CREATE INDEX IF NOT EXISTS idx_claim_validations_claim_id ON claim_forge.claim_validations(claim_id);
      CREATE INDEX IF NOT EXISTS idx_claim_validations_created_at ON claim_forge.claim_validations(created_at);
      CREATE INDEX IF NOT EXISTS idx_claim_validations_status ON claim_forge.claim_validations(overall_status);
      CREATE INDEX IF NOT EXISTS idx_validation_steps_claim_id ON claim_forge.validation_steps(claim_validation_id);
      CREATE INDEX IF NOT EXISTS idx_validation_steps_step_name ON claim_forge.validation_steps(step_name);
    `);
    }
    async storeClaimValidation(record) {
        if (!this.client)
            throw new Error('Database client not initialized');
        const query = `
      INSERT INTO claim_forge.claim_validations (
        claim_id, original_claim, overall_status, confidence, processing_time_ms,
        validation_steps, final_findings, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
        const values = [
            record.claim_id,
            JSON.stringify(record.original_claim),
            record.overall_status,
            record.confidence,
            record.processing_time_ms,
            JSON.stringify(record.validation_steps),
            JSON.stringify(record.final_findings),
            JSON.stringify(record.metadata)
        ];
        const result = await this.client.query(query, values);
        return result.rows[0].id;
    }
    async updateValidationStep(claimValidationId, stepName, stepData) {
        if (!this.client)
            throw new Error('Database client not initialized');
        const query = `
      UPDATE validation_steps 
      SET 
        status = $3,
        end_time = $4,
        duration_ms = $5,
        output_data = $6,
        errors = $7,
        warnings = $8,
        confidence_score = $9
      WHERE claim_validation_id = $1 AND step_name = $2
    `;
        const values = [
            claimValidationId,
            stepName,
            stepData.status,
            stepData.end_time,
            stepData.duration_ms,
            stepData.output_data ? JSON.stringify(stepData.output_data) : null,
            stepData.errors,
            stepData.warnings,
            stepData.confidence_score
        ];
        await this.client.query(query, values);
    }
    async addValidationStep(claimValidationId, step) {
        if (!this.client)
            throw new Error('Database client not initialized');
        const query = `
      INSERT INTO validation_steps (
        claim_validation_id, step_name, step_order, status, start_time,
        input_data, output_data, errors, warnings, confidence_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
        const values = [
            claimValidationId,
            step.step_name,
            step.step_order,
            step.status,
            step.start_time,
            step.input_data ? JSON.stringify(step.input_data) : null,
            step.output_data ? JSON.stringify(step.output_data) : null,
            step.errors,
            step.warnings,
            step.confidence_score
        ];
        await this.client.query(query, values);
    }
    async getClaimValidation(claimId) {
        if (!this.client)
            throw new Error('Database client not initialized');
        const query = `
      SELECT * FROM claim_forge.claim_validations WHERE claim_id = $1
    `;
        const result = await this.client.query(query, [claimId]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            id: row.id,
            claim_id: row.claim_id,
            original_claim: row.original_claim,
            overall_status: row.overall_status,
            confidence: row.confidence,
            processing_time_ms: row.processing_time_ms,
            created_at: row.created_at,
            updated_at: row.updated_at,
            validation_steps: row.validation_steps,
            final_findings: row.final_findings,
            metadata: row.metadata
        };
    }
    async getClaimValidations(limit = 100, offset = 0, status) {
        if (!this.client)
            throw new Error('Database client not initialized');
        let query = `
      SELECT * FROM claim_forge.claim_validations
    `;
        const values = [];
        if (status) {
            query += ` WHERE overall_status = $1`;
            values.push(status);
        }
        query += ` ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);
        const result = await this.client.query(query, values);
        return result.rows.map(row => ({
            id: row.id,
            claim_id: row.claim_id,
            original_claim: row.original_claim,
            overall_status: row.overall_status,
            confidence: row.confidence,
            processing_time_ms: row.processing_time_ms,
            created_at: row.created_at,
            updated_at: row.updated_at,
            validation_steps: row.validation_steps,
            final_findings: row.final_findings,
            metadata: row.metadata
        }));
    }
    async getValidationSteps(claimValidationId) {
        if (!this.client)
            throw new Error('Database client not initialized');
        const query = `
      SELECT * FROM validation_steps 
      WHERE claim_validation_id = $1 
      ORDER BY step_order ASC
    `;
        const result = await this.client.query(query, [claimValidationId]);
        return result.rows.map(row => ({
            step_name: row.step_name,
            step_order: row.step_order,
            status: row.status,
            start_time: row.start_time,
            end_time: row.end_time,
            duration_ms: row.duration_ms,
            input_data: row.input_data,
            output_data: row.output_data,
            errors: row.errors,
            warnings: row.warnings,
            confidence_score: row.confidence_score
        }));
    }
    async getValidationStats() {
        if (!this.client)
            throw new Error('Database client not initialized');
        const query = `
      SELECT 
        COUNT(*) as total_validations,
        COUNT(CASE WHEN overall_status = 'GO' THEN 1 END) as go_count,
        COUNT(CASE WHEN overall_status = 'NO_GO' THEN 1 END) as no_go_count,
        COUNT(CASE WHEN overall_status = 'NEEDS_REVIEW' THEN 1 END) as needs_review_count,
        AVG(processing_time_ms) as average_processing_time
      FROM claim_forge.claim_validations
    `;
        const result = await this.client.query(query);
        const row = result.rows[0];
        return {
            total_validations: parseInt(row.total_validations),
            go_count: parseInt(row.go_count),
            no_go_count: parseInt(row.no_go_count),
            needs_review_count: parseInt(row.needs_review_count),
            average_processing_time: parseFloat(row.average_processing_time) || 0,
            success_rate: row.total_validations > 0 ? (parseInt(row.go_count) / parseInt(row.total_validations)) * 100 : 0
        };
    }
    async close() {
        if (this.client) {
            this.client.release();
            this.client = null;
        }
    }
}
exports.ClaimStorageService = ClaimStorageService;
exports.claimStorage = new ClaimStorageService();
//# sourceMappingURL=claim-storage.js.map