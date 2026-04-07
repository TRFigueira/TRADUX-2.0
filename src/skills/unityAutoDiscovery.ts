import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

/**
 * Skill: unity-auto-discovery
 * 
 * Executa uma varredura profunda (Deep Scan) em diretórios de jogos da Unity
 * para localizar, filtrar semanticamente e extrair arquivos traduzíveis.
 */

// Tipos de arquivos traduzíveis
export type TranslatableFileType = '.csv' | '.json' | '.xliff' | '.xml' | '.txt';

// Prioridade de pastas para scan
const PRIORITY_FOLDERS = [
  'StreamingAssets',
  'Resources',
  'i18n',
  'Localization',
  'Lang',
  'Languages',
  'Text',
  'Dialogue',
  'Dialogues',
  'Story',
  'Narrative'
];

// Extensões suportadas
const SUPPORTED_EXTENSIONS: TranslatableFileType[] = ['.csv', '.json', '.xliff', '.xml', '.txt'];

// Arquivos/padrões de sistema que devem ser ignorados
const SYSTEM_FILE_PATTERNS = [
  /lib_burst/i,
  /steamworks/i,
  /steam_api/i,
  /dll/i,
  /debug/i,
  /burst/i,
  /generated/i,
  /assembly/i,
  /mcs/i,
  /unityengine/i,
  /system/i,
  /mono/i,
  /csharp/i,
  /mscorlib/i,
  /netstandard/i,
  /newtonsoft/i,
  /json\.net/i,
  /textmeshpro/i,
  /tmpro/i,
  /_DOTween/i,
  /_Plugins_/i,
  /DoNotShip/i
];

// Pastas de sistema para ignorar
const SYSTEM_FOLDERS = [
  'Plugins',
  'Managed',
  'MonoBleedingEdge',
  'BurstDebugInformation',
  'DoNotShip',
  '_Data',
  '_Data',
  'Data',
  'il2cpp'
];

// Padrões semânticos que indicam arquivo traduzível
const TRANSLATABLE_PATTERNS = [
  /Key/i,
  /SourceString/i,
  /Text/i,
  /Dialogue/i,
  /Message/i,
  /Description/i,
  /Name/i,
  /Title/i,
  /Content/i,
  /\{[^}]+\}/, // Smart Strings {variable}
  /\$\{[^}]+\}/, // Template literals ${var}
  /%[sdif]/, // printf-style formatting
  /\{\d+\}/, // Indexed placeholders {0}, {1}
];

export interface ScanProgress {
  phase: 'scanning' | 'analyzing' | 'importing' | 'complete';
  currentFile: string;
  filesFound: number;
  filesProcessed: number;
  stringsDiscovered: number;
  stringsImported: number;
  percentage: number;
}

export interface TranslatableFile {
  path: string;
  relativePath: string;
  name: string;
  extension: TranslatableFileType;
  size: number;
  priority: number; // 0-100, maior = mais prioritário
  isTranslatable: boolean;
  confidence: number; // 0-1
  preview?: string;
  stringsCount?: number;
}

export interface ScanResult {
  rootPath: string;
  files: TranslatableFile[];
  totalFiles: number;
  translatableFiles: number;
  totalStrings: number;
  durationMs: number;
}

export class UnityAutoDiscovery extends EventEmitter {
  private scannedPaths: Set<string> = new Set();
  private abortFlag: boolean = false;

  /**
   * Executa varredura profunda em diretório de jogo Unity.
   */
  async scanGameDirectory(
    rootPath: string,
    onProgress?: (progress: ScanProgress) => void
  ): Promise<ScanResult> {
    const startTime = Date.now();
    this.scannedPaths.clear();
    this.abortFlag = false;

    const result: ScanResult = {
      rootPath,
      files: [],
      totalFiles: 0,
      translatableFiles: 0,
      totalStrings: 0,
      durationMs: 0
    };

    // Fase 1: Scanning - Encontrar todos os arquivos candidatos
    this.emit('phase', 'scanning');
    const candidateFiles = await this.findCandidateFiles(rootPath);
    result.totalFiles = candidateFiles.length;

    // Fase 2: Analyzing - Triagem semântica
    this.emit('phase', 'analyzing');
    for (let i = 0; i < candidateFiles.length; i++) {
      if (this.abortFlag) break;

      const filePath = candidateFiles[i];
      const fileInfo = await this.analyzeFile(filePath, rootPath);
      
      if (fileInfo.isTranslatable) {
        result.files.push(fileInfo);
        result.translatableFiles++;
        result.totalStrings += fileInfo.stringsCount || 0;
      }

      // Reportar progresso
      if (onProgress && i % 10 === 0) {
        onProgress({
          phase: 'analyzing',
          currentFile: fileInfo.name,
          filesFound: result.totalFiles,
          filesProcessed: i + 1,
          stringsDiscovered: result.totalStrings,
          stringsImported: 0,
          percentage: Math.round(((i + 1) / candidateFiles.length) * 33) + 33
        });
      }
    }

    // Ordenar por prioridade (descendente)
    result.files.sort((a, b) => b.priority - a.priority);

    result.durationMs = Date.now() - startTime;
    this.emit('phase', 'complete');

    return result;
  }

  /**
   * Encontra todos os arquivos candidatos (extensões suportadas).
   * Prioriza pastas importantes de jogos Unity.
   */
  private async findCandidateFiles(rootPath: string): Promise<string[]> {
    const candidates: string[] = [];
    const priorityCandidates: string[] = [];

    const walk = async (dir: string, depth: number = 0) => {
      if (this.abortFlag) return;
      if (depth > 10) return; // Limite de profundidade

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            // Verificar se é pasta prioritária
            const isPriority = PRIORITY_FOLDERS.some(
              pf => entry.name.toLowerCase().includes(pf.toLowerCase())
            );

            // Pular pastas de sistema/cache
            if (this.shouldSkipDirectory(entry.name)) continue;

            if (isPriority) {
              // Scan prioritário primeiro
              await this.scanDirectory(fullPath, priorityCandidates);
            } else {
              await walk(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase() as TranslatableFileType;
            if (SUPPORTED_EXTENSIONS.includes(ext)) {
              if (this.isInPriorityFolder(fullPath)) {
                priorityCandidates.push(fullPath);
              } else {
                candidates.push(fullPath);
              }
            }
          }
        }
      } catch (error) {
        // Ignorar erros de permissão
      }
    };

    await walk(rootPath);

