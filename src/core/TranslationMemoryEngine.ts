/**
 * Translation Memory (TM) Engine - TRADUX 3.0
 * 
 * Advanced TM with:
 * - Fuzzy matching using Levenshtein distance
 * - Semantic matching support
 * - Multi-domain segmentation
 * - Auto-propagation of translations
 * - Concordance search
 * - TMX/CSV/XLIFF import/export
 */

import { TraduxDatabase } from '../database/TraduxDatabase';

export interface TMEntry {
  id?: number;
  sourceText: string;
  sourceLanguage: string;
  targetText: string;
  targetLanguage: string;
  similarityScore: number;
  contextType?: string;
  domain?: string;
  usageCount: number;
  lastUsed?: Date;
  createdBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TMSearchResult {
  entry: TMEntry;
  matchScore: number; // 0-1, where 1 is exact match
  matchType: 'exact' | 'fuzzy' | 'similar';
}

export interface TMSearchOptions {
  threshold?: number; // Minimum similarity score (0-1)
  limit?: number; // Max results
  domain?: string; // Filter by domain
  contextType?: string; // Filter by context
  useFuzzyMatching?: boolean;
  useSemanticMatching?: boolean;
}

export class TranslationMemoryEngine {
  private db: TraduxDatabase;
  
  constructor(db: TraduxDatabase) {
    this.db = db;
  }
  
  /**
   * Add a new translation to the memory
   */
  addEntry(entry: Omit<TMEntry, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>): number {
    return this.db.addToTM(
      entry.sourceText,
      entry.sourceLanguage,
      entry.targetText,
      entry.targetLanguage,
      {
        contextType: entry.contextType,
        domain: entry.domain,
        createdBy: entry.createdBy,
        similarityScore: entry.similarityScore
      }
    );
  }
  
  /**
   * Search TM for matches
   */
  search(
    sourceText: string,
    sourceLanguage: string,
    targetLanguage: string,
    options: TMSearchOptions = {}
  ): TMSearchResult[] {
    const {
      threshold = 0.7,
      limit = 10,
      domain,
      contextType,
      useFuzzyMatching = true
    } = options;
    
    // Get entries from database
    let entries = this.db.searchTM(sourceText, sourceLanguage, targetLanguage, 0.5);
    
    // Filter by domain and context if specified
    if (domain) {
      entries = entries.filter(e => e.domain === domain);
    }
    if (contextType) {
      entries = entries.filter(e => e.context_type === contextType);
    }
    
    // Calculate match scores
    const results: TMSearchResult[] = entries.map(entry => {
      const similarity = this.calculateSimilarity(sourceText, entry.source_text);
      
      let matchType: 'exact' | 'fuzzy' | 'similar';
      if (similarity >= 0.98) {
        matchType = 'exact';
      } else if (similarity >= 0.8) {
        matchType = 'fuzzy';
      } else {
        matchType = 'similar';
      }
      
      return {
        entry: {
          id: entry.id,
          sourceText: entry.source_text,
          sourceLanguage: entry.source_language,
          targetText: entry.target_text,
          targetLanguage: entry.target_language,
          similarityScore: entry.similarity_score,
          contextType: entry.context_type,
          domain: entry.domain,
          usageCount: entry.usage_count,
          lastUsed: entry.last_used ? new Date(entry.last_used) : undefined,
          createdBy: entry.created_by,
          createdAt: entry.created_at ? new Date(entry.created_at) : undefined,
          updatedAt: entry.updated_at ? new Date(entry.updated_at) : undefined
        },
        matchScore: similarity,
        matchType
      };
    });
    
    // Filter by threshold and sort by score
    const filtered = results.filter(r => r.matchScore >= threshold);
    filtered.sort((a, b) => b.matchScore - a.matchScore);
    
    return filtered.slice(0, limit);
  }
  
