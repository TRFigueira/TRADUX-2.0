import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, AlertCircle, Loader2, Wrench } from 'lucide-react';

interface Tool {
  name: string;
  executableName: string;
  description: string;
  installed: boolean;
  version?: string;
  path?: string;
}

interface ToolProgress {
  toolName: string;
  phase: 'downloading' | 'extracting' | 'installing' | 'complete' | 'error';
  percentage: number;
  message: string;
  error?: string;
}

export function ToolsManager({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [progress, setProgress] = useState<ToolProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTools();
    }
  }, [isOpen]);

  useEffect(() => {
    console.log('[ToolsManager] Setting up progress listener...');
    // Listen for progress updates
    const unsubscribe = window.electronAPI?.onToolsProgress?.((data: ToolProgress) => {
      console.log('[ToolsManager] Progress update:', data);
      setProgress(data);
      if (data.phase === 'complete' || data.phase === 'error') {
        setInstalling(null);
        if (data.phase === 'complete') {
          loadTools(); // Refresh list
        }
      }
    });

    console.log('[ToolsManager] Progress listener set up:', !!unsubscribe);
    return () => {
      if (unsubscribe) {
        console.log('[ToolsManager] Cleaning up progress listener');
        unsubscribe();
      }
    };
  }, []);

  const loadTools = async () => {
    console.log('[ToolsManager] Loading tools...');
    setLoading(true);
    try {
      console.log('[ToolsManager] Checking window.electronAPI:', !!window.electronAPI);
      console.log('[ToolsManager] Checking toolsList method:', !!window.electronAPI?.toolsList);
      
      // Try direct IPC call as fallback
      const toolsListCall = window.electronAPI?.toolsList || 
        (() => (window as any).ipcRenderer?.invoke?.('tools:list'));
      
      if (!toolsListCall) {
        console.error('[ToolsManager] No toolsList method available');
        setError('API não disponível. Reinicie o aplicativo.');
        return;
      }
      
      console.log('[ToolsManager] Calling toolsList...');
      const result = await toolsListCall();
      console.log('[ToolsManager] toolsList result:', result);
      if (result?.success) {
        console.log('[ToolsManager] Tools loaded:', result.tools);
        setTools(result.tools);
      } else {
        console.error('[ToolsManager] Failed to load tools:', result?.error);
        setError(result?.error || 'Failed to load tools');
      }
    } catch (err) {
      console.error('[ToolsManager] Error loading tools:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const installTool = async (toolName: string) => {
    setInstalling(toolName);
    setError(null);
    try {
      const result = await window.electronAPI?.toolsInstall?.(toolName);
      if (!result?.success && result?.error) {
        setError(result.error);
      }
    } catch (err) {
      setError((err as Error).message);
      setInstalling(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-100">Ferramentas Externas</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-gray-400 text-sm mb-4">
            Estas ferramentas são necessárias para extrair textos de jogos Unity.
            Clique em "Instalar" para baixar automaticamente do GitHub.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-400">Carregando...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {tools.map((tool) => (
                <div
                  key={tool.name}
                  className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-100">{tool.name}</h3>
                      {tool.installed ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{tool.description}</p>
                    {tool.installed && tool.version && (
                      <p className="text-xs text-gray-500 mt-1">
                        Versão: {tool.version}
                      </p>
                    )}
                    {tool.installed && tool.path && (
                      <p className="text-xs text-gray-600 mt-0.5 truncate max-w-md">
                        {tool.path}
                      </p>
                    )}
                  </div>

                  <div className="ml-4">
                    {installing === tool.name ? (
                      <div className="w-32">
                        <div className="flex items-center gap-2 mb-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                          <span className="text-xs text-gray-400">
                            {progress?.phase === 'downloading' && 'Baixando...'}
                            {progress?.phase === 'extracting' && 'Extraindo...'}
                            {progress?.phase === 'installing' && 'Instalando...'}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${progress?.percentage || 0}%` }}
                          />
                        </div>
                      </div>
                    ) : tool.installed ? (
                      <button
                        disabled
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 text-sm rounded cursor-default"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Instalado
                      </button>
                    ) : (
                      <button
                        onClick={() => installTool(tool.name)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Instalar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info Section */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <h4 className="text-sm font-medium text-blue-400 mb-2">
              Sobre as Ferramentas
            </h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>
                <strong>AssetStudioCLI:</strong> Extrai assets Unity (TextAsset, MonoBehaviour) de jogos Unity. 
                Essencial para extrair textos de diálogos, menus e UI.
              </li>
              <li>
                <strong>UABEA:</strong> Editor de assets Unity para modificar arquivos após tradução.
                Permite salvar as alterações de volta no jogo.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-700 bg-gray-900">
          <button
            onClick={loadTools}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-100 transition-colors disabled:opacity-50"
          >
            Atualizar
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 text-sm rounded transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// Extend window interface for TypeScript
declare global {
  interface Window {
    electronAPI?: {
      toolsList?: () => Promise<{ success: boolean; tools: Tool[]; error?: string }>;
      toolsInstall?: (toolName: string) => Promise<{ success: boolean; error?: string }>;
      onToolsProgress?: (callback: (progress: ToolProgress) => void) => () => void;
    };
  }
}