    // Retornar prioritários primeiro
    return [...priorityCandidates, ...candidates];
  }

  /**
   * Scaneia um diretório específico (para pastas prioritárias).
   */
  private async scanDirectory(dir: string, output: string[]) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, output);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase() as TranslatableFileType;
          if (SUPPORTED_EXTENSIONS.includes(ext)) {
            output.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Ignorar erros
    }
  }

  /**
   * Verifica se arquivo está em pasta prioritária.
   */
  private isInPriorityFolder(filePath: string): boolean {
    const normalized = filePath.toLowerCase();
    return PRIORITY_FOLDERS.some(pf => normalized.includes(pf.toLowerCase()));
  }

  /**
   * Pastas que devem ser ignoradas.
   */
  private shouldSkipDirectory(name: string): boolean {
    const skipList = [
      'node_modules',
      '.git',
      '__pycache__',
      'Library',
      'Temp',
      'Obj',
      'Logs',
      'Packages',
      'ProjectSettings',
      'UserSettings',
      'Build',
      'Builds',
      'bin',
      'obj'
    ];
    return skipList.includes(name) || 
           name.startsWith('.') ||
           SYSTEM_FOLDERS.some(sf => name.toLowerCase().includes(sf.toLowerCase()));
  }

  /**
   * Verifica se nome de arquivo é de sistema (não traduzível).
   */
  private isSystemFile(fileName: string): boolean {
    const lowerName = fileName.toLowerCase();
    return SYSTEM_FILE_PATTERNS.some(pattern => pattern.test(lowerName));
  }

  /**
   * Analisa arquivo para determinar se é traduzível.
   * Faro da IA - triagem semântica.
   */
  private async analyzeFile(filePath: string, rootPath: string): Promise<TranslatableFile> {
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase() as TranslatableFileType;
    const name = path.basename(filePath);
    const relativePath = path.relative(rootPath, filePath);

    // Calcular prioridade base
    let priority = 50;
    let confidence = 0.5;
    let stringsCount = 0;
    let preview: string | undefined;
    let isTranslatable = false;

    // Verificar se é arquivo de sistema - rejeitar imediatamente
    if (this.isSystemFile(name)) {
      return {
        path: filePath,
        relativePath,
        name,
        extension: ext,
        size: stats.size,
        priority: 0,
        isTranslatable: false,
        confidence: 0,
        stringsCount: 0
      };
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const previewContent = content.slice(0, 2000); // Primeiros 2KB

      // Análise por tipo de arquivo
      switch (ext) {
        case '.json':
          const jsonResult = this.analyzeJSON(previewContent);
          confidence = jsonResult.confidence;
          stringsCount = jsonResult.count;
          isTranslatable = jsonResult.isTranslatable;
          preview = jsonResult.preview;
          break;

        case '.csv':
          const csvResult = this.analyzeCSV(previewContent);
          confidence = csvResult.confidence;
          stringsCount = csvResult.count;
          isTranslatable = csvResult.isTranslatable;
          preview = csvResult.preview;
          break;

        case '.xml':
        case '.xliff':
          const xmlResult = this.analyzeXML(previewContent);
          confidence = xmlResult.confidence;
          stringsCount = xmlResult.count;
          isTranslatable = xmlResult.isTranslatable;
          preview = xmlResult.preview;
          break;

        case '.txt':
          const txtResult = this.analyzeTXT(previewContent);
          confidence = txtResult.confidence;
          stringsCount = txtResult.count;
          isTranslatable = txtResult.isTranslatable;
          preview = txtResult.preview;
          break;
      }

      // Ajustar prioridade baseada em fatores
      if (this.isInPriorityFolder(filePath)) priority += 30;
      if (confidence > 0.8) priority += 15;
      if (name.toLowerCase().includes('localization')) priority += 20;
      if (name.toLowerCase().includes('dialogue')) priority += 15;
      if (name.toLowerCase().includes('text')) priority += 10;

    } catch (error) {
      // Arquivo não pode ser lido como texto
      confidence = 0;
      isTranslatable = false;
    }

    return {
      path: filePath,
      relativePath,
      name,
      extension: ext,
      size: stats.size,
      priority: Math.min(100, priority),
      isTranslatable,
      confidence,
      preview,
      stringsCount
    };
  }

  /**
   * Analisa conteúdo JSON.
   */
  private analyzeJSON(content: string): { confidence: number; count: number; isTranslatable: boolean; preview?: string } {
    try {
      const data = JSON.parse(content);
      let textFields: string[] = [];

      const extractTexts = (obj: any, depth: number = 0) => {
        if (depth > 5) return;

        if (typeof obj === 'string') {
          textFields.push(obj);
        } else if (Array.isArray(obj)) {
          obj.forEach(item => extractTexts(item, depth + 1));
        } else if (typeof obj === 'object' && obj !== null) {
          Object.entries(obj).forEach(([key, value]) => {
            // Priorizar campos com nomes semânticos
            if (typeof value === 'string' && this.isTextField(key)) {
              textFields.push(value);
            } else {
              extractTexts(value, depth + 1);
            }
          });
        }
      };

      extractTexts(data);

      // Calcular confiança
      const hasTranslatablePattern = textFields.some(t => 
        TRANSLATABLE_PATTERNS.some(p => p.test(t))
      );

      const avgLength = textFields.reduce((sum, t) => sum + t.length, 0) / (textFields.length || 1);
      const hasDialogueLikeText = textFields.some(t => t.length > 20 && /[.!?]/.test(t));

      let confidence = 0.3;
      if (hasTranslatablePattern) confidence += 0.3;
      if (hasDialogueLikeText) confidence += 0.2;
      if (avgLength > 10) confidence += 0.1;
      if (textFields.length > 5) confidence += 0.1;

      return {
        confidence: Math.min(1, confidence),
        count: textFields.length,
        isTranslatable: confidence > 0.5 && textFields.length > 0,
        preview: textFields.slice(0, 3).join(' | ')
      };
    } catch {
      return { confidence: 0, count: 0, isTranslatable: false };
    }
  }

  /**
   * Analisa conteúdo CSV.
   */
  private analyzeCSV(content: string): { confidence: number; count: number; isTranslatable: boolean; preview?: string } {
    const lines = content.split('\n').slice(0, 50); // Primeiras 50 linhas
    if (lines.length < 2) return { confidence: 0, count: 0, isTranslatable: false };

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    // Verificar se headers indicam arquivo de tradução
    const hasKeyColumn = headers.some(h => /key|id|name/i.test(h));
    const hasTextColumn = headers.some(h => /text|string|source|dialogue|message/i.test(h));
    const hasLanguageColumn = headers.some(h => /lang|locale|en|pt|translation/i.test(h));

    let textCount = 0;
    const previewTexts: string[] = [];

    for (let i = 1; i < lines.length && i < 10; i++) {
      const cells = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      cells.forEach((cell, idx) => {
        const header = headers[idx] || '';
        if (this.isTextField(header) && cell.length > 0) {
          textCount++;
          if (previewTexts.length < 3) previewTexts.push(cell.slice(0, 100));
        }
      });
    }

    let confidence = 0.3;
    if (hasKeyColumn) confidence += 0.2;
    if (hasTextColumn) confidence += 0.3;
    if (hasLanguageColumn) confidence += 0.2;
    if (textCount > 0) confidence += 0.1;

    return {
      confidence: Math.min(1, confidence),
      count: lines.length - 1,
      isTranslatable: confidence > 0.5,
      preview: previewTexts.join(' | ')
    };
  }

  /**
   * Analisa conteúdo XML/XLIFF.
   */
  private analyzeXML(content: string): { confidence: number; count: number; isTranslatable: boolean; preview?: string } {
    const isXliff = content.includes('xliff') || content.includes('<file ');
    const hasTransUnit = content.includes('<trans-unit') || content.includes('<source>');
    const hasTarget = content.includes('<target>');

    // Contar unidades de tradução
    const sourceMatches = content.match(/<source[^>]*>([^<]+)<\/source>/gi) || [];
    const texts = sourceMatches.map(m => m.replace(/<[^>]+>/g, '')).filter(t => t.trim());

    let confidence = 0.3;
    if (isXliff) confidence += 0.3;
    if (hasTransUnit) confidence += 0.2;
    if (hasTarget) confidence += 0.1;
    if (texts.length > 5) confidence += 0.1;

    return {
      confidence: Math.min(1, confidence),
      count: texts.length,
      isTranslatable: confidence > 0.5,
      preview: texts.slice(0, 3).join(' | ')
    };
  }

  /**
   * Analisa conteúdo TXT (formato UABEA ou simples).
   */
  private analyzeTXT(content: string): { confidence: number; count: number; isTranslatable: boolean; preview?: string } {
    const lines = content.split('\n').filter(l => l.trim());
    
    // Detectar formato UABEA (path_id|texto)
    const uabeaPattern = lines.filter(l => /^[^|]+\|.+/.test(l));
    const isUabea = uabeaPattern.length > lines.length * 0.5;

    // Detectar formato simples (uma linha = uma string)
    const meaningfulLines = lines.filter(l => l.trim().length > 5);
    const hasDialogue = meaningfulLines.some(l => /[.!?]/.test(l) && l.length > 20);

    let confidence = 0.3;
    let count = 0;

    if (isUabea) {
      confidence += 0.4;
      count = uabeaPattern.length;
    } else if (meaningfulLines.length > 5) {
      confidence += 0.2;
      if (hasDialogue) confidence += 0.2;
      count = meaningfulLines.length;
    }

    return {
      confidence: Math.min(1, confidence),
      count,
      isTranslatable: confidence > 0.5 && count > 0,
      preview: meaningfulLines.slice(0, 3).join(' | ')
    };
  }

  /**
   * Verifica se nome de campo indica conteúdo traduzível.
   */
  private isTextField(fieldName: string): boolean {
    const textPatterns = [
      /text/i,
      /dialogue/i,
      /message/i,
      /description/i,
      /name/i,
      /title/i,
      /content/i,
      /source/i,
      /translated/i,
      /string/i,
      /value/i
    ];
    return textPatterns.some(p => p.test(fieldName));
  }

  /**
   * Aborta scan em andamento.
   */
  abort(): void {
    this.abortFlag = true;
    this.emit('aborted');
  }
}

export default UnityAutoDiscovery;
