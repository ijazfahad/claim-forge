/**
 * Payer Domain Mapping Service
 * Maps insurance companies to their official domains for Google search queries
 */

export interface PayerDomainMapping {
  [payerName: string]: string[];
}

export class PayerDomainMappingService {
  private static instance: PayerDomainMappingService;
  private payerDomains: PayerDomainMapping = {};

  private constructor() {
    this.initializePayerDomains();
  }

  public static getInstance(): PayerDomainMappingService {
    if (!PayerDomainMappingService.instance) {
      PayerDomainMappingService.instance = new PayerDomainMappingService();
    }
    return PayerDomainMappingService.instance;
  }

  private initializePayerDomains(): void {
    this.payerDomains = {
      // Medicare - CMS.gov is the authoritative source for policy documents
      'Medicare': ['cms.gov'],
      'Medicare HMO': ['cms.gov'],
      'Medicare PPO': ['cms.gov'],
      'Medicare Advantage': ['cms.gov'],
      
      // Medicaid - CMS.gov also hosts Medicaid policy documents
      'Medicaid': ['cms.gov'],
      'Medicaid HMO': ['cms.gov'],
      'Medicaid PPO': ['cms.gov'],
      
      // Major Commercial Medical Payers - Provider portals with policy sections
      'Aetna': ['aetna.com'],
      'Anthem': ['anthem.com'],
      'Blue Cross Blue Shield': ['bcbs.com'],
      'BCBS': ['bcbs.com'],
      'Cigna': ['cigna.com'],
      'Humana': ['humana.com'],
      'UnitedHealthcare': ['uhcprovider.com'],
      'UHC': ['uhcprovider.com'],
      'United Health': ['uhcprovider.com'],
      
      // Regional BCBS Medical Plans - Provider portals
      'Blue Cross Blue Shield of California': ['anthem.com'],
      'Blue Cross Blue Shield of Texas': ['bcbstx.com'],
      'Blue Cross Blue Shield of Florida': ['floridablue.com'],
      'Blue Cross Blue Shield of Illinois': ['bcbsil.com'],
      'Blue Cross Blue Shield of New York': ['empireblue.com'],
      'Blue Cross Blue Shield of Pennsylvania': ['ibx.com'],
      'Blue Cross Blue Shield of Michigan': ['bcbsm.com'],
      'Blue Cross Blue Shield of Georgia': ['anthem.com'],
      'Blue Cross Blue Shield of North Carolina': ['bcbsnc.com'],
      'Blue Cross Blue Shield of Ohio': ['anthem.com'],
      
      // Kaiser Permanente - Provider portal
      'Kaiser Permanente': ['kp.org'],
      'Kaiser': ['kp.org'],
      
      // Other Major Medical Payers - Provider portals
      'Molina Healthcare': ['molinahealthcare.com'],
      'Centene': ['centene.com'],
      'WellCare': ['wellcare.com'],
      'Health Net': ['healthnet.com'],
      'Independence Blue Cross': ['ibx.com'],
      'Highmark': ['highmark.com'],
      'Capital Blue Cross': ['capbluecross.com'],
      
      // State-Specific Medical Plans - Provider portals
      'Florida Blue': ['floridablue.com'],
      'CareFirst': ['carefirst.com'],
      'Premera Blue Cross': ['premera.com'],
      'Regence': ['regence.com'],
      'Cambia Health Solutions': ['cambiahealth.com'],
      
      // Additional Medical Payers - Provider portals
      'EmblemHealth': ['emblemhealth.com'],
      'Healthfirst': ['healthfirst.org'],
      'Tufts Health Plan': ['tuftshealthplan.com'],
      'Harvard Pilgrim': ['harvardpilgrim.org'],
      'Independence Health Group': ['ibx.com'],
      'Geisinger Health Plan': ['geisinger.org'],
      'UPMC Health Plan': ['upmchealthplan.com'],
      'Kaiser Foundation Health Plan': ['kp.org'],
      
      // Self-Pay Options
      'Self Pay': ['healthcare.gov'],
      'Cash Pay': ['healthcare.gov'],
      'Uninsured': ['healthcare.gov']
    };
  }

  /**
   * Get domains for a specific payer
   */
  public getDomainsForPayer(payerName: string): string[] {
    // Direct match
    if (this.payerDomains[payerName]) {
      return this.payerDomains[payerName];
    }

    // Partial match - find payers that contain the search term
    const partialMatches = Object.keys(this.payerDomains).filter(key => 
      key.toLowerCase().includes(payerName.toLowerCase()) ||
      payerName.toLowerCase().includes(key.toLowerCase())
    );

    if (partialMatches.length > 0) {
      // Return domains from the first partial match
      return this.payerDomains[partialMatches[0]];
    }

    // Fallback - try to extract domain from common patterns
    return this.extractDomainFromPayerName(payerName);
  }

  /**
   * Extract domain from payer name using common patterns
   */
  private extractDomainFromPayerName(payerName: string): string[] {
    const name = payerName.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    
    // Common patterns - just hostnames
    if (name.includes('medicare')) return ['cms.gov'];
    if (name.includes('medicaid')) return ['cms.gov'];
    if (name.includes('blue cross') || name.includes('bcbs')) return ['bcbs.com'];
    if (name.includes('aetna')) return ['aetna.com'];
    if (name.includes('anthem')) return ['anthem.com'];
    if (name.includes('cigna')) return ['cigna.com'];
    if (name.includes('humana')) return ['humana.com'];
    if (name.includes('united') || name.includes('uhc')) return ['uhcprovider.com'];
    if (name.includes('kaiser')) return ['kp.org'];
    
    // Default fallback - just hostname
    const cleanName = name.replace(/\s+/g, '');
    return [`${cleanName}.com`];
  }

  /**
   * Generate site-specific search queries for a payer
   */
  public generateSiteQueries(payerName: string, baseQuery: string): string[] {
    const domains = this.getDomainsForPayer(payerName);
    
    return domains.map(domain => {
      // Clean up the base query
      const cleanQuery = baseQuery
        .replace(/site:\S+/g, '') // Remove existing site: clauses
        .trim();
      
      return `site:${domain} ${cleanQuery}`;
    });
  }

  /**
   * Get all known payers
   */
  public getAllPayers(): string[] {
    return Object.keys(this.payerDomains);
  }

  /**
   * Add or update a payer domain mapping
   */
  public addPayerMapping(payerName: string, domains: string[]): void {
    this.payerDomains[payerName] = domains;
  }
}
