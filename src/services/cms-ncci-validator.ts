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
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// CMS landing pages (stable entry points)
const CMS_PAGES = {
  ptp: 'https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-procedure-procedure-ptp-edits',
  mue: 'https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-medically-unlikely-edits',
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
}

export interface ValidationIssue {
  type: 'ICD_FORMAT' | 'AOC_PRIMARY_MISSING' | 'MUE_EXCEEDED' | 'PTP_BLOCKED' | 'PTP_NEEDS_MODIFIER' | 'PTP_UNKNOWN_INDICATOR' | 'NEEDS_POLICY_CHECK' | 'AOC' | 'MUE' | 'PTP_BYPASSED';
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

async function ingestPTP(client: PoolClient, zipPath: string): Promise<void> {
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
          const provider = /practitioner|physician/i.test(fileName) ? 'practitioner'
                         : /hospital|outpatient|opps/i.test(fileName) ? 'hospital' : 'hospital';
          bufferRows.push({
            column1: c1, column2: c2,
            modifier_indicator: mi || null,
            effective_date: eff || null,
            provider_type: provider
          });
        });
      });
    }
  });

      // Clear existing data
      await client.query('DELETE FROM claim_forge.ptp_edits');

  // Insert new data
  if (bufferRows.length > 0) {
    const insertQuery = `
      INSERT INTO claim_forge.ptp_edits (column1, column2, modifier_indicator, effective_date, provider_type)
      VALUES ($1, $2, $3, $4, $5)
    `;
    
    for (const row of bufferRows) {
      await client.query(insertQuery, [
        row.column1,
        row.column2,
        row.modifier_indicator,
        row.effective_date,
        row.provider_type
      ]);
    }
  }
}

async function ingestMUE(client: PoolClient, zipPath: string): Promise<void> {
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
          const st = /practitioner/i.test(fileName) ? 'practitioner'
                   : /hospital|outpatient/i.test(fileName) ? 'hospital' : 'dme';
          bufferRows.push({ hcpcs_cpt: code, mue_value: mue, effective_date: eff || null, service_type: st });
        });
      });
    }
  });

      // Clear existing data
      await client.query('DELETE FROM claim_forge.mue');

  // Insert new data
  if (bufferRows.length > 0) {
    const insertQuery = `
      INSERT INTO claim_forge.mue (hcpcs_cpt, mue_value, effective_date, service_type)
      VALUES ($1, $2, $3, $4)
    `;
    
    for (const row of bufferRows) {
      await client.query(insertQuery, [
        row.hcpcs_cpt,
        row.mue_value,
        row.effective_date,
        row.service_type
      ]);
    }
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

  // Insert new data
  if (bufferRows.length > 0) {
    const insertQuery = `
      INSERT INTO claim_forge.aoc (addon_code, primary_code, effective_date)
      VALUES ($1, $2, $3)
    `;
    
    for (const row of bufferRows) {
      await client.query(insertQuery, [
        row.addon_code,
        row.primary_code,
        row.effective_date
      ]);
    }
  }
}

// -------------------------------
// Public: build (download + ingest)
// -------------------------------
export async function buildLatest({ verbose = false } = {}): Promise<{ dbPath: string; downloaded: any }> {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const client = await initDb();

  try {
    // find + download
    const kinds = ['ptp', 'mue', 'aoc'];
    const latest: any = {};
    for (const k of kinds) {
      const link = await getLatestDownloadLink(CMS_PAGES[k as keyof typeof CMS_PAGES], k);
      if (!link) throw new Error(`No download link found for ${k}`);
      if (verbose) console.log(`[${k}] ${link.text} -> ${link.href}`);
      latest[k] = await downloadTo(link.href, OUTDIR);
    }

    // ingest
    if (verbose) console.log('Ingesting PTP...');
    await ingestPTP(client, latest.ptp);
    if (verbose) console.log('Ingesting MUE...');
    await ingestMUE(client, latest.mue);
    if (verbose) console.log('Ingesting AOC...');
    await ingestAOC(client, latest.aoc);

        if (verbose) {
          const ptpCount = await client.query('SELECT COUNT(*) AS c FROM claim_forge.ptp_edits');
          const mueCount = await client.query('SELECT COUNT(*) AS c FROM claim_forge.mue');
          const aocCount = await client.query('SELECT COUNT(*) AS c FROM claim_forge.aoc');
          console.log(`PTP rows: ${ptpCount.rows[0].c}, MUE rows: ${mueCount.rows[0].c}, AOC rows: ${aocCount.rows[0].c}`);
        }
    
    return { dbPath: 'postgresql', downloaded: latest };
  } finally {
    client.release();
  }
}

// -------------------------------
// Validator
// -------------------------------
async function getDbClient(): Promise<PoolClient> {
  return await pool.connect();
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

        // 3) MUE: check units (assuming 1 unit per code for now)
        for (const c of cptList) {
          const mueResult = await client.query('SELECT mue_value FROM claim_forge.mue WHERE hcpcs_cpt = $1 AND (service_type IS NULL OR service_type = $2)', [c.code, providerType]);
      const row = mueResult.rows[0] as { mue_value: number } | undefined;
      if (row && Number.isFinite(row.mue_value)) {
        const units = 1; // Default to 1 unit per code
        if (units > row.mue_value) {
          errors.push({
            type: 'MUE_EXCEEDED',
            message: `CPT ${c.code} units ${units} exceed MUE limit ${row.mue_value} for ${providerType}.`,
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
            `, [c1, c2, providerType]);
        
        const row = ptpResult.rows[0] as { modifier_indicator: string } | undefined;
        if (!row) continue;

        const indicator = (row.modifier_indicator || '').trim();
        const modifiers = claim.modifiers || [];

        if (indicator === '0' || indicator === 'N') {
          errors.push({
            type: 'PTP_BLOCKED',
            message: `PTP edit blocks billing ${c1}+${c2} together for ${providerType} (modifier indicator ${indicator}).`,
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

    // 5) Medical necessity (CPT↔ICD): policy-specific
    if (icdList.length && cptList.length) {
      warnings.push({
        type: 'NEEDS_POLICY_CHECK',
        message: 'CPT↔ICD medical necessity requires payer-specific policy (LCD/NCD or commercial policy) validation.',
        data: { payerPolices: 'Plug in your LCD/NCD/commercial rule engine or AI policy checker.' }
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
      const result = await client.query('SELECT COUNT(*) FROM claim_forge.ptp_edits');
      return result.rows[0].count > 0;
    } finally {
      client.release();
    }
  } catch (error) {
    return false;
  }
}

export function getDatabasePath(): string {
  return 'postgresql';
}
