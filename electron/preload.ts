import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload Script - Ponte segura entre Main e Renderer
 * 
 * Este arquivo é executado no contexto isolado do Electron e expõe
 * APIs controladas à aplicação React, garantindo segurança e
 * isolamento do processo principal.
 */

/**
 * Interface das APIs expostas ao Renderer.
 * Tipagem estrita para TypeScript.
 */
export interface ElectronAPI {
  // Buscar lista de arquivos disponíveis
  fetchFiles: () => Promise<Array<{
    id: string;
    name: string;
    count: { count: number };
  }>>;
  
  // Buscar strings de um arquivo específico com paginação
  fetchStringsByFile: (fileId: string, page?: number, pageSize?: number) => Promise<
    Array<{
      id: number;
      source_file: string;
      path_id: string;
      original_text: string;
      shielded_text: string;
      translated_text: string | null;
      status: string;
    }> | {
      strings: Array<{
        id: number;
        source_file: string;
        path_id: string;
        original_text: string;
        shielded_text: string;
        translated_text: string | null;
        status: string;
      }>;
      total: number;
      page: number;
      pageSize: number;
    }
  >;
  
  // Salvar tradução de uma string
  translateString: (id: number, translatedText: string) => Promise<unknown>;
  
  // Pesquisa fuzzy na Translation Memory
  searchFuzzy: (query: string, limit?: number) => Promise<Array<{
    id: number;
    original_text: string;
    translated_text: string;
    rank: number;
    similarity: number;
  }>>;
  
  // Verificação de qualidade
  runQACheck: (id: number) => Promise<{
    passed: boolean;
    warnings: string[];
    originalLength?: number;
    translatedLength?: number;
  }>;
  
  // Importar pasta do jogo Unity
  importUnityGame: () => Promise<{
    success: boolean;
    gamePath?: string;
    error?: string;
  }>;
  
  // Exportação de traduções (Repacker)
  exportTranslations: (format?: 'json' | 'csv' | 'uabea') => Promise<{
    success: boolean;
    report?: {
      timestamp: string;
      format: string;
      outputPath: string;
      totalStrings: number;
      successfulExports: number;
      failedExports: number;
      generatedFiles: string[];
      durationMs: number;
    };
    error?: string;
  }>;
  
  // Listener de progresso de exportação
  onExportProgress: (callback: (progress: {
    total: number;
    processed: number;
    percentage: number;
    phase: string;
    successful: number;
    failed: number;
  }) => void) => () => void;
  
  // === TOOL MANAGEMENT ===
  toolsList: () => Promise<{ success: boolean; tools: any[]; error?: string }>;
  toolsInstall: (toolName: string) => Promise<{ success: boolean; error?: string }>;
  onToolsProgress: (callback: (progress: {
    toolName: string;
    phase: string;
    percentage: number;
    message: string;
    error?: string;
  }) => void) => () => void;
  
  // Selecionar e importar pasta com arquivos de tradução
  selectFolder: () => Promise<{
    canceled: boolean;
    folderPath?: string;
    filesFound?: number;
    stringsImported?: number;
  }>;
  
  // Skill: Unity Auto-Discovery - Deep Scan de jogos Unity
  scanUnityGame: (gamePath: string) => Promise<{
    gamePath?: string;
    files?: Array<{
      path: string;
      relativePath: string;
      name: string;
      extension: string;
      size: number;
      priority: number;
      isTranslatable: boolean;
      confidence: number;
      preview?: string;
      stringsCount?: number;
    }>;
    totalFiles?: number;
    translatableFiles?: number;
    totalStrings?: number;
    durationMs?: number;
    error?: string;
  }>;
  
  // Importar arquivos selecionados do scan
  importScannedFiles: (files: Array<{
    path: string;
    relativePath: string;
    name: string;
    extension: string;
    size: number;
    priority: number;
    isTranslatable: boolean;
    confidence: number;
    preview?: string;
    stringsCount?: number;
  }>) => Promise<{
    success: boolean;
    stringsImported?: number;
    error?: string;
  }>;
  
  // Listener para progresso de scan
  onScanProgress: (callback: (progress: {
    phase: string;
    currentFile: string;
    filesFound: number;
    filesProcessed: number;
    stringsDiscovered: number;
    stringsImported: number;
    percentage: number;
  }) => void) => () => void;
  
  // Listener para progresso de importação
  onImportProgress: (callback: (progress: {
    currentFile: string;
    imported: number;
  }) => void) => () => void;
  
  // UABEA Integration
  checkUABEA: () => Promise<{ available: boolean; path: string }>;
  setUABEAPath: (uabeaPath: string) => Promise<{ success: boolean; available?: boolean; error?: string }>;
  scanAssetsFiles: (gamePath: string) => Promise<{ success: boolean; files?: any[]; totalFiles?: number; error?: string }>;
  extractAssetsTexts: (assetFiles: any[]) => Promise<{ success: boolean; stringsExtracted?: number; errors?: string[]; error?: string }>;
  onUABEAProgress: (callback: (progress: {
    phase: string;
    currentFile: string;
    filesFound: number;
    filesProcessed: number;
    stringsExtracted: number;
    percentage: number;
  }) => void) => () => void;

