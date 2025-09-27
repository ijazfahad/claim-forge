# CMS/NCCI Database Update Guide

This guide explains how to update the CMS/NCCI validation tables when new data becomes available from CMS.

## Overview

The CMS/NCCI (National Correct Coding Initiative) database contains three main types of edits:
- **PTP (Procedure-to-Procedure)**: Codes that cannot be billed together
- **MUE (Medically Unlikely Edits)**: Maximum units allowed per day
- **AOC (Add-On Code)**: Add-on codes that require a primary code

## When to Update

Update the CMS/NCCI database when:
- New quarterly updates are released by CMS (typically January, April, July, October)
- You need the latest coding rules for claim validation
- Current data is outdated or missing recent edits

## Update Process

### 1. Check Current Data

First, verify what data you currently have:

```bash
# Check current table counts
cd /Users/fahadijaz/projects/claim-validator
source .env
npx ts-node -e "
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkTables() {
  const client = await pool.connect();
  try {
    const ptpCount = await client.query('SELECT COUNT(*) FROM claim_forge.ptp_edits');
    const mueCount = await client.query('SELECT COUNT(*) FROM claim_forge.mue');
    const aocCount = await client.query('SELECT COUNT(*) FROM claim_forge.aoc');
    
    console.log('Current PTP edits:', ptpCount.rows[0].count);
    console.log('Current MUE entries:', mueCount.rows[0].count);
    console.log('Current AOC entries:', aocCount.rows[0].count);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTables().catch(console.error);
"
```

### 2. Update the Database

Run the CMS/NCCI database update:

```bash
cd /Users/fahadijaz/projects/claim-validator
source .env
npm run update:cms
```

**Or manually:**
```bash
npx ts-node -e "
import { buildLatest } from './src/services/cms-ncci-validator';
buildLatest({ verbose: true }).then(() => console.log('✅ CMS/NCCI database updated successfully')).catch(console.error);
"
```

### 3. Verify the Update

After updating, verify the new data:

```bash
# Check updated table counts
npx ts-node -e "
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkTables() {
  const client = await pool.connect();
  try {
    const ptpCount = await client.query('SELECT COUNT(*) FROM claim_forge.ptp_edits');
    const mueCount = await client.query('SELECT COUNT(*) FROM claim_forge.mue');
    const aocCount = await client.query('SELECT COUNT(*) FROM claim_forge.aoc');
    
    console.log('Updated PTP edits:', ptpCount.rows[0].count);
    console.log('Updated MUE entries:', mueCount.rows[0].count);
    console.log('Updated AOC entries:', aocCount.rows[0].count);
    
    // Show sample of latest data
    const latestPTP = await client.query('SELECT * FROM claim_forge.ptp_edits ORDER BY created_at DESC LIMIT 3');
    console.log('Latest PTP entries:', latestPTP.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTables().catch(console.error);
"
```

### 4. Test Validation

Test that the updated data works correctly:

```bash
# Test with sample claim
npx ts-node -e "
import { validateClaim } from './src/services/cms-ncci-validator';

const testClaim = {
  cpt_codes: ['99213', '99214'],
  icd10_codes: ['M54.5', 'G89.29'],
  modifiers: ['25']
};

console.log('Testing CMS/NCCI validation...');
validateClaim(testClaim).then(result => {
  console.log('✅ Validation working correctly');
  console.log('- Valid:', result.is_valid);
  console.log('- Risk Score:', result.risk_score);
  console.log('- Errors:', result.errors.length);
  console.log('- Warnings:', result.warnings.length);
  console.log('- Passes:', result.passes.length);
}).catch(console.error);
"
```

## What the Update Process Does

1. **Downloads Latest Data**: Fetches the most recent CMS/NCCI files from CMS.gov
2. **Extracts ZIP Files**: Unzips the downloaded files to access Excel/CSV data
3. **Parses Data**: Converts Excel/CSV data into structured format
4. **Clears Old Data**: Removes existing data from the database tables
5. **Inserts New Data**: Loads the new data into PostgreSQL tables
6. **Updates Indexes**: Ensures database indexes are optimized for queries

## Data Sources

The system automatically downloads from these CMS pages:
- **PTP Edits**: https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-procedure-procedure-ptp-edits
- **MUE Edits**: https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-medically-unlikely-edits
- **AOC Edits**: https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-add-code-edits

## Troubleshooting

### Common Issues

1. **Network Errors**: Ensure internet connection and CMS.gov accessibility
2. **Database Connection**: Verify `DATABASE_URL` in `.env` file
3. **Permission Errors**: Check database user permissions
4. **Disk Space**: Ensure sufficient disk space for downloads

### Error Messages

- **"No download link found"**: CMS page structure may have changed
- **"Database connection failed"**: Check `DATABASE_URL` and database status
- **"Permission denied"**: Check database user permissions
- **"Disk space full"**: Clean up old downloads or increase disk space

### Manual Download

If automatic download fails, you can manually download files:

1. Visit the CMS pages listed above
2. Download the ZIP files for the current quarter
3. Place them in the `cms_ncci_downloads/` directory
4. Run the update process (it will use existing files)

## File Locations

- **Downloaded Files**: `cms_ncci_downloads/`
- **Database Tables**: `claim_forge.ptp_edits`, `claim_forge.mue`, `claim_forge.aoc`
- **Update Script**: `src/services/cms-ncci-validator.ts`

## Schedule Recommendations

- **Production**: Update monthly or quarterly
- **Development**: Update as needed for testing
- **Staging**: Update before production deployments

## Monitoring

Monitor the update process by:
- Checking table counts before/after updates
- Verifying sample data looks correct
- Testing validation with known claim scenarios
- Reviewing error logs for any issues

## Backup

Before major updates, consider backing up the current data:

```bash
# Backup current data
pg_dump $DATABASE_URL --table=claim_forge.ptp_edits --table=claim_forge.mue --table=claim_forge.aoc > cms_ncci_backup_$(date +%Y%m%d).sql
```

## Support

If you encounter issues:
1. Check the error logs
2. Verify environment variables
3. Test database connectivity
4. Review CMS website for changes
5. Contact the development team if needed
