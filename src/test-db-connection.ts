import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://claimvalidator:claimvalidator123@localhost:5432/claim_validator';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL?.includes('localhost') || DATABASE_URL?.includes('127.0.0.1') 
    ? false 
    : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

async function testConnection() {
  console.log('🔗 Testing database connection...');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connected to database successfully!');
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time, version() as db_version');
    console.log('📊 Database Info:');
    console.log(`   Time: ${result.rows[0].current_time}`);
    console.log(`   Version: ${result.rows[0].db_version.split(' ')[0]} ${result.rows[0].db_version.split(' ')[1]}`);
    
    // Check if claim_forge schema exists
    const schemaResult = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'claim_forge'
    `);
    
    if (schemaResult.rows.length > 0) {
      console.log('✅ claim_forge schema exists');
      
      // Check tables
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'claim_forge'
        ORDER BY table_name
      `);
      
      console.log('📋 Tables in claim_forge schema:');
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
      
    } else {
      console.log('⚠️  claim_forge schema does not exist');
    }
    
    client.release();
    
  } catch (error: any) {
    console.error('❌ Database connection failed:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Error details:', error);
  } finally {
    await pool.end();
  }
}

testConnection();