  // Deletar strings
  deleteStringsByFile: (sourceFile: string) => Promise<{ success: boolean; deletedCount?: number; error?: string }>;
  clearAllStrings: () => Promise<{ success: boolean; deletedCount?: number; error?: string }>;

  // Traduzir tudo
  translateAll: (targetLang?: string) => Promise<{ success: boolean; translatedCount?: number; message?: string; error?: string }>;

  // AssetStudio CLI - Extração Automática Integrada
  checkAssetStudio: () => Promise<{ available: boolean; path: string }>;
  installAssetStudio: () => Promise<{ success: boolean; error?: string }>;
  scanAssetsFilesAssetStudio: (gamePath: string) => Promise<{ success: boolean; files: any[]; totalFiles: number; error?: string }>;
  extractAssetsTextsAssetStudio: (assetFiles: any[]) => Promise<{ success: boolean; stringsExtracted: number; errors: string[]; message?: string; error?: string }>;
  onAssetStudioProgress: (callback: (progress: any) => void) => (() => void);
}

/**
 * APIs expostas através do contextBridge.
 * 
 * O contextBridge garante que apenas estas APIs específicas são
 * acessíveis ao código React, mantendo o isolamento de segurança.
 */
const api: ElectronAPI = {
  /**
   * Buscar lista de arquivos únicos do banco de dados.
   * Retorna arquivos com contagem de strings.
   */
  fetchFiles: () => ipcRenderer.invoke('fetch-files'),

  /**
   * Buscar strings de um arquivo específico com paginação.
   * @param fileId - Identificador do arquivo (source_file)
   * @param page - Número da página (default: 1)
   * @param pageSize - Tamanho da página (default: 1000)
   */
  fetchStringsByFile: (fileId: string, page: number = 1, pageSize: number = 1000) => 
    ipcRenderer.invoke('fetch-strings-by-file', fileId, page, pageSize),

  /**
   * Salvar tradução de uma string no banco de dados.
   * @param id - ID da string
   * @param translatedText - Texto traduzido
   */
  translateString: (id: number, translatedText: string) => 
    ipcRenderer.invoke('translate-string', id, translatedText),

  /**
   * Pesquisa fuzzy na Translation Memory para sugestões.
   * @param query - Texto a pesquisar
   * @param limit - Número máximo de resultados (default: 5)
   */
  searchFuzzy: (query: string, limit: number = 5) => 
    ipcRenderer.invoke('search-fuzzy', query, limit),

  /**
   * Executar verificação de qualidade numa tradução.
   * @param id - ID da string a verificar
   */
  runQACheck: (id: number) => 
    ipcRenderer.invoke('run-qa-check', id),

  /**
   * Exportar traduções para arquivos de build.
   * @param format - Formato de exportação (json, csv, uabea)
   */
  exportTranslations: (format: 'json' | 'csv' | 'uabea' = 'json') => 
    ipcRenderer.invoke('export-translations', format),

  /**
   * Listener para progresso de exportação.
   * @param callback - Função chamada quando há atualização de progresso
   * @returns Função para remover o listener
   */
  onExportProgress: (callback) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('export-progress', handler);
    return () => ipcRenderer.removeListener('export-progress', handler);
  },

  /**
   * Importar pasta do jogo Unity.
   * @returns Resultado da seleção com caminho da pasta
   */
  importUnityGame: () => ipcRenderer.invoke('import-unity-game'),

  /**
   * Abrir dialog para selecionar pasta e importar arquivos de tradução.
   * @returns Resultado da importação com estatísticas
   */
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  /**
   * Skill: Unity Auto-Discovery - Deep Scan de jogos Unity.
   * @param gamePath - Pasta do jogo Unity para scanear
   * @returns Resultado do scan com arquivos encontrados
   */
  scanUnityGame: (gamePath: string) => ipcRenderer.invoke('scan-unity-game', gamePath),

  /**
   * Importar arquivos selecionados do scan para o banco de dados.
   * @param files - Lista de arquivos para importar
   * @returns Resultado da importação
   */
  importScannedFiles: (files: Array<any>) => 
    ipcRenderer.invoke('import-scanned-files', files),

  /**
   * Listener para progresso de scan Unity.
   * @param callback - Função chamada quando há atualização de progresso
   * @returns Função para remover o listener
   */
  onScanProgress: (callback) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('scan-progress', handler);
    return () => ipcRenderer.removeListener('scan-progress', handler);
  },

  /**
   * Listener para progresso de importação de arquivos scaneados.
   * @param callback - Função chamada quando há atualização de progresso
   * @returns Função para remover o listener
   */
  onImportProgress: (callback) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('import-progress', handler);
    return () => ipcRenderer.removeListener('import-progress', handler);
  },

  /**
   * UABEA: Verificar se está instalado e configurado.
   * @returns Status de disponibilidade e caminho
   */
  checkUABEA: () => ipcRenderer.invoke('check-uabea'),

  /**
   * UABEA: Configurar caminho do executável.
   * @param uabeaPath - Caminho completo para UABEA.exe
   * @returns Resultado da configuração
   */
  setUABEAPath: (uabeaPath: string) => ipcRenderer.invoke('set-uabea-path', uabeaPath),

  /**
   * UABEA: Scan de arquivos .assets na pasta do jogo.
   * @param gamePath - Pasta do jogo Unity
   * @returns Lista de arquivos .assets encontrados
   */
  scanAssetsFiles: (gamePath: string) => ipcRenderer.invoke('scan-assets-files', gamePath),

  /**
   * UABEA: Extrair textos dos arquivos .assets selecionados.
   * @param assetFiles - Lista de arquivos .assets para processar
   * @returns Resultado da extração
   */
  extractAssetsTexts: (assetFiles: any[]) => ipcRenderer.invoke('extract-assets-texts', assetFiles),

  /**
   * UABEA: Listener para progresso de extração.
   * @param callback - Função chamada quando há atualização
   * @returns Função para remover o listener
   */
  onUABEAProgress: (callback) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('uabea-progress', handler);
    return () => ipcRenderer.removeListener('uabea-progress', handler);
  },

  /**
   * Deletar todas as strings de um arquivo específico.
   * @param sourceFile - Nome do arquivo fonte
   * @returns Resultado da deleção
   */
  deleteStringsByFile: (sourceFile: string) => 
    ipcRenderer.invoke('delete-strings-by-file', sourceFile),

  /**
   * Limpar todo o banco de dados (deletar todas as strings).
   * @returns Resultado da operação
   */
  clearAllStrings: () => ipcRenderer.invoke('clear-all-strings'),

  /**
   * Traduzir todas as strings pendentes automaticamente.
   * @param targetLang - Código do idioma de destino (default: pt-BR)
   * @returns Resultado da tradução
   */
  translateAll: (targetLang?: string) => ipcRenderer.invoke('translate-all', targetLang),

  /**
   * AssetStudio: Verificar se está instalado e disponível.
   * @returns Status de disponibilidade e caminho
   */
  checkAssetStudio: () => ipcRenderer.invoke('check-assetstudio'),

  /**
   * AssetStudio: Instalar automaticamente o AssetStudio CLI.
   * @returns Resultado da instalação
   */
  installAssetStudio: () => ipcRenderer.invoke('install-assetstudio'),

  /**
   * AssetStudio: Scan de arquivos .assets na pasta do jogo.
   * @param gamePath - Pasta do jogo Unity
   * @returns Lista de arquivos .assets encontrados
   */
  scanAssetsFilesAssetStudio: (gamePath: string) => 
    ipcRenderer.invoke('scan-assets-files-assetstudio', gamePath),

  /**
   * AssetStudio: Extrair textos automaticamente dos arquivos .assets.
   * @param assetFiles - Lista de arquivos .assets para processar
   * @returns Resultado da extração automática
   */
  extractAssetsTextsAssetStudio: (assetFiles: any[]) => 
    ipcRenderer.invoke('extract-assets-texts-assetstudio', assetFiles),

  /**
   * AssetStudio: Listener para progresso de extração.
   * @param callback - Função chamada quando há atualização
   * @returns Função para remover o listener
   */
  onAssetStudioProgress: (callback) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('assetstudio-progress', handler);
    return () => ipcRenderer.removeListener('assetstudio-progress', handler);
  },

  // === TOOL MANAGEMENT ===
  /**
   * Listar ferramentas externas disponíveis e seu status.
   * @returns Lista de ferramentas com status de instalação
   */
  toolsList: () => {
    console.log('[Preload] toolsList called');
    const result = ipcRenderer.invoke('tools:list');
    console.log('[Preload] toolsList result:', result);
    return result;
  },

  /**
   * Instalar uma ferramenta específica.
   * @param toolName - Nome da ferramenta (AssetStudioCLI, UABEA)
   * @returns Resultado da instalação
   */
  toolsInstall: (toolName: string) => ipcRenderer.invoke('tools:install', toolName),

  /**
   * Listener para progresso de instalação de ferramentas.
   * @param callback - Função chamada quando há atualização
   * @returns Função para remover o listener
   */
  onToolsProgress: (callback) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('tools:progress', handler);
    return () => ipcRenderer.removeListener('tools:progress', handler);
  }
};

// Expor APIs ao contexto do Renderer via window.api
console.log('[Preload] Exposing API:', Object.keys(api));
contextBridge.exposeInMainWorld('api', api);
console.log('[Preload] API exposed to window.api');

/**
 * Declaração de tipo para o ambiente global.
 * Permite TypeScript reconhecer window.api.
 */
declare global {
  interface Window {
    api: ElectronAPI;
  }
}
