import { FileText, Settings, Search, Database, FolderPlus } from 'lucide-react';

/**
 * Componente Sidebar - Navegação de arquivos
 * 
 * Apresenta a lista de arquivos .assets disponíveis no banco de dados,
 * permitindo ao tradutor selecionar qual arquivo pretende traduzir.
 * Inclui também estatísticas rápidas e acesso às configurações.
 */

interface FileItem {
  id: string;
  name: string;
  count: { count: number };
  translatedCount?: number;
}

interface SidebarProps {
  files: FileItem[];
  selectedFile: string | null;
  onSelectFile: (fileId: string) => void;
  onAddFolder?: () => void;
  stats?: {
    total: number;
    translated: number;
    pending: number;
  };
}

export function Sidebar({ files, selectedFile, onSelectFile, onAddFolder, stats }: SidebarProps) {
  return (
    <aside className="w-64 bg-cat-dark-800 border-r border-cat-dark-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-cat-dark-700">
        <div className="flex items-center gap-2 text-cat-dark-200">
          <Database className="w-5 h-5 text-status-translated" />
          <h1 className="font-semibold text-sm tracking-wide">UNITY CAT TOOL</h1>
        </div>
        <p className="text-xs text-cat-dark-400 mt-1">v1.0.0</p>
      </div>

      {/* Estatísticas Rápidas */}
      {stats && (
        <div className="p-3 grid grid-cols-3 gap-2 border-b border-cat-dark-700 bg-cat-dark-900/50">
          <div className="text-center">
            <p className="text-lg font-bold text-cat-dark-200">{stats.total}</p>
            <p className="text-[10px] text-cat-dark-500 uppercase">Total</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-status-translated">{stats.translated}</p>
            <p className="text-[10px] text-cat-dark-500 uppercase">Traduzido</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-status-pending">{stats.pending}</p>
            <p className="text-[10px] text-cat-dark-500 uppercase">Pendente</p>
          </div>
        </div>
      )}

      {/* Lista de Arquivos */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <div className="flex items-center justify-between px-2 py-2">
            <p className="text-xs font-semibold text-cat-dark-500 uppercase">
              Arquivos ({files.length})
            </p>
            {onAddFolder && (
              <button
                onClick={onAddFolder}
                className="p-1 rounded hover:bg-cat-dark-700 text-cat-dark-400 hover:text-status-translated transition-colors"
                title="Adicionar Pasta"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {files.length === 0 ? (
            <div className="px-2 py-8 text-center">
              <p className="text-xs text-cat-dark-500 mb-3">Nenhum arquivo carregado</p>
              {onAddFolder && (
                <button
                  onClick={onAddFolder}
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded bg-status-translated/20 hover:bg-status-translated/30 text-status-translated text-xs font-medium transition-colors"
                >
                  <FolderPlus className="w-4 h-4" />
                  Adicionar Pasta
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-1">
              {files.map((file) => (
                <li key={file.id}>
                  <button
                    onClick={() => onSelectFile(file.name)}
                    className={`
                      w-full flex items-center gap-2 px-3 py-2 rounded text-left
                      transition-colors duration-150 text-sidebar
                      ${selectedFile === file.name 
                        ? 'bg-status-translated/20 text-status-translated border-l-2 border-status-translated' 
                        : 'text-cat-dark-300 hover:bg-cat-dark-700/50 hover:text-cat-dark-200'
                      }
                    `}
                  >
                    <FileText className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{file.name}</p>
                      <p className="text-[10px] text-cat-dark-500">
                        {file.count.count} strings
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Footer - Ações */}
      <div className="p-3 border-t border-cat-dark-700 space-y-2">
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded text-cat-dark-400 hover:text-cat-dark-200 hover:bg-cat-dark-700 transition-colors text-xs">
          <Search className="w-4 h-4" />
          Pesquisar na TM
        </button>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded text-cat-dark-400 hover:text-cat-dark-200 hover:bg-cat-dark-700 transition-colors text-xs">
          <Settings className="w-4 h-4" />
          Configurações
        </button>
      </div>
    </aside>
  );
}
