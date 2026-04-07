import * as fs from 'fs-extra';
import * as path from 'path';
import { TranslationMemoryDB, GameStringRecord } from '../db/tmDatabase';
import { unshieldText, TagDictionary, UnshieldResult } from '../regex_shield/unshield';

/**
 * Módulo Repacker - Reempacotamento de Traduções
 * 
 * Este serviço orquestra a exportação final do jogo traduzido:
 * 1. Lê strings aprovadas da Translation Memory
 * 2. Aplica unshield para restaurar tags Unity
 * 3. Gera arquivos de saída em formato compatível (JSON/CSV/UABEA)
 * 4. Cria relatório de exportação
 * 
 * Design principles:
 * - Nunca sobrescreve arquivos originais
 * - Output em pasta separada output_build/
 * - Relatórios detalhados de sucesso/falha
 */

/**
 * Formato de exportação suportado.
 */
export type ExportFormat = 'json' | 'csv' | 'uabea';

/**
 * Estado de progresso da exportação.
 */
export interface ExportProgress {
  /** Total de strings a processar */
  total: number;
  /** Strings processadas */
  processed: number;
  /** Strings com sucesso */
  successful: number;
  /** Strings com erro */
  failed: number;
  /** Porcentagem completa */
  percentage: number;
  /** String atual em processamento */
  currentString?: string;
  /** Fase atual */
  phase: 'reading' | 'unshielding' | 'writing' | 'complete';
}

/**
 * Resultado da exportação de uma string individual.
 */
export interface StringExportResult {
  id: number;
  sourceFile: string;
  pathId: string;
  originalText: string;
  translatedText: string;
  finalText: string;
  unshieldResult: UnshieldResult;
  success: boolean;
  error?: string;
}

/**
 * Relatório final de exportação.
 */
export interface ExportReport {
  /** Timestamp da exportação */
  timestamp: string;
  /** Formato utilizado */
  format: ExportFormat;
  /** Pasta de saída */
  outputPath: string;
  /** Total de strings processadas */
  totalStrings: number;
  /** Strings exportadas com sucesso */
  successfulExports: number;
  /** Strings com falha */
  failedExports: number;
  /** Lista de falhas */
  failures: Array<{ id: number; error: string }>;
  /** Arquivos gerados */
  generatedFiles: string[];
  /** Duração em milissegundos */
  durationMs: number;
}

/**
 * Configuração de exportação.
 */
export interface RepackerConfig {
  /** Formato de saída */
  format?: ExportFormat;
  /** Pasta de saída (default: ./output_build) */
  outputDir?: string;
  /** Status mínimo para exportação (default: translated) */
  minStatus?: 'translated' | 'reviewed' | 'approved';
  /** Callback de progresso */
  onProgress?: (progress: ExportProgress) => void;
}

/**
 * Serviço de reempacotamento de traduções.
 */
export class RepackerService {
  private db: TranslationMemoryDB;
  private outputDir: string;
  private format: ExportFormat;
  private minStatus: string;

  constructor(db: TranslationMemoryDB, config: RepackerConfig = {}) {
    this.db = db;
    this.format = config.format || 'json';
    this.outputDir = config.outputDir || path.resolve('./output_build');
    this.minStatus = config.minStatus || 'translated';
  }

  /**
   * Executa a exportação completa das traduções.
   * 
   * Fluxo:
   * 1. Garante pasta de saída existe
   * 2. Lê strings aprovadas da base de dados
   * 3. Para cada string: aplica unshield
   * 4. Escreve ficheiros de saída
   * 5. Gera relatório final
   */
  public async exportTranslations(
    onProgress?: (progress: ExportProgress) => void
  ): Promise<ExportReport> {
    const startTime = Date.now();
    
    console.log('[Repacker] Iniciando exportação...');
    console.log(`[Repacker] Formato: ${this.format}, Output: ${this.outputDir}`);

    // 1. Preparar pasta de saída
    await fs.ensureDir(this.outputDir);
    
    // Limpar exports anteriores (manter pasta)
    const existingFiles = await fs.readdir(this.outputDir);
    for (const file of existingFiles) {
      await fs.remove(path.join(this.outputDir, file));
    }

    // 2. Ler strings do banco de dados
    const progress: ExportProgress = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      percentage: 0,
      phase: 'reading'
    };

    onProgress?.(progress);

    // Query para buscar strings traduzidas
    const strings = this.getStringsForExport();
    progress.total = strings.length;
    
    console.log(`[Repacker] ${strings.length} strings encontradas para exportação`);

    // 3. Processar cada string
    const results: StringExportResult[] = [];
    progress.phase = 'unshielding';

    for (let i = 0; i < strings.length; i++) {
      const stringItem = strings[i];
      
      progress.currentString = `${stringItem.source_file}#${stringItem.path_id}`;
      progress.processed = i;
      progress.percentage = Math.round((i / strings.length) * 100);
      onProgress?.(progress);

      try {
        const result = await this.processString(stringItem);
        results.push(result);
        
        if (result.success) {
          progress.successful++;
        } else {
          progress.failed++;
        }
      } catch (error) {
        progress.failed++;
        results.push({
          id: stringItem.id!,
          sourceFile: stringItem.source_file,
          pathId: stringItem.path_id,
          originalText: stringItem.original_text,
          translatedText: stringItem.translated_text || '',
          finalText: '',
          unshieldResult: {
            restoredText: '',
            restoredTokens: [],
            missingTokens: [],
            success: false
          },
          success: false,
          error: (error as Error).message
        });
      }

      // Pequena pausa para não bloquear event loop
      if (i % 10 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    progress.processed = strings.length;
    progress.percentage = 100;
    progress.phase = 'writing';
    onProgress?.(progress);

    // 4. Escrever arquivos de saída
    const generatedFiles = await this.writeOutputFiles(results);

    progress.phase = 'complete';
    onProgress?.(progress);

    // 5. Gerar relatório
    const report: ExportReport = {
      timestamp: new Date().toISOString(),
      format: this.format,
      outputPath: this.outputDir,
      totalStrings: strings.length,
      successfulExports: progress.successful,
      failedExports: progress.failed,
      failures: results
        .filter(r => !r.success)
        .map(r => ({ id: r.id, error: r.error || 'Unknown error' })),
      generatedFiles,
      durationMs: Date.now() - startTime
    };

    // Salvar relatório
    await fs.writeJSON(
      path.join(this.outputDir, 'export_report.json'),
      report,
      { spaces: 2 }
    );

    console.log(`[Repacker] Exportação concluída em ${report.durationMs}ms`);
    console.log(`[Repacker] Sucessos: ${report.successfulExports}, Falhas: ${report.failedExports}`);

    return report;
  }

  /**
   * Busca strings do banco de dados que estão prontas para exportação.
   */
  private getStringsForExport(): GameStringRecord[] {
    const stmt = this.db.getDatabase().prepare(`
      SELECT * FROM game_strings 
      WHERE translated_text IS NOT NULL 
      AND status IN ('translated', 'reviewed', 'approved')
      ORDER BY source_file, id
    `);
    return stmt.all() as GameStringRecord[];
  }

  /**
   * Processa uma string individual: aplica unshield.
   */
  private async processString(stringItem: GameStringRecord): Promise<StringExportResult> {
    // Reconstruir dicionário de tags a partir do shielded_text
    // Na prática, este dicionário seria guardado durante a extração
    const tagDict = this.rebuildTagDictionary(
      stringItem.original_text,
      stringItem.shielded_text
    );

    // Aplicar unshield
    const unshieldResult = unshieldText(stringItem.translated_text || '', tagDict);

    return {
      id: stringItem.id!,
      sourceFile: stringItem.source_file,
      pathId: stringItem.path_id,
      originalText: stringItem.original_text,
      translatedText: stringItem.translated_text || '',
      finalText: unshieldResult.restoredText,
      unshieldResult,
      success: unshieldResult.success
    };
  }

  /**
   * Reconstrói o dicionário de tags comparando texto original com shielded.
   * 
   * Esta é uma abordagem simplificada. Em produção, o dicionário
   * deveria ser guardado no banco de dados durante a extração.
   */
  private rebuildTagDictionary(original: string, shielded: string): TagDictionary {
    const tags: Record<string, string> = {};
    
    // Encontrar tokens no texto shielded
    const tokenRegex = /\[(TAG|VAR|BIND)_\d+\]/g;
    const tokens = shielded.match(tokenRegex) || [];
    
    // Para cada token, tentar encontrar a tag correspondente no original
    // Esta é uma heurística simplificada
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      // Patterns comuns Unity
      if (token.startsWith('[TAG_')) {
        // Procurar tags <color>, <b>, <i>, <size>
        const colorMatch = original.match(/<color=[^>]+>.*?<\/color>/);
        if (colorMatch && !tags[token]) {
          tags[token] = colorMatch[0];
        } else {
          const simpleTag = original.match(/<(b|i|size)[^>]*>.*?<\/\1>/);
          if (simpleTag && !tags[token]) {
            tags[token] = simpleTag[0];
          }
        }
      } else if (token.startsWith('[VAR_')) {
        // Procurar variáveis {0}, {playerName}
        const varMatch = original.match(/\{[^}]+\}/);
        if (varMatch) {
          tags[token] = varMatch[0];
        }
      } else if (token.startsWith('[BIND_')) {
        // Procurar bindings [JUMP], [ACTION]
        const bindMatch = original.match(/\[[A-Z_]+\]/);
        if (bindMatch) {
          tags[token] = bindMatch[0];
        }
      }
    }
    
    return {
      tags,
      extractedAt: new Date().toISOString()
    };
  }

  /**
   * Escreve os arquivos de saída no formato especificado.
   */
  private async writeOutputFiles(results: StringExportResult[]): Promise<string[]> {
    const generatedFiles: string[] = [];
    
    switch (this.format) {
      case 'json':
        await this.writeJsonOutput(results);
        generatedFiles.push('translations.json');
        break;
        
      case 'csv':
        await this.writeCsvOutput(results);
        generatedFiles.push('translations.csv');
        break;
        
      case 'uabea':
        await this.writeUabeaOutput(results);
        generatedFiles.push('translations.txt');
        break;
    }
    
    return generatedFiles;
  }

  /**
   * Exporta em formato JSON estruturado.
   */
  private async writeJsonOutput(results: StringExportResult[]): Promise<void> {
    const output = {
      metadata: {
        exportedAt: new Date().toISOString(),
        format: 'unity-cat-tool',
        version: '1.0.0'
      },
      translations: results
        .filter(r => r.success)
        .map(r => ({
          id: r.id,
          sourceFile: r.sourceFile,
          pathId: r.pathId,
          original: r.originalText,
          translated: r.finalText,
          status: 'exported'
        }))
    };
    
    await fs.writeJSON(
      path.join(this.outputDir, 'translations.json'),
      output,
      { spaces: 2 }
    );
  }

  /**
   * Exporta em formato CSV para importação em outras ferramentas.
   */
  private async writeCsvOutput(results: StringExportResult[]): Promise<void> {
    const csvLines = [
      'ID,Source File,Path ID,Original,Translated,Status'
    ];
    
    for (const result of results) {
      if (result.success) {
        csvLines.push(
          `"${result.id}","${result.sourceFile}","${result.pathId}","${result.originalText.replace(/"/g, '""')}","${result.finalText.replace(/"/g, '""')}","exported"`
        );
      }
    }
    
    await fs.writeFile(
      path.join(this.outputDir, 'translations.csv'),
      csvLines.join('\n'),
      'utf-8'
    );
  }

  /**
   * Exporta em formato compatível com UABEA (Unity Asset Bundle Extractor).
   * 
   * Formato simplificado: uma linha por string com identificador.
   */
  private async writeUabeaOutput(results: StringExportResult[]): Promise<void> {
    const lines: string[] = [
      '# Unity CAT Tool Export - UABEA Format',
      `# Exported: ${new Date().toISOString()}`,
      '# Format: source_file|path_id|translated_text',
      ''
    ];
    
    // Agrupar por arquivo de origem
    const byFile = new Map<string, StringExportResult[]>();
    for (const result of results) {
      if (!result.success) continue;
      
      const list = byFile.get(result.sourceFile) || [];
      list.push(result);
      byFile.set(result.sourceFile, list);
    }
    
    for (const [sourceFile, strings] of byFile) {
      lines.push(`## ${sourceFile}`);
      
      for (const str of strings) {
        lines.push(`${str.pathId}|${str.finalText}`);
      }
      
      lines.push(''); // Linha em branco entre arquivos
    }
    
    await fs.writeFile(
      path.join(this.outputDir, 'translations.txt'),
      lines.join('\n'),
      'utf-8'
    );
  }
}

/**
 * Factory function para criar instância do RepackerService.
 */
export function createRepackerService(
  db: TranslationMemoryDB,
  config?: RepackerConfig
): RepackerService {
  return new RepackerService(db, config);
}
