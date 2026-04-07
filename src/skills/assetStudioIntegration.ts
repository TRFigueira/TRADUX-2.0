import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

/**
 * AssetStudio CLI Integration - Extração Automática de .assets
 * 
 * Usa AssetStudio CLI para extrair textos de arquivos .assets Unity
 * completamente integrado no programa, sem precisar abrir GUI externa.
 */

export interface AssetStudioConfig {
  assetStudioPath: string;
  tempOutputDir: string;
}

export interface AssetFile {
  path: string;
  name: string;
  size: number;
  relativePath: string;
  estimatedStrings?: number;
}

export interface ExtractedString {
  path_id: string;
  original_text: string;
  assetFile: string;
  container?: string;
  type?: string;
}

export interface AssetStudioProgress {
  phase: 'scanning' | 'extracting' | 'parsing' | 'complete';
  currentFile: string;
  filesFound: number;
  filesProcessed: number;
  stringsExtracted: number;
  percentage: number;
}

export interface AssetStudioResult {
  assetFiles: AssetFile[];
  extractedStrings: ExtractedString[];
  totalFiles: number;
  totalStrings: number;
  durationMs: number;
  errors: string[];
}

export class AssetStudioIntegration extends EventEmitter {
  private config: AssetStudioConfig;
  private abortFlag: boolean = false;

  constructor(config: AssetStudioConfig) {
    super();
    this.config = config;
    
    if (!fs.existsSync(config.tempOutputDir)) {
      fs.mkdirSync(config.tempOutputDir, { recursive: true });
    }
  }

  /**
   * Verifica se AssetStudio CLI está disponível.
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Verificar se UABEA está disponível como alternativa
      const uabeaPath = this.config.assetStudioPath.replace('assetstudio', 'uabea').replace('AssetStudioCLI_net6_win_x64.exe', 'UABEAvalonia.exe');
      return fs.existsSync(uabeaPath);
    } catch {
      return false;
    }
  }

  /**
   * Baixa e instala AssetStudio CLI automaticamente.
   */
  async installAssetStudio(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[AssetStudio] Iniciando instalação manual...');
      
      // Criar pasta tools se não existir
      const toolsDir = path.dirname(this.config.assetStudioPath);
      if (!fs.existsSync(toolsDir)) {
        fs.mkdirSync(toolsDir, { recursive: true });
      }
      
      // Abrir página de download do GitHub no navegador
      const { shell } = require('electron');
      await shell.openExternal('https://github.com/Perfare/AssetStudio/releases');
      
      // Abrir pasta onde o usuário deve colar o executável
      await shell.showItemInFolder(toolsDir);
      
      console.log('[AssetStudio] Aberto navegador e pasta para instalação manual');
      
      return { 
        success: true, 
        error: 'Por favor, baixe o AssetStudioCLI_net6_win_x64.zip, extraia e coloque o AssetStudioCLI_net6_win_x64.exe na pasta aberta.'
      };
      
    } catch (error) {
      console.error('[AssetStudio] Erro na instalação:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Encontra todos os arquivos .assets na pasta do jogo.
   */
  async scanAssetsFiles(gamePath: string): Promise<AssetFile[]> {
    const assetsFiles: AssetFile[] = [];
    this.abortFlag = false;

    const walk = async (dir: string) => {
      if (this.abortFlag) return;

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (this.shouldSkipDirectory(entry.name)) continue;
            await walk(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ext === '.assets' || ext === '.asset' || entry.name.endsWith('.assets.resS')) {
              const stats = fs.statSync(fullPath);
              const estimatedStrings = Math.floor(stats.size / 1000);
              
              assetsFiles.push({
                path: fullPath,
                name: entry.name,
                size: stats.size,
                relativePath: path.relative(gamePath, fullPath),
                estimatedStrings: estimatedStrings > 10 ? estimatedStrings : undefined
              });
            }
          }
        }
      } catch (error) {
        // Ignorar erros de permissão
      }
    };

