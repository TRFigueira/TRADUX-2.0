-- Initialize default data for TRADUX 3.0
-- This migration runs after main schema is created

-- Create default organization
INSERT OR IGNORE INTO organizations (name, slug, description) VALUES 
('Default Organization', 'default', 'Default organization for migrated projects');

-- Create default project
INSERT OR IGNORE INTO projects (organization_id, name, slug, description, source_language, localization_system)
VALUES 
(1, 'Migrated Project', 'migrated-project', 'Project migrated from TRADUX 2.0', 'en', 'legacy');

-- Create default admin user
INSERT OR IGNORE INTO users (email, username, password_hash, first_name, last_name, role)
VALUES 
('admin@tradux.com', 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LrUpm', 'Admin', 'User', 'admin');

-- Add admin to project
INSERT OR IGNORE INTO project_users (project_id, user_id, role)
VALUES (1, 1, 'admin');

-- Create QA rules
INSERT OR IGNORE INTO qa_rules (project_id, name, type, description, pattern, severity)
VALUES 
(1, 'Missing Placeholders', 'placeholder', 'Check for missing placeholders', '\{[0-9]+\}', 'error'),
(1, 'Length Limit', 'length', 'Check length limits', NULL, 'warning'),
(1, 'HTML Tags', 'format', 'Check HTML tags', '<[^>]*>', 'error');

-- Create settings
INSERT OR IGNORE INTO settings (key, value, description, type, is_public)
VALUES 
('mt_enabled', 'true', 'Enable machine translation', 'boolean', 1),
('default_target_language', 'pt-BR', 'Default target language', 'string', 1),
('qa_auto_check', 'true', 'Enable automatic QA checking', 'boolean', 1);
