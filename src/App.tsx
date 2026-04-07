import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { ContextPanel } from './components/ContextPanel';
import { ExportModal } from './components/ExportModal';
import { ScanModal } from './components/ScanModal';
import { Menu, Minus, Square, X, Download, Gamepad2, Trash2, Languages } from 'lucide-react';

/**
 * Componente Principal App
 * 
 * Layout de 3 colunas:
 * - Sidebar (20%): Navegação de arquivos
 * - Editor (60%): Grade bilíngue de tradução
 * - ContextPanel (20%): Fuzzy matches e QA
 * 
 * Tema Dark Mode por padrão.
 */

// Tipos
interface FileItem {
  id: string;
  name: string;
  count: { count: number };
}

interface StringItem {
  id: number;
  source_file: string;
  path_id: string;
  original_text: string;
  shielded_text: string;
  translated_text: string | null;
  status: 'pending' | 'translated' | 'reviewed' | 'approved';
}

interface FuzzyMatch {
  id: number;
  original_text: string;
  translated_text: string;
  similarity: number;
  rank: number;
}

interface QAResult {
  passed: boolean;
  warnings: string[];
  originalLength?: number;
  translatedLength?: number;
}

function App() {
  // Estado
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [strings, setStrings] = useState<StringItem[]>([]);
  const [selectedStringId, setSelectedStringId] = useState<number | null>(null);
  const [fuzzyMatches, setFuzzyMatches] = useState<FuzzyMatch[]>([]);
  const [qaResult, setQaResult] = useState<QAResult | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [loading, setLoading] = useState({
    files: false,
    strings: false,
    fuzzy: false,
    qa: false
  });

  // Estatísticas globais
  const [globalStats, setGlobalStats] = useState({
    total: 0,
    translated: 0,
    pending: 0
  });

  /**
   * Carregar lista de arquivos ao iniciar.
   */
  useEffect(() => {
    loadFiles();
  }, []);

  /**
   * Carregar strings quando um arquivo é selecionado.
   */
  useEffect(() => {
    if (selectedFile) {
      loadStrings(selectedFile);
    }
  }, [selectedFile]);

  /**
   * Carregar fuzzy matches e QA quando uma string é selecionada.
   */
  useEffect(() => {
    if (selectedStringId) {
      const selected = strings.find(s => s.id === selectedStringId);
      if (selected) {
        loadFuzzyMatches(selected.shielded_text || selected.original_text);
        loadQACheck(selectedStringId);
      }
    }
  }, [selectedStringId, strings]);

  /**
   * API: Buscar lista de arquivos.
   */
  const loadFiles = async () => {
    setLoading(prev => ({ ...prev, files: true }));
    try {
      const fileList = await window.api.fetchFiles();
      setFiles(fileList);
      
      // Calcular estatísticas globais
      let total = 0, translated = 0;
      fileList.forEach(f => {
        total += f.count.count;
      });
      setGlobalStats({ total, translated, pending: total - translated });
    } catch (error) {
      console.error('Erro ao carregar arquivos:', error);
    } finally {
      setLoading(prev => ({ ...prev, files: false }));
    }
  };

  /**
   * API: Buscar strings de um arquivo com paginação.
   */
  const loadStrings = async (fileId: string, page: number = 1, pageSize: number = 1000) => {
    setLoading(prev => ({ ...prev, strings: true }));
    try {
      const result = await window.api.fetchStringsByFile(fileId, page, pageSize);
      
      // Handle both old format (array) and new format (object with pagination)
      const stringList = Array.isArray(result) ? result : result.strings;
      
      setStrings(stringList as StringItem[]);
      
      // Log para debug
      if (!Array.isArray(result)) {
        console.log(`[App] Carregadas ${stringList.length} strings de ${result.total} totais (página ${result.page})`);
      }
      
      // Selecionar primeira string automaticamente
      if (stringList.length > 0 && !selectedStringId) {
        setSelectedStringId(stringList[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar strings:', error);
    } finally {
      setLoading(prev => ({ ...prev, strings: false }));
    }
  };

  /**
   * API: Pesquisa fuzzy na Translation Memory.
   */
  const loadFuzzyMatches = async (query: string) => {
    setLoading(prev => ({ ...prev, fuzzy: true }));
    try {
      const matches = await window.api.searchFuzzy(query, 5);
      setFuzzyMatches(matches.map(m => ({
        ...m,
        similarity: 1 - (m.rank * 0.1) // Converter rank para similaridade aproximada
      })));
    } catch (error) {
      console.error('Erro na pesquisa fuzzy:', error);
    } finally {
      setLoading(prev => ({ ...prev, fuzzy: false }));
    }
  };

  /**
   * API: Verificação de qualidade.
   */
  const loadQACheck = async (id: number) => {
    setLoading(prev => ({ ...prev, qa: true }));
    try {
      const result = await window.api.runQACheck(id);
      setQaResult(result);
    } catch (error) {
      console.error('Erro no QA:', error);
    } finally {
      setLoading(prev => ({ ...prev, qa: false }));
    }
  };

  /**
   * API: Salvar tradução.
   */
  const handleSaveTranslation = useCallback(async (id: number, text: string) => {
    try {
      await window.api.translateString(id, text);
      
      // Atualizar estado local
      setStrings(prev => prev.map(s => 
        s.id === id 
          ? { ...s, translated_text: text, status: 'translated' as const }
          : s
      ));
      
      // Recarregar QA
      loadQACheck(id);
    } catch (error) {
      console.error('Erro ao salvar tradução:', error);
    }
  }, []);

  /**
   * API: Pedir tradução via IA (simulado por agora).
   */
  const handleRequestAI = useCallback(async (id: number) => {
    // TODO: Integrar com o serviço de IA real
    // Por agora, simular com um delay
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const stringItem = strings.find(s => s.id === id);
        if (stringItem) {
          // Simulação: tradução simples
          const mockTranslation = `[TRADUZIDO] ${stringItem.original_text}`;
          handleSaveTranslation(id, mockTranslation);
        }
        resolve();
      }, 1000);
    });
  }, [strings, handleSaveTranslation]);

  /**
   * Aplicar tradução de fuzzy match.
   */
  const handleApplyFuzzy = useCallback((text: string) => {
    if (selectedStringId) {
      handleSaveTranslation(selectedStringId, text);
    }
  }, [selectedStringId, handleSaveTranslation]);

  /**
   * Selecionar string.
   */
  const handleSelectString = useCallback((id: number) => {
    setSelectedStringId(id);
  }, []);

  /**
   * Selecionar arquivo.
   */
  const handleSelectFile = useCallback((fileId: string) => {
    setSelectedFile(fileId);
    setSelectedStringId(null);
    setStrings([]);
  }, []);

  /**
   * API: Selecionar e importar pasta com arquivos de tradução.
   */
  const handleAddFolder = useCallback(async () => {
    try {
      const result = await window.api.selectFolder();
      
      if (result.canceled) {
        console.log('Importação cancelada pelo usuário');
        return;
      }
      
      if (result.filesFound === 0) {
        alert('Nenhum arquivo encontrado na pasta.\n\nFormatos suportados: .json, .csv, .txt');
        return;
      }
      
      if (result.stringsImported === 0) {
        alert(`${result.filesFound} arquivo(s) encontrado(s), mas nenhuma string foi importada.\n\nVerifique se os arquivos contêm texto válido.`);
        return;
      }
      
      // Recarregar lista de arquivos
      await loadFiles();
      
      // Mostrar sucesso
      alert(`Importação concluída!\n\n${result.stringsImported} strings importadas de ${result.filesFound} arquivo(s).`);
      console.log(`Importação concluída: ${result.stringsImported} strings importadas de ${result.filesFound} arquivos`);
    } catch (error) {
      console.error('Erro ao importar pasta:', error);
      alert('Erro ao importar pasta. Verifique o console para mais detalhes.');
    }
  }, [loadFiles]);

  /**
   * Deletar strings do arquivo selecionado.
   */
  const handleDeleteSelectedFile = useCallback(async () => {
    if (!selectedFile) {
      alert('Selecione um arquivo primeiro');
      return;
    }
    
    if (!confirm(`Tem certeza que deseja deletar TODAS as strings de "${selectedFile}"?`)) {
      return;
    }
    
    try {
      const result = await window.api.deleteStringsByFile(selectedFile);
      if (result.success) {
        alert(`${result.deletedCount} strings deletadas de ${selectedFile}`);
        setSelectedFile(null);
        setStrings([]);
        await loadFiles();
      } else {
        alert('Erro ao deletar: ' + result.error);
      }
    } catch (error) {
      console.error('Erro ao deletar strings:', error);
      alert('Erro ao deletar strings');
    }
  }, [selectedFile, loadFiles]);

  /**
   * Limpar todo o banco de dados.
   */
  const handleClearAll = useCallback(async () => {
    if (!confirm('Tem certeza que deseja APAGAR TODAS AS STRINGS do banco de dados?\n\nEsta ação não pode ser desfeita!')) {
      return;
    }
    
    try {
      const result = await window.api.clearAllStrings();
      if (result.success) {
        alert(`${result.deletedCount} strings deletadas do banco de dados`);
        setSelectedFile(null);
        setStrings([]);
        setSelectedStringId(null);
        await loadFiles();
      } else {
        alert('Erro ao limpar: ' + result.error);
      }
    } catch (error) {
      console.error('Erro ao limpar banco:', error);
      alert('Erro ao limpar banco de dados');
    }
  }, [loadFiles]);

  /**
   * Traduzir todas as strings pendentes.
   */
  const handleTranslateAll = useCallback(async () => {
    if (!confirm('Deseja traduzir automaticamente todas as strings pendentes?\n\nNota: As traduções serão marcadas para revisão.')) {
      return;
    }
    
    try {
      const result = await window.api.translateAll('pt-BR');
      if (result.success) {
        alert(`${result.translatedCount} strings traduzidas!\n\n${result.message || ''}`);
        if (selectedFile) {
          await loadStrings(selectedFile);
        }
        await loadFiles();
      } else {
        alert('Erro na tradução: ' + result.error);
      }
    } catch (error) {
      console.error('Erro ao traduzir tudo:', error);
      alert('Erro ao traduzir');
    }
  }, [selectedFile, loadFiles]);

  const selectedString = strings.find(s => s.id === selectedStringId) || null;

  return (
    <div className="h-screen w-screen bg-cat-dark-900 text-cat-dark-200 font-sans overflow-hidden flex flex-col">
      {/* Title Bar Customizada (Electron) */}
      <div className="h-10 bg-cat-dark-800 border-b border-cat-dark-700 flex items-center justify-between px-4 draggable-region">
        <div className="flex items-center gap-3">
          <Menu className="w-4 h-4 text-cat-dark-400" />
          <span className="text-sm font-medium">Unity CAT Tool</span>
          {selectedFile && (
            <span className="text-xs text-cat-dark-500">
              - {selectedFile}
            </span>
          )}
        </div>
          <div className="flex items-center gap-3 no-drag">
            <button
              onClick={() => setIsScanModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-cat-dark-700 hover:bg-cat-dark-600 text-cat-dark-200 text-xs font-medium rounded transition-colors"
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              Importar Jogo Unity
            </button>
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-status-translated/20 hover:bg-status-translated/30 text-status-translated text-xs font-medium rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar Jogo Traduzido
            </button>
            <div className="w-px h-4 bg-cat-dark-600" />
            <button
              onClick={handleDeleteSelectedFile}
              disabled={!selectedFile}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-red-400 text-xs font-medium rounded transition-colors"
              title="Deletar arquivo selecionado"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Deletar
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium rounded transition-colors"
              title="Limpar todo o banco de dados"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar Tudo
            </button>
            <button
              onClick={handleTranslateAll}
              disabled={globalStats.total === 0}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-blue-400 text-xs font-medium rounded transition-colors"
              title="Traduzir tudo automaticamente"
            >
              <Languages className="w-3.5 h-3.5" />
              Traduzir Tudo
            </button>
            <div className="w-px h-4 bg-cat-dark-600" />
          <button className="p-1.5 hover:bg-cat-dark-700 rounded text-cat-dark-400 hover:text-cat-dark-200">
            <Minus className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:bg-cat-dark-700 rounded text-cat-dark-400 hover:text-cat-dark-200">
            <Square className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded text-cat-dark-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Layout Principal - 3 Colunas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Coluna 1: Sidebar (20%) */}
        <Sidebar
          files={files}
          selectedFile={selectedFile}
          onSelectFile={handleSelectFile}
          onAddFolder={handleAddFolder}
          stats={globalStats}
        />

        {/* Coluna 2: Editor (60%) */}
        <Editor
          strings={strings}
          selectedStringId={selectedStringId}
          onSelectString={handleSelectString}
          onSaveTranslation={handleSaveTranslation}
          onRequestAI={handleRequestAI}
        />

        {/* Coluna 3: Context Panel (20%) */}
        <ContextPanel
          selectedString={selectedString}
          fuzzyMatches={fuzzyMatches}
          qaResult={qaResult}
          onApplyFuzzy={handleApplyFuzzy}
          loading={loading.fuzzy || loading.qa}
        />
      </div>

      {/* Status Bar */}
      <div className="h-7 bg-cat-dark-800 border-t border-cat-dark-700 flex items-center px-4 text-[11px] text-cat-dark-400 justify-between">
        <div className="flex items-center gap-4">
          {loading.strings && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 border border-cat-dark-600 border-t-cat-dark-400 rounded-full animate-spin" />
              A carregar...
            </span>
          )}
          <span>Pronto</span>
        </div>
        <div className="flex items-center gap-4">
          <span>UTF-8</span>
          <span>Português (BR)</span>
          <span className="text-cat-dark-500">
            {selectedStringId ? `ID: ${selectedStringId}` : 'Nenhuma string selecionada'}
          </span>
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
      />

      {/* Scan Modal */}
      <ScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onImportComplete={loadFiles}
      />
    </div>
  );
}

export default App;
