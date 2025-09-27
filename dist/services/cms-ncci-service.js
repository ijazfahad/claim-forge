"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CMSNCCIService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const cms_ncci_validator_1 = require("./cms-ncci-validator");
class CMSNCCIService {
    constructor() {
        this.database = null;
        this.loadDatabase();
    }
    loadDatabase() {
        try {
            const dataPath = path_1.default.join(__dirname, '../data/cms-ncci-2025.json');
            const data = fs_1.default.readFileSync(dataPath, 'utf8');
            this.database = JSON.parse(data);
        }
        catch (error) {
            console.log('Legacy CMS/NCCI database not found, using PostgreSQL validator');
            this.database = null;
        }
    }
    async validateClaim(payload) {
        if (!this.database) {
            try {
                const result = await (0, cms_ncci_validator_1.validateClaim)({
                    cpt_codes: payload.cpt_codes,
                    icd10_codes: payload.icd10_codes,
                    modifiers: payload.modifiers,
                    place_of_service: payload.place_of_service,
                    note_summary: payload.note_summary
                });
                const issues = [];
                result.errors.forEach(error => {
                    issues.push({
                        code: this.mapValidationType(error.type),
                        risk_percentage: 100,
                        reason: error.message,
                        category: this.getCategoryFromType(error.type),
                        fix: this.getFixFromType(error.type)
                    });
                });
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
            }
            catch (error) {
                console.error('PostgreSQL CMS/NCCI validation failed:', error);
                return [{
                        code: 'database_error',
                        risk_percentage: 100,
                        reason: 'CMS/NCCI validation unavailable',
                        category: 'bundling'
                    }];
            }
        }
        const issues = [];
        for (const cptCode of payload.cpt_codes) {
            const cptIssues = await this.validateCPTCode(cptCode, payload);
            issues.push(...cptIssues);
        }
        const bundlingIssues = await this.validateBundling(payload);
        issues.push(...bundlingIssues);
        const modifierIssues = await this.validateModifiers(payload);
        issues.push(...modifierIssues);
        const frequencyIssues = await this.validateFrequency(payload);
        issues.push(...frequencyIssues);
        return issues;
    }
    async validateCPTCode(cptCode, payload) {
        const issues = [];
        const rule = this.database.cpt_codes[cptCode];
        if (!rule) {
            issues.push({
                code: cptCode,
                risk_percentage: 100,
                reason: 'CPT code not found in CMS/NCCI database',
                category: 'icd10'
            });
            return issues;
        }
        const icd10Issues = this.validateICD10Compatibility(cptCode, payload.icd10_codes, rule);
        issues.push(...icd10Issues);
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
    validateICD10Compatibility(cptCode, icd10Codes, rule) {
        const issues = [];
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
    async validateBundling(payload) {
        const issues = [];
        for (let i = 0; i < payload.cpt_codes.length; i++) {
            for (let j = i + 1; j < payload.cpt_codes.length; j++) {
                const code1 = payload.cpt_codes[i];
                const code2 = payload.cpt_codes[j];
                const rule1 = this.database.cpt_codes[code1];
                const rule2 = this.database.cpt_codes[code2];
                if (!rule1 || !rule2)
                    continue;
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
    async validateModifiers(payload) {
        const issues = [];
        for (const cptCode of payload.cpt_codes) {
            const rule = this.database.cpt_codes[cptCode];
            if (!rule)
                continue;
            for (const requiredModifier of rule.bundling_rules.modifier_requirements) {
                if (!payload.modifiers?.includes(requiredModifier)) {
                    const modifierRule = this.database.modifier_rules[requiredModifier];
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
    async validateFrequency(payload) {
        const issues = [];
        for (const cptCode of payload.cpt_codes) {
            const rule = this.database.cpt_codes[cptCode];
            if (!rule)
                continue;
            const frequencyLimit = rule.bundling_rules.frequency_limits;
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
            if (frequencyLimit.per_year) {
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
    getCPTInfo(cptCode) {
        return this.database?.cpt_codes[cptCode] || null;
    }
    getBundlingEdit(code1, code2) {
        const key = `${code1}_${code2}`;
        return this.database?.bundling_edits[key] || null;
    }
    getModifierInfo(modifier) {
        return this.database?.modifier_rules[modifier] || null;
    }
    isLoaded() {
        return this.database !== null;
    }
    getVersion() {
        return this.database?.version || 'postgresql';
    }
    mapValidationType(type) {
        const typeMap = {
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
    getCategoryFromType(type) {
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
    getFixFromType(type) {
        const fixMap = {
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
exports.CMSNCCIService = CMSNCCIService;
//# sourceMappingURL=cms-ncci-service.js.map