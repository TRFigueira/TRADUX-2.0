-- TRADUX 3.0 Database Schema Evolution
-- Migration from basic CAT tool to full TMS platform

-- 1. Projects and Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    settings TEXT, -- JSON for organization settings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    source_language TEXT NOT NULL DEFAULT 'en',
    target_languages TEXT, -- JSON array of target languages
    unity_version TEXT, -- Unity version if detected
    localization_system TEXT, -- 'legacy', 'unity_localization', 'mixed'
    settings TEXT, -- JSON for project settings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, slug)
);

-- 2. Users and Roles
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role TEXT NOT NULL DEFAULT 'translator', -- admin, manager, translator, reviewer
    is_active BOOLEAN DEFAULT 1,
    preferences TEXT, -- JSON for user preferences
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- admin, translator, reviewer
    permissions TEXT, -- JSON for specific permissions
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_id)
);

-- 3. Enhanced Strings with Context and Metadata
CREATE TABLE IF NOT EXISTS strings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    key_id TEXT NOT NULL,
    context_type TEXT, -- 'ui', 'gameplay', 'narrative', 'audio', 'asset'
    context_description TEXT,
    source_file TEXT,
    line_number INTEGER,
    character_position INTEGER,
    max_length INTEGER,
    notes TEXT,
    tags TEXT, -- JSON array of tags
    metadata TEXT, -- JSON for additional metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, key_id)
);

-- 4. Translations with Enhanced Features
CREATE TABLE IF NOT EXISTS translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    string_id INTEGER REFERENCES strings(id) ON DELETE CASCADE,
    language_code TEXT NOT NULL,
    text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, translated, reviewed, approved, rejected
    translator_id INTEGER REFERENCES users(id),
    reviewer_id INTEGER REFERENCES users(id),
    quality_score REAL, -- 0-100 quality score
    word_count INTEGER,
    character_count INTEGER,
    placeholders TEXT, -- JSON array of placeholders found
    is_machine_translated BOOLEAN DEFAULT 0,
    mt_engine TEXT, -- 'google', 'deepl', 'azure', etc.
    mt_confidence REAL,
    comments TEXT,
    metadata TEXT, -- JSON for additional metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(string_id, language_code)
);

-- 5. Translation Memory (TM)
CREATE TABLE IF NOT EXISTS translation_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_text TEXT NOT NULL,
    source_language TEXT NOT NULL,
    target_text TEXT NOT NULL,
    target_language TEXT NOT NULL,
    similarity_score REAL DEFAULT 1.0, -- For exact matches
    context_type TEXT,
    domain TEXT, -- Technical domain
    usage_count INTEGER DEFAULT 1,
    last_used DATETIME,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Glossary / Termbase
CREATE TABLE IF NOT EXISTS glossary_terms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    definition TEXT,
    part_of_speech TEXT,
    domain TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active', -- active, deprecated, pending
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, term)
);

CREATE TABLE IF NOT EXISTS glossary_translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term_id INTEGER REFERENCES glossary_terms(id) ON DELETE CASCADE,
    language_code TEXT NOT NULL,
    translation TEXT NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'active',
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(term_id, language_code)
);

-- 7. Smart Strings Placeholders
CREATE TABLE IF NOT EXISTS placeholders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    string_id INTEGER REFERENCES strings(id) ON DELETE CASCADE,
    placeholder TEXT NOT NULL, -- e.g., '{0}', '{player_name}', '{count:plural}'
    type TEXT NOT NULL, -- 'simple', 'plural', 'gender', 'conditional'
    description TEXT,
    validation_rules TEXT, -- JSON for validation rules
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Quality Assurance (QA) Rules and Results
CREATE TABLE IF NOT EXISTS qa_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'placeholder', 'length', 'consistency', 'format'
    description TEXT,
    pattern TEXT, -- Regex pattern if applicable
    severity TEXT DEFAULT 'warning', -- 'error', 'warning', 'info'
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qa_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    translation_id INTEGER REFERENCES translations(id) ON DELETE CASCADE,
    rule_id INTEGER REFERENCES qa_rules(id),
    severity TEXT NOT NULL,
    message TEXT,
    line_number INTEGER,
    character_position INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Unity Localization Integration
