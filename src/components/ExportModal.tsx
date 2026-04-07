import { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Download, 
  FileJson, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  FolderOpen
} from 'lucide-react';

/**
 * Componente ExportModal - Modal de Exportação de Traduções
 * 
 * Apresenta uma interface para o usuário exportar as traduções completas:
 * - Seleção do formato de exportação (JSON, CSV, UABEA)
 * - Barra de progresso em tempo real
 * - Relatório final com estatísticas
 * - Acesso à pasta de saída
 */

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ExportProgress {
  total: number;
  processed: number;
  percentage: number;
  phase: 'reading' | 'unshielding' | 'writing' | 'complete';
  successful: number;
  failed: number;
}

interface ExportReport {
  timestamp: string;
  format: string;
  outputPath: string;
  totalStrings: number;
  successfulExports: number;
  failedExports: number;
  generatedFiles: string[];
  durationMs: number;
}

type ExportFormat = 'json' | 'csv' | 'uabea';

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: React.ElementType; description: string }[] = [
  { 
    value: 'json', 
    label: 'JSON', 
    icon: FileJson, 
    description: 'Formato estruturado para integração com ferramentas'
  },
  { 
    value: 'csv', 
    label: 'CSV', 
    icon: FileSpreadsheet, 
    description: 'Compatível com Excel e outras ferramentas CAT'
  },
  { 
    value: 'uabea', 
    label: 'UABEA', 
    icon: FileText, 
    description: 'Formato para Unity Asset Bundle Extractor'
  }
];

