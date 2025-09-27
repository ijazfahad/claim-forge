"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationRunner = void 0;
const pg_1 = require("pg");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
class MigrationRunner {
    async initialize() {
        this.client = await pool.connect();
        await this.createMigrationsTable();
    }
    async createMigrationsTable() {
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
    async getExecutedMigrations() {
        const result = await this.client.query('SELECT * FROM claim_forge.migrations ORDER BY version');
        return result.rows;
    }
    async getAvailableMigrations() {
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
    async runMigration(migration) {
        console.log(`Running migration: ${migration.version} - ${migration.name}`);
        const migrationPath = path.join(__dirname, migration.filename);
        const sql = fs.readFileSync(migrationPath, 'utf8');
        try {
            await this.client.query('BEGIN');
            await this.client.query(sql);
            await this.client.query('INSERT INTO claim_forge.migrations (version, name, filename) VALUES ($1, $2, $3)', [migration.version, migration.name, migration.filename]);
            await this.client.query('COMMIT');
            console.log(`✅ Migration ${migration.version} completed successfully`);
        }
        catch (error) {
            await this.client.query('ROLLBACK');
            console.error(`❌ Migration ${migration.version} failed:`, error);
            throw error;
        }
    }
    async runMigrations() {
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
    async close() {
        if (this.client) {
            this.client.release();
        }
        await pool.end();
    }
}
exports.MigrationRunner = MigrationRunner;
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
    }
    catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
    finally {
        await migrationRunner.close();
    }
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=migrate.js.map