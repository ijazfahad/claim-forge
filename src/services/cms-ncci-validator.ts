import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as unzipper from 'unzipper';
import * as XLSX from 'xlsx';
import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// -------------------------------
// Config
// -------------------------------
const OUTDIR = path.resolve(process.cwd(), 'cms_ncci_downloads');

// PostgreSQL connection configuration
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL?.includes('localhost') || DATABASE_URL?.includes('127.0.0.1') 
    ? false 
    : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// CMS landing pages (stable entry points) - Updated to get all data types
const CMS_PAGES = {
  // PTP (Procedure-to-Procedure) edits
  ptp_hospital: 'https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-procedure-procedure-ptp-edits',
  ptp_practitioner: 'https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-procedure-procedure-ptp-edits',
  
  // MUE (Medically Unlikely Edits)
  mue_hospital: 'https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-medically-unlikely-edits',
  mue_practitioner: 'https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-medically-unlikely-edits',
  mue_dme: 'https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-medically-unlikely-edits',
  
  // AOC (Add-On Code) edits
  aoc: 'https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-add-code-edits'
};

// -------------------------------
// Types
// -------------------------------
export interface ClaimValidationInput {
  cpt_codes: string[];
  icd10_codes: string[];
  modifiers?: string[];
  place_of_service?: string;
  note_summary?: string;
  revenue_codes?: string[];
  claim_date?: string; // YYYY-MM-DD format
  provider_type?: 'practitioner' | 'hospital' | 'dme' | 'asc';
  units?: { [code: string]: number }; // Units per CPT code
}

export interface ValidationIssue {
  type: 'ICD_FORMAT' | 'AOC_PRIMARY_MISSING' | 'MUE_EXCEEDED' | 'PTP_BLOCKED' | 'PTP_NEEDS_MODIFIER' | 'PTP_UNKNOWN_INDICATOR' | 'NEEDS_POLICY_CHECK' | 'AOC' | 'MUE' | 'PTP_BYPASSED' | 'MODIFIER_INVALID' | 'MODIFIER_INAPPROPRIATE' | 'POS_INVALID' | 'REVENUE_CODE_INVALID' | 'EFFECTIVE_DATE_INVALID' | 'FREQUENCY_EXCEEDED';
  message: string;
  data?: any;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  passes: ValidationIssue[];
  is_valid: boolean;
  risk_score: number;
}

// -------------------------------
// Helpers: fetch + parse CMS pages
// -------------------------------
const ZIP_OR_PDF = /\.(zip|pdf)(?:\?|$)/i;

function effectiveScore(href: string, text: string): { score: number; date: Date | null } {
  const hay = `${href} ${text}`;
  let bestScore = 10;
  let bestDate: Date | null = null;

  // Effective mm/dd/yyyy
  const eff = /Effective\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i.exec(hay);
  if (eff) {
    const dt = new Date(+eff[3], +eff[1] - 1, +eff[2]);
    bestScore = 95; bestDate = dt;
  }
  // yyyy-mm-dd
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(hay);
  if (iso) {
    const dt = new Date(+iso[1], +iso[2] - 1, +iso[3]);
    if (!bestDate || dt > bestDate) { bestScore = 92; bestDate = dt; }
  }
  // 2025 Quarter 4
  const q = /(20\d{2})\s*Quarter\s*([1-4])/i.exec(hay);
  if (q) {
    const map: { [key: number]: [number, number] } = {1: [2, 28], 2: [5, 31], 3: [8, 30], 4: [11, 31]}; // approx end-of-quarter
    const dt = new Date(+q[1], map[+q[2]][0], map[+q[2]][1]);
    if (!bestDate || dt > bestDate) { bestScore = 90; bestDate = dt; }
  }
  // year only
  const y = /(20\d{2})/.exec(hay);
  if (y) {
    const dt = new Date(+y[1], 11, 31);
    if (!bestDate || dt > bestDate) { bestScore = Math.max(bestScore, 70); bestDate = dt; }
  }
  return { score: bestScore, date: bestDate };
}

