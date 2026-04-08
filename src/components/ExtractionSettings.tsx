import React, { useState, useEffect } from 'react';

interface ExtractionConfig {
  fileBlacklist: string[];
  directoryWhitelist: string[];
  contentBlacklist: string[];
  enableStrictMode: boolean;
}

const DEFAULT_CONFIG: ExtractionConfig = {
  fileBlacklist: [
    'catalog.json',
    'catalog.json.meta',
    'addressables_assets.json',
    'buildsettings.json',
    'projectsettings.json',
    'bundleconfig.json'
  ],
  directoryWhitelist: [
    'Assets/Localization',
    'Assets/Resources',
    'Resources',
    'StreamingAssets',
    'Localization',
    'Languages',
    'Text',
    'Dialogues',
    'Dialog',
    'Data'
  ],
  contentBlacklist: [
    'UnityEngine.',
    'Unity.',
    'System.',
    'Mono.',
    'PublicKeyToken=',
    'Version=',
    'Culture=',
    'ResourceManagement',
    'ResourceProviders',
    'SceneProvider',
    'InstanceProvider',
    'AssetBundleProvider',
    'ContentCatalogProvider',
    'LegacyResourcesProvider',
    'Addressables',
    'Addressable',
    'ResourceManager',
    'ResourceProvider',
    'BurstGenerated',
    'CalcVertex',
    'CalcTriangle',
    'CalcNormal',
    'JobParallelFor',
    'JobRanges'
  ],
  enableStrictMode: true
};

export function ExtractionSettings({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [config, setConfig] = useState<ExtractionConfig>(DEFAULT_CONFIG);
  const [newFilePattern, setNewFilePattern] = useState('');
  const [newDirectoryPattern, setNewDirectoryPattern] = useState('');
  const [newContentPattern, setNewContentPattern] = useState('');

  useEffect(() => {
    // Load config from localStorage
    const saved = localStorage.getItem('tradux-extraction-config');
    if (saved) {
      setConfig(JSON.parse(saved));
    }
  }, []);

  const saveConfig = () => {
    localStorage.setItem('tradux-extraction-config', JSON.stringify(config));
    console.log('[ExtractionSettings] Config saved:', config);
    // TODO: Send to main process when IPC is available
  };

  const addFilePattern = () => {
    if (newFilePattern.trim()) {
      setConfig(prev => ({
        ...prev,
        fileBlacklist: [...prev.fileBlacklist, newFilePattern.trim()]
      }));
      setNewFilePattern('');
    }
  };

  const removeFilePattern = (index: number) => {
    setConfig(prev => ({
      ...prev,
      fileBlacklist: prev.fileBlacklist.filter((_, i) => i !== index)
    }));
  };

  const addDirectoryPattern = () => {
    if (newDirectoryPattern.trim()) {
      setConfig(prev => ({
        ...prev,
        directoryWhitelist: [...prev.directoryWhitelist, newDirectoryPattern.trim()]
      }));
      setNewDirectoryPattern('');
    }
  };

  const removeDirectoryPattern = (index: number) => {
    setConfig(prev => ({
      ...prev,
      directoryWhitelist: prev.directoryWhitelist.filter((_, i) => i !== index)
    }));
  };

  const addContentPattern = () => {
    if (newContentPattern.trim()) {
      setConfig(prev => ({
        ...prev,
        contentBlacklist: [...prev.contentBlacklist, newContentPattern.trim()]
      }));
      setNewContentPattern('');
    }
  };

  const removeContentPattern = (index: number) => {
    setConfig(prev => ({
      ...prev,
      contentBlacklist: prev.contentBlacklist.filter((_, i) => i !== index)
    }));
  };

  const resetToDefaults = () => {
    setConfig(DEFAULT_CONFIG);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Configurações de Extração</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* Strict Mode */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="strictMode"
              checked={config.enableStrictMode}
              onChange={(e) => setConfig(prev => ({ ...prev, enableStrictMode: e.target.checked }))}
              className="w-4 h-4"
            />
            <label htmlFor="strictMode" className="font-medium">
              Modo Estrito (ignorar mais conteúdo técnico)
            </label>
          </div>

          {/* File Blacklist */}
          <div>
            <h3 className="font-semibold mb-2">Arquivos a Ignorar (Blacklist)</h3>
            <div className="space-y-2 mb-2">
              {config.fileBlacklist.map((pattern, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
                    {pattern}
                  </code>
                  <button
                    onClick={() => removeFilePattern(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newFilePattern}
                onChange={(e) => setNewFilePattern(e.target.value)}
                placeholder="Ex: catalog.json, *.meta"
                className="flex-1 px-3 py-2 border rounded"
              />
              <button
                onClick={addFilePattern}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Adicionar
              </button>
            </div>
          </div>

          {/* Directory Whitelist */}
          <div>
            <h3 className="font-semibold mb-2">Diretórios Prioritários (Whitelist)</h3>
            <div className="space-y-2 mb-2">
              {config.directoryWhitelist.map((pattern, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
                    {pattern}
                  </code>
                  <button
                    onClick={() => removeDirectoryPattern(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newDirectoryPattern}
                onChange={(e) => setNewDirectoryPattern(e.target.value)}
                placeholder="Ex: Assets/Localization, Resources"
                className="flex-1 px-3 py-2 border rounded"
              />
              <button
                onClick={addDirectoryPattern}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Adicionar
              </button>
            </div>
          </div>

          {/* Content Blacklist */}
          <div>
            <h3 className="font-semibold mb-2">Conteúdo a Ignorar</h3>
            <div className="space-y-2 mb-2">
              {config.contentBlacklist.map((pattern, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
                    {pattern}
                  </code>
                  <button
                    onClick={() => removeContentPattern(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newContentPattern}
                onChange={(e) => setNewContentPattern(e.target.value)}
                placeholder="Ex: UnityEngine., PublicKeyToken="
                className="flex-1 px-3 py-2 border rounded"
              />
              <button
                onClick={addContentPattern}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Adicionar
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <button
              onClick={resetToDefaults}
              className="text-gray-500 hover:text-gray-700"
            >
              Restaurar Padrões
            </button>
            <div className="space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 border rounded hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={saveConfig}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              >
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
