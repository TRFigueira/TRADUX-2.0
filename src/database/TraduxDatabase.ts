import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface TraduxConfig {
  databasePath: string;
  migrationsPath: string;
}

export class TraduxDatabase {
  private db: Database.Database;
  private config: TraduxConfig;

  constructor(config: TraduxConfig) {
    this.config = config;
    this.db = new Database(config.databasePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  async initialize(): Promise<void> {
    try {
      // Run migrations
      await this.runMigrations();
      
      // Initialize default data if needed
      await this.initializeDefaultData();
      
      console.log('[TraduxDatabase] Database initialized successfully');
    } catch (error) {
      console.error('[TraduxDatabase] Failed to initialize database:', error);
      throw error;
    }
  }

  private async runMigrations(): Promise<void> {
    const migrationsPath = this.config.migrationsPath;
    
    if (!fs.existsSync(migrationsPath)) {
      fs.mkdirSync(migrationsPath, { recursive: true });
    }

    // Create migrations table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get executed migrations
    const executedMigrations = this.db.prepare('SELECT filename FROM migrations').all() as { filename: string }[];
    const executedSet = new Set(executedMigrations.map(m => m.filename));

    // Get all migration files
    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure migrations run in order

    // Run pending migrations
    for (const file of migrationFiles) {
      if (!executedSet.has(file)) {
        console.log(`[TraduxDatabase] Running migration: ${file}`);
        const migrationPath = path.join(migrationsPath, file);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
        
        try {
          this.db.exec(migrationSQL);
          
          // Record migration
          this.db.prepare('INSERT INTO migrations (filename) VALUES (?)').run(file);
          console.log(`[TraduxDatabase] Migration completed: ${file}`);
        } catch (error) {
          console.error(`[TraduxDatabase] Migration failed: ${file}`, error);
          throw error;
        }
      }
    }
  }

  private async initializeDefaultData(): Promise<void> {
    // Check if this is a fresh installation
    const userCount = this.db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const projectCount = this.db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };

    if (userCount.count === 0 && projectCount.count === 0) {
      console.log('[TraduxDatabase] Initializing default data...');
      
      // Create default organization
      this.db.prepare(`
        INSERT INTO organizations (name, slug, description) 
        VALUES (?, ?, ?)
      `).run('Default Organization', 'default', 'Default organization for new installations');

      // Create default admin user
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      this.db.prepare(`
        INSERT INTO users (email, username, password_hash, first_name, last_name, role) 
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('admin@tradux.com', 'admin', hashedPassword, 'Admin', 'User', 'admin');

      // Create default project
      this.db.prepare(`
        INSERT INTO projects (organization_id, name, slug, description, source_language, target_languages, localization_system)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        1, // default organization
        'Sample Project',
        'sample-project',
        'Sample project for getting started',
        'en',
        JSON.stringify(['pt-BR', 'es', 'fr']),
        'legacy'
      );

      // Add admin to project
      this.db.prepare(`
        INSERT INTO project_users (project_id, user_id, role)
        VALUES (?, ?, ?)
      `).run(1, 1, 'admin');

      // Create default QA rules
      const qaRules = [
        ['Missing Placeholders', 'placeholder', 'Check for missing placeholders', '\\{[0-9]+\\}', 'error'],
        ['Length Limit', 'length', 'Check if translation exceeds length limits', null, 'warning'],
        ['HTML Tags', 'format', 'Check for broken HTML tags', '<[^>]*>', 'error'],
        ['Inconsistent Terminology', 'consistency', 'Check for inconsistent terminology', null, 'warning']
      ];

      for (const [name, type, description, pattern, severity] of qaRules) {
        this.db.prepare(`
          INSERT INTO qa_rules (project_id, name, type, description, pattern, severity)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(1, name, type, description, pattern, severity);
      }

      console.log('[TraduxDatabase] Default data initialized');
    }
  }

  // Organization methods
  createOrganization(name: string, slug: string, description?: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO organizations (name, slug, description)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(name, slug, description);
    return result.lastInsertRowid as number;
  }

  getOrganizations(): any[] {
    return this.db.prepare('SELECT * FROM organizations ORDER BY name').all();
  }

  // Project methods
  createProject(organizationId: number, name: string, slug: string, data: {
    description?: string;
    sourceLanguage?: string;
    targetLanguages?: string[];
    unityVersion?: string;
    localizationSystem?: string;
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO projects (organization_id, name, slug, description, source_language, target_languages, unity_version, localization_system)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      organizationId,
      name,
      slug,
      data.description || null,
      data.sourceLanguage || 'en',
      JSON.stringify(data.targetLanguages || []),
      data.unityVersion || null,
      data.localizationSystem || 'legacy'
    );
    
    return result.lastInsertRowid as number;
  }

  getProjects(organizationId?: number): any[] {
    if (organizationId) {
      return this.db.prepare('SELECT * FROM projects WHERE organization_id = ? ORDER BY name').all(organizationId);
    }
    return this.db.prepare('SELECT * FROM projects ORDER BY name').all();
  }

  // User methods
  createUser(userData: {
    email: string;
    username: string;
    passwordHash: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO users (email, username, password_hash, first_name, last_name, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      userData.email,
      userData.username,
      userData.passwordHash,
      userData.firstName || null,
      userData.lastName || null,
      userData.role || 'translator'
    );
    
    return result.lastInsertRowid as number;
  }

  getUserByEmail(email: string): any {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  }

  // String methods
  createString(projectId: number, keyId: string, data: {
    contextType?: string;
    contextDescription?: string;
    sourceFile?: string;
    lineNumber?: number;
    maxLength?: number;
    notes?: string;
    tags?: string[];
    metadata?: any;
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO strings (project_id, key_id, context_type, context_description, source_file, line_number, max_length, notes, tags, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      projectId,
      keyId,
      data.contextType || null,
      data.contextDescription || null,
      data.sourceFile || null,
      data.lineNumber || null,
      data.maxLength || null,
      data.notes || null,
      JSON.stringify(data.tags || []),
      JSON.stringify(data.metadata || {})
    );
    
    return result.lastInsertRowid as number;
  }

  getStrings(projectId: number, filters?: {
    contextType?: string;
    search?: string;
  }): any[] {
    let query = 'SELECT * FROM strings WHERE project_id = ?';
    const params: any[] = [projectId];

    if (filters?.contextType) {
      query += ' AND context_type = ?';
      params.push(filters.contextType);
    }

    if (filters?.search) {
      query += ' AND (key_id LIKE ? OR notes LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY key_id';

    return this.db.prepare(query).all(...params);
  }

  clearAllStrings(): { deleted: number } {
    const result = this.db.prepare('DELETE FROM strings').run();
    console.log(`[TraduxDatabase] Cleared ${result.changes} strings`);
    return { deleted: result.changes };
  }

  // Translation methods
  createTranslation(stringId: number, languageCode: string, text: string, data: {
    status?: string;
    translatorId?: number;
    reviewerId?: number;
    qualityScore?: number;
    isMachineTranslated?: boolean;
    mtEngine?: string;
    mtConfidence?: number;
    comments?: string;
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO translations (string_id, language_code, text, status, translator_id, reviewer_id, quality_score, word_count, character_count, is_machine_translated, mt_engine, mt_confidence, comments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      stringId,
      languageCode,
      text,
      data.status || 'pending',
      data.translatorId || null,
      data.reviewerId || null,
      data.qualityScore || null,
      this.countWords(text),
      text.length,
      data.isMachineTranslated || false,
      data.mtEngine || null,
      data.mtConfidence || null,
      data.comments || null
    );
    
    return result.lastInsertRowid as number;
  }

  getTranslations(stringId: number, languageCode?: string): any[] {
    let query = 'SELECT * FROM translations WHERE string_id = ?';
    const params: any[] = [stringId];

    if (languageCode) {
      query += ' AND language_code = ?';
      params.push(languageCode);
    }

    query += ' ORDER BY language_code';

    return this.db.prepare(query).all(...params);
  }

  // Translation Memory methods
  addToTM(sourceText: string, sourceLanguage: string, targetText: string, targetLanguage: string, data: {
    contextType?: string;
    domain?: string;
    createdBy?: number;
    similarityScore?: number;
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO translation_memory (source_text, source_language, target_text, target_language, context_type, domain, created_by, similarity_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      sourceText,
      sourceLanguage,
      targetText,
      targetLanguage,
      data.contextType || null,
      data.domain || null,
      data.createdBy || null,
      data.similarityScore || 1.0
    );
    
    return result.lastInsertRowid as number;
  }

  searchTM(sourceText: string, sourceLanguage: string, targetLanguage: string, threshold: number = 0.8): any[] {
    // Simple exact match for now - can be enhanced with fuzzy matching
    const stmt = this.db.prepare(`
      SELECT * FROM translation_memory 
      WHERE source_language = ? AND target_language = ? AND similarity_score >= ?
      ORDER BY similarity_score DESC, usage_count DESC
      LIMIT 10
    `);
    
    return stmt.all(sourceLanguage, targetLanguage, threshold);
  }

  // Glossary methods
  createGlossaryTerm(projectId: number, term: string, data: {
    definition?: string;
    partOfSpeech?: string;
    domain?: string;
    notes?: string;
    createdBy?: number;
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO glossary_terms (project_id, term, definition, part_of_speech, domain, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      projectId,
      term,
      data.definition || null,
      data.partOfSpeech || null,
      data.domain || null,
      data.notes || null,
      data.createdBy || null
    );
    
    return result.lastInsertRowid as number;
  }

  getGlossaryTerms(projectId: number, search?: string): any[] {
    let query = 'SELECT * FROM glossary_terms WHERE project_id = ? AND status = "active"';
    const params: any[] = [projectId];

    if (search) {
      query += ' AND term LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY term';

    return this.db.prepare(query).all(...params);
  }

  // QA methods
  runQA(translationId: number): any[] {
    // Get active QA rules for the project
    const translation = this.db.prepare(`
      SELECT t.*, s.project_id 
      FROM translations t 
      JOIN strings s ON t.string_id = s.id 
      WHERE t.id = ?
    `).get(translationId) as any;

    if (!translation) return [];

    const rules = this.db.prepare(`
      SELECT * FROM qa_rules 
      WHERE project_id = ? AND is_active = 1
    `).all(translation.project_id) as any[];

    const results: any[] = [];

    for (const rule of rules) {
      const ruleResult = this.applyQARule(translation, rule);
      if (ruleResult) {
        results.push({
          translationId,
          ruleId: rule.id,
          severity: ruleResult.severity,
          message: ruleResult.message,
          lineNumber: ruleResult.lineNumber || null,
          characterPosition: ruleResult.characterPosition || null
        });
      }
    }

    return results;
  }

  private applyQARule(translation: any, rule: any): any {
    switch (rule.type) {
      case 'placeholder':
        return this.checkPlaceholders(translation, rule);
      case 'length':
        return this.checkLength(translation, rule);
      case 'format':
        return this.checkFormat(translation, rule);
      default:
        return null;
    }
  }

  private checkPlaceholders(translation: any, rule: any): any {
    // Extract placeholders from source and target
    const sourcePlaceholders = this.extractPlaceholders(translation.original_text || '');
    const targetPlaceholders = this.extractPlaceholders(translation.text);

    const missing = sourcePlaceholders.filter(p => !targetPlaceholders.includes(p));
    const extra = targetPlaceholders.filter(p => !sourcePlaceholders.includes(p));

    if (missing.length > 0 || extra.length > 0) {
      return {
        severity: rule.severity,
        message: missing.length > 0 
          ? `Missing placeholders: ${missing.join(', ')}`
          : `Extra placeholders: ${extra.join(', ')}`,
        lineNumber: null,
        characterPosition: null
      };
    }

    return null;
  }

  private checkLength(translation: any, rule: any): any {
    // This would need access to the string's max_length setting
    // For now, just check if translation is significantly longer
    const sourceLength = (translation.original_text || '').length;
    const targetLength = translation.text.length;
    
    if (targetLength > sourceLength * 2) {
      return {
        severity: rule.severity,
        message: `Translation is significantly longer (${targetLength} vs ${sourceLength} characters)`,
        lineNumber: null,
        characterPosition: null
      };
    }

    return null;
  }

  private checkFormat(translation: any, rule: any): any {
    if (!rule.pattern) return null;

    const regex = new RegExp(rule.pattern, 'gi');
    const sourceMatches = (translation.original_text || '').match(regex) || [];
    const targetMatches = translation.text.match(regex) || [];

    if (sourceMatches.length !== targetMatches.length) {
      return {
        severity: rule.severity,
        message: `Format mismatch: expected ${sourceMatches.length} matches, found ${targetMatches.length}`,
        lineNumber: null,
        characterPosition: null
      };
    }

    return null;
  }

  private extractPlaceholders(text: string): string[] {
    const matches = text.match(/\{[^}]+\}/g);
    return matches || [];
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  // Settings methods
  getSetting(key: string): any {
    const result = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
    if (!result) return null;

    switch (result.type) {
      case 'number':
        return Number(result.value);
      case 'boolean':
        return result.value === 'true';
      case 'json':
        return JSON.parse(result.value);
      default:
        return result.value;
    }
  }

  setSetting(key: string, value: any, type: string = 'string', isPublic: boolean = false): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, type, is_public, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(key, typeof value === 'object' ? JSON.stringify(value) : String(value), type, isPublic);
  }

  // Activity logging
  logActivity(data: {
    userId?: number;
    projectId?: number;
    action: string;
    entityType: string;
    entityId?: number;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
  }): void {
    this.db.prepare(`
      INSERT INTO activity_logs (user_id, project_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.userId || null,
      data.projectId || null,
      data.action,
      data.entityType,
      data.entityId || null,
      data.oldValues ? JSON.stringify(data.oldValues) : null,
      data.newValues ? JSON.stringify(data.newValues) : null,
      data.ipAddress || null,
      data.userAgent || null
    );
  }

  // Close database connection
  close(): void {
    this.db.close();
  }

  // Access to raw database for advanced operations
  get rawDatabase(): Database.Database {
    return this.db;
  }

  // Prepare statement for raw SQL operations
  prepare(sql: string): Database.Statement {
    return this.db.prepare(sql);
  }
}