async function getLatestDownloadLink(pageUrl: string, kind: string): Promise<{ href: string; text: string } | null> {
  const { data: html } = await axios.get(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (ai-claim-validator)' }});
  const $ = cheerio.load(html);
  let candidates: Array<{ href: string; text: string }> = [];

  $('a[href]').each((_, a) => {
    const href = ($(a).attr('href') || '').trim();
    const text = ($(a).text() || '').trim();
    if (!ZIP_OR_PDF.test(href)) return;
    const full = href.startsWith('/') ? `https://www.cms.gov${href}` : href;
    const hay = `${full} ${text}`.toLowerCase();

    // Filter per kind
    if (kind === 'ptp' && !/(ptp|procedure-to-procedure|edit files)/i.test(hay)) return;
    if (kind === 'mue' && !/(mue|medically\s+unlikely)/i.test(hay)) return;
    if (kind === 'aoc' && !/(add[\s-]*on|aoc)/i.test(hay)) return;

    candidates.push({ href: full, text });
  });

  if (!candidates.length) return null;

  candidates = candidates
    .map(c => ({ ...c, ...effectiveScore(c.href, c.text) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ad = a.date ? +a.date : 0;
      const bd = b.date ? +b.date : 0;
      return bd - ad;
    });

  return candidates[0]; // best
}

async function downloadTo(url: string, dir: string): Promise<string> {
  fs.mkdirSync(dir, { recursive: true });
  const name = url.split('?')[0].split('/').pop() || 'download';
  const dest = path.join(dir, name);
  const res = await axios.get(url, { responseType: 'stream' });
  await new Promise<void>((resolve, reject) => {
    const w = fs.createWriteStream(dest);
    res.data.pipe(w);
    w.on('finish', resolve);
    w.on('error', reject);
  });
  return dest;
}

// -------------------------------
// Ingest ZIP/XLSX into PostgreSQL
// -------------------------------
async function initDb(): Promise<PoolClient> {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const client = await pool.connect();

      // Create claim_forge schema if it doesn't exist
      await client.query(`CREATE SCHEMA IF NOT EXISTS claim_forge;`);

      await client.query(`
        CREATE TABLE IF NOT EXISTS claim_forge.ptp_edits (
          id SERIAL PRIMARY KEY,
          column1 VARCHAR(20) NOT NULL,
          column2 VARCHAR(20) NOT NULL,
          modifier_indicator VARCHAR(10),   -- e.g., 0, 1 (CMS semantics)
          effective_date VARCHAR(50),
          provider_type VARCHAR(50),        -- practitioner/hospital if derivable
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_ptp_c1c2 ON claim_forge.ptp_edits(column1, column2);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS claim_forge.mue (
          id SERIAL PRIMARY KEY,
          hcpcs_cpt VARCHAR(20) NOT NULL,
          mue_value INTEGER NOT NULL,
          effective_date VARCHAR(50),
          service_type VARCHAR(50),         -- practitioner/hospital/dme etc if derivable
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_mue_code ON claim_forge.mue(hcpcs_cpt);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS claim_forge.aoc (
          id SERIAL PRIMARY KEY,
          addon_code VARCHAR(20) NOT NULL,
          primary_code VARCHAR(20) NOT NULL,
          effective_date VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_aoc_addon ON claim_forge.aoc(addon_code);
      `);

  return client;
}

async function extractZipEntries(zipPath: string, onEntry: (fileName: string, buffer: Buffer) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Parse())
      .on('entry', async (entry: any) => {
        const fileName = entry.path;
        if (/\.(xlsx|xls|csv|txt)$/i.test(fileName)) {
          const chunks: Buffer[] = [];
          entry.on('data', (c: Buffer) => chunks.push(c));
          entry.on('end', () => onEntry(fileName, Buffer.concat(chunks)));
          entry.on('error', (e: Error) => { console.error('Zip entry error:', e); entry.autodrain(); });
        } else {
          entry.autodrain();
        }
      })
      .on('finish', resolve)
      .on('error', reject);
  });
}