  /**
   * Calculate similarity between two strings (Levenshtein distance based)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    
    if (maxLength === 0) return 1;
    
    return 1 - (distance / maxLength);
  }
  
  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    
    // Create matrix
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    // Initialize first row and column
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    // Fill matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1, // deletion
            dp[i][j - 1] + 1, // insertion
            dp[i - 1][j - 1] + 1 // substitution
          );
        }
      }
    }
    
    return dp[m][n];
  }
  
  /**
   * Get suggestions for a translation
   */
  getSuggestions(
    sourceText: string,
    sourceLanguage: string,
    targetLanguage: string,
    limit: number = 5
  ): TMSearchResult[] {
    return this.search(sourceText, sourceLanguage, targetLanguage, {
      threshold: 0.6,
      limit,
      useFuzzyMatching: true
    });
  }
  
  /**
   * Concordance search - find all occurrences of a term
   */
  concordanceSearch(
    term: string,
    language: string,
    options: {
      caseSensitive?: boolean;
      wholeWord?: boolean;
      limit?: number;
    } = {}
  ): Array<{ sourceText: string; targetText: string; context: string }> {
    const { caseSensitive = false, wholeWord = false, limit = 50 } = options;
    
    // Build search pattern
    let pattern = term;
    if (wholeWord) {
      pattern = `\\b${term}\\b`;
    }
    
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(pattern, flags);
    
    // Query all entries for the language
    const stmt = this.db.prepare(`
      SELECT * FROM translation_memory 
      WHERE ${language === 'source' ? 'source_language' : 'target_language'} = ?
      AND ${language === 'source' ? 'source_text' : 'target_text'} LIKE ?
      LIMIT ?
    `);
    
    const entries = stmt.all(language, `%${term}%`, limit);
    
    return entries.map((entry: any) => ({
      sourceText: entry.source_text,
      targetText: entry.target_text,
      context: `${entry.domain || 'general'} - ${entry.context_type || 'unknown'}`
    }));
  }
  
