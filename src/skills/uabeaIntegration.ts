import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

/**
 * Módulo UABEA Integration - Versão GUI
 * 
 * Abre o UABEA GUI para extração manual dos arquivos .assets.
 * O usuário extrai os textos no UABEA e depois importa os arquivos exportados.
 */

export interface UABEAConfig {
  uabeaPath: string;
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

export interface UABEAProgress {
  phase: 'scanning' | 'extracting' | 'parsing' | 'complete';
  currentFile: string;
  filesFound: number;
  filesProcessed: number;
  stringsExtracted: number;
  percentage: number;
}

export interface UABEAResult {
  assetFiles: AssetFile[];
  extractedStrings: ExtractedString[];
  totalFiles: number;
  totalStrings: number;
  durationMs: number;
  errors: string[];
}

export class UABEAIntegration extends EventEmitter {
  private config: UABEAConfig;
  private abortFlag: boolean = false;

  constructor(config: UABEAConfig) {
    super();
    this.config = config;
    
    if (!fs.existsSync(config.tempOutputDir)) {
      fs.mkdirSync(config.tempOutputDir, { recursive: true });
    }
  }

  /**
   * Verifica se UABEA está disponível.
   */
  async isAvailable(): Promise<boolean> {
    try {
      return fs.existsSync(this.config.uabeaPath);
    } catch {
      return false;
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
   * Abre o UABEA GUI com o arquivo .assets selecionado.
   */
  async openUABEA(assetFile: AssetFile): Promise<{ success: boolean; error?: string }> {
    try {
      // Verificar se executável existe
      if (!fs.existsSync(this.config.uabeaPath)) {
        console.error(`[UABEA] ERRO: Executável não encontrado em ${this.config.uabeaPath}`);
        return { success: false, error: `UABEA não encontrado em ${this.config.uabeaPath}` };
      }

      // Verificar se arquivo .assets existe
      if (!fs.existsSync(assetFile.path)) {
        console.error(`[UABEA] ERRO: Arquivo não encontrado: ${assetFile.path}`);
        return { success: false, error: `Arquivo não encontrado: ${assetFile.path}` };
      }

      console.log(`[UABEA] Abrindo GUI para: ${assetFile.name}`);
      console.log(`[UABEA] Caminho UABEA: ${this.config.uabeaPath}`);
      console.log(`[UABEA] Caminho arquivo: ${assetFile.path}`);
      
      const child = spawn(this.config.uabeaPath, [assetFile.path], {
        detached: true,
        stdio: 'ignore'
      });
      
      // Capturar erros do processo
      child.on('error', (err) => {
        console.error(`[UABEA] Erro ao spawn processo: ${err.message}`);
      });

      child.on('exit', (code) => {
        if (code !== 0) {
          console.error(`[UABEA] Processo saiu com código ${code}`);
        }
      });
      
      child.unref();
      
      console.log(`[UABEA] Processo iniciado (PID: ${child.pid})`);
      
      return { success: true };
    } catch (error) {
      console.error(`[UABEA] Erro ao abrir: ${(error as Error).message}`);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Extrai textos abrindo UABEA GUI para cada arquivo.
   */
  async extractStrings(
    assetFiles: AssetFile[],
    onProgress?: (progress: UABEAProgress) => void
  ): Promise<UABEAResult> {
    const startTime = Date.now();
    const result: UABEAResult = {
      assetFiles,
      extractedStrings: [],
      totalFiles: assetFiles.length,
      totalStrings: 0,
      durationMs: 0,
      errors: []
    };

    console.log(`[UABEA] Iniciando extração de ${assetFiles.length} arquivos`);
    console.log(`[UABEA] Caminho do executável: ${this.config.uabeaPath}`);

    this.emit('phase', 'extracting');

    for (let i = 0; i < assetFiles.length; i++) {
      if (this.abortFlag) break;

      const assetFile = assetFiles[i];
      
      try {
        if (onProgress) {
          onProgress({
            phase: 'extracting',
            currentFile: assetFile.name,
            filesFound: assetFiles.length,
            filesProcessed: i,
            stringsExtracted: 0,
            percentage: Math.round((i / assetFiles.length) * 100)
          });
        }

        const openResult = await this.openUABEA(assetFile);
        
        if (!openResult.success) {
          result.errors.push(`Erro ao abrir ${assetFile.name}: ${openResult.error}`);
        }

        // Delay maior entre arquivos (2 segundos)
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        const errorMsg = `Erro com ${assetFile.name}: ${(error as Error).message}`;
        result.errors.push(errorMsg);
        console.error('[UABEA]', errorMsg);
      }
    }

    result.durationMs = Date.now() - startTime;
    this.emit('phase', 'complete');
    
    console.log(`[UABEA] Extração completa. Erros: ${result.errors.length}`);

    return result;
  }

  private shouldSkipDirectory(name: string): boolean {
    const skipList = [
      'node_modules', '.git', 'Library', 'Temp', 'Logs', 'Packages',
      'ProjectSettings', 'MonoBleedingEdge', 'BurstDebugInformation',
      'Managed', 'Plugins'
    ];
    return skipList.includes(name) || name.startsWith('.');
  }

  abort(): void {
    this.abortFlag = true;
    this.emit('aborted');
  }

  setUABEAPath(newPath: string): void {
    this.config.uabeaPath = newPath;
  }

  getUABEAPath(): string {
    return this.config.uabeaPath;
  }
}

export default UABEAIntegration;
