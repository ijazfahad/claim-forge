import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database connection
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1') 
    ? false 
    : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

interface Migration {
  version: string;
  name: string;
  filename: string;
  executed_at?: Date;
}

class MigrationRunner {
  private client: any;

  async initialize(): Promise<void> {
    this.client = await pool.connect();
    await this.createMigrationsTable();
  }

  private async createMigrationsTable(): Promise<void> {
    // Create claim_forge schema if it doesn't exist
    await this.client.query(`CREATE SCHEMA IF NOT EXISTS claim_forge;`);
    
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS claim_forge.migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async getExecutedMigrations(): Promise<Migration[]> {
    const result = await this.client.query('SELECT * FROM claim_forge.migrations ORDER BY version');
    return result.rows;
  }

  async getAvailableMigrations(): Promise<Migration[]> {
    const migrationsDir = path.join(__dirname);
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    return files.map(file => {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        throw new Error(`Invalid migration filename: ${file}`);
      }
      return {
        version: match[1],
        name: match[2].replace(/_/g, ' '),
        filename: file
      };
    });
  }

  async runMigration(migration: Migration): Promise<void> {
    console.log(`Running migration: ${migration.version} - ${migration.name}`);
    
    const migrationPath = path.join(__dirname, migration.filename);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    try {
      await this.client.query('BEGIN');
      await this.client.query(sql);
      await this.client.query(
        'INSERT INTO claim_forge.migrations (version, name, filename) VALUES ($1, $2, $3)',
        [migration.version, migration.name, migration.filename]
      );
      await this.client.query('COMMIT');
      console.log(`✅ Migration ${migration.version} completed successfully`);
    } catch (error) {
      await this.client.query('ROLLBACK');
      console.error(`❌ Migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  async runMigrations(): Promise<void> {
    const executedMigrations = await this.getExecutedMigrations();
    const availableMigrations = await this.getAvailableMigrations();
    
    const executedVersions = new Set(executedMigrations.map(m => m.version));
    const pendingMigrations = availableMigrations.filter(m => !executedVersions.has(m.version));
    
    if (pendingMigrations.length === 0) {
      console.log('✅ All migrations are up to date');
      return;
    }
    
    console.log(`Found ${pendingMigrations.length} pending migrations`);
    
    for (const migration of pendingMigrations) {
      await this.runMigration(migration);
    }
    
    console.log('✅ All migrations completed successfully');
  }

  async close(): Promise<void> {
    if (this.client) {
      this.client.release();
    }
    await pool.end();
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const migrationRunner = new MigrationRunner();
  
  try {
    await migrationRunner.initialize();
    
    switch (command) {
      case 'migrate':
        await migrationRunner.runMigrations();
        break;
      case 'status':
        const executed = await migrationRunner.getExecutedMigrations();
        const available = await migrationRunner.getAvailableMigrations();
        console.log('Executed migrations:');
        executed.forEach(m => console.log(`  ✅ ${m.version} - ${m.name}`));
        console.log('\nAvailable migrations:');
        available.forEach(m => {
          const isExecuted = executed.some(e => e.version === m.version);
          console.log(`  ${isExecuted ? '✅' : '⏳'} ${m.version} - ${m.name}`);
        });
        break;
      default:
        console.log('Usage: npm run migrate [migrate|status]');
        console.log('  migrate - Run pending migrations');
        console.log('  status  - Show migration status');
    }
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await migrationRunner.close();
  }
}

if (require.main === module) {
  main();
}

export { MigrationRunner };
