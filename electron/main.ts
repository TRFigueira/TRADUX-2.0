import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { createRepackerService, ExportReport } from '../src/extractor/repacker';
import { TranslationMemoryDB } from '../src/db/tmDatabase';
import { UnityAutoDiscovery, TranslatableFile } from '../src/skills/unityAutoDiscovery';
import { UABEAIntegration } from '../src/skills/uabeaIntegration';
import { AssetStudioIntegration } from '../src/skills/assetStudioIntegration';

/**
 * Processo Principal Electron (Main Process)
 * 
 * Responsável por:
 * - Criar e gerenciar a janela da aplicação
 * - Inicializar o banco de dados SQLite
 * - Implementar handlers IPC para comunicação com o Renderer
 */

// Manter referência global do objeto window para evitar garbage collection
let mainWindow: BrowserWindow | null = null;

// Instância do banco de dados SQLite
let db: Database.Database | null = null;

/**
 * Inicializa o banco de dados SQLite.
 * Usa better-sqlite3 para acesso síncrono e rápido.
 */
function initializeDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'translation_memory.db');
  
  db = new Database(dbPath);
  
  // Configurar para alta performance
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  
  // Criar tabelas se não existirem
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_strings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_file TEXT NOT NULL,
      path_id TEXT NOT NULL,
      original_text TEXT NOT NULL,
      shielded_text TEXT NOT NULL,
      translated_text TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_file, path_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_source_file ON game_strings(source_file);
    CREATE INDEX IF NOT EXISTS idx_status ON game_strings(status);
  `);
  
  console.log('[Main] Banco de dados inicializado:', dbPath);
}

/**
 * Cria a janela principal da aplicação.
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: 'Unity CAT Tool',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false // Necessário para acesso ao fs em preload
    },
    titleBarStyle: 'hiddenInset', // Estilo moderno macOS/Windows
    show: false // Só mostrar quando estiver pronto
  });

  // Carregar a aplicação
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Handlers IPC para comunicação segura entre Main e Renderer.
 * 
 * Cada handler expõe funcionalidade do backend à interface React.
 */
function setupIpcHandlers(): void {
  if (!db) throw new Error('Banco de dados não inicializado');

  // 1. Buscar lista de arquivos únicos
  ipcMain.handle('fetch-files', () => {
    const stmt = db!.prepare('SELECT DISTINCT source_file FROM game_strings ORDER BY source_file');
    const files = stmt.all() as Array<{ source_file: string }>;
    return files.map(f => ({
      id: f.source_file,
      name: f.source_file,
      count: db!.prepare('SELECT COUNT(*) as count FROM game_strings WHERE source_file = ?').get(f.source_file) as { count: number }
    }));
  });

  // 2. Buscar strings de um arquivo específico
  ipcMain.handle('fetch-strings-by-file', (_event, fileId: string) => {
    const stmt = db!.prepare(`
      SELECT id, source_file, path_id, original_text, shielded_text, translated_text, status
      FROM game_strings 
      WHERE source_file = ?
      ORDER BY id
    `);
    return stmt.all(fileId);
  });

  // 3. Traduzir uma string (salvar no banco de dados)
  ipcMain.handle('translate-string', (_event, id: number, translatedText: string) => {
    const stmt = db!.prepare(`
      UPDATE game_strings 
      SET translated_text = ?, status = 'translated', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *
    `);
    return stmt.get(id, translatedText);
  });

  // 4. Pesquisa fuzzy para TM matches
  ipcMain.handle('search-fuzzy', (_event, query: string, limit: number = 5) => {
    const sanitizedQuery = query.replace(/"/g, '""').replace(/[\*]/g, '').trim();
    if (!sanitizedQuery) return [];
    
    const stmt = db!.prepare(`
      SELECT g.*, rank
      FROM (
        SELECT rowid, rank
        FROM game_strings_fts
        WHERE game_strings_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      ) AS fts
      JOIN game_strings AS g ON fts.rowid = g.id
      WHERE g.translated_text IS NOT NULL
    `);
    return stmt.all(`"${sanitizedQuery}"`, limit);
  });

  // 5. Verificação de Qualidade (QA)
  ipcMain.handle('run-qa-check', (_event, id: number) => {
    const stmt = db!.prepare('SELECT * FROM game_strings WHERE id = ?');
    const record = stmt.get(id) as any;
    
    const warnings: string[] = [];
    
    if (!record) {
      warnings.push('Registro não encontrado');
      return { passed: false, warnings };
    }
    
    // Verificar se a tradução tem todas as tags protegidas
    const originalTags = (record.original_text.match(/\[TAG_\d+\]/g) || []);
    const translatedTags = (record.translated_text?.match(/\[TAG_\d+\]/g) || []);
    
    if (originalTags.length !== translatedTags.length) {
      warnings.push(`Diferença no número de tags protegidas: original=${originalTags.length}, traduzido=${translatedTags.length}`);
    }
    
    // Verificar variáveis
    const originalVars = (record.original_text.match(/\[VAR_\d+\]/g) || []);
    const translatedVars = (record.translated_text?.match(/\[VAR_\d+\]/g) || []);
    
    if (originalVars.length !== translatedVars.length) {
      warnings.push(`Diferença no número de variáveis: original=${originalVars.length}, traduzido=${translatedVars.length}`);
    }
    
    // Verificar se tradução não está vazia
    if (!record.translated_text || record.translated_text.trim() === '') {
      warnings.push('Tradução está vazia');
    }
    
    return {
      passed: warnings.length === 0,
      warnings,
      originalLength: record.original_text?.length || 0,
      translatedLength: record.translated_text?.length || 0
    };
  });

  // 6. Exportação de traduções (Repacker)
  ipcMain.handle('export-translations', async (_event, format: 'json' | 'csv' | 'uabea' = 'json') => {
    try {
      // Criar wrapper da base de dados compatível com RepackerService
      const tmDb = {
        getDatabase: () => db!,
        // Implementar outros métodos necessários se houver
      } as any;
      
      const repacker = createRepackerService(tmDb, {
        format,
        outputDir: path.join(app.getPath('userData'), 'output_build'),
        minStatus: 'translated'
      });

      let progressData = {
        total: 0,
        processed: 0,
        percentage: 0,
        phase: 'reading' as 'reading' | 'unshielding' | 'writing' | 'complete',
        successful: 0,
        failed: 0
      };

      // Enviar progresso para o renderer via evento
      const sendProgress = () => {
        if (mainWindow) {
          mainWindow.webContents.send('export-progress', progressData);
        }
      };

      const report = await repacker.exportTranslations((progress) => {
        progressData = {
          total: progress.total,
          processed: progress.processed,
          percentage: progress.percentage,
          phase: progress.phase,
          successful: progress.successful,
          failed: progress.failed
        };
        sendProgress();
      });

      return {
        success: true,
        report: {
          ...report,
          outputPath: report.outputPath
        }
      };
    } catch (error) {
      console.error('[Main] Erro na exportação:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  // 7. Selecionar e importar pasta com arquivos de tradução
  ipcMain.handle('select-folder', async () => {
    if (!mainWindow) return { canceled: true };
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Selecionar Pasta com Arquivos de Tradução'
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    
    const folderPath = result.filePaths[0];
    console.log('[Main] Pasta selecionada:', folderPath);
    
    // Ler arquivos suportados da pasta
    const supportedExtensions = ['.json', '.csv', '.txt'];
    const files = fs.readdirSync(folderPath)
      .filter(f => supportedExtensions.some(ext => f.toLowerCase().endsWith(ext)))
      .map(f => path.join(folderPath, f));
    
    console.log(`[Main] ${files.length} arquivos encontrados`);
    
    // Importar cada arquivo
    const insertStmt = db!.prepare(`
      INSERT OR IGNORE INTO game_strings 
      (source_file, path_id, original_text, shielded_text)
      VALUES (?, ?, ?, ?)
    `);
    
    let totalImported = 0;
    
    for (const filePath of files) {
      const strings = importTranslationFile(filePath);
      
      for (const str of strings) {
        try {
          insertStmt.run(str.source_file, str.path_id, str.original_text, str.shielded_text);
          totalImported++;
        } catch (err) {
          console.error(`[Main] Erro ao inserir ${str.path_id}:`, err);
        }
      }
    }
    
    console.log(`[Main] ${totalImported} strings importadas`);
    
    return {
      canceled: false,
      folderPath,
      filesFound: files.length,
      stringsImported: totalImported
    };
  });

  // 8. Skill: Unity Auto-Discovery - Deep Scan de jogos Unity
  const scanner = new UnityAutoDiscovery();
  
  ipcMain.handle('scan-unity-game', async () => {
    if (!mainWindow) return { canceled: true };
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Selecionar Pasta do Jogo Unity para Deep Scan'
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    
    const gamePath = result.filePaths[0];
    console.log('[Main] Iniciando Deep Scan:', gamePath);
    
    try {
      const scanResult = await scanner.scanGameDirectory(gamePath, (progress) => {
        if (mainWindow) {
          mainWindow.webContents.send('scan-progress', progress);
        }
      });
      
      console.log(`[Main] Scan completo: ${scanResult.translatableFiles} arquivos traduzíveis encontrados`);
      
      return {
        canceled: false,
        gamePath,
        files: scanResult.files,
        totalFiles: scanResult.totalFiles,
        translatableFiles: scanResult.translatableFiles,
        totalStrings: scanResult.totalStrings,
        durationMs: scanResult.durationMs
      };
    } catch (error) {
      console.error('[Main] Erro no scan:', error);
      return {
        canceled: false,
        error: (error as Error).message
      };
    }
  });

  // 9. Importar arquivos selecionados do scan
  ipcMain.handle('import-scanned-files', async (_event, files: TranslatableFile[]) => {
    if (!db) return { success: false, error: 'Banco de dados não inicializado' };
    
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO game_strings 
      (source_file, path_id, original_text, shielded_text)
      VALUES (?, ?, ?, ?)
    `);
    
    let totalImported = 0;
    
    db.exec('BEGIN TRANSACTION');
    
    try {
      for (const file of files) {
        const content = fs.readFileSync(file.path, 'utf-8');
        const strings = extractStringsFromFile(content, file.extension, file.name);
        
        for (const str of strings) {
          insertStmt.run(str.source_file, str.path_id, str.original_text, str.shielded_text);
          totalImported++;
        }
        
        if (mainWindow) {
          mainWindow.webContents.send('import-progress', {
            currentFile: file.name,
            imported: totalImported
          });
        }
      }
      
      db.exec('COMMIT');
      console.log(`[Main] ${totalImported} strings importadas de ${files.length} arquivos`);
      
      return { success: true, stringsImported: totalImported };
    } catch (error) {
      db.exec('ROLLBACK');
      console.error('[Main] Erro na importação:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 10. UABEA Integration - Scan e extração de arquivos .assets
  const uabeaConfig = {
    uabeaPath: path.join(app.getPath('userData'), 'tools', 'uabea', 'UABEAvalonia.exe'),
    tempOutputDir: path.join(app.getPath('temp'), 'uabea-extract')
  };
  
  const uabea = new UABEAIntegration(uabeaConfig);
  
  // 10.1 Verificar se UABEA está disponível
  ipcMain.handle('check-uabea', async () => {
    const available = await uabea.isAvailable();
    return { available, path: uabeaConfig.uabeaPath };
  });
  
  // 10.2 Configurar caminho do UABEA
  ipcMain.handle('set-uabea-path', async (_event, uabeaPath: string) => {
    try {
      uabea.setUABEAPath(uabeaPath);
      const available = await uabea.isAvailable();
      return { success: true, available };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
  
  // 10.3 Scan de arquivos .assets
  ipcMain.handle('scan-assets-files', async (_event, gamePath: string) => {
    try {
      const assetFiles = await uabea.scanAssetsFiles(gamePath);
      return {
        success: true,
        files: assetFiles,
        totalFiles: assetFiles.length
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
  
  // 10.4 Extrair textos de arquivos .assets - AGORA ABRE UABEA GUI
  ipcMain.handle('extract-assets-texts', async (_event, assetFiles: any[]) => {
    console.log('[Main] Abrindo UABEA GUI para', assetFiles.length, 'arquivos .assets');
    
    try {
      const result = await uabea.extractStrings(assetFiles, (progress) => {
        console.log('[Main] Progresso UABEA:', progress.percentage + '%', progress.currentFile);
        if (mainWindow) {
          mainWindow.webContents.send('uabea-progress', progress);
        }
      });
      
      // NOTA: A extração automática foi desativada porque arquivos .assets Unity
      // são binários complexos que requerem ferramentas especializadas.
      // O UABEA GUI foi aberto para extração manual.
      
      console.log('[Main] UABEA GUI aberto para', assetFiles.length, 'arquivos');
      
      // Retornar informação sobre como proceder
      return {
        success: true,
        stringsExtracted: 0,
        message: `UABEA GUI aberto para ${assetFiles.length} arquivo(s).\n\nINSTRUÇÕES:\n1. No UABEA, selecione o arquivo .assets\n2. Clique em 'Dump' ou 'Export' para extrair os textos\n3. Salve os arquivos exportados\n4. Use 'Adicionar Pasta' no Unity CAT Tool para importar`,
        requiresManualExtraction: true,
        errors: result.errors
      };
    } catch (error) {
      console.error('[Main] Erro ao abrir UABEA:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 11. AssetStudio Integration - Extração Automática Integrada
  const assetStudioConfig = {
    assetStudioPath: path.join(app.getPath('userData'), 'tools', 'assetstudio', 'AssetStudioCLI_net6_win_x64.exe'),
    tempOutputDir: path.join(app.getPath('temp'), 'assetstudio-extract')
  };
  
  const assetStudio = new AssetStudioIntegration(assetStudioConfig);
  
  // 11.1 Verificar se AssetStudio está disponível
  ipcMain.handle('check-assetstudio', async () => {
    const available = await assetStudio.isAvailable();
    return { available, path: assetStudioConfig.assetStudioPath };
  });
  
  // 11.2 Instalar AssetStudio automaticamente
  ipcMain.handle('install-assetstudio', async () => {
    try {
      const result = await assetStudio.installAssetStudio();
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
  
  // 11.3 Scan de arquivos .assets (usando AssetStudio)
  ipcMain.handle('scan-assets-files-assetstudio', async (_event, gamePath: string) => {
    try {
      const assetFiles = await assetStudio.scanAssetsFiles(gamePath);
      return {
        success: true,
        files: assetFiles,
        totalFiles: assetFiles.length
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
  
  // 11.4 Extração automática com AssetStudio CLI
  ipcMain.handle('extract-assets-texts-assetstudio', async (_event, assetFiles: any[]) => {
    console.log('[Main] Iniciando extração automática com AssetStudio CLI:', assetFiles.length, 'arquivos');
    
    try {
      const result = await assetStudio.extractStrings(assetFiles, (progress) => {
        console.log('[Main] Progresso AssetStudio:', progress.percentage + '%', progress.currentFile);
        if (mainWindow) {
          mainWindow.webContents.send('assetstudio-progress', progress);
        }
      });
      
      // Inserir strings extraídas no banco de dados
      if (result.extractedStrings.length > 0 && db) {
        const insertStmt = db.prepare(`
          INSERT OR IGNORE INTO game_strings 
          (source_file, path_id, original_text, shielded_text)
          VALUES (?, ?, ?, ?)
        `);
        
        db.exec('BEGIN TRANSACTION');
        
        try {
          for (const str of result.extractedStrings) {
            insertStmt.run(
              str.assetFile || 'AssetStudio_Extract',
              str.path_id,
              str.original_text,
              str.original_text
            );
          }
          
          db.exec('COMMIT');
          console.log(`[AssetStudio] ${result.extractedStrings.length} strings importadas no banco de dados`);
        } catch (err) {
          db.exec('ROLLBACK');
          console.error('[AssetStudio] Erro ao inserir no banco:', err);
          throw err;
        }
      }
      
      console.log('[Main] Extração AssetStudio completa:', result.totalStrings, 'strings extraídas');
      
      return {
        success: true,
        stringsExtracted: result.totalStrings,
        errors: result.errors,
        message: `${result.totalStrings} strings extraídas automaticamente com AssetStudio CLI!`
      };
    } catch (error) {
      console.error('[Main] Erro na extração AssetStudio:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 12. Deletar strings por arquivo
  ipcMain.handle('delete-strings-by-file', async (_event, sourceFile: string) => {
    if (!db) return { success: false, error: 'Banco de dados não inicializado' };
    
    try {
      const stmt = db.prepare('DELETE FROM game_strings WHERE source_file = ?');
      const result = stmt.run(sourceFile);
      console.log(`[Main] Deletadas ${result.changes} strings de ${sourceFile}`);
      return { success: true, deletedCount: result.changes };
    } catch (error) {
      console.error('[Main] Erro ao deletar strings:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 12. Limpar todo o banco de dados
  ipcMain.handle('clear-all-strings', async () => {
    if (!db) return { success: false, error: 'Banco de dados não inicializado' };
    
    try {
      const stmt = db.prepare('DELETE FROM game_strings');
      const result = stmt.run();
      console.log(`[Main] Banco de dados limpo. ${result.changes} strings deletadas`);
      return { success: true, deletedCount: result.changes };
    } catch (error) {
      console.error('[Main] Erro ao limpar banco:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 13. Traduzir tudo automaticamente (placeholder - requer integração com API de tradução)
  ipcMain.handle('translate-all', async (_event, targetLang: string = 'pt-BR') => {
    if (!db) return { success: false, error: 'Banco de dados não inicializado' };
    
    try {
      // Buscar todas as strings pendentes
      const stmt = db.prepare('SELECT * FROM game_strings WHERE status = ? OR translated_text IS NULL');
      const pendingStrings = stmt.all('pending') as any[];
      
      if (pendingStrings.length === 0) {
        return { success: true, translatedCount: 0, message: 'Nenhuma string pendente para traduzir' };
      }
      
      console.log(`[Main] Traduzindo ${pendingStrings.length} strings para ${targetLang}`);
      
      // AQUI você integraria com uma API de tradução (Google Translate, DeepL, etc.)
      // Por enquanto, apenas marca como "needs_review" para revisão manual
      const updateStmt = db.prepare('UPDATE game_strings SET status = ?, translated_text = ? WHERE id = ?');
      
      db.exec('BEGIN TRANSACTION');
      let translatedCount = 0;
      
      try {
        for (const str of pendingStrings) {
          // Placeholder: copiar texto original como tradução
          // Em produção, chamar API de tradução aqui
          const translatedText = `[${targetLang}] ${str.original_text}`;
          
          updateStmt.run('needs_review', translatedText, str.id);
          translatedCount++;
        }
        
        db.exec('COMMIT');
        console.log(`[Main] ${translatedCount} strings marcadas para revisão`);
        
        return { 
          success: true, 
          translatedCount, 
          message: `${translatedCount} strings processadas. NOTA: Integração com API de tradução necessária.` 
        };
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    } catch (error) {
      console.error('[Main] Erro na tradução:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  console.log('[Main] Handlers IPC configurados');
}

/**
 * Função auxiliar para extrair strings de arquivos JSON/CSV de tradução.
 * Suporta arquivos exportados do UABEA ou formatos similares.
 */
function importTranslationFile(filePath: string): Array<{
  source_file: string;
  path_id: string;
  original_text: string;
  shielded_text: string;
}> {
  const results: Array<{
    source_file: string;
    path_id: string;
    original_text: string;
    shielded_text: string;
  }> = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    
    // Tentar parse como JSON primeiro
    try {
      const jsonData = JSON.parse(content);
      
      // Formato do UABEA ou UnityCAT
      if (Array.isArray(jsonData)) {
        jsonData.forEach((item, index) => {
          const text = item.translated || item.text || item.original || item;
          if (typeof text === 'string') {
            results.push({
              source_file: fileName,
              path_id: item.path_id || item.id || `entry_${index}`,
              original_text: text,
              shielded_text: text
            });
          }
        });
      } else if (jsonData.translations && Array.isArray(jsonData.translations)) {
        // Formato com metadata
        jsonData.translations.forEach((item: any, index: number) => {
          const text = item.translated || item.text || item.original || item;
          if (typeof text === 'string') {
            results.push({
              source_file: fileName,
              path_id: item.path_id || item.id || `entry_${index}`,
              original_text: text,
              shielded_text: text
            });
          }
        });
      }
    } catch {
      // Não é JSON, tentar como CSV ou formato texto
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        
        // Tentar detectar formato CSV
        if (line.includes(',')) {
          const parts = line.split(',');
          const text = parts[parts.length - 1]?.replace(/^"|"$/g, '');
          if (text) {
            results.push({
              source_file: fileName,
              path_id: parts[0]?.replace(/^"|"$/g, '') || `line_${index}`,
              original_text: text,
              shielded_text: text
            });
          }
        } else if (line.includes('|')) {
          // Formato UABEA txt
          const parts = line.split('|');
          if (parts.length >= 2) {
            results.push({
              source_file: fileName,
              path_id: parts[0],
              original_text: parts.slice(1).join('|'),
              shielded_text: parts.slice(1).join('|')
            });
          }
        } else if (line.length > 0) {
          // Linha simples
          results.push({
            source_file: fileName,
            path_id: `line_${index}`,
            original_text: line,
            shielded_text: line
          });
        }
      });
    }
  } catch (error) {
    console.error(`[Main] Erro ao importar ${filePath}:`, error);
  }
  
  return results;
}

/**
 * Extrai strings de conteúdo de arquivo baseado na extensão.
 * Usado pela skill Unity Auto-Discovery para importação em lote.
 */
function extractStringsFromFile(
  content: string,
  extension: string,
  fileName: string
): Array<{
  source_file: string;
  path_id: string;
  original_text: string;
  shielded_text: string;
}> {
  const results: Array<{
    source_file: string;
    path_id: string;
    original_text: string;
    shielded_text: string;
  }> = [];

  switch (extension.toLowerCase()) {
    case '.json':
      try {
        const data = JSON.parse(content);
        const extractTexts = (obj: any, path: string = 'root') => {
          if (typeof obj === 'string') {
            results.push({
              source_file: fileName,
              path_id: path,
              original_text: obj,
              shielded_text: obj
            });
          } else if (Array.isArray(obj)) {
            obj.forEach((item, idx) => extractTexts(item, `${path}[${idx}]`));
          } else if (typeof obj === 'object' && obj !== null) {
            Object.entries(obj).forEach(([key, value]) => {
              extractTexts(value, `${path}.${key}`);
            });
          }
        };
        extractTexts(data);
      } catch {
        // Ignorar JSON inválido
      }
      break;

    case '.csv':
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (idx === 0) return; // Skip header
        const parts = line.split(',');
        if (parts.length >= 2) {
          const text = parts[parts.length - 1]?.replace(/^"|"$/g, '');
          if (text) {
            results.push({
              source_file: fileName,
              path_id: parts[0]?.replace(/^"|"$/g, '') || `row_${idx}`,
              original_text: text,
              shielded_text: text
            });
          }
        }
      });
      break;

    case '.xml':
    case '.xliff':
      const sourceMatches = content.match(/<source[^>]*>([^<]+)<\/source>/gi) || [];
      sourceMatches.forEach((match, idx) => {
        const text = match.replace(/<[^>]+>/g, '');
        if (text.trim()) {
          results.push({
            source_file: fileName,
            path_id: `trans_unit_${idx}`,
            original_text: text,
            shielded_text: text
          });
        }
      });
      break;

    case '.txt':
      const txtLines = content.split('\n');
      txtLines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        
        if (trimmed.includes('|')) {
          const parts = trimmed.split('|');
          if (parts.length >= 2) {
            results.push({
              source_file: fileName,
              path_id: parts[0],
              original_text: parts.slice(1).join('|'),
              shielded_text: parts.slice(1).join('|')
            });
          }
        } else {
          results.push({
            source_file: fileName,
            path_id: `line_${idx}`,
            original_text: trimmed,
            shielded_text: trimmed
          });
        }
      });
      break;
  }

  return results;
}

/**
 * Ciclo de vida da aplicação Electron.
 */
app.whenReady().then(() => {
  initializeDatabase();
  setupIpcHandlers();
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (db) {
    db.close();
    console.log('[Main] Banco de dados fechado');
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
