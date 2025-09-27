import fs from 'fs';
import path from 'path';
import { ClaimPayload } from '../types/claim-types';
import { validateClaim } from './cms-ncci-validator';

export interface CMSNCCIRule {
  description: string;
  category: string;
  bundling_rules: {
    bundled_with: string[];
    bundles: string[];
    modifier_requirements: string[];
    frequency_limits: {
      per_day: number;
      per_year?: number;
      per_episode?: number;
    };
  };
  prior_auth: {
    required: boolean;
    conditions: string[];
  };
  valid_icd10: string[];
}

export interface CMSNCCIDatabase {
  version: string;
  last_updated: string;
  cpt_codes: Record<string, CMSNCCIRule>;
  bundling_edits: Record<string, {
    primary: string;
    secondary: string;
    modifier_required: string;
    description: string;
  }>;
  modifier_rules: Record<string, {
    description: string;
    usage: string;
  }>;
  frequency_limits: {
    global_periods: Record<string, number>;
    annual_limits: Record<string, number>;
  };
}

export interface ValidationIssue {
  code: string;
  risk_percentage: number;
  reason: string;
  category: 'bundling' | 'modifier' | 'frequency' | 'icd10' | 'prior_auth';
  fix?: string;
}

export class CMSNCCIService {
  private database: CMSNCCIDatabase | null = null;

  constructor() {
    // Try to load legacy database, but don't fail if it doesn't exist
    this.loadDatabase();
  }

  /**
   * Load CMS/NCCI database from JSON file (legacy support)
   */
  private loadDatabase(): void {
    try {
      const dataPath = path.join(__dirname, '../data/cms-ncci-2025.json');
      const data = fs.readFileSync(dataPath, 'utf8');
      this.database = JSON.parse(data);
    } catch (error) {
      console.log('Legacy CMS/NCCI database not found, using PostgreSQL validator');
      this.database = null;
    }
  }

  /**
   * Validate claim payload against CMS/NCCI rules
   */
  async validateClaim(payload: ClaimPayload): Promise<ValidationIssue[]> {
    // Use new PostgreSQL validator if legacy database is not available
    if (!this.database) {
      try {
        const result = await validateClaim({
          cpt_codes: payload.cpt_codes,
          icd10_codes: payload.icd10_codes,
          modifiers: payload.modifiers,
          place_of_service: payload.place_of_service,
          note_summary: payload.note_summary
        });

        // Convert ValidationResult to ValidationIssue[]
        const issues: ValidationIssue[] = [];
        
        // Convert errors to issues
        result.errors.forEach(error => {
          issues.push({
            code: this.mapValidationType(error.type),
            risk_percentage: 100,
            reason: error.message,
            category: this.getCategoryFromType(error.type),
            fix: this.getFixFromType(error.type)
          });
        });

        // Convert warnings to issues
        result.warnings.forEach(warning => {
          issues.push({
            code: this.mapValidationType(warning.type),
            risk_percentage: 50,
            reason: warning.message,
            category: this.getCategoryFromType(warning.type),
            fix: this.getFixFromType(warning.type)
          });
        });

        return issues;
      } catch (error) {
        console.error('PostgreSQL CMS/NCCI validation failed:', error);
        return [{
          code: 'database_error',
          risk_percentage: 100,
          reason: 'CMS/NCCI validation unavailable',
          category: 'bundling'
        }];
      }
    }

    const issues: ValidationIssue[] = [];

    // Validate each CPT code
    for (const cptCode of payload.cpt_codes) {
      const cptIssues = await this.validateCPTCode(cptCode, payload);
      issues.push(...cptIssues);
    }

    // Check bundling rules
    const bundlingIssues = await this.validateBundling(payload);
    issues.push(...bundlingIssues);

    // Check modifier requirements
    const modifierIssues = await this.validateModifiers(payload);
    issues.push(...modifierIssues);

    // Check frequency limits
    const frequencyIssues = await this.validateFrequency(payload);
    issues.push(...frequencyIssues);

    return issues;
  }

  /**
   * Validate individual CPT code
   */
  private async validateCPTCode(cptCode: string, payload: ClaimPayload): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const rule = this.database!.cpt_codes[cptCode];

    if (!rule) {
      issues.push({
        code: cptCode,
        risk_percentage: 100,
        reason: 'CPT code not found in CMS/NCCI database',
        category: 'icd10'
      });
      return issues;
    }

    // Check ICD-10 code compatibility
    const icd10Issues = this.validateICD10Compatibility(cptCode, payload.icd10_codes, rule);
    issues.push(...icd10Issues);

    // Check prior authorization requirements
    if (rule.prior_auth.required) {
      issues.push({
        code: cptCode,
        risk_percentage: 85,
        reason: `Prior authorization required: ${rule.prior_auth.conditions.join(', ')}`,
        category: 'prior_auth',
        fix: 'Obtain prior authorization before procedure'
      });
    }

