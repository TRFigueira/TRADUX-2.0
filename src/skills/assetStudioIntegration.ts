import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

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
}

export interface AssetStudioProgress {
  phase: string;
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

export interface AssetStudioConfig {
  assetStudioPath: string;
  tempOutputDir: string;
}

/**
 * AssetStudio CLI integration for Unity asset extraction
 */
export class AssetStudioIntegration extends EventEmitter {
  private config: AssetStudioConfig;
  private abortFlag = false;

  constructor(config: AssetStudioConfig) {
    super();
    this.config = config;
  }

  /**
   * Verifica se o AssetStudio CLI está disponível
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
   * Instala o AssetStudio CLI automaticamente
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
   * Escaneia arquivos .assets em uma pasta
   */
  async scanAssetsFiles(gamePath: string): Promise<{ success: boolean; files: AssetFile[]; error?: string }> {
    const assetsFiles: AssetFile[] = [];
    
    try {
      console.log('[AssetStudio] Escaneando arquivos .assets em:', gamePath);
      
      const walk = (dir: string) => {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            // Pular diretórios comuns que não contêm assets
            if (this.shouldSkipDirectory(fullPath)) {
              continue;
            }
            walk(fullPath);
          } else if (file.endsWith('.assets') || file.endsWith('.asset')) {
            const relativePath = path.relative(gamePath, fullPath);
            const fileSize = stat.size;
            
            const assetFile: AssetFile = {
              path: fullPath,
              name: file,
              size: fileSize,
              relativePath: relativePath,
              estimatedStrings: Math.max(1, Math.floor(fileSize / 1000))
            };
            
            assetsFiles.push(assetFile);
            console.log(`[AssetStudio] Encontrado: ${file} (${fileSize} bytes)`);
          }
        }
      };