CREATE TABLE IF NOT EXISTS unity_localization_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    table_type TEXT NOT NULL, -- 'string', 'asset'
    locale_id TEXT,
    file_path TEXT,
    last_sync DATETIME,
    metadata TEXT, -- JSON for Unity-specific metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS unity_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER REFERENCES unity_localization_tables(id) ON DELETE CASCADE,
    asset_key TEXT NOT NULL,
    asset_type TEXT NOT NULL, -- 'sprite', 'audio', 'font', 'prefab', 'material'
    asset_path TEXT,
    locale_id TEXT,
    metadata TEXT, -- JSON for asset metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Export/Import Jobs
CREATE TABLE IF NOT EXISTS export_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    format TEXT NOT NULL, -- 'csv', 'xliff', 'json', 'tmx'
    target_languages TEXT, -- JSON array
    options TEXT, -- JSON for export options
    status TEXT DEFAULT 'pending', -- pending, running, completed, failed
    file_path TEXT,
    error_message TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS import_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    format TEXT NOT NULL,
    file_path TEXT,
    options TEXT, -- JSON for import options
    status TEXT DEFAULT 'pending',
    imported_count INTEGER DEFAULT 0,
    skipped_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- 11. Activity Logs and Audit Trail
CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    project_id INTEGER REFERENCES projects(id),
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'translate', 'review'
    entity_type TEXT NOT NULL, -- 'string', 'translation', 'project', 'user'
    entity_id INTEGER,
    old_values TEXT, -- JSON for old values
    new_values TEXT, -- JSON for new values
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Settings and Configuration
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    type TEXT DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
    is_public BOOLEAN DEFAULT 0, -- Public settings can be accessed via API
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. Machine Translation Configurations
CREATE TABLE IF NOT EXISTS mt_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    engine TEXT NOT NULL, -- 'google', 'deepl', 'azure'
    api_key TEXT,
    api_endpoint TEXT,
    model TEXT, -- Specific model if applicable
    glossary_id INTEGER REFERENCES glossary_terms(id),
    settings TEXT, -- JSON for engine-specific settings
    is_active BOOLEAN DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_strings_project_key ON strings(project_id, key_id);
CREATE INDEX IF NOT EXISTS idx_strings_project_context ON strings(project_id, context_type);
CREATE INDEX IF NOT EXISTS idx_translations_string_lang ON translations(string_id, language_code);
CREATE INDEX IF NOT EXISTS idx_translations_status ON translations(status);
CREATE INDEX IF NOT EXISTS idx_tm_source_target ON translation_memory(source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_tm_source_text ON translation_memory(source_text);
CREATE INDEX IF NOT EXISTS idx_glossary_project_term ON glossary_terms(project_id, term);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project ON activity_logs(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_qa_results_translation ON qa_results(translation_id);
CREATE INDEX IF NOT EXISTS idx_unity_tables_project ON unity_localization_tables(project_id);

-- 15. Triggers for Updated At
CREATE TRIGGER IF NOT EXISTS update_strings_timestamp 
    AFTER UPDATE ON strings
    BEGIN
        UPDATE strings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_translations_timestamp 
    AFTER UPDATE ON translations
    BEGIN
        UPDATE translations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_projects_timestamp 
    AFTER UPDATE ON projects
    BEGIN
        UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- 16. Default Settings
INSERT OR IGNORE INTO settings (key, value, description, type, is_public) VALUES
('default_source_language', 'en', 'Default source language for new projects', 'string', 1),
('max_file_size_mb', '50', 'Maximum file size for uploads in MB', 'number', 1),
('enable_machine_translation', 'true', 'Enable machine translation by default', 'boolean', 1),
('default_qa_rules', 'placeholder,length', 'Default QA rules to enable', 'json', 1),
('supported_languages', '["en","pt-BR","es","fr","de","it","ja","ko","zh-CN","ru","ar"]', 'Supported languages', 'json', 1);