    return issues;
  }

  /**
   * Validate ICD-10 code compatibility
   */
  private validateICD10Compatibility(
    cptCode: string,
    icd10Codes: string[],
    rule: CMSNCCIRule
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const icd10Code of icd10Codes) {
      if (!rule.valid_icd10.includes(icd10Code)) {
        issues.push({
          code: cptCode,
          risk_percentage: 70,
          reason: `ICD-10 code ${icd10Code} not compatible with CPT ${cptCode}`,
          category: 'icd10',
          fix: `Use compatible ICD-10 codes: ${rule.valid_icd10.join(', ')}`
        });
      }
    }

    return issues;
  }

  /**
   * Validate bundling rules
   */
  private async validateBundling(payload: ClaimPayload): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    for (let i = 0; i < payload.cpt_codes.length; i++) {
      for (let j = i + 1; j < payload.cpt_codes.length; j++) {
        const code1 = payload.cpt_codes[i];
        const code2 = payload.cpt_codes[j];
        const rule1 = this.database!.cpt_codes[code1];
        const rule2 = this.database!.cpt_codes[code2];

        if (!rule1 || !rule2) continue;

        // Check if codes are bundled
        if (rule1.bundling_rules.bundled_with.includes(code2)) {
          const requiredModifier = rule1.bundling_rules.modifier_requirements.find(m => m === '59');
          if (requiredModifier && !payload.modifiers?.includes('59')) {
            issues.push({
              code: code1,
              risk_percentage: 80,
              reason: `CPT ${code1} and ${code2} are bundled, requires modifier 59`,
              category: 'bundling',
              fix: 'Add modifier 59 to separate the procedures'
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Validate modifier requirements
   */
  private async validateModifiers(payload: ClaimPayload): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    for (const cptCode of payload.cpt_codes) {
      const rule = this.database!.cpt_codes[cptCode];
      if (!rule) continue;

      for (const requiredModifier of rule.bundling_rules.modifier_requirements) {
        if (!payload.modifiers?.includes(requiredModifier)) {
          const modifierRule = this.database!.modifier_rules[requiredModifier];
          issues.push({
            code: cptCode,
            risk_percentage: 60,
            reason: `CPT ${cptCode} requires modifier ${requiredModifier}: ${modifierRule?.description}`,
            category: 'modifier',
            fix: `Add modifier ${requiredModifier} to CPT ${cptCode}`
          });
        }
      }
    }

    return issues;
  }

  /**
   * Validate frequency limits
   */
  private async validateFrequency(payload: ClaimPayload): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    for (const cptCode of payload.cpt_codes) {
      const rule = this.database!.cpt_codes[cptCode];
      if (!rule) continue;

      const frequencyLimit = rule.bundling_rules.frequency_limits;
      
      // Check daily limits
      if (frequencyLimit.per_day === 1) {
        const sameDayCount = payload.cpt_codes.filter(code => code === cptCode).length;
        if (sameDayCount > 1) {
          issues.push({
            code: cptCode,
            risk_percentage: 90,
            reason: `CPT ${cptCode} limited to ${frequencyLimit.per_day} per day`,
            category: 'frequency',
            fix: 'Remove duplicate CPT codes for same day'
          });
        }
      }

      // Check annual limits
      if (frequencyLimit.per_year) {
        // This would require historical data - for now, just note the limit
        issues.push({
          code: cptCode,
          risk_percentage: 30,
          reason: `CPT ${cptCode} limited to ${frequencyLimit.per_year} per year`,
          category: 'frequency',
          fix: 'Verify annual frequency limit not exceeded'
        });
      }
    }

    return issues;
  }

  /**
   * Get CPT code information
   */
  getCPTInfo(cptCode: string): CMSNCCIRule | null {
    return this.database?.cpt_codes[cptCode] || null;
  }

  /**
   * Get bundling edit information
   */
  getBundlingEdit(code1: string, code2: string): any {
    const key = `${code1}_${code2}`;
    return this.database?.bundling_edits[key] || null;
  }

  /**
   * Get modifier information
   */
  getModifierInfo(modifier: string): any {
    return this.database?.modifier_rules[modifier] || null;
  }

  /**
   * Check if database is loaded
   */
  isLoaded(): boolean {
    return this.database !== null;
  }

  /**
   * Get database version
   */
  getVersion(): string {
    return this.database?.version || 'postgresql';
  }

  /**
   * Map validation type from PostgreSQL validator to legacy format
   */
  private mapValidationType(type: string): string {
    const typeMap: Record<string, string> = {
      'ICD_FORMAT': 'icd10_format',
      'AOC_PRIMARY_MISSING': 'bundling_conflict',
      'MUE_EXCEEDED': 'frequency_limit',
      'PTP_BLOCKED': 'bundling_conflict',
      'PTP_NEEDS_MODIFIER': 'modifier_required',
      'PTP_UNKNOWN_INDICATOR': 'bundling_warning',
      'NEEDS_POLICY_CHECK': 'policy_check',
      'AOC': 'bundling_check',
      'MUE': 'frequency_check',
      'PTP_BYPASSED': 'bundling_bypassed'
    };
    return typeMap[type] || 'unknown';
  }

  /**
   * Get category from validation type
   */
  private getCategoryFromType(type: string): 'bundling' | 'modifier' | 'frequency' | 'icd10' | 'prior_auth' {
    if (type.includes('bundling') || type.includes('PTP') || type.includes('AOC')) {
      return 'bundling';
    }
    if (type.includes('modifier') || type.includes('MUE')) {
      return 'modifier';
    }
    if (type.includes('frequency') || type.includes('MUE')) {
      return 'frequency';
    }
    if (type.includes('ICD') || type.includes('icd10')) {
      return 'icd10';
    }
    return 'bundling';
  }

  /**
   * Get fix suggestion from validation type
   */
  private getFixFromType(type: string): string {
    const fixMap: Record<string, string> = {
      'ICD_FORMAT': 'Verify ICD-10-CM code format',
      'AOC_PRIMARY_MISSING': 'Add required primary code',
      'MUE_EXCEEDED': 'Reduce units to within MUE limit',
      'PTP_BLOCKED': 'Remove conflicting code or add appropriate modifier',
      'PTP_NEEDS_MODIFIER': 'Add bypass modifier (59, XE, XP, XS, or XU)',
      'PTP_UNKNOWN_INDICATOR': 'Review CMS/NCCI guidelines',
      'NEEDS_POLICY_CHECK': 'Verify payer-specific policy requirements'
    };
    return fixMap[type] || 'Review CMS/NCCI guidelines';
  }
}