      await walk(gamePath);
      return { success: true, files: assetsFiles.sort((a, b) => b.size - a.size) };
    } catch (error) {
      console.error('[AssetStudio] Erro ao escanear arquivos:', error);
      return { success: false, files: [], error: (error as Error).message };
    }
  }

  /**
   * Extrai textos usando UABEA existente com extração real
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

    console.log(`[UABEA] Iniciando extração real de ${assetFiles.length} arquivos`);

    this.emit('phase', 'extracting');

    try {
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
          console.log(`[UABEA] Extraindo textos de: ${assetFile.name}`);
          
          // Tentar ler textos diretamente do arquivo .assets
          const extractedTexts = await this.extractTextsFromAsset(assetFile);
          
          if (extractedTexts.length > 0) {
            result.extractedStrings.push(...extractedTexts);
            console.log(`[UABEA] ${assetFile.name}: ${extractedTexts.length} textos extraídos`);
          } else {
            console.log(`[UABEA] ${assetFile.name}: nenhum texto encontrado`);
          }
          
        } catch (error) {
          const errorMsg = `Erro com ${assetFile.name}: ${(error as Error).message}`;
          result.errors.push(errorMsg);
          console.error('[UABEA]', errorMsg);
        }
      }

      result.totalStrings = result.extractedStrings.length;
      result.durationMs = Date.now() - startTime;
      
      console.log(`[UABEA] Extração completa: ${result.totalStrings} textos extraídos de ${result.totalFiles} arquivos`);

    } catch (error) {
      console.error('[UABEA] Erro no processo:', error);
      result.errors.push((error as Error).message);
    }

    this.emit('phase', 'complete');
    return result;
  }

  /**
   * Extrai textos diretamente de um arquivo .assets
   */
  private async extractTextsFromAsset(assetFile: AssetFile): Promise<ExtractedString[]> {
    const strings: ExtractedString[] = [];
    
    try {
      // Tentar diferentes métodos de extração
      const extractedStrings = await this.tryMultipleExtractionMethods(assetFile);
      
      // Processar strings extraídas
      for (let i = 0; i < extractedStrings.length; i++) {
        const text = extractedStrings[i];
        
        // Filtrar strings vazias ou muito curtas
        if (!text || text.trim().length < 3) continue;
        
        // Filtrar strings que parecem ser código ou binário
        if (this.isLikelyBinaryText(text)) continue;
        
        // Filtrar strings duplicadas
        if (strings.some(s => s.original_text === text.trim())) continue;
        
        const extractedString: ExtractedString = {
          path_id: `${assetFile.name}_${i}`,
          original_text: text.trim(),
          assetFile: assetFile.name
        };
        
        strings.push(extractedString);
      }
      
      console.log(`[UABEA] Extraídos ${strings.length} textos válidos de ${assetFile.name}`);
      
    } catch (error) {
      console.error(`[UABEA] Erro ao extrair textos de ${assetFile.name}:`, error);
    }
    
    return strings;
  }

  /**
   * Tenta múltiplos métodos de extração de textos
   */
  private async tryMultipleExtractionMethods(assetFile: AssetFile): Promise<string[]> {
    const methods = [
      () => this.extractFromBinaryPattern(assetFile),
      () => this.extractFromUTF8Strings(assetFile),
      () => this.extractFromCommonPatterns(assetFile),
      () => this.extractFromDialoguePatterns(assetFile)
    ];

    for (const method of methods) {
      try {
        const result = await method();
        if (result && result.length > 0) {
          console.log(`[UABEA] Método de extração bem-sucedido para ${assetFile.name}: ${result.length} textos`);
          return result;
        }
      } catch (error) {
        console.log(`[UABEA] Método de extração falhou para ${assetFile.name}:`, error);
      }
    }

    return [];
  }

  /**
   * Extrai strings usando padrões binários comuns
   */
  private async extractFromBinaryPattern(assetFile: AssetFile): Promise<string[]> {
    const strings: string[] = [];
    
    try {
      const buffer = fs.readFileSync(assetFile.path);
      const text = buffer.toString('utf8', 0, Math.min(buffer.length, 200000)); // Ler primeiros 200KB
      
      // Procurar por strings legíveis entre caracteres não legíveis
      const matches = text.match(/[a-zA-Z0-9\s\.\,\!\?\;\:\-\_\(\)\[\]\{\}'"`]{8,}/g);
      
      if (matches) {
        for (const match of matches) {
          const cleanMatch = match.trim();
          if (cleanMatch.length >= 8 && this.isReadableText(cleanMatch)) {
            strings.push(cleanMatch);
          }
        }
      }
    } catch (error) {
      console.error('[UABEA] Erro na extração binária:', error);
    }
    
    return strings;
  }

  /**
   * Extrai strings UTF-8 do arquivo
   */
  private async extractFromUTF8Strings(assetFile: AssetFile): Promise<string[]> {
    const strings: string[] = [];
    
    try {
      const buffer = fs.readFileSync(assetFile.path);
      const text = buffer.toString('utf8');
      
      // Procurar por frases completas
      const sentences = text.match(/[^.!?]*[.!?]/g);
      
      if (sentences) {
        for (const sentence of sentences) {
          const cleanSentence = sentence.trim();
          if (cleanSentence.length >= 5 && this.isReadableText(cleanSentence)) {
            strings.push(cleanSentence);
          }
        }
      }
    } catch (error) {
      console.error('[UABEA] Erro na extração UTF-8:', error);
    }
    
    return strings;
  }

  /**
   * Extrai strings usando padrões comuns em jogos Unity
   */
  private async extractFromCommonPatterns(assetFile: AssetFile): Promise<string[]> {
    const strings: string[] = [];
    
    try {
      const buffer = fs.readFileSync(assetFile.path);
      const text = buffer.toString('utf8');
      
      // Padrões comuns em jogos
      const patterns = [
        /"[^"]{5,}"/g, // Strings entre aspas
        /'[^']{5,}'/g, // Strings entre apóstrofos
        /\b[A-Z][a-z]+\s+[a-z]{3,}\b/g, // Títulos com capitalização
        /\b\w{4,}\s+\w{4,}\b/g, // Palavras compostas
        /\b[A-Z][a-z]{3,}\b/g, // Palavras com capitalização
        /\d+\s*\w+\s*\w+/g, // Números seguidos de palavras
      ];
      
      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          for (const match of matches) {
            const cleanMatch = match.replace(/["']/g, '').trim();
            if (cleanMatch.length >= 4 && this.isReadableText(cleanMatch)) {
              strings.push(cleanMatch);
            }
          }
        }
      }
    } catch (error) {
      console.error('[UABEA] Erro na extração de padrões:', error);
    }
    
    return strings;
  }

  /**
   * Extrai strings usando padrões de diálogo
   */
  private async extractFromDialoguePatterns(assetFile: AssetFile): Promise<string[]> {
    const strings: string[] = [];
    
    try {
      const buffer = fs.readFileSync(assetFile.path);
      const text = buffer.toString('utf8');
      
      // Padrões específicos para diálogos
      const dialoguePatterns = [
        /"[^"]*\?[^"]*"/g, // Perguntas entre aspas
        /"[^"]*![^"]*"/g, // Exclamações entre aspas
        /"[^"]*\.\.\.[^"]*"/g, // Elipses entre aspas
        /"[^"]*:\s*[^"]*"/g, // Diálogos com dois pontos
        /\b\w+\s*:\s*"[^"]*"/g, // Nome seguido de diálogo
      ];
      
      for (const pattern of dialoguePatterns) {
        const matches = text.match(pattern);
        if (matches) {
          for (const match of matches) {
            const cleanMatch = match.replace(/["']/g, '').trim();
            if (cleanMatch.length >= 5 && this.isReadableText(cleanMatch)) {
              strings.push(cleanMatch);
            }
          }
        }
      }
    } catch (error) {
      console.error('[UABEA] Erro na extração de diálogos:', error);
    }
    
    return strings;
  }

  /**
   * Verifica se o texto é legível (não é código ou binário)
   */
  private isReadableText(text: string): boolean {
    // Verificar se tem uma proporção razoável de letras
    const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
    const totalChars = text.length;
    
    if (totalChars === 0) return false;
    
    const letterRatio = letterCount / totalChars;
    
    // Texto legível deve ter pelo menos 40% de letras
    if (letterRatio < 0.4) return false;
    
    // Verificar se não tem muitos caracteres especiais
    const specialCharCount = (text.match(/[^\w\s\.\,\!\?\;\:\-\_\(\)\[\]\{\}"']/g) || []).length;
    const specialCharRatio = specialCharCount / totalChars;
    
    // Não deve ter mais de 15% de caracteres especiais
    if (specialCharRatio > 0.15) return false;
    
    // Verificar se não é tudo maiúscula (pode ser código)
    const upperCount = (text.match(/[A-Z]/g) || []).length;
    const lowerCount = (text.match(/[a-z]/g) || []).length;
    
    if (upperCount > 0 && lowerCount === 0) return false;
    
    // Verificar se não é apenas números
    const numberCount = (text.match(/[0-9]/g) || []).length;
    if (numberCount === totalChars) return false;
    
    return true;
  }

  /**
   * Verifica se o texto parece ser binário ou código
   */
  private isLikelyBinaryText(text: string): boolean {
    // Verificar caracteres de controle
    if (/[\x00-\x1F\x7F]/.test(text)) return true;
    
    // Verificar sequências repetitivas (possível binário)
    if (/(.)\1{8,}/.test(text)) return true;
    
    // Verificar se tem muitos caracteres não imprimíveis
    const nonPrintableCount = (text.match(/[^\x20-\x7E\n\r\t]/g) || []).length;
    if (nonPrintableCount > text.length * 0.1) return true;
    
    return false;
  }

  /**
   * Verifica se deve pular um diretório durante o scan
   */
  private shouldSkipDirectory(dirPath: string): boolean {
    const dirName = path.basename(dirPath).toLowerCase();
    const skipDirs = [
      'node_modules',
      '.git',
      '.vscode',
      '.idea',
      'bin',
      'obj',
      'temp',
      'tmp',
      'cache',
      'logs'
    ];
    
    return skipDirs.includes(dirName);
  }

  /**
   * Aborta extração em andamento.
   */
  abort(): void {
    this.abortFlag = true;
    this.emit('aborted');
  }
}
