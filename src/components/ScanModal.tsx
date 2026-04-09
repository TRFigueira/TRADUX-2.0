import { useState, useEffect, useCallback } from 'react';
import { X, FolderSearch, FileText, Check, Loader2, ChevronRight, ChevronDown, HardDrive, Gamepad2, Package, Settings, AlertTriangle, Download } from 'lucide-react';

interface ScannedFile {
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
}

interface ScanResult {
  gamePath: string;
  files: ScannedFile[];
  totalFiles: number;
  translatableFiles: number;
  totalStrings: number;
  durationMs: number;
}

interface AssetFile {
  path: string;
  name: string;
  size: number;
  relativePath: string;
  estimatedStrings?: number;
}

interface ScanProgress {
  phase: string;
  currentFile: string;
  filesFound: number;
  filesProcessed: number;
  stringsDiscovered: number;
  stringsImported: number;
  percentage: number;
}

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  scanning: 'Escaneando diretórios...',
  analyzing: 'Analisando arquivos...',
  importing: 'Importando para banco de dados...',
  extracting: 'Extraindo textos...',
  complete: 'Concluído!'
};

export function ScanModal({ isOpen, onClose, onImportComplete }: ScanModalProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  
  // AssetStudio states (replacing UABEA)
  const [assetFiles, setAssetFiles] = useState<AssetFile[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [assetStudioStatus, setAssetStudioStatus] = useState<{ available: boolean; path: string } | null>(null);
  const [isInstallingAssetStudio, setIsInstallingAssetStudio] = useState(false);

  // Setup listeners
  useEffect(() => {
    if (!isOpen) return;

    const removeScanListener = window.electronAPI?.onScanProgress?.((p) => {
      setProgress(p);
    });

    const removeImportListener = window.electronAPI?.onImportProgress?.((p) => {
      // Progresso de importação
    });

    const removeAssetStudioListener = window.electronAPI?.onAssetStudioProgress?.((p) => {
      setProgress(p);
    });

    // Verificar status AssetStudio
    checkAssetStudioStatus();

    return () => {
      removeScanListener();
      removeImportListener();
      removeAssetStudioListener();
    };
  }, [isOpen]);

  const checkAssetStudioStatus = async () => {
    try {
      const status = await window.electronAPI.checkAssetStudio();
      setAssetStudioStatus(status);
      
      // Se UABEA estiver disponível, mostrar como instalado
      if (status.available) {
        console.log('UABEA detectado e pronto para uso!');
      }
    } catch (error) {
      console.error('Erro ao verificar AssetStudio:', error);
    }
  };

  const installAssetStudio = async () => {
    setIsInstallingAssetStudio(true);
    try {
      const result = await window.electronAPI.installAssetStudio();
      if (result.success) {
        // Mostrar instruções detalhadas
        alert(
          'INSTALAÇÃO MANUAL DO ASSETSTUDIO CLI\n\n' +
          '1. Uma página do GitHub foi aberta no seu navegador\n' +
          '2. Procure por "AssetStudioCLI_net6_win_x64.zip"\n' +
          '3. Clique para baixar o arquivo\n' +
          '4. Extraia o arquivo .zip\n' +
          '5. Copie o arquivo "AssetStudioCLI_net6_win_x64.exe"\n' +
          '6. Cole na pasta que foi aberta automaticamente\n' +
          '7. Volte ao programa e clique em "Verificar Status"\n\n' +
          'A pasta de destino já está aberta para facilitar!'
        );
        await checkAssetStudioStatus();
      } else {
        setError(result.error || 'Erro ao iniciar instalação');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao instalar AssetStudio');
    } finally {
      setIsInstallingAssetStudio(false);
    }
  };

  const handleStartScan = useCallback(async () => {
    setIsScanning(true);
    setProgress(null);
    setResult(null);
    setError(null);
    setSelectedFiles(new Set());
    setExpandedFiles(new Set());
    setAssetFiles([]);
    setSelectedAssets(new Set());

    try {
      // Primeiro, obter o caminho do jogo selecionado
      const importResult = await window.electronAPI.importUnityGame();
      
      if (!importResult.success || !importResult.gamePath) {
        setError('Nenhuma pasta de jogo selecionada');
        return;
      }

      // Agora fazer o scan com o caminho correto
      const scanResult = await window.electronAPI.scanUnityGame(importResult.gamePath);
      
      if (!scanResult.gamePath) {
        setError('Scan cancelado ou pasta inválida');
        return;
      }

      const resultData: ScanResult = {
        gamePath: scanResult.gamePath,
        files: scanResult.files || [],
        totalFiles: scanResult.totalFiles || 0,
        translatableFiles: scanResult.translatableFiles || 0,
        totalStrings: scanResult.totalStrings || 0,
        durationMs: scanResult.durationMs || 0
      };

      setResult(resultData);
      setSelectedFiles(new Set());
      setExpandedFiles(new Set());

      // Se não há arquivos traduzíveis, tentar scan de .assets com AssetStudio
      if (resultData.translatableFiles === 0 && assetStudioStatus?.available) {
        try {
          const assetScanResult = await window.electronAPI.scanAssetsFilesAssetStudio(resultData.gamePath);
          if (assetScanResult.success) {
            setAssetFiles(assetScanResult.files);
          }
        } catch (error) {
          console.error('Erro no scan de .assets:', error);
        }
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsScanning(false);
      setProgress(null);
    }
  }, [assetStudioStatus]);

  const handleImport = async () => {
    if (selectedFiles.size === 0) return;
    
    setIsImporting(true);
    setProgress({
      phase: 'importing',
      currentFile: '',
      filesFound: selectedFiles.size,
      filesProcessed: 0,
      stringsDiscovered: 0,
      stringsImported: 0,
      percentage: 0
    });

    try {
      if (!result) {
        setError('Nenhum resultado de scan disponível');
        return;
      }
      
      const filesToImport = result.files.filter(f => selectedFiles.has(f.path));
      const importResult = await window.electronAPI.importScannedFiles(filesToImport);

      if (importResult.success) {
        onImportComplete();
        onClose();
      } else {
        setError(importResult.error || 'Erro na importação');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro na importação');
    } finally {
      setIsImporting(false);
      setProgress(null);
    }
  };

  const toggleFileSelection = (path: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const toggleFileExpand = (path: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (!result) return;
    setSelectedFiles(new Set(result.files.map(f => f.path)));
  };

  const deselectAll = () => {
    setSelectedFiles(new Set());
  };

  const toggleAssetSelection = (path: string) => {
    setSelectedAssets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const selectAllAssets = () => {
    setSelectedAssets(new Set(assetFiles.map(f => f.path)));
  };

  const deselectAllAssets = () => {
    setSelectedAssets(new Set());
  };

  const handleExtractWithAssetStudio = async () => {
    if (selectedAssets.size === 0) return;
    
    setIsImporting(true);
    setProgress({
      phase: 'extracting',
      currentFile: '',
      filesFound: selectedAssets.size,
      filesProcessed: 0,
      stringsDiscovered: 0,
      stringsImported: 0,
      percentage: 0
    });

    try {
      const filesToExtract = assetFiles.filter(f => selectedAssets.has(f.path));
      const extractResult = await window.electronAPI.extractAssetsTextsAssetStudio(filesToExtract);

      if (extractResult.success) {
        onImportComplete();
        onClose();
      } else {
        setError(extractResult.error || 'Erro na extração');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na extração');
    } finally {
      setIsImporting(false);
      setProgress(null);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getPriorityColor = (priority: number): string => {
    if (priority >= 80) return 'text-red-400';
    if (priority >= 60) return 'text-yellow-400';
    if (priority >= 40) return 'text-blue-400';
    return 'text-cat-dark-400';
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[900px] max-h-[85vh] bg-cat-dark-800 rounded-lg shadow-2xl border border-cat-dark-600 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cat-dark-600 bg-cat-dark-700/50">
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-5 h-5 text-status-translated" />
            <h2 className="text-lg font-semibold text-cat-dark-100">
              Importar Jogo Unity
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isScanning || isImporting}
            className="p-1.5 rounded hover:bg-cat-dark-600 text-cat-dark-400 hover:text-cat-dark-200 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {!result && !isScanning && !error && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <FolderSearch className="w-16 h-16 text-cat-dark-500 mb-4" />
              <h3 className="text-xl font-medium text-cat-dark-200 mb-2">
                Importar Jogo Unity
              </h3>
              <p className="text-sm text-cat-dark-400 max-w-md mb-6">
                Esta ferramenta varre profundamente a pasta do jogo, identifica arquivos 
                traduzíveis (JSON, CSV, XML, TXT) e arquivos .assets Unity para extração 
                automática de textos.
              </p>
              <div className="grid grid-cols-2 gap-4 text-xs text-cat-dark-500 mb-6">
                <div className="bg-cat-dark-700/50 rounded p-3 text-left">
                  <strong className="text-cat-dark-300 block mb-1">Pastas Prioritárias</strong>
                  StreamingAssets, Resources, i18n, Localization, Lang, Dialogue
                </div>
                <div className="bg-cat-dark-700/50 rounded p-3 text-left">
                  <strong className="text-cat-dark-300 block mb-1">Extração Automática</strong>
                  AssetStudio CLI embutido para .assets Unity
                </div>
              </div>
              
              {/* AssetStudio Status */}
              {assetStudioStatus && (
                <div className="mb-4 p-3 bg-cat-dark-700/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-cat-dark-300">
                      Extração .assets: {assetStudioStatus.available ? 'UABEA Pronto' : 'Não configurado'}
                    </span>
                    <div className="flex items-center gap-2">
                      {!assetStudioStatus.available && (
                        <button
                          onClick={installAssetStudio}
                          disabled={isInstallingAssetStudio}
                          className="flex items-center gap-2 px-3 py-1 bg-status-translated hover:bg-status-translated/80 disabled:opacity-50 text-cat-dark-900 text-xs font-medium rounded transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          {isInstallingAssetStudio ? 'Iniciando...' : 'Configurar'}
                        </button>
                      )}
                      <button
                        onClick={checkAssetStudioStatus}
                        className="flex items-center gap-2 px-3 py-1 bg-cat-dark-600 hover:bg-cat-dark-500 text-cat-dark-200 text-xs font-medium rounded transition-colors"
                      >
                        Verificar Status
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              <button
                onClick={handleStartScan}
                disabled={isScanning}
                className="flex items-center gap-2 px-6 py-3 bg-status-translated hover:bg-status-translated/80 disabled:opacity-50 text-cat-dark-900 font-semibold rounded-lg transition-colors"
              >
                <Gamepad2 className="w-5 h-5" />
                Selecionar Pasta do Jogo
              </button>
            </div>
          )}

          {/* Progress */}
          {(isScanning || isImporting) && progress && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <Loader2 className="w-12 h-12 text-status-translated animate-spin mb-4" />
              <h3 className="text-lg font-medium text-cat-dark-200 mb-2">
                {PHASE_LABELS[progress.phase] || 'Processando...'}
              </h3>
              <p className="text-sm text-cat-dark-400 mb-6">
                {progress.currentFile || 'Analisando...'}
              </p>
              
              {/* Progress Bar */}
              <div className="w-full max-w-md h-2 bg-cat-dark-700 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-status-translated transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              
              {/* Stats */}
              <div className="flex gap-6 text-xs text-cat-dark-500">
                <span>Arquivos: {progress.filesProcessed}/{progress.filesFound}</span>
                <span>Strings: {progress.stringsDiscovered}</span>
                <span>{progress.percentage}%</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <X className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-lg font-medium text-red-400 mb-2">Erro</h3>
              <p className="text-sm text-cat-dark-400 mb-6">{error}</p>
              <button
                onClick={() => setError(null)}
                className="px-4 py-2 bg-cat-dark-700 hover:bg-cat-dark-600 text-cat-dark-200 rounded transition-colors"
              >
                Voltar
              </button>
            </div>
          )}

          {/* Results - AssetStudio available but no translatable files */}
          {result && !isScanning && !isImporting && !error && result.translatableFiles === 0 && assetFiles.length > 0 && (
            <>
              {/* Stats Bar */}
              <div className="px-6 py-3 bg-cat-dark-700/30 border-b border-cat-dark-600 flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-cat-dark-400" />
                  <span className="text-cat-dark-400">Pasta:</span>
                  <span className="text-cat-dark-200 truncate max-w-xs">{result.gamePath}</span>
                </div>
                <div className="w-px h-4 bg-cat-dark-600" />
                <div>
                  <span className="text-cat-dark-400">Arquivos .assets: </span>
                  <span className="text-status-translated font-medium">{assetFiles.length}</span>
                </div>
              </div>

              {/* AssetStudio Info */}
              <div className="px-6 py-4 bg-green-500/10 border-b border-green-500/30">
                <div className="flex items-start gap-3">
                  <Package className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-green-400 font-medium">
                      Extração Manual com UABEA
                    </p>
                    <p className="text-xs text-cat-dark-400 mt-1">
                      Foram encontrados {assetFiles.length} arquivo(s) .assets. 
                      O programa abrirá o UABEA para cada arquivo. Extraia manualmente os textos e importe os arquivos gerados.
                    </p>
                  </div>
                </div>
              </div>

              {/* Asset Files Selection */}
              <div className="px-6 py-2 border-b border-cat-dark-600 flex items-center gap-4">
                <button
                  onClick={selectAllAssets}
                  className="text-xs text-cat-dark-400 hover:text-status-translated transition-colors"
                >
                  Selecionar Todos
                </button>
                <span className="text-cat-dark-600">|</span>
                <button
                  onClick={deselectAllAssets}
                  className="text-xs text-cat-dark-400 hover:text-status-translated transition-colors"
                >
                  Desmarcar Todos
                </button>
                <span className="text-xs text-cat-dark-500 ml-auto">
                  {selectedAssets.size} selecionado(s)
                </span>
              </div>

              {/* Asset Files List */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-1">
                  {assetFiles.map((asset) => (
                    <div
                      key={asset.path}
                      className={`
                        flex items-center gap-3 p-2 rounded-lg transition-colors
                        ${selectedAssets.has(asset.path) ? 'bg-status-translated/10' : 'hover:bg-cat-dark-700/30'}
                      `}
                    >
                      <button
                        onClick={() => toggleAssetSelection(asset.path)}
                        className={`
                          w-5 h-5 rounded border flex items-center justify-center transition-colors
                          ${selectedAssets.has(asset.path)
                            ? 'bg-status-translated border-status-translated'
                            : 'border-cat-dark-500 hover:border-cat-dark-400'
                          }
                        `}
                      >
                        {selectedAssets.has(asset.path) && (
                          <Check className="w-3.5 h-3.5 text-cat-dark-900" />
                        )}
                      </button>

                      <Package className="w-4 h-4 text-cat-dark-400 flex-shrink-0" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-cat-dark-200 truncate">
                            {asset.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-cat-dark-500">
                          <span className="truncate">{asset.relativePath}</span>
                          <span>â¢</span>
                          <span>{formatBytes(asset.size)}</span>
                          {asset.estimatedStrings && asset.estimatedStrings > 0 && (
                            <>
                              <span>â¢</span>
                              <span className="text-cat-dark-400">~{asset.estimatedStrings} strings estimadas</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer for Assets */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-cat-dark-600 bg-cat-dark-700/30">
                <button
                  onClick={handleStartScan}
                  className="px-4 py-2 text-sm text-cat-dark-400 hover:text-cat-dark-200 transition-colors"
                >
                  Nova Varredura
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-cat-dark-400 hover:text-cat-dark-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleExtractWithAssetStudio}
                    disabled={selectedAssets.size === 0}
                    className="flex items-center gap-2 px-6 py-2 bg-status-translated hover:bg-status-translated/80 disabled:opacity-50 disabled:cursor-not-allowed text-cat-dark-900 font-semibold rounded-lg transition-colors"
                  >
                    <Package className="w-4 h-4" />
                    Abrir UABEA para {selectedAssets.size} Arquivo(s)
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Results - No files at all */}
          {result && !isScanning && !isImporting && !error && result.translatableFiles === 0 && assetFiles.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <FolderSearch className="w-16 h-16 text-cat-dark-500 mb-4" />
              <h3 className="text-xl font-medium text-cat-dark-200 mb-2">
                Nenhum Arquivo Traduzível Encontrado
              </h3>
              <p className="text-sm text-cat-dark-400 max-w-md mb-4">
                O scan não encontrou arquivos de tradução (JSON, CSV, XML, TXT) na pasta selecionada.
              </p>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 max-w-md mb-6">
                <p className="text-sm text-yellow-400 font-medium mb-2">
                  â£ Dica: AssetStudio CLI necessário para .assets
                </p>
                <p className="text-xs text-cat-dark-400">
                  Para extrair textos de arquivos .assets, o programa precisa do 
                  <strong className="text-cat-dark-300"> AssetStudio CLI</strong>.
                  Ele será baixado automaticamente se necessário.
                </p>
              </div>
              <button
                onClick={handleStartScan}
                className="flex items-center gap-2 px-6 py-3 bg-cat-dark-700 hover:bg-cat-dark-600 text-cat-dark-200 font-medium rounded-lg transition-colors"
              >
                <FolderSearch className="w-5 h-5" />
                Tentar Outra Pasta
              </button>
            </div>
          )}

          {/* Results with files */}
          {result && !isScanning && !isImporting && !error && result.translatableFiles > 0 && (
            <>
              {/* Stats Bar */}
              <div className="px-6 py-3 bg-cat-dark-700/30 border-b border-cat-dark-600 flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-cat-dark-400" />
                  <span className="text-cat-dark-400">Pasta:</span>
                  <span className="text-cat-dark-200 truncate max-w-xs">{result.gamePath}</span>
                </div>
                <div className="w-px h-4 bg-cat-dark-600" />
                <div>
                  <span className="text-cat-dark-400">Arquivos: </span>
                  <span className="text-status-translated font-medium">{result.translatableFiles}</span>
                  <span className="text-cat-dark-500"> / {result.totalFiles}</span>
                </div>
                <div className="w-px h-4 bg-cat-dark-600" />
                <div>
                  <span className="text-cat-dark-400">Strings: </span>
                  <span className="text-status-translated font-medium">{result.totalStrings.toLocaleString()}</span>
                </div>
                <div className="w-px h-4 bg-cat-dark-600" />
                <div>
                  <span className="text-cat-dark-400">Tempo: </span>
                  <span className="text-cat-dark-300">{(result.durationMs / 1000).toFixed(1)}s</span>
                </div>
              </div>

              {/* Selection Controls */}
              <div className="px-6 py-2 border-b border-cat-dark-600 flex items-center gap-4">
                <button
                  onClick={selectAll}
                  className="text-xs text-cat-dark-400 hover:text-status-translated transition-colors"
                >
                  Selecionar Todos
                </button>
                <span className="text-cat-dark-600">|</span>
                <button
                  onClick={deselectAll}
                  className="text-xs text-cat-dark-400 hover:text-status-translated transition-colors"
                >
                  Desmarcar Todos
                </button>
                <span className="text-xs text-cat-dark-500 ml-auto">
                  {selectedFiles.size} selecionado(s)
                </span>
              </div>

              {/* File Tree */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-1">
                  {result.files.map((file) => (
                    <div key={file.path}>
                      <div
                        className={`
                          flex items-center gap-3 p-2 rounded-lg transition-colors
                          ${selectedFiles.has(file.path) ? 'bg-status-translated/10' : 'hover:bg-cat-dark-700/30'}
                        `}
                      >
                        <button
                          onClick={() => toggleFileSelection(file.path)}
                          className={`
                            w-5 h-5 rounded border flex items-center justify-center transition-colors
                            ${selectedFiles.has(file.path)
                              ? 'bg-status-translated border-status-translated'
                              : 'border-cat-dark-500 hover:border-cat-dark-400'
                            }
                          `}
                        >
                          {selectedFiles.has(file.path) && (
                            <Check className="w-3.5 h-3.5 text-cat-dark-900" />
                          )}
                        </button>

                        <button
                          onClick={() => toggleFileExpand(file.path)}
                          className="p-0.5 rounded hover:bg-cat-dark-700 text-cat-dark-500"
                        >
                          {expandedFiles.has(file.path) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>

                        <FileText className="w-4 h-4 text-cat-dark-400 flex-shrink-0" />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-cat-dark-200 truncate">
                              {file.name}
                            </span>
                            <span className={`text-xs font-medium ${getPriorityColor(file.priority)}`}>
                              P{file.priority}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-cat-dark-500">
                            <span className="truncate">{file.relativePath}</span>
                            <span>â¢</span>
                            <span>{formatBytes(file.size)}</span>
                            {file.stringsCount && (
                              <>
                                <span>â¢</span>
                                <span className="text-status-translated">{file.stringsCount} strings</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Confidence Bar */}
                        <div className="w-16 h-1.5 bg-cat-dark-700 rounded-full overflow-hidden flex-shrink-0">
                          <div
                            className={`h-full ${getConfidenceColor(file.confidence)}`}
                            style={{ width: `${file.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-cat-dark-500 w-10 text-right">
                          {Math.round(file.confidence * 100)}%
                        </span>
                      </div>

                      {/* Preview */}
                      {expandedFiles.has(file.path) && file.preview && (
                        <div className="ml-12 mr-4 p-3 bg-cat-dark-700/30 rounded-lg mt-1">
                          <p className="text-xs text-cat-dark-500 mb-1">Preview:</p>
                          <p className="text-sm text-cat-dark-300 line-clamp-3">
                            {file.preview}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {result && !isScanning && !isImporting && !error && result.translatableFiles > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-cat-dark-600 bg-cat-dark-700/30">
            <button
              onClick={handleStartScan}
              className="px-4 py-2 text-sm text-cat-dark-400 hover:text-cat-dark-200 transition-colors"
            >
              Nova Varredura
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-cat-dark-400 hover:text-cat-dark-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={selectedFiles.size === 0}
                className="flex items-center gap-2 px-6 py-2 bg-status-translated hover:bg-status-translated/80 disabled:opacity-50 disabled:cursor-not-allowed text-cat-dark-900 font-semibold rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
                Importar {selectedFiles.size} Arquivo(s)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