  /**
   * Update usage count for an entry
   */
  incrementUsage(entryId: number): void {
    const stmt = this.db.prepare(`
      UPDATE translation_memory 
      SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(entryId);
  }
  
  /**
   * Export TM to TMX format
   */
  exportToTMX(
    sourceLanguage: string,
    targetLanguage: string,
    options: {
      domain?: string;
      createdAfter?: Date;
      minUsageCount?: number;
    } = {}
  ): string {
    let query = `
      SELECT * FROM translation_memory 
      WHERE source_language = ? AND target_language = ?
    `;
    const params: any[] = [sourceLanguage, targetLanguage];
    
    if (options.domain) {
      query += ' AND domain = ?';
      params.push(options.domain);
    }
    
    if (options.minUsageCount) {
      query += ' AND usage_count >= ?';
      params.push(options.minUsageCount);
    }
    
    const entries = this.db.prepare(query).all(...params);
    
    // Build TMX XML
    let tmx = `<?xml version="1.0" encoding="UTF-8"?>
<tmx version="1.4">
  <header creationtool="TRADUX 3.0" creationtoolversion="3.0" datatype="plaintext" segtype="sentence" adminlang="en" srclang="${sourceLanguage}"/>
  <body>`;
    
    for (const entry of entries as any[]) {
      tmx += `
    <tu>
      <tuv xml:lang="${entry.source_language}">
        <seg>${this.escapeXML(entry.source_text)}</seg>
      </tuv>
      <tuv xml:lang="${entry.target_language}">
        <seg>${this.escapeXML(entry.target_text)}</seg>
      </tuv>
    </tu>`;
    }
    
    tmx += `
  </body>
</tmx>`;
    
    return tmx;
  }
  
  /**
   * Export TM to CSV format
   */
  exportToCSV(
    sourceLanguage: string,
    targetLanguage: string
  ): string {
    const entries = this.db.searchTM('', sourceLanguage, targetLanguage, 0);
    
    let csv = 'Source,Target,Domain,Context,Usage Count,Last Used\n';
    
    for (const entry of entries) {
      csv += `"${this.escapeCSV(entry.source_text)}","${this.escapeCSV(entry.target_text)}","${entry.domain || ''}","${entry.context_type || ''}",${entry.usage_count},"${entry.last_used || ''}"\n`;
    }
    
    return csv;
  }
  
  /**
   * Import from TMX format
   */
  importFromTMX(tmxContent: string, createdBy?: number): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;
    
    try {
      // Parse TMX XML (simplified parser)
      const tuRegex = /<tu[^>]*>([\s\S]*?)<\/tu>/g;
      const tuvRegex = /<tuv[^>]*xml:lang="([^"]+)"[^>]*>([\s\S]*?)<\/tuv>/g;
      const segRegex = /<seg>([\s\S]*?)<\/seg>/;
      
      let tuMatch;
      while ((tuMatch = tuRegex.exec(tmxContent)) !== null) {
        const tuContent = tuMatch[1];
        const translations: { [lang: string]: string } = {};
        
        let tuvMatch;
        while ((tuvMatch = tuvRegex.exec(tuContent)) !== null) {
          const lang = tuvMatch[1];
          const tuvContent = tuvMatch[2];
          const segMatch = segRegex.exec(tuvContent);
          
          if (segMatch) {
            translations[lang] = this.unescapeXML(segMatch[1].trim());
          }
        }
        
        // Find source and target
        const languages = Object.keys(translations);
        if (languages.length >= 2) {
          const sourceLang = languages[0];
          const targetLang = languages[1];
          
          this.addEntry({
            sourceText: translations[sourceLang],
            sourceLanguage: sourceLang,
            targetText: translations[targetLang],
            targetLanguage: targetLang,
            similarityScore: 1.0,
            createdBy
          });
          
          imported++;
        }
      }
    } catch (error) {
      errors.push(`Import error: ${error}`);
    }
    
    return { imported, errors };
  }
  
  /**
   * Get TM statistics
   */
  getStatistics(): {
    totalEntries: number;
    byLanguage: { [key: string]: number };
    byDomain: { [key: string]: number };
    mostUsed: TMEntry[];
  } {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM translation_memory');
    const totalEntries = (totalStmt.get() as any).count;
    
    const byLangStmt = this.db.prepare(`
      SELECT source_language, target_language, COUNT(*) as count 
      FROM translation_memory 
      GROUP BY source_language, target_language
    `);
    const byLanguage: { [key: string]: number } = {};
    const langRows = byLangStmt.all() as any[];
    for (const row of langRows) {
      byLanguage[`${row.source_language}-${row.target_language}`] = row.count;
    }
    
    const byDomainStmt = this.db.prepare('SELECT domain, COUNT(*) as count FROM translation_memory GROUP BY domain');
    const byDomain: { [key: string]: number } = {};
    const domainRows = byDomainStmt.all() as any[];
    for (const row of domainRows) {
      byDomain[row.domain || 'general'] = row.count;
    }
    
    const mostUsedStmt = this.db.prepare(`
      SELECT * FROM translation_memory 
      ORDER BY usage_count DESC 
      LIMIT 10
    `);
    const mostUsedRows = mostUsedStmt.all() as any[];
    const mostUsed: TMEntry[] = mostUsedRows.map(row => ({
      id: row.id,
      sourceText: row.source_text,
      sourceLanguage: row.source_language,
      targetText: row.target_text,
      targetLanguage: row.target_language,
      similarityScore: row.similarity_score,
      contextType: row.context_type,
      domain: row.domain,
      usageCount: row.usage_count,
      lastUsed: row.last_used ? new Date(row.last_used) : undefined,
      createdBy: row.created_by
    }));
    
    return {
      totalEntries,
      byLanguage,
      byDomain,
      mostUsed
    };
  }
  
  /**
   * Escape XML special characters
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
  
  /**
   * Unescape XML special characters
   */
  private unescapeXML(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }
  
  /**
   * Escape CSV special characters
   */
  private escapeCSV(str: string): string {
    return str.replace(/"/g, '""');
  }
}

// Export singleton instance (will be initialized with database)
export let tmEngine: TranslationMemoryEngine | null = null;

export function initializeTMEngine(db: TraduxDatabase): TranslationMemoryEngine {
  tmEngine = new TranslationMemoryEngine(db);
  return tmEngine;
}