const PHASE_LABELS: Record<ExportProgress['phase'], string> = {
  reading: 'Lendo strings do banco de dados...',
  unshielding: 'Restaurando tags Unity...',
  writing: 'Escrevendo arquivos de saída...',
  complete: 'Exportação concluída!'
};

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [report, setReport] = useState<ExportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Configurar listener de progresso
  useEffect(() => {
    if (!isOpen || !isExporting) return;

    const unsubscribe = window.api.onExportProgress((newProgress) => {
      setProgress(newProgress);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, isExporting]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);
    setReport(null);
    setProgress({
      total: 0,
      processed: 0,
      percentage: 0,
      phase: 'reading',
      successful: 0,
      failed: 0
    });

    try {
      const result = await window.api.exportTranslations(selectedFormat);

      if (result.success && result.report) {
        setReport(result.report);
        setProgress(prev => prev ? { ...prev, phase: 'complete' } : null);
      } else {
        setError(result.error || 'Erro desconhecido na exportação');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsExporting(false);
    }
  }, [selectedFormat]);

  const handleClose = useCallback(() => {
    if (isExporting) return; // Não fechar durante exportação
    
    // Reset state
    setIsExporting(false);
    setProgress(null);
    setReport(null);
    setError(null);
    setSelectedFormat('json');
    
    onClose();
  }, [isExporting, onClose]);

  const handleOpenOutputFolder = useCallback(() => {
    if (report?.outputPath) {
      // Abrir pasta no sistema operativo
      // Note: Em Electron real, usaria shell.openPath
      console.log('Abrir pasta:', report.outputPath);
    }
  }, [report]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-cat-dark-800 rounded-xl border border-cat-dark-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cat-dark-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-status-translated/20 rounded-lg">
              <Download className="w-5 h-5 text-status-translated" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-cat-dark-200">
                Exportar Jogo Traduzido
              </h2>
              <p className="text-sm text-cat-dark-400">
                Gerar ficheiros de build com traduções restauradas
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isExporting}
            className="p-2 hover:bg-cat-dark-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-cat-dark-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Formato Selection */}
          {!isExporting && !report && !error && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-cat-dark-300">
                Formato de Exportação
              </label>
              <div className="grid grid-cols-3 gap-3">
                {FORMAT_OPTIONS.map((format) => {
                  const Icon = format.icon;
                  const isSelected = selectedFormat === format.value;
                  
                  return (
                    <button
                      key={format.value}
                      onClick={() => setSelectedFormat(format.value)}
                      className={`
                        p-4 rounded-lg border-2 transition-all text-left
                        ${isSelected 
                          ? 'border-status-translated bg-status-translated/10' 
                          : 'border-cat-dark-700 hover:border-cat-dark-600 bg-cat-dark-900/50'
                        }
                      `}
                    >
                      <Icon className={`w-6 h-6 mb-2 ${isSelected ? 'text-status-translated' : 'text-cat-dark-400'}`} />
                      <p className={`font-medium ${isSelected ? 'text-cat-dark-200' : 'text-cat-dark-300'}`}>
                        {format.label}
                      </p>
                      <p className="text-xs text-cat-dark-500 mt-1">
                        {format.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {isExporting && progress && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-cat-dark-300">
                  {PHASE_LABELS[progress.phase]}
                </span>
                <span className="text-sm text-cat-dark-400">
                  {progress.processed} / {progress.total} strings
                </span>
              </div>
              
              {/* Barra de progresso */}
              <div className="h-3 bg-cat-dark-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-status-translated to-status-approved transition-all duration-300 ease-out"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              
              {/* Estatísticas em tempo real */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-cat-dark-900/50 rounded-lg">
                  <p className="text-lg font-semibold text-cat-dark-200">
                    {progress.successful}
                  </p>
                  <p className="text-xs text-cat-dark-500">Sucessos</p>
                </div>
                <div className="p-3 bg-cat-dark-900/50 rounded-lg">
                  <p className={`text-lg font-semibold ${progress.failed > 0 ? 'text-status-pending' : 'text-cat-dark-200'}`}>
                    {progress.failed}
                  </p>
                  <p className="text-xs text-cat-dark-500">Falhas</p>
                </div>
                <div className="p-3 bg-cat-dark-900/50 rounded-lg">
                  <p className="text-lg font-semibold text-cat-dark-200">
                    {progress.percentage}%
                  </p>
                  <p className="text-xs text-cat-dark-500">Completo</p>
                </div>
              </div>
            </div>
          )}

          {/* Success Report */}
          {report && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-status-translated/10 border border-status-translated/30 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-status-translated flex-shrink-0" />
                <div>
                  <p className="font-medium text-cat-dark-200">
                    Exportação Concluída com Sucesso
                  </p>
                  <p className="text-sm text-cat-dark-400">
                    {report.successfulExports} strings exportadas em {(report.durationMs / 1000).toFixed(1)}s
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-medium text-cat-dark-300">Detalhes</h3>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-cat-dark-900/50 rounded-lg">
                    <p className="text-cat-dark-500">Formato</p>
                    <p className="text-cat-dark-200 font-medium uppercase">{report.format}</p>
                  </div>
                  <div className="p-3 bg-cat-dark-900/50 rounded-lg">
                    <p className="text-cat-dark-500">Total de Strings</p>
                    <p className="text-cat-dark-200 font-medium">{report.totalStrings}</p>
                  </div>
                  <div className="p-3 bg-cat-dark-900/50 rounded-lg">
                    <p className="text-cat-dark-500">Sucessos</p>
                    <p className="text-status-translated font-medium">{report.successfulExports}</p>
                  </div>
                  <div className="p-3 bg-cat-dark-900/50 rounded-lg">
                    <p className="text-cat-dark-500">Falhas</p>
                    <p className={`font-medium ${report.failedExports > 0 ? 'text-status-pending' : 'text-cat-dark-200'}`}>
                      {report.failedExports}
                    </p>
                  </div>
                </div>

                {report.generatedFiles.length > 0 && (
                  <div className="p-3 bg-cat-dark-900/50 rounded-lg">
                    <p className="text-cat-dark-500 text-sm mb-2">Arquivos Gerados</p>
                    <ul className="space-y-1">
                      {report.generatedFiles.map((file) => (
                        <li key={file} className="text-sm text-cat-dark-300 font-mono">
                          {file}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-3 bg-cat-dark-900/50 rounded-lg">
                  <p className="text-cat-dark-500 text-sm">Pasta de Saída</p>
                  <p className="text-sm text-cat-dark-300 font-mono mt-1 break-all">
                    {report.outputPath}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-status-pending/10 border border-status-pending/30 rounded-lg">
              <AlertCircle className="w-6 h-6 text-status-pending flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-cat-dark-200">Erro na Exportação</p>
                <p className="text-sm text-cat-dark-400 mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-cat-dark-700 bg-cat-dark-900/30">
          {!isExporting && !report && !error ? (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-cat-dark-400 hover:text-cat-dark-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-6 py-2 bg-status-translated hover:bg-status-translated/90 text-cat-dark-900 font-medium rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Iniciar Exportação
              </button>
            </>
          ) : isExporting ? (
            <div className="flex items-center gap-2 text-cat-dark-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Processando...</span>
            </div>
          ) : report ? (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-cat-dark-400 hover:text-cat-dark-200 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={handleOpenOutputFolder}
                className="flex items-center gap-2 px-6 py-2 bg-cat-dark-700 hover:bg-cat-dark-600 text-cat-dark-200 font-medium rounded-lg transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                Abrir Pasta
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-cat-dark-400 hover:text-cat-dark-200 transition-colors"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