function sheetToJson(buf: Buffer): Array<{ name: string; rows: any[] }> {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const out: Array<{ name: string; rows: any[] }> = [];
  wb.SheetNames.forEach(name => {
    const ws = wb.Sheets[name];
    // Convert to JSON with header row starting from row 2 (skip copyright notice)
    const jsonData = XLSX.utils.sheet_to_json(ws, { 
      header: 1, // Use array format to handle headers properly
      range: 1, // Start from row 2 (0-indexed)
      defval: null, 
      raw: false 
    });
    
    // Convert array format to object format with proper headers
    if (jsonData.length > 0) {
      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1).map((row: unknown) => {
        const rowArray = row as any[];
        const obj: any = {};
        headers.forEach((header, index) => {
          if (header && rowArray[index] !== undefined) {
            obj[header] = rowArray[index];
          }
        });
        return obj;
      });
      if (rows.length > 0) out.push({ name, rows });
    }
  });
  return out;
}

async function ingestPTP(client: PoolClient, zipPath: string, providerType: string = 'hospital'): Promise<void> {
  const bufferRows: any[] = [];
  await extractZipEntries(zipPath, (fileName, buf) => {
    // Heuristics: find columns like Column1/Column2/ModifierIndicator in xlsx/csv.
    if (/\.xlsx?$/i.test(fileName)) {
      const sheets = sheetToJson(buf);
      sheets.forEach(({ rows }) => {
        rows.forEach((r: any) => {
          // Handle the actual column structure from CMS files
          const c1 = (r['Column 1'] || r.Column1 || r.C1 || r['HCPCS/CPT Code 1'] || '').toString().trim();
          const c2 = (r['Column 2'] || r.Column2 || r.C2 || r['HCPCS/CPT Code 2'] || '').toString().trim();
          if (!c1 || !c2 || c1 === 'Column 1' || c2 === 'Column 2') return; // Skip headers
          
          const mi = (r['Modifier\r\nIndicator\r\n0=not allowed\r\n1= allowed\r\n9= not applicable'] || 
                     r.ModifierIndicator || r['Modifier Indicator'] || r.MI || '').toString().trim();
          const eff = (r.EffectiveDate || r['Effective Date'] || '10-01-2025').toString().trim();
          bufferRows.push({
            column1: c1, column2: c2,
            modifier_indicator: mi || null,
            effective_date: eff || null,
            provider_type: providerType
          });
        });
      });
    }
  });

      // Clear existing data for this provider type only
      await client.query('DELETE FROM claim_forge.ptp_edits WHERE provider_type = $1', [providerType]);

  // Insert new data using batch insert
  if (bufferRows.length > 0) {
    const values = bufferRows.map((row, index) => {
      const baseIndex = index * 5;
      return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`;
    }).join(', ');
    
    const insertQuery = `
      INSERT INTO claim_forge.ptp_edits (column1, column2, modifier_indicator, effective_date, provider_type)
      VALUES ${values}
    `;
    
    const params = bufferRows.flatMap(row => [
      row.column1,
      row.column2,
      row.modifier_indicator,
      row.effective_date,
      row.provider_type
    ]);
    
    await client.query(insertQuery, params);
  }
}

async function ingestMUE(client: PoolClient, zipPath: string, serviceType: string = 'dme'): Promise<void> {
  const bufferRows: any[] = [];
  await extractZipEntries(zipPath, (fileName, buf) => {
    if (/\.xlsx?$/i.test(fileName)) {
      const sheets = sheetToJson(buf);
      sheets.forEach(({ rows }) => {
        rows.forEach((r: any) => {
          // Handle the actual column structure from CMS files
          const code = (r['HCPCS/CPT Code'] || r.HCPCS || r['HCPCS Code'] || r['HCPCS/CPT'] || r.CPT || r.Code || '').toString().trim();
          const mue = parseInt(r['DME Supplier Services MUE Values'] || r.MUE || r['MUE Value'] || r['Practitioner Services MUE'] || r['Outpatient Hospital Services MUE'], 10);
          if (!code || !Number.isFinite(mue) || code === 'HCPCS/CPT Code') return; // Skip headers
          const eff = (r.EffectiveDate || r['Effective Date'] || '10-01-2025').toString().trim();
          bufferRows.push({ hcpcs_cpt: code, mue_value: mue, effective_date: eff || null, service_type: serviceType });
        });
      });
    }
  });

      // Clear existing data for this service type only
      await client.query('DELETE FROM claim_forge.mue WHERE service_type = $1', [serviceType]);

  // Insert new data using batch insert
  if (bufferRows.length > 0) {
    const values = bufferRows.map((row, index) => {
      const baseIndex = index * 4;
      return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`;
    }).join(', ');
    
    const insertQuery = `
      INSERT INTO claim_forge.mue (hcpcs_cpt, mue_value, effective_date, service_type)
      VALUES ${values}
    `;
    
    const params = bufferRows.flatMap(row => [
      row.hcpcs_cpt,
      row.mue_value,
      row.effective_date,
      row.service_type
    ]);
    
    await client.query(insertQuery, params);
  }
}

