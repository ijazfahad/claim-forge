import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Database connection
const DATABASE_URL = 'postgresql://postgres:postgres@45.79.108.146:5432/claim_forge';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL?.includes('localhost') || DATABASE_URL?.includes('127.0.0.1') 
    ? false 
    : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function setupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔗 Connecting to database...');
    
    // Create claim_forge schema if it doesn't exist
    await client.query(`CREATE SCHEMA IF NOT EXISTS claim_forge;`);
    console.log('✅ Schema created');
    
    // Set search path
    await client.query(`SET search_path TO claim_forge, public;`);
    
    // Read and execute migration files
    const migrationFiles = [
      '001_create_cms_ncci_tables.sql',
      '002_create_claim_storage_tables.sql', 
      '003_create_updated_at_triggers.sql',
      '004_update_claim_storage_for_evaluator_agent.sql'
    ];
    
    for (const filename of migrationFiles) {
      const filePath = path.join(__dirname, filename);
      if (fs.existsSync(filePath)) {
        console.log(`📄 Running migration: ${filename}`);
        const sql = fs.readFileSync(filePath, 'utf8');
        await client.query(sql);
        console.log(`✅ Migration ${filename} completed`);
      }
    }
    
    // Insert test data
    console.log('📊 Inserting test data...');
    
    // Test claim validation record
    const testClaimValidation = `
      INSERT INTO claim_forge.claim_validations (
        claim_id, original_claim, overall_status, confidence, processing_time_ms,
        question_analysis, overall_assessment, insurance_insights,
        research_results, planner_questions, sanity_check_results
      ) VALUES (
        'TEST-CLAIM-001',
        '{"payer": "Medicare", "cpt_codes": ["99213"], "icd10_codes": ["Z00.00"], "modifiers": [], "place_of_service": "11", "state": "CA", "note_summary": "Office visit for routine checkup"}',
        'APPROVED',
        'high',
        5000,
        '[{"question_id": "Q1", "question": "Is CPT 99213 covered?", "answer": "Yes, covered under Medicare Part B", "confidence": 0.9, "method": "multi-model", "status": "PASS", "risk_level": "low", "recommendations": ["High confidence - Policy well documented"]}]',
        '{"decision_rationale": "High confidence approval based on policy compliance", "risk_factors": [], "approval_criteria_met": true, "blockers": [], "next_steps": ["Process payment"], "estimated_approval_probability": 95}',
        '{"payer_compliance": "compliant", "coverage_verification": "verified", "prior_auth_status": "not_required", "coding_compliance": "compliant", "state_regulations": "compliant"}',
        '[{"question": "Is CPT 99213 covered?", "answer": "Yes, CPT 99213 is covered under Medicare Part B", "confidence": 0.9, "source": "Multi-Model Consensus", "metadata": {"extraction_method": "multi-model", "processing_time": 3000}, "recommendations": ["High confidence - Policy well documented"]}]',
        '[{"n": 1, "type": "basic", "q": "Is CPT 99213 covered?", "accept_if": ["Coverage confirmed"], "search_queries": ["Medicare coverage 99213"], "risk_flags": {"PA": false, "POS": false, "NCCI": false, "Modifiers": false, "Frequency": false, "Diagnosis": false, "StateSpecific": false, "LOBSpecific": false, "Thresholds": false}}]',
        '{"is_valid": true, "sanitized_payload": {"payer": "Medicare", "cpt_codes": ["99213"], "icd10_codes": ["Z00.00"], "modifiers": [], "place_of_service": "11", "state": "CA", "note_summary": "Office visit for routine checkup"}, "ssp_prediction": {"specialty": "Internal Medicine", "subspecialty": "General Internal Medicine", "confidence": "high"}, "issues": [], "warnings": [], "cms_ncci_checks": {"bundling_issues": [], "modifier_requirements": [], "frequency_limits": []}, "ai_clinical_validation": {"overall_appropriate": true, "specialty": "Internal Medicine", "subspecialty": "General Internal Medicine", "cpt_validation": [{"code": "99213", "appropriate": true, "confidence": "high", "reasoning": "Appropriate for established patient office visit"}], "icd_validation": [{"code": "Z00.00", "appropriate": true, "confidence": "high", "reasoning": "Appropriate for routine checkup"}], "modifier_validation": [], "place_of_service_validation": {"code": "11", "appropriate": true, "confidence": "high", "reasoning": "Office visit appropriate for POS 11"}, "clinical_concerns": [], "documentation_quality": "Good", "recommendations": ["Documentation appears complete"]}, "policy_check_required": false, "policy_check_details": {}, "validation_issues": [], "cms_ncci_validation": {"is_valid": true, "errors": [], "warnings": [], "passes": [], "risk_score": 0}}'
      )
      ON CONFLICT (claim_id) DO NOTHING
      RETURNING id;
    `;
    
    const result = await client.query(testClaimValidation);
    const claimValidationId = result.rows[0]?.id;
    
    if (claimValidationId) {
      console.log(`✅ Test claim validation inserted with ID: ${claimValidationId}`);
      
      // Insert test validation steps
      const testSteps = [
        {
          step_name: 'sanity_check',
          step_order: 1,
          status: 'completed',
          agent_type: 'sanity_check',
          model_used: 'gpt-4o',
          confidence_score: 0.85
        },
        {
          step_name: 'planner',
          step_order: 2,
          status: 'completed',
          agent_type: 'planner',
          model_used: 'gpt-4o',
          confidence_score: 0.9
        },
        {
          step_name: 'research',
          step_order: 3,
          status: 'completed',
          agent_type: 'research',
          model_used: 'multi-model',
          confidence_score: 0.9
        },
        {
          step_name: 'evaluator',
          step_order: 4,
          status: 'completed',
          agent_type: 'evaluator',
          model_used: 'gpt-4o',
          confidence_score: 0.95
        }
      ];
      
      for (const step of testSteps) {
        const stepQuery = `
          INSERT INTO claim_forge.validation_steps (
            claim_validation_id, step_name, step_order, status, start_time, end_time,
            duration_ms, agent_type, model_used, confidence_score
          ) VALUES ($1, $2, $3, $4, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour' + INTERVAL '30 seconds', 30000, $5, $6, $7)
          ON CONFLICT DO NOTHING;
        `;
        
        await client.query(stepQuery, [
          claimValidationId,
          step.step_name,
          step.step_order,
          step.status,
          step.agent_type,
          step.model_used,
          step.confidence_score
        ]);
      }
      
      console.log('✅ Test validation steps inserted');
      
      // Insert test research results
      const researchQuery = `
        INSERT INTO claim_forge.research_results (
          claim_validation_id, question_id, question_text, answer, confidence, source,
          extraction_method, processing_time_ms, recommendations
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT DO NOTHING;
      `;
      
      await client.query(researchQuery, [
        claimValidationId,
        'Q1',
        'Is CPT 99213 covered?',
        'Yes, CPT 99213 is covered under Medicare Part B for established patient office visits',
        0.9,
        'Multi-Model Consensus',
        'multi-model',
        3000,
        ['High confidence - Policy well documented', 'Strong model consensus']
      ]);
      
      console.log('✅ Test research results inserted');
      
      // Insert test planner questions
      const plannerQuery = `
        INSERT INTO claim_forge.planner_questions (
          claim_validation_id, question_number, question_type, question_text,
          accept_if, search_queries, risk_flags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING;
      `;
      
      await client.query(plannerQuery, [
        claimValidationId,
        1,
        'basic',
        'Is CPT 99213 covered?',
        ['Coverage confirmed'],
        ['Medicare coverage 99213', 'CPT 99213 policy'],
        '{"PA": false, "POS": false, "NCCI": false, "Modifiers": false, "Frequency": false, "Diagnosis": false, "StateSpecific": false, "LOBSpecific": false, "Thresholds": false}'
      ]);
      
      console.log('✅ Test planner questions inserted');
      
      // Insert test sanity check results
      const sanityQuery = `
        INSERT INTO claim_forge.sanity_check_results (
          claim_validation_id, cpt_codes, icd_codes, modifiers, place_of_service,
          clinical_assessment, cms_ncci_results, ssp_predictions, recommendations
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT DO NOTHING;
      `;
      
      await client.query(sanityQuery, [
        claimValidationId,
        ['99213'],
        ['Z00.00'],
        [],
        '11',
        '{"overall_appropriate": true, "specialty": "Internal Medicine", "subspecialty": "General Internal Medicine", "cpt_validation": [{"code": "99213", "appropriate": true, "confidence": "high", "reasoning": "Appropriate for established patient office visit"}], "icd_validation": [{"code": "Z00.00", "appropriate": true, "confidence": "high", "reasoning": "Appropriate for routine checkup"}], "modifier_validation": [], "place_of_service_validation": {"code": "11", "appropriate": true, "confidence": "high", "reasoning": "Office visit appropriate for POS 11"}, "clinical_concerns": [], "documentation_quality": "Good", "recommendations": ["Documentation appears complete"]}',
        '{"bundling_issues": [], "modifier_requirements": [], "frequency_limits": []}',
        '{"specialty": "Internal Medicine", "subspecialty": "General Internal Medicine", "confidence": "high"}',
        ['Documentation appears complete', 'Claim appears valid']
      ]);
      
      console.log('✅ Test sanity check results inserted');
      
    } else {
      console.log('ℹ️  Test claim validation already exists');
    }
    
    // Verify data was inserted
    const countQuery = `
      SELECT 
        (SELECT COUNT(*) FROM claim_forge.claim_validations) as claim_validations,
        (SELECT COUNT(*) FROM claim_forge.validation_steps) as validation_steps,
        (SELECT COUNT(*) FROM claim_forge.research_results) as research_results,
        (SELECT COUNT(*) FROM claim_forge.planner_questions) as planner_questions,
        (SELECT COUNT(*) FROM claim_forge.sanity_check_results) as sanity_check_results;
    `;
    
    const counts = await client.query(countQuery);
    const stats = counts.rows[0];
    
    console.log('');
    console.log('📊 === DATABASE STATISTICS ===');
    console.log(`📋 Claim Validations: ${stats.claim_validations}`);
    console.log(`🔍 Validation Steps: ${stats.validation_steps}`);
    console.log(`🔬 Research Results: ${stats.research_results}`);
    console.log(`📝 Planner Questions: ${stats.planner_questions}`);
    console.log(`✅ Sanity Check Results: ${stats.sanity_check_results}`);
    console.log('');
    console.log('✅ Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase().catch(console.error);
}

export { setupDatabase };