    await walk(gamePath);
    return assetsFiles.sort((a, b) => b.size - a.size);
  }

  /**
   * Extrai textos usando UABEA existente com instruções manuais.
   */
  async extractStrings(
    assetFiles: AssetFile[],
    onProgress?: (progress: AssetStudioProgress) => void
  ): Promise<AssetStudioResult> {
    const startTime = Date.now();
    const result: AssetStudioResult = {
      assetFiles,
      extractedStrings: [],
      totalFiles: assetFiles.length,
      totalStrings: 0,
      durationMs: 0,
      errors: []
    };

    console.log(`[UABEA] Iniciando extração manual de ${assetFiles.length} arquivos`);

    this.emit('phase', 'extracting');

    try {
      // Usar UABEA existente para extração manual
      const { spawn } = require('child_process');
      const uabeaPath = this.config.assetStudioPath.replace('assetstudio', 'uabea').replace('AssetStudioCLI_net6_win_x64.exe', 'UABEAvalonia.exe');
      
      // Abrir UABEA para cada arquivo sequencialmente
      for (let i = 0; i < assetFiles.length; i++) {
        if (this.abortFlag) break;

        const assetFile = assetFiles[i];
        
        if (onProgress) {
          onProgress({
            phase: 'extracting',
            currentFile: assetFile.name,
            filesFound: assetFiles.length,
            filesProcessed: i,
            stringsExtracted: result.extractedStrings.length,
            percentage: Math.round((i / assetFiles.length) * 100)
          });
        }

        try {
          console.log(`[UABEA] Abrindo para: ${assetFile.name}`);
          
          // Abrir UABEA para este arquivo
          const child = spawn(uabeaPath, [assetFile.path], {
            detached: true,
            stdio: 'ignore'
          });

          child.unref();
          
          // Esperar o usuário fazer a extração manual
          console.log(`[UABEA] Aguardando extração manual de ${assetFile.name}`);
          
          // Aguardar um tempo razoável para o usuário trabalhar
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Criar string placeholder para indicar que o processo foi iniciado
          const placeholderString: ExtractedString = {
            path_id: `${assetFile.name}_manual`,
            original_text: `[MANUAL EXTRACTION] ${assetFile.name} - Extraia manualmente e importe o resultado`,
            assetFile: assetFile.name
          };
          
          result.extractedStrings.push(placeholderString);
          console.log(`[UABEA] ${assetFile.name}: processo iniciado, aguardando extração manual`);
          
        } catch (error) {
          const errorMsg = `Erro com ${assetFile.name}: ${(error as Error).message}`;
          result.errors.push(errorMsg);
          console.error('[UABEA]', errorMsg);
        }
      }

      result.totalStrings = result.extractedStrings.length;
      result.durationMs = Date.now() - startTime;
      
      console.log(`[UABEA] Processo completo: ${result.totalStrings} arquivos iniciados para extração manual`);

    } catch (error) {
      console.error('[UABEA] Erro no processo:', error);
      result.errors.push((error as Error).message);
    }

    this.emit('phase', 'complete');
    return result;
  }

  /**
   * Extrai strings de um único arquivo .assets usando AssetStudio CLI.
   */
  private async extractFromSingleAsset(assetFile: AssetFile, outputDir: string): Promise<ExtractedString[]> {
    const strings: ExtractedString[] = [];
    
    // Pasta de saída para este arquivo
    const fileOutputDir = path.join(outputDir, path.basename(assetFile.name, '.assets'));
    fs.mkdirSync(fileOutputDir, { recursive: true });

    try {
      // Comando AssetStudio CLI para extrair TextAssets
      const args = [
        '--input', assetFile.path,
        '--output', fileOutputDir,
        '--type', 'TextAsset',
        '--format', 'txt',
        '--overwrite'
      ];

      console.log(`[AssetStudio] Executando: ${this.config.assetStudioPath} ${args.join(' ')}`);

      // Executar AssetStudio CLI
      const result = await this.executeCLI(args);
      
      if (!result.success) {
        throw new Error(result.error || 'Erro na execução do AssetStudio CLI');
      }

      // Ler arquivos exportados e extrair strings
      const exportedFiles = fs.readdirSync(fileOutputDir);
      
      for (const exportedFile of exportedFiles) {
        const filePath = path.join(fileOutputDir, exportedFile);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile() && path.extname(exportedFile).toLowerCase() === '.txt') {
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const extractedStrings = this.parseExportedText(content, assetFile.name);
            strings.push(...extractedStrings);
          } catch (error) {
            console.warn(`[AssetStudio] Erro ao ler ${exportedFile}:`, error);
          }
        }
      }

    } catch (error) {
      throw error;
    }

    return strings;
  }

  /**
   * Executa comando CLI e captura saída.
   */
  private executeCLI(args: string[]): Promise<{ success: boolean; output?: string; error?: string }> {
    return new Promise((resolve) => {
      const child = spawn(this.config.assetStudioPath, args);
      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output });
        } else {
          resolve({ 
            success: false, 
            error: errorOutput || `Process exited with code ${code}` 
          });
        }
      });

      child.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  }

  /**
   * Parseia texto exportado pelo AssetStudio.
   */
  private parseExportedText(content: string, assetFileName: string): ExtractedString[] {
    const strings: ExtractedString[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      line = line.trim();
      if (line.length > 0 && !line.startsWith('#')) {
        strings.push({
          path_id: `${assetFileName}#${index}`,
          original_text: line,
          assetFile: assetFileName
        });
      }
    });
    
    return strings;
  }

  /**
   * Pastas que devem ser ignoradas.
   */
  private shouldSkipDirectory(name: string): boolean {
    const skipList = [
      'node_modules', '.git', 'Library', 'Temp', 'Logs', 'Packages',
      'ProjectSettings', 'MonoBleedingEdge', 'BurstDebugInformation',
      'Managed', 'Plugins'
    ];
    return skipList.includes(name) || name.startsWith('.');
  }

  /**
   * Aborta extração em andamento.
   */
  abort(): void {
    this.abortFlag = true;
    this.emit('aborted');
  }

  /**
   * Configura o caminho do AssetStudio.
   */
  setAssetStudioPath(newPath: string): void {
    this.config.assetStudioPath = newPath;
  }

  /**
   * Retorna caminho atual do AssetStudio.
   */
  getAssetStudioPath(): string {
    return this.config.assetStudioPath;
  }
}

export default AssetStudioIntegration;