async function ingestAOC(client: PoolClient, zipPath: string): Promise<void> {
  const bufferRows: any[] = [];
  await extractZipEntries(zipPath, (fileName, buf) => {
    if (/\.xlsx?$/i.test(fileName)) {
      const sheets = sheetToJson(buf);
      sheets.forEach(({ rows }) => {
        rows.forEach((r: any) => {
          // Handle the actual column structure from CMS files
          const addOn = (r['Add-On_Code'] || r['Add-on Code'] || r.AddOn || r['Addon Code'] || r['Add On Code'] || '').toString().trim();
          const primary = (r['Primary_Code'] || r['Primary Code'] || r.Primary || r['Primary Procedure Code'] || '').toString().trim();
          if (!addOn || !primary || addOn === 'Add-On_Code' || primary === 'Primary_Code') return; // Skip headers
          const eff = (r['AOC_Edit_EffDT'] || r.EffectiveDate || r['Effective Date'] || '10-01-2025').toString().trim();
          bufferRows.push({ addon_code: addOn, primary_code: primary, effective_date: eff || null });
        });
      });
    }
  });

      // Clear existing data
      await client.query('DELETE FROM claim_forge.aoc');

  // Insert new data using batch insert
  if (bufferRows.length > 0) {
    const values = bufferRows.map((row, index) => {
      const baseIndex = index * 3;
      return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`;
    }).join(', ');
    
    const insertQuery = `
      INSERT INTO claim_forge.aoc (addon_code, primary_code, effective_date)
      VALUES ${values}
    `;
    
    const params = bufferRows.flatMap(row => [
      row.addon_code,
      row.primary_code,
      row.effective_date
    ]);
    
    await client.query(insertQuery, params);
  }
}

// -------------------------------
// Public: build (download + ingest)
// -------------------------------
export async function buildLatest({ verbose = false } = {}): Promise<{ dbPath: string; downloaded: any }> {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const client = await initDb();

  try {
    // find + download all CMS data types
    const dataTypes = ['ptp_hospital', 'ptp_practitioner', 'mue_hospital', 'mue_practitioner', 'mue_dme', 'aoc'];
    const latest: any = {};
    
    for (const dataType of dataTypes) {
      const link = await getLatestDownloadLink(CMS_PAGES[dataType as keyof typeof CMS_PAGES], dataType);
      if (!link) {
        if (verbose) console.log(`No download link found for ${dataType}, skipping...`);
        continue;
      }
      if (verbose) console.log(`[${dataType}] ${link.text} -> ${link.href}`);
      latest[dataType] = await downloadTo(link.href, OUTDIR);
    }

    // ingest all data types
    if (latest.ptp_hospital && verbose) console.log('Ingesting Hospital PTP...');
    if (latest.ptp_hospital) await ingestPTP(client, latest.ptp_hospital, 'hospital');
    
    if (latest.ptp_practitioner && verbose) console.log('Ingesting Practitioner PTP...');
    if (latest.ptp_practitioner) await ingestPTP(client, latest.ptp_practitioner, 'practitioner');
    
    if (latest.mue_hospital && verbose) console.log('Ingesting Hospital MUE...');
    if (latest.mue_hospital) await ingestMUE(client, latest.mue_hospital, 'hospital');
    
    if (latest.mue_practitioner && verbose) console.log('Ingesting Practitioner MUE...');
    if (latest.mue_practitioner) await ingestMUE(client, latest.mue_practitioner, 'practitioner');
    
    if (latest.mue_dme && verbose) console.log('Ingesting DME MUE...');
    if (latest.mue_dme) await ingestMUE(client, latest.mue_dme, 'dme');
    
    if (latest.aoc && verbose) console.log('Ingesting AOC...');
    if (latest.aoc) await ingestAOC(client, latest.aoc);

    if (verbose) {
      const ptpCount = await client.query('SELECT COUNT(*) AS c FROM claim_forge.ptp_edits');
      const mueCount = await client.query('SELECT COUNT(*) AS c FROM claim_forge.mue');
      const aocCount = await client.query('SELECT COUNT(*) AS c FROM claim_forge.aoc');
      console.log(`PTP rows: ${ptpCount.rows[0].c}, MUE rows: ${mueCount.rows[0].c}, AOC rows: ${aocCount.rows[0].c}`);
      
      // Show provider type distribution
      const ptpTypes = await client.query('SELECT provider_type, COUNT(*) AS c FROM claim_forge.ptp_edits GROUP BY provider_type');
      const mueTypes = await client.query('SELECT service_type, COUNT(*) AS c FROM claim_forge.mue GROUP BY service_type');
      console.log('PTP provider types:', ptpTypes.rows);
      console.log('MUE service types:', mueTypes.rows);
    }
    
    return { dbPath: 'postgresql', downloaded: latest };
  } finally {
    client.release();
  }
}

// -------------------------------
// Helper Functions
// -------------------------------
async function getDbClient(): Promise<PoolClient> {
  return await pool.connect();
}

// Validate modifier syntax and appropriateness
function validateModifiers(modifiers: string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // Valid modifier patterns
  const validModifierPattern = /^[A-Z0-9]{2}$/;
  const numericModifiers = /^[0-9]{2}$/;
  const alphaModifiers = /^[A-Z]{2}$/;
  
  for (const modifier of modifiers) {
    // Check format
    if (!validModifierPattern.test(modifier)) {
      issues.push({
        type: 'MODIFIER_INVALID',
        message: `Invalid modifier format: ${modifier}. Modifiers must be 2 alphanumeric characters.`,
        data: { modifier }
      });
      continue;
    }
    
    // Check for inappropriate combinations (basic rules)
    const upperModifier = modifier.toUpperCase();
    
    // Anatomical modifiers (E1-E4, FA-F9, LC, LD, RC, RT, etc.) should not be used together
    const anatomicalModifiers = ['E1', 'E2', 'E3', 'E4', 'FA', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'LC', 'LD', 'RC', 'RT', 'LT', '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '62', '63', '66', '76', '77', '78', '79', '80', '81', '82'];
    
    if (anatomicalModifiers.includes(upperModifier)) {
      // Check for conflicting anatomical modifiers (only check once per pair)
      const conflictingModifiers = modifiers.filter(m => m !== modifier && anatomicalModifiers.includes(m.toUpperCase()));
      if (conflictingModifiers.length > 0 && modifiers.indexOf(modifier) < modifiers.indexOf(conflictingModifiers[0])) {
        issues.push({
          type: 'MODIFIER_INAPPROPRIATE',
          message: `Inappropriate modifier combination: ${modifier} conflicts with ${conflictingModifiers.join(', ')}`,
          data: { modifier, conflictingModifiers }
        });
      }
    }
  }
  
  return issues;
}

// Validate place of service codes
function validatePlaceOfService(pos: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  if (!pos) return issues;
  
  // Valid POS codes (simplified list)
  const validPOSCodes = [
    '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
    '21', '22', '23', '24', '25', '26', '31', '32', '33', '34', '41', '42', '49', '50', '51', '52', '53', '54', '55', '56',
    '57', '58', '59', '60', '61', '62', '65', '71', '72', '81', '82', '99'
  ];
  
  if (!validPOSCodes.includes(pos)) {
    issues.push({
      type: 'POS_INVALID',
      message: `Invalid place of service code: ${pos}`,
      data: { pos }
    });
  }
  
  return issues;
}

// Validate revenue codes
function validateRevenueCodes(revenueCodes: string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  if (!revenueCodes || revenueCodes.length === 0) return issues;
  
  for (const code of revenueCodes) {
    // Revenue codes should be 3 digits
    if (!/^[0-9]{3}$/.test(code)) {
      issues.push({
        type: 'REVENUE_CODE_INVALID',
        message: `Invalid revenue code format: ${code}. Revenue codes must be 3 digits.`,
        data: { code }
      });
    }
  }
  
  return issues;
}

// Note: AI clinical validation has been moved to the Sanity Check Agent

// Check effective dates
async function validateEffectiveDates(client: PoolClient, claimDate: Date, providerType: string): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  
  try {
    // Check if claim date is before any effective dates (rules not yet in effect)
    const pastRules = await client.query(`
      SELECT COUNT(*) as count 
      FROM (
        SELECT effective_date FROM claim_forge.ptp_edits WHERE provider_type = $1 AND effective_date > $2
        UNION
        SELECT effective_date FROM claim_forge.mue WHERE service_type = $1 AND effective_date > $2
        UNION  
        SELECT effective_date FROM claim_forge.aoc WHERE effective_date > $2
      ) all_dates
    `, [providerType, claimDate.toISOString().split('T')[0]]);
    
    if (parseInt(pastRules.rows[0].count) > 0) {
      issues.push({
        type: 'EFFECTIVE_DATE_INVALID',
        message: 'Some validation rules are not yet in effect for this claim date.',
        data: { futureRuleCount: pastRules.rows[0].count }
      });
    }
  } catch (error) {
    // Ignore date validation errors for now
  }
  
  return issues;
}

/**
 * Validate a claim against CMS/NCCI rules
 */
export async function validateClaim(claim: ClaimValidationInput, { providerType = 'practitioner' } = {}): Promise<ValidationResult> {
  const client = await getDbClient();
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const passes: ValidationIssue[] = [];

  try {
    const cptList = (claim.cpt_codes || []).map(code => ({ code: code.trim() }))
                                     .filter(c => !!c.code);
    const icdList = (claim.icd10_codes || []).map(s => s.trim()).filter(Boolean);
    
    // Use claim provider type if provided, otherwise use parameter
    const actualProviderType = claim.provider_type || providerType;
    
    // Validate claim date
    const claimDate = claim.claim_date ? new Date(claim.claim_date) : new Date();

    // 0) Basic format validations
    const modifierIssues = validateModifiers(claim.modifiers || []);
    errors.push(...modifierIssues.filter(i => i.type === 'MODIFIER_INVALID'));
    warnings.push(...modifierIssues.filter(i => i.type === 'MODIFIER_INAPPROPRIATE'));
    
    const posIssues = validatePlaceOfService(claim.place_of_service || '');
    errors.push(...posIssues);
    
    const revenueIssues = validateRevenueCodes(claim.revenue_codes || []);
    errors.push(...revenueIssues);
    
    const dateIssues = await validateEffectiveDates(client, claimDate, actualProviderType);
    warnings.push(...dateIssues);
    
    // Note: AI clinical validation is now handled by the Sanity Check Agent

    // 1) ICD sanity (format only)
    const icdBad = icdList.filter(code => !/^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/.test(code));
    if (icdBad.length) {
      errors.push({ type: 'ICD_FORMAT', message: `Invalid ICD-10-CM format: ${icdBad.join(', ')}`, data: icdBad });
    } else {
      passes.push({ type: 'ICD_FORMAT', message: 'ICD-10-CM codes are syntactically valid.' });
    }

        // 2) AOC: ensure add-on codes have a required primary code present
        for (const c of cptList) {
          const aocResult = await client.query('SELECT addon_code, primary_code FROM claim_forge.aoc WHERE addon_code = $1', [c.code]);
      const aocRows = aocResult.rows as Array<{ addon_code: string; primary_code: string }>;
      if (aocRows.length) {
        const primaries = new Set(cptList.map(x => x.code));
        const ok = aocRows.some(r => primaries.has(r.primary_code));
        if (!ok) {
          errors.push({
            type: 'AOC_PRIMARY_MISSING',
            message: `Add-on code ${c.code} requires an allowed primary code (${[...new Set(aocRows.map(r => r.primary_code))].join(', ')}) on the same claim.`,
            data: { addon: c.code, requiredPrimaries: [...new Set(aocRows.map(r => r.primary_code))] }
          });
        } else {
          passes.push({ type: 'AOC', message: `Add-on code ${c.code}: primary present.` });
        }
      }
    }

        // 3) MUE: check units with actual units from claim
        for (const c of cptList) {
          const mueResult = await client.query('SELECT mue_value FROM claim_forge.mue WHERE hcpcs_cpt = $1 AND (service_type IS NULL OR service_type = $2)', [c.code, actualProviderType]);
      const row = mueResult.rows[0] as { mue_value: number } | undefined;
      if (row && Number.isFinite(row.mue_value)) {
        // Use actual units from claim if provided, otherwise default to 1
        const units = claim.units && claim.units[c.code] ? claim.units[c.code] : 1;
        if (units > row.mue_value) {
          errors.push({
            type: 'MUE_EXCEEDED',
            message: `CPT ${c.code} units ${units} exceed MUE limit ${row.mue_value} for ${actualProviderType}.`,
            data: { code: c.code, units, mue: row.mue_value }
          });
        } else {
          passes.push({ type: 'MUE', message: `CPT ${c.code} units=${units} within MUE limit (${row.mue_value}).` });
        }
      }
    }

    // 4) PTP: disallowed pairs unless modifier allows (simplified)
    const presentCodes = cptList.map(c => c.code);
    for (let i = 0; i < presentCodes.length; i++) {
      for (let j = 0; j < presentCodes.length; j++) {
        if (i === j) continue;
        const c1 = presentCodes[i], c2 = presentCodes[j];
            const ptpResult = await client.query(`
              SELECT modifier_indicator
              FROM claim_forge.ptp_edits
              WHERE column1 = $1 AND column2 = $2 AND (provider_type IS NULL OR provider_type = $3)
            `, [c1, c2, actualProviderType]);
        
        const row = ptpResult.rows[0] as { modifier_indicator: string } | undefined;
        if (!row) continue;

        const indicator = (row.modifier_indicator || '').trim();
        const modifiers = claim.modifiers || [];

        if (indicator === '0' || indicator === 'N') {
          errors.push({
            type: 'PTP_BLOCKED',
            message: `PTP edit blocks billing ${c1}+${c2} together for ${actualProviderType} (modifier indicator ${indicator}).`,
            data: { c1, c2, indicator }
          });
        } else if (indicator === '1' || indicator === 'Y') {
          // Check if appropriate bypass modifier present
          const allowedMods = new Set(['59', 'XE', 'XP', 'XS', 'XU']);
          const mods = new Set(modifiers.map(m => m.toUpperCase()));
          const ok = [...allowedMods].some(m => mods.has(m));
          if (!ok) {
            errors.push({
              type: 'PTP_NEEDS_MODIFIER',
              message: `PTP edit for ${c1}+${c2} requires a bypass modifier (59/X{EPSU}).`,
              data: { c1, c2, requiredModifiers: ['59','XE','XP','XS','XU'] }
            });
          } else {
            passes.push({ type: 'PTP_BYPASSED', message: `PTP edit for ${c1}+${c2} bypassed by modifier.` });
          }
        } else {
          // Unknown indicator => conservative
          warnings.push({
            type: 'PTP_UNKNOWN_INDICATOR',
            message: `PTP ${c1}+${c2} has unrecognized modifier indicator "${indicator}". Treating as potential conflict.`,
            data: { c1, c2, indicator }
          });
        }
      }
    }

    // 5) Policy validation (CPT↔ICD↔Payer): medical necessity and coverage
    if (icdList.length && cptList.length) {
      const policyValidationDetails = {
        cpt_codes: cptList.map(c => c.code),
        icd10_codes: icdList,
        provider_type: actualProviderType,
        claim_date: claimDate.toISOString().split('T')[0],
        note_summary: claim.note_summary || 'No clinical notes provided',
        validation_types: ['Medical Necessity', 'Policy Coverage', 'LCD/NCD Research', 'Payer-Specific Rules'],
        research_questions: [
          `Are there any Local Coverage Determinations (LCD) or National Coverage Determinations (NCD) that apply to CPT ${cptList.map(c => c.code).join(', ')} with diagnosis ${icdList.join(', ')}?`,
          `What are the coverage criteria for CPT ${cptList.map(c => c.code).join(', ')} with diagnosis ${icdList.join(', ')}?`,
          `What documentation requirements exist for CPT ${cptList.map(c => c.code).join(', ')} with ${icdList.join(', ')}?`,
          `Are there any commercial payer policies that affect coverage for these codes?`,
          `What are the medical necessity requirements for this CPT/ICD combination?`
        ]
      };

      warnings.push({
        type: 'NEEDS_POLICY_CHECK',
        message: `Policy validation required for CPT ${cptList.map(c => c.code).join(', ')} with ICD-10 ${icdList.join(', ')}. This requires payer-specific policy research.`,
        data: policyValidationDetails
      });
    }

    // Calculate risk score and overall validity
    const errorCount = errors.length;
    const warningCount = warnings.length;
    const riskScore = Math.min(100, (errorCount * 30) + (warningCount * 10));
    const isValid = errorCount === 0;

    return { errors, warnings, passes, is_valid: isValid, risk_score: riskScore };
  } finally {
    client.release();
  }
}

// -------------------------------
// Utility functions
// -------------------------------
export async function isDatabaseBuilt(): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      // Check if schema exists first
      const schemaResult = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'claim_forge'");
      if (schemaResult.rows.length === 0) {
        return false;
      }
      
      // Check if any of the tables have data
      const ptpResult = await client.query('SELECT COUNT(*) FROM claim_forge.ptp_edits');
      const mueResult = await client.query('SELECT COUNT(*) FROM claim_forge.mue');
      const aocResult = await client.query('SELECT COUNT(*) FROM claim_forge.aoc');
      
      // Database is built if any table has data
      return ptpResult.rows[0].count > 0 || mueResult.rows[0].count > 0 || aocResult.rows[0].count > 0;
    } finally {
      client.release();
    }
  } catch (error) {
    console.log('Database check failed:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

export function getDatabasePath(): string {
  return 'postgresql';
}
