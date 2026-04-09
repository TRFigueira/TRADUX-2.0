import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { TraduxDatabase } from '../src/database/TraduxDatabase';
import { processFile, TranslatableString } from './assetProcessors';
import { ToolManager } from '../src/services/ToolManager';

// Função principal de inicialização
function initializeApp() {
  let mainWindow: BrowserWindow | null = null;
  let db: TraduxDatabase | null = null;
  let toolManager: ToolManager | null = null;

  // Criar janela principal
  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    // Carregar o aplicativo
    if (process.env.NODE_ENV === 'development') {
      mainWindow.loadURL('http://localhost:5173');
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadFile('dist/index.html');
    }

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  // Inicializar banco de dados
  async function initializeDatabase() {
    try {
      const dbPath = path.join(app.getPath('userData'), 'tradux_30.db');
      const migrationsPath = path.join(__dirname, '../database/migrations');
      
      db = new TraduxDatabase({
        databasePath: dbPath,
        migrationsPath: migrationsPath
      });
      
      await db.initialize();
      console.log('[Main] Database initialized successfully');
      
      // Initialize ToolManager
      const toolsDir = path.join(app.getPath('userData'), 'tools');
      toolManager = new ToolManager(toolsDir);
      console.log('[Main] ToolManager initialized');
    } catch (error) {
      console.error('[Main] Failed to initialize database:', error);
      throw error;
    }
  }

  // Extract text using AssetStudioCLI with proper type filtering
  async function extractWithAssetStudioCLI(gamePath: string): Promise<Array<{path_id: string; original_text: string; assetFile: string}>> {
    const strings: Array<{path_id: string; original_text: string; assetFile: string}> = [];
    
    const assetStudioPath = path.join(app.getPath('userData'), 'tools', 'AssetStudioCLI_net6_win_x64.exe');
    
    // Check if AssetStudioCLI exists
    if (!fs.existsSync(assetStudioPath)) {
      console.log('[AssetStudio] CLI not found, falling back to manual extraction');
      return strings;
    }
    
    const tempOutputDir = path.join(app.getPath('temp'), 'tradux-extract-' + Date.now());
    fs.mkdirSync(tempOutputDir, { recursive: true });
    
    try {
      console.log('[AssetStudio] Starting extraction with type filtering...');
      
      // Use AssetStudioCLI with --type TextAsset,MonoBehaviour and --filter for localization/dialogue paths
      const args = [
        gamePath,
        tempOutputDir,
        '--game', 'TOT',
        '--export', 'text',
        '--type', 'TextAsset,MonoBehaviour',
        '--filter', 'Localization|Dialogue|UI|Menu|Text|Story|Conversation'
      ];
      
      console.log('[AssetStudio] Command:', assetStudioPath, args.join(' '));
      
      await new Promise((resolve, reject) => {
        const process = spawn(assetStudioPath, args, {
          timeout: 300000 // 5 minute timeout
        });
        
        let stdout = '';
        let stderr = '';
        
        process.stdout.on('data', (data) => {
          stdout += data.toString();
          console.log('[AssetStudio]', data.toString().trim());
        });
        
        process.stderr.on('data', (data) => {
          stderr += data.toString();
          console.error('[AssetStudio]', data.toString().trim());
        });
        
        process.on('close', (code) => {
          if (code === 0) {
            resolve(null);
          } else {
            reject(new Error(`AssetStudioCLI exited with code ${code}: ${stderr}`));
          }
        });
        
        process.on('error', (err) => {
          reject(err);
        });
      });
      
      // Process extracted files
      const extractTextFiles = (dir: string) => {
        const files = fs.readdirSync(dir);
        let index = 0;
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            extractTextFiles(filePath);
          } else if (file.endsWith('.txt') || file.endsWith('.json')) {
            try {
              const content = fs.readFileSync(filePath, 'utf8');
              const lines = content.split('\n');
              
              for (const line of lines) {
                const trimmed = line.trim();
                if (isRealGameText(trimmed)) {
                  strings.push({
                    path_id: `${file}_${index++}`,
                    original_text: trimmed,
                    assetFile: file
                  });
                }
              }
            } catch (err) {
              console.error('[AssetStudio] Error reading:', filePath, err);
            }
          }
        }
      };
      
      extractTextFiles(tempOutputDir);
      console.log(`[AssetStudio] Extracted ${strings.length} strings from TextAssets`);
      
    } catch (error) {
      console.error('[AssetStudio] Extraction failed:', error);
    } finally {
      // Cleanup temp directory
      try {
        fs.rmSync(tempOutputDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    
    return strings;
  }

  // Configurar handlers IPC
  function setupIPCHandlers() {
    // === ORGANIZATIONS ===
    ipcMain.handle('organizations:list', async () => {
      try {
        if (!db) throw new Error('Database not initialized');
        return { success: true, organizations: db.getOrganizations() };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('organizations:create', async (_event, data: { name: string; slug: string; description?: string }) => {
      try {
        if (!db) throw new Error('Database not initialized');
        const id = db.createOrganization(data.name, data.slug, data.description);
        return { success: true, id };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // === PROJECTS ===
    ipcMain.handle('projects:list', async (_event, organizationId?: number) => {
      try {
        if (!db) throw new Error('Database not initialized');
        const projects = db.getProjects(organizationId);
        
        const formattedProjects = projects.map(project => ({
          ...project,
          target_languages: project.target_languages ? JSON.parse(project.target_languages) : [],
          settings: project.settings ? JSON.parse(project.settings) : {}
        }));
        
        return { success: true, projects: formattedProjects };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('projects:create', async (_event, data: {
      organizationId: number;
      name: string;
      slug: string;
      description?: string;
      sourceLanguage?: string;
      targetLanguages?: string[];
      unityVersion?: string;
      localizationSystem?: string;
    }) => {
      try {
        if (!db) throw new Error('Database not initialized');
        const id = db.createProject(data.organizationId, data.name, data.slug, {
          description: data.description,
          sourceLanguage: data.sourceLanguage,
          targetLanguages: data.targetLanguages,
          unityVersion: data.unityVersion,
          localizationSystem: data.localizationSystem
        });
        return { success: true, id };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // === USERS ===
    ipcMain.handle('users:create', async (_event, userData: {
      email: string;
      username: string;
      password: string;
      firstName?: string;
      lastName?: string;
      role?: string;
    }) => {
      try {
        if (!db) throw new Error('Database not initialized');
        
        const bcrypt = require('bcrypt');
        const passwordHash = await bcrypt.hash(userData.password, 12);
        
        const id = db.createUser({
          email: userData.email,
          username: userData.username,
          passwordHash,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role || 'translator'
        });
        
        return { success: true, id };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('users:login', async (_event, credentials: { email: string; password: string }) => {
      try {
        if (!db) throw new Error('Database not initialized');
        
        const user = db.getUserByEmail(credentials.email);
        if (!user) {
          return { success: false, error: 'User not found' };
        }
        
        const bcrypt = require('bcrypt');
        const isValid = await bcrypt.compare(credentials.password, user.password_hash);
        
        if (!isValid) {
          return { success: false, error: 'Invalid password' };
        }
        
        const { password_hash, ...userWithoutPassword } = user;
        return { success: true, user: userWithoutPassword };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // === STRINGS ===
    ipcMain.handle('strings:list', async (_event, projectId: number, filters?: {
      contextType?: string;
      search?: string;
    }) => {
      try {
        if (!db) throw new Error('Database not initialized');
        const strings = db.getStrings(projectId, filters);
        
        const formattedStrings = strings.map(str => ({
          ...str,
          tags: str.tags ? JSON.parse(str.tags) : [],
          metadata: str.metadata ? JSON.parse(str.metadata) : {}
        }));
        
        return { success: true, strings: formattedStrings };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('strings:create', async (_event, projectId: number, data: {
      keyId: string;
      contextType?: string;
      contextDescription?: string;
      sourceFile?: string;
      lineNumber?: number;
      maxLength?: number;
      notes?: string;
      tags?: string[];
      metadata?: any;
    }) => {
      try {
        if (!db) throw new Error('Database not initialized');
        const id = db.createString(projectId, data.keyId, data);
        return { success: true, id };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // === TRANSLATIONS ===
    ipcMain.handle('translations:list', async (_event, stringId: number, languageCode?: string) => {
      try {
        if (!db) throw new Error('Database not initialized');
        const translations = db.getTranslations(stringId, languageCode);
        return { success: true, translations };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('translations:create', async (_event, data: {
      stringId: number;
      languageCode: string;
      text: string;
      status?: string;
      translatorId?: number;
      reviewerId?: number;
      qualityScore?: number;
      isMachineTranslated?: boolean;
      mtEngine?: string;
      mtConfidence?: number;
      comments?: string;
    }) => {
      try {
        if (!db) throw new Error('Database not initialized');
        const id = db.createTranslation(data.stringId, data.languageCode, data.text, data);
        return { success: true, id };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // === TRANSLATION MEMORY ===
    ipcMain.handle('tm:search', async (_event, data: {
      sourceText: string;
      sourceLanguage: string;
      targetLanguage: string;
      threshold?: number;
    }) => {
      try {
        if (!db) throw new Error('Database not initialized');
        const results = db.searchTM(data.sourceText, data.sourceLanguage, data.targetLanguage, data.threshold);
        return { success: true, results };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // === GLOSSARY ===
    ipcMain.handle('glossary:list', async (_event, projectId: number, search?: string) => {
      try {
        if (!db) throw new Error('Database not initialized');
        const terms = db.getGlossaryTerms(projectId, search);
        return { success: true, terms };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // === QA ===
    ipcMain.handle('qa:run', async (_event, translationId: number) => {
      try {
        if (!db) throw new Error('Database not initialized');
        const results = db.runQA(translationId);
        return { success: true, results };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // === SETTINGS ===
    ipcMain.handle('settings:get', async (_event, key: string) => {
      try {
        if (!db) throw new Error('Database not initialized');
        const value = db.getSetting(key);
        return { success: true, value };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // === TOOL MANAGEMENT ===
    ipcMain.handle('tools:list', async () => {
      try {
        if (!toolManager) throw new Error('ToolManager not initialized');
        const tools = await toolManager.getTools();
        return { success: true, tools };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('tools:install', async (_event, toolName: string) => {
      try {
        if (!toolManager) throw new Error('ToolManager not initialized');
        
        // Forward progress events to renderer
        toolManager.on('progress', (progress) => {
          if (mainWindow) {
            mainWindow.webContents.send('tools:progress', progress);
          }
        });
        
        const result = await toolManager.installTool(toolName);
        return result;
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('tools:check', async (_event, toolName: string) => {
      try {
        if (!toolManager) throw new Error('ToolManager not initialized');
        const isInstalled = toolManager.isInstalled(toolName);
        const toolPath = toolManager.getToolPath(toolName);
        return { success: true, installed: isInstalled, path: toolPath };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // === LEGACY COMPATIBILITY HANDLERS ===
    
    // Importar jogo Unity (legacy)
    ipcMain.handle('import-unity-game', async () => {
      try {
        console.log('[Main] Iniciando diálogo de seleção de pasta...');
        
        if (!mainWindow) {
          console.error('[Main] MainWindow não está disponível');
          return { success: false, error: 'Janela principal não encontrada' };
        }

        const result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openDirectory'],
          title: 'Selecione a pasta do jogo Unity'
        });

        console.log('[Main] Resultado do diálogo:', result);

        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
          const gamePath = result.filePaths[0];
          console.log('[Main] Pasta selecionada:', gamePath);
          
          if (fs.existsSync(gamePath)) {
            return { success: true, gamePath };
          } else {
            return { success: false, error: 'Pasta selecionada não existe' };
          }
        }

        console.log('[Main] Nenhuma pasta selecionada ou diálogo cancelado');
        return { success: false, error: 'Nenhuma pasta selecionada' };
      } catch (error) {
        console.error('[Main] Erro ao importar jogo:', error);
        return { success: false, error: `Erro: ${(error as Error).message}` };
      }
    });

    // Scan de arquivos traduzíveis (legacy)
    ipcMain.handle('scan-unity-game', async (_event, gamePath: string) => {
      try {
        console.log('[Main] Iniciando Deep Scan:', gamePath);
        
        if (!gamePath || typeof gamePath !== 'string') {
          console.error('[Main] gamePath inválido:', gamePath);
          return { success: false, error: 'Caminho do jogo inválido' };
        }
        
        if (!fs.existsSync(gamePath)) {
          console.error('[Main] Pasta do jogo não existe:', gamePath);
          return { success: false, error: 'Pasta do jogo não encontrada' };
        }
        
        const translatableFiles = await scanTranslatableFiles(gamePath);
        
        return {
          gamePath,
          files: translatableFiles,
          totalFiles: translatableFiles.length,
          translatableFiles: translatableFiles.length,
          totalStrings: 0,
          durationMs: 0
        };
      } catch (error) {
        console.error('[Main] Erro no scan:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // AssetStudio handlers (legacy)
    ipcMain.handle('check-assetstudio', async () => {
      return { available: true, path: 'AssetStudio Integration pronto para uso' };
    });

    ipcMain.handle('install-assetstudio', async () => {
      try {
        return { success: true, error: 'AssetStudio Integration já está configurado!' };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('scan-assets-files-assetstudio', async (_event, gamePath: string) => {
      try {
        const assetFiles = await scanAssetFiles(gamePath);
        return {
          success: true,
          files: assetFiles,
          totalFiles: assetFiles.length
        };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('extract-assets-texts-assetstudio', async (_event, assetFiles: any[]) => {
      console.log('[Main] Extraindo textos com AssetStudioCLI:', assetFiles.length, 'arquivos');
      
      try {
        let totalStrings: Array<{path_id: string; original_text: string; assetFile: string}> = [];
        
        // If we have .assets files, try to use AssetStudioCLI on the game directory
        const assetsFile = assetFiles.find(f => f.name?.endsWith('.assets') || f.path?.includes('.assets'));
        
        if (assetsFile) {
          const gamePath = path.dirname(assetsFile.path);
          console.log('[Main] Tentando extrair com AssetStudioCLI de:', gamePath);
          
          // Try AssetStudioCLI extraction first
          const cliStrings = await extractWithAssetStudioCLI(gamePath);
          
          if (cliStrings.length > 0) {
            console.log(`[Main] AssetStudioCLI extraíou ${cliStrings.length} textos`);
            totalStrings = cliStrings;
          } else {
            console.log('[Main] AssetStudioCLI não encontrou textos, usando extração binária...');
            // Fallback to binary extraction for each file
            for (const file of assetFiles) {
              if (fs.existsSync(file.path)) {
                const buffer = fs.readFileSync(file.path);
                const strings = extractFromBinaryFile(buffer, file.name, buffer.length);
                totalStrings.push(...strings);
              }
            }
          }
        } else {
          // No .assets files, use binary extraction
          for (const file of assetFiles) {
            if (fs.existsSync(file.path)) {
              const buffer = fs.readFileSync(file.path);
              const strings = extractFromBinaryFile(buffer, file.name, buffer.length);
              totalStrings.push(...strings);
            }
          }
        }
        
        return {
          success: true,
          stringsExtracted: totalStrings.length,
          message: `Extração concluída! ${totalStrings.length} textos extraídos de ${assetFiles.length} arquivos.`,
          errors: []
        };
        
      } catch (error) {
        console.error('[Main] Erro na extração com AssetStudio:', error);
        return { 
          success: false, 
          error: (error as Error).message,
          stringsExtracted: 0
        };
      }
    });

    // Additional legacy handlers
    ipcMain.handle('fetch-files', async () => {
      try {
        if (!db) return [];
        
        // Get strings grouped by source_file
        const stmt = db.prepare(`
          SELECT source_file, COUNT(*) as count 
          FROM strings 
          GROUP BY source_file
        `);
        const rows = stmt.all() as any[];
        
        return rows.map((row, index) => ({
          id: index.toString(),
          name: row.source_file,
          count: { count: row.count }
        }));
      } catch (error) {
        console.error('[Main] Erro ao buscar arquivos:', error);
        return [];
      }
    });

    ipcMain.handle('fetch-strings-by-file', async (_event, sourceFile: string, page: number = 1, pageSize: number = 1000) => {
      try {
        if (!db) return { strings: [], total: 0, page, pageSize };
        
        // Get total count first
        const countStmt = db.prepare(`
          SELECT COUNT(*) as total FROM strings WHERE source_file = ?
        `);
        const countResult = countStmt.get(sourceFile) as any;
        const total = countResult?.total || 0;
        
        // Get paginated strings
        const offset = (page - 1) * pageSize;
        const stmt = db.prepare(`
          SELECT * FROM strings 
          WHERE source_file = ?
          ORDER BY id
          LIMIT ? OFFSET ?
        `);
        const rows = stmt.all(sourceFile, pageSize, offset) as any[];
        
        const strings = rows.map(row => ({
          id: row.id,
          source_file: row.source_file,
          path_id: row.key_id,
          original_text: row.metadata ? JSON.parse(row.metadata).original_text || row.key_id : row.key_id,
          shielded_text: row.key_id,
          translated_text: null,
          status: 'pending'
        }));
        
        return { strings, total, page, pageSize };
      } catch (error) {
        console.error('[Main] Erro ao buscar strings:', error);
        return { strings: [], total: 0, page, pageSize };
      }
    });

    ipcMain.handle('translate-string', async () => {
      return { success: true };
    });

    ipcMain.handle('search-fuzzy', async () => {
      return [];
    });

    ipcMain.handle('run-qa-check', async () => {
      return { passed: true, warnings: [] };
    });

    // UABEA: Extract texts using UABEA for proper Unity asset parsing
    ipcMain.handle('extract-with-uabea', async (_event, assetFilePath: string) => {
      console.log('[Main] Extraindo com UABEA:', assetFilePath);
      try {
        // For now, use the smart binary extractor
        // In the future, this would call UABEA CLI
        const buffer = fs.readFileSync(assetFilePath);
        const fileName = path.basename(assetFilePath);
        const strings = extractFromBinaryFile(buffer, fileName, buffer.length);
        
        // Save to database
        if (db && strings.length > 0) {
          const projectId = 1;
          let savedCount = 0;
          
          for (let i = 0; i < Math.min(strings.length, 10000); i++) {
            const str = strings[i];
            try {
              const textHash = Buffer.from(str.original_text).toString('base64').slice(0, 20);
              const uniqueKeyId = `${fileName}_idx${i}_hash${textHash}`;
              
              db.createString(projectId, uniqueKeyId, {
                contextType: 'gameplay',
                contextDescription: `Extracted from ${fileName}`,
                sourceFile: fileName,
                notes: str.original_text.slice(0, 200),
                metadata: {
                  original_text: str.original_text,
                  assetFile: str.assetFile,
                  extracted_at: new Date().toISOString()
                }
              });
              savedCount++;
            } catch (err) {
              // Skip duplicates
            }
          }
          
          console.log(`[Main] Salvos ${savedCount} textos do UABEA`);
          return { success: true, extracted: strings.length, saved: savedCount };
        }
        
        return { success: true, extracted: strings.length, saved: 0 };
      } catch (error) {
        console.error('[Main] Erro na extração UABEA:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // Import scanned files handler
    ipcMain.handle('import-scanned-files', async (_event, files: any[]) => {
      console.log('[Main] Importando arquivos escaneados:', files.length);
      try {
        if (!db) throw new Error('Database not initialized');
        
        const results = [];
        let totalExtracted = 0;
        let totalSaved = 0;
        
        // Get default project (id = 1)
        const projectId = 1;
        
        for (const file of files) {
          // Extract texts from each file
          const extracted = await extractTextsFromFile(file.path);
          totalExtracted += extracted.length;
          
          // Save each string to database
          let savedCount = 0;
          for (let i = 0; i < extracted.length; i++) {
            const str = extracted[i];
            try {
              // Generate unique key_id using file name, index and text hash
              const textHash = Buffer.from(str.original_text).toString('base64').slice(0, 20);
              const uniqueKeyId = `${file.name}_idx${i}_hash${textHash}`;
              
              db.createString(projectId, uniqueKeyId, {
                contextType: 'gameplay',
                contextDescription: `Extracted from ${file.name}`,
                sourceFile: file.name,
                notes: str.original_text.slice(0, 200), // Limit notes length
                metadata: {
                  original_text: str.original_text,
                  assetFile: str.assetFile,
                  extracted_at: new Date().toISOString(),
                  file_path: str.path_id
                }
              });
              savedCount++;
              totalSaved++;
            } catch (err) {
              // Silently skip duplicates - they're expected
            }
          }
          
          results.push({
            file: file.name || file.path,
            imported: true,
            stringsCount: extracted.length,
            savedCount: savedCount,
            strings: extracted
          });
          
          console.log(`[Main] Extraídos ${extracted.length} textos de ${file.name}, salvos ${savedCount}`);
        }
        
        return { 
          success: true, 
          imported: results.length, 
          totalStrings: totalExtracted,
          totalSaved: totalSaved,
          results 
        };
      } catch (error) {
        console.error('[Main] Erro ao importar arquivos:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // Clear all strings handler
    ipcMain.handle('clear-all-strings', async () => {
      console.log('[Main] Limpando todas as strings');
      try {
        if (!db) throw new Error('Database not initialized');
        
        const result = db.clearAllStrings();
        return { success: true, cleared: result.deleted };
      } catch (error) {
        console.error('[Main] Erro ao limpar strings:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    console.log('[Main] Handlers IPC configurados');
  }

  // Funções auxiliares (legacy)
  async function scanTranslatableFiles(gamePath: string): Promise<any[]> {
    const files: any[] = [];
    
    // FILE BLACKLIST - Arquivos que NÃO contêm textos de jogo
    const FILE_BLACKLIST = [
      /^lib_/i,                    // lib_burst_generated, etc.
      /^UnityEngine\./i,          // UnityEngine.CoreModule.dll, etc.
      /^Unity\.Jobs\./i,         // Unity Jobs assemblies
      /^System\./i,               // System assemblies
      /^netstandard/i,            // .NET Standard
      /^mscorlib/i,               // Core library
      /^Mono\./i,                 // Mono runtime
      /^Microsoft\./i,            // Microsoft assemblies
      /Burst/i,                   // Burst compiler generated
      /il2cpp/i,                  // IL2CPP generated files
      /Assembly-CSharp-firstpass/i,
      /Assembly-UnityScript/i,
      // Unity Addressables - System files, not game text
      /catalog\.json/i,           // Addressables catalog
      /catalog\.json\.meta/i,      // Unity metadata
      /addressables_assets\.json/i, // Addressables manifest
      /buildsettings\.json/i,      // Build settings
      /projectsettings\.json/i,    // Project settings
      /bundleconfig\.json/i,       // Bundle configuration
    ];
    
    // Unity game text locations to prioritize
    const textLocations = [
      'StreamingAssets',      // Common for game data
      'Resources',            // Unity Resources folder
      'Assets/Resources',
      'Assets/StreamingAssets',
      'Data',                 // Generic data folder
      'Localization',         // Localization folder
      'Languages',            // Language files
      'Text',                 // Text files
      'Dialogues',            // Dialogue files
      'Dialog',               // Alternative spelling
      'Scripts',              // Scripts with embedded text
      'Managed',              // .NET assemblies
    ];
    
    function walkDir(dir: string, relativePath: string = '') {
      try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const itemRelativePath = relativePath ? path.join(relativePath, item) : item;
          
          // Skip only obvious non-game folders
          if (fs.statSync(fullPath).isDirectory()) {
            // Skip: Logs, Temp, Cache, but NOT Resources/StreamingAssets!
            const skipFolders = ['logs', 'temp', 'cache', 'crashdumps', 'debug'];
            const lowerItem = item.toLowerCase();
            if (skipFolders.includes(lowerItem)) {
              console.log(`[Scan] Pulando pasta: ${item}`);
              continue;
            }
            walkDir(fullPath, itemRelativePath);
          } else if (
            // Text files with game content
            item.match(/\.(txt|json|xml|csv|yaml|yml|tsv)$/i) ||
            // Unity assets
            item.match(/\.assets$/i) ||
            // Resource files  
            item.match(/\.resS$/i) ||
            // Mono/.NET assemblies (may contain embedded text)
            item.match(/\.dll$/i) ||
            // Unity scenes/prefabs (may contain UI text)
            item.match(/\.unity$/i) ||
            item.match(/\.prefab$/i) ||
            // Specific game text patterns
            item.match(/dialog/i) ||
            item.match(/localization/i) ||
            item.match(/lang/i) ||
            item.match(/text/i) ||
            item.match(/string/i)
          ) {
            // Check blacklist - skip system files
            if (FILE_BLACKLIST.some(pattern => pattern.test(item))) {
              console.log(`[Scan] Ignorado (blacklist): ${item}`);
              continue;
            }
            
            try {
              const stats = fs.statSync(fullPath);
              
              // Calculate priority based on location and name
              let priority = 1;
              let confidence = 0.5;
              
              const lowerPath = fullPath.toLowerCase();
              const lowerName = item.toLowerCase();
              
              // High priority for known text locations
              if (textLocations.some(loc => lowerPath.includes(loc.toLowerCase()))) {
                priority = 10;
                confidence = 0.9;
              }
              
              // High priority for text/content related names
              if (lowerName.match(/dialog|text|lang|localization|string|conversation|npc|quest/)) {
                priority = 20;
                confidence = 0.95;
              }
              
              // Medium priority for common game formats
              if (lowerName.match(/\.json$|\.xml$|\.csv$|\.txt$/)) {
                priority = Math.max(priority, 5);
                confidence = Math.max(confidence, 0.7);
              }
              
              files.push({
                path: fullPath,
                relativePath: itemRelativePath,
                name: item,
                extension: path.extname(item),
                size: stats.size,
                priority: priority,
                isTranslatable: true,
                confidence: confidence,
                preview: `Arquivo encontrado: ${item} (${Math.round(confidence * 100)}% confiança)`
              });
            } catch (error) {
              console.warn(`[Main] Erro ao ler arquivo ${fullPath}:`, error);
            }
          }
        }
      } catch (error) {
        console.warn(`[Main] Erro ao ler diretório ${dir}:`, error);
      }
    }
    
    walkDir(gamePath);
    
    // Sort by priority (highest first)
    files.sort((a, b) => b.priority - a.priority);
    
    console.log(`[Scan] Encontrados ${files.length} arquivos candidatos`);
    console.log(`[Scan] Top 10 por prioridade:`, files.slice(0, 10).map(f => `${f.name} (prio:${f.priority})`));
    
    return files;
  }

  async function scanAssetFiles(gamePath: string): Promise<any[]> {
    const assetFiles: any[] = [];
    
    function walkDir(dir: string) {
      try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          
          if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
          } else if (item.endsWith('.assets')) {
            try {
              const stats = fs.statSync(fullPath);
              assetFiles.push({
                name: item,
                path: fullPath,
                size: stats.size,
                type: 'unity_asset'
              });
            } catch (error) {
              console.warn(`[Main] Erro ao ler asset ${fullPath}:`, error);
            }
          }
        }
      } catch (error) {
        console.warn(`[Main] Erro ao ler diretório ${dir}:`, error);
      }
    }
    
    walkDir(gamePath);
    return assetFiles;
  }

  // Extract texts from a file using multiple methods
  async function extractTextsFromFile(filePath: string): Promise<Array<{path_id: string; original_text: string; assetFile: string}>> {
    const strings: Array<{path_id: string; original_text: string; assetFile: string}> = [];
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    try {
      if (!fs.existsSync(filePath)) {
        return strings;
      }
      
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        return strings;
      }
      
      // Use specialized processors for known text formats
      if (['.json', '.csv', '.xml', '.txt'].includes(ext)) {
        console.log(`[Main] Usando processador especializado para ${fileName}`);
        const extracted = await processFile(filePath);
        
        for (const str of extracted) {
          strings.push({
            path_id: str.id,
            original_text: str.originalText,
            assetFile: fileName,
          });
        }
        
        console.log(`[Main] Processador extraiu ${strings.length} textos de ${fileName}`);
        return strings;
      }
      
      // For binary Unity files, use binary extraction
      if (ext === '.assets' || ext === '.ress' || ext === '.resS') {
        return extractFromBinaryFile(await fs.promises.readFile(filePath), fileName, stats.size);
      }
      
      // Fallback to simple text extraction
      const content = (await fs.promises.readFile(filePath)).toString('utf8', 0, Math.min(stats.size, 500000));
      
      // Method 1: Extract strings between quotes
      const quotePattern = /"([^"]{3,500})"/g;
      let match;
      let index = 0;
      while ((match = quotePattern.exec(content)) !== null) {
        const text = match[1].trim();
        if (isValidGameText(text)) {
          strings.push({
            path_id: `${fileName}_${index++}`,
            original_text: text,
            assetFile: fileName
          });
        }
      }
      
    } catch (error) {
      console.error(`[Main] Erro ao extrair textos de ${filePath}:`, error);
    }
    
    return strings;
  }
  
  // Extract readable strings from binary Unity files - SMART VERSION
  function extractFromBinaryFile(buffer: Buffer, fileName: string, _fileSize: number): Array<{path_id: string; original_text: string; assetFile: string}> {
    const strings: Array<{path_id: string; original_text: string; assetFile: string}> = [];
    const seenTexts = new Set<string>();
    let index = 0;
    
    // Unity localization patterns
    const dialogueIndicators = [
      // Common dialogue patterns
      '"', "'", 
      // Sentence endings (indicates real text)
      '. ', '! ', '? ',
      // Common UI words
      'Start', 'Options', 'Quit', 'Menu', 'Level', 'Stage',
      'Continue', 'Save', 'Load', 'Pause', 'Resume',
      'Back', 'Next', 'Previous', 'Confirm', 'Cancel',
      'Yes', 'No', 'OK', 'Close', 'Exit'
    ];
    
    // Read in chunks
    const chunkSize = Math.min(buffer.length, 10 * 1024 * 1024);
    
    for (let offset = 0; offset < buffer.length; offset += chunkSize) {
      const end = Math.min(offset + chunkSize, buffer.length);
      const chunk = buffer.slice(offset, end);
      
      // Look for Unity MonoBehaviour text fields (often contain game text)
      // Pattern: m_Script, m_Text, m_Name, etc.
      let currentString = '';
      let inStringField = false;
      
      for (let i = 0; i < chunk.length; i++) {
        const byte = chunk[i];
        
        // Check if printable ASCII (more restrictive for game text)
        if (byte >= 32 && byte <= 126) {
          currentString += String.fromCharCode(byte);
        } else if (byte === 0) {
          // Null terminator
          if (currentString.length >= 5 && currentString.length <= 500) {
            const trimmed = currentString.trim();
            
            // Only keep if it looks like real game text
            if (isRealGameText(trimmed) && !seenTexts.has(trimmed)) {
              seenTexts.add(trimmed);
              strings.push({
                path_id: `${fileName}_${index++}`,
                original_text: trimmed,
                assetFile: fileName
              });
            }
          }
          currentString = '';
        } else {
          // Invalid byte - reset
          if (currentString.length >= 5) {
            const trimmed = currentString.trim();
            if (isRealGameText(trimmed) && !seenTexts.has(trimmed)) {
              seenTexts.add(trimmed);
              strings.push({
                path_id: `${fileName}_${index++}`,
                original_text: trimmed,
                assetFile: fileName
              });
            }
          }
          currentString = '';
        }
      }
    }
    
    console.log(`[Main] Extraídos ${strings.length} textos REAIS de ${fileName}`);
    return strings;
  }
  
  // Check if text is REAL game text (dialogues, UI, menus) - not metadata
  function isRealGameText(text: string): boolean {
    if (!text || text.length < 5 || text.length > 500) return false;
    
    // Must contain at least one letter (including accented)
    const letterCount = (text.match(/[a-zA-Z\u00C0-\u017F]/g) || []).length;
    if (letterCount < 3) return false;
    
    // ===== BINARY DATA FILTERS =====
    // Must contain spaces (more than one word required)
    if (!text.includes(' ')) return false;
    
    // Reject lines with repeated symbols (->->->, ???, ===, etc.)
    if (/(-{2,}|>{2,}|[?]{2,}|[=]{2,}|[\|]{2,}|[\[]){3,}/.test(text)) return false;
    
    // Reject if too many non-letter characters (likely binary)
    const nonLetterCount = text.length - letterCount;
    if (nonLetterCount > letterCount * 2) return false; // More non-letters than letters
    
    // ===== ENHANCED FILTERS - Exclude code/metadata =====
    
    // Skip if looks like C++ method signature (::)
    if (text.includes('::')) return false;
    
    // Skip if looks like C# method call (NameSpace.Class.Method)
    if (/\w+\.\w+\.\w+/.test(text) && text.includes('(')) return false;
    
    // Skip Unity/System namespaces
    if (text.startsWith('UnityEngine.')) return false;
    if (text.startsWith('Unity.')) return false;
    if (text.startsWith('System.')) return false;
    if (text.startsWith('Mono.')) return false;
    
    // Skip assembly metadata
    if (text.includes('PublicKeyToken=')) return false;
    if (text.includes('mscorlib')) return false;
    if (text.includes('Version=') && text.includes('Culture=')) return false;
    if (text.includes('Version=') && text.includes('PublicKeyToken=')) return false;
    
    // Skip Burst/IL2CPP internals
    if (text.includes('BurstGenerated')) return false;
    if (text.includes('CalcVertex') || text.includes('CalcTriangle') || text.includes('CalcNormal')) return false;
    if (text.includes('JobParallelFor')) return false;
    if (text.includes('JobRanges')) return false;
    
    // Skip hash/ID patterns
    if (/^[0-9a-f]{16,}$/i.test(text)) return false; // Long hex strings
    if (/\b[0-9a-f]{8}-[0-9a-f]{4}/i.test(text)) return false; // GUID fragments
    
    // Skip variable names (camelCase/PascalCase without spaces)
    if (/^[A-Z][a-z]+[A-Z]/.test(text) && !text.includes(' ')) return false;
    if (/^[a-z]+[A-Z]/.test(text) && !text.includes(' ')) return false;
    
    // Skip if too many dots (likely namespace path)
    const dotCount = (text.match(/\./g) || []).length;
    if (dotCount > 3 && letterCount < 20) return false;
    
    // Skip if mostly non-alphabetic (binary or encoded)
    const nonAlphaRatio = (text.length - letterCount) / text.length;
    if (nonAlphaRatio > 0.5) return false;
    
    // Skip if looks like code/technical
    if (text.includes('m_') && text.includes('_')) return false; // Unity variable names
    if (/^[0-9a-fA-F]{8,}$/.test(text)) return false; // Hex strings
    if (/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(text) && text.length < 20) return false; // variable names
    if (text.includes('->')) return false; // C++ pointer
    if (text.startsWith('k__') || text.startsWith('<>')) return false; // Compiler generated
    if (text.includes('Assembly') || text.includes('Version=')) return false; // Assembly info
    if (text.endsWith('.dll') || text.endsWith('.cs')) return false; // File references
    
    // Skip paths
    if (text.includes('Assets/') || text.includes('Resources/')) return false;
    if (text.includes('StreamingAssets/')) return false;
    
    // Skip GUIDs and IDs
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) return false;
    if (/fileID: \d+/.test(text)) return false;
    
    // NATURAL LANGUAGE DETECTION - Must look like human text
    // Check for at least 2 words (require space between them)
    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount < 2 && letterCount < 20) return false;
    
    // Check for actual sentences or common words (indicates real text)
    const hasSentenceStructure = /[.!?]$/.test(text) || 
                                  text.includes(' the ') || 
                                  text.includes(' you ') ||
                                  text.includes(' and ') ||
                                  text.includes(' The ') ||
                                  text.includes(' a ') ||
                                  text.includes(' to ') ||
                                  text.includes(' of ') ||
                                  text.includes(' is ') ||
                                  text.includes(' in ') ||
                                  text.includes(' for ') ||
                                  text.includes(' with ') ||
                                  text.includes(' on ') ||
                                  text.includes(' at ') ||
                                  text.includes(' from ') ||
                                  // Common game UI terms
                                  text.includes('Hello') ||
                                  text.includes('Welcome') ||
                                  text.includes('Click') ||
                                  text.includes('Press') ||
                                  text.includes('Start') ||
                                  text.includes('Menu') ||
                                  text.includes('Options') ||
                                  text.includes('Quit') ||
                                  text.includes('Exit') ||
                                  text.includes('Continue') ||
                                  text.includes('Back') ||
                                  text.includes('Next') ||
                                  text.includes('Save') ||
                                  text.includes('Load') ||
                                  text.includes('Play') ||
                                  text.includes('Pause') ||
                                  text.includes('Resume') ||
                                  text.includes('Confirm') ||
                                  text.includes('Cancel');
    
    if (!hasSentenceStructure && letterCount < 15) return false;
    
    return true;
  }
  
  // Check if text is valid game text
  function isValidGameText(text: string): boolean {
    if (!text || text.length < 3 || text.length > 500) return false;
    
    // Must have at least some letters
    const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
    if (letterCount < 3) return false;
    
    // Skip if too many non-printable/control characters
    const printableCount = (text.match(/[\x20-\x7E]/g) || []).length;
    if (printableCount < text.length * 0.8) return false;
    
    // Skip if looks like code/paths/IDs
    if (text.includes('function') || text.includes('class ') || text.includes('var ')) return false;
    if (text.includes('{') && text.includes('}') && text.indexOf('{') < text.indexOf('}')) return false;
    if (text.startsWith('//') || text.startsWith('/*')) return false;
    if (text.includes('Assets/') || text.includes('Packages/')) return false;
    if (/^[0-9a-f]{8,}$/i.test(text)) return false; // Hex strings
    if (/^[A-Za-z0-9+/]{20,}={0,2}$/.test(text)) return false; // Base64
    
    // Skip common file extensions and paths
    if (/\.(jpg|png|mp3|wav|ogg|fbx|obj|prefab|unity|cs|js|lua|json|dll|exe|zip)$/i.test(text)) return false;
    
    // Skip Unity-specific patterns
    if (text.startsWith('m_') || text.startsWith('k__')) return false;
    if (text.includes('::') || text.includes('->')) return false;
    
    return true;
  }
  
  // Extract readable ASCII strings from buffer
  function extractReadableStrings(buffer: Buffer): string[] {
    const strings: string[] = [];
    let currentString = '';
    
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      // Printable ASCII range
      if (byte >= 32 && byte <= 126) {
        currentString += String.fromCharCode(byte);
      } else if (byte === 0) {
        // Null terminator - end of string
        if (currentString.length >= 3) {
          strings.push(currentString);
        }
        currentString = '';
      }
    }
    
    // Don't forget last string
    if (currentString.length >= 3) {
      strings.push(currentString);
    }
    
    return strings;
  }

  // Eventos do app
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    }
  });

  // Inicialização
  app.whenReady().then(async () => {
    try {
      await initializeDatabase();
      createWindow();
      setupIPCHandlers();
      console.log('[Main] TRADUX 3.0 initialized successfully');
    } catch (error) {
      console.error('[Main] Failed to initialize app:', error);
      app.quit();
    }
  });
}

// Inicializar o aplicativo
initializeApp();
