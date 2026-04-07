import { useState, useCallback, useEffect } from 'react';
import { AlertTriangle, Check, Copy, Sparkles, Save } from 'lucide-react';

/**
 * Componente Editor - Grade Bilíngue
 * 
 * Interface principal de tradução com:
 * - Coluna Source (texto original, somente leitura)
 * - Coluna Target (texto editável / traduzido)
 * - Highlight visual de tags protegidas [TAG_N], [VAR_N], etc.
 * - Ações por string (salvar, copiar, usar IA)
 */

interface StringItem {
  id: number;
  source_file: string;
  path_id: string;
  original_text: string;
  shielded_text: string;
  translated_text: string | null;
  status: 'pending' | 'translated' | 'reviewed' | 'approved';
}

interface EditorProps {
  strings: StringItem[];
  selectedStringId: number | null;
  onSelectString: (id: number) => void;
  onSaveTranslation: (id: number, text: string) => Promise<void>;
  onRequestAI: (id: number) => Promise<void>;
}

/**
 * Componente para renderizar texto com highlight de tags protegidas.
 * Substitui tokens [TAG_N], [VAR_N], [BIND_N] por spans estilizados.
 */
function HighlightedText({ text }: { text: string }) {
  if (!text) return null;
  
  // Regex para detectar tokens protegidos
  const tokenRegex = /(\[TAG_\d+\]|\[VAR_\d+\]|\[BIND_\d+\])/g;
  const parts = text.split(tokenRegex);
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.match(tokenRegex)) {
          return (
            <span
              key={index}
              className="
                inline-block px-1.5 py-0.5 mx-0.5 rounded text-xs font-mono
                bg-tag-highlight-bg border border-tag-highlight-border
                text-tag-highlight-text shadow-sm
                hover:bg-tag-highlight-bg/80 transition-colors
                cursor-help
              "
              title="Tag protegida - não modificar"
            >
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

/**
 * Badge de estado da tradução.
 */
function StatusBadge({ status }: { status: string }) {
  const colors = {
    pending: 'bg-status-pending/20 text-status-pending border-status-pending/30',
    translated: 'bg-status-translated/20 text-status-translated border-status-translated/30',
    reviewed: 'bg-status-reviewed/20 text-status-reviewed border-status-reviewed/30',
    approved: 'bg-status-approved/20 text-status-approved border-status-approved/30'
  };
  
  const labels = {
    pending: 'Pendente',
    translated: 'Traduzido',
    reviewed: 'Revisado',
    approved: 'Aprovado'
  };
  
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors[status as keyof typeof colors] || colors.pending}`}>
      {labels[status as keyof typeof labels] || status}
    </span>
  );
}

export function Editor({ 
  strings, 
  selectedStringId, 
  onSelectString, 
  onSaveTranslation,
  onRequestAI 
}: EditorProps) {
  // Estado local para edição de texto
  const [editingText, setEditingText] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [generatingAI, setGeneratingAI] = useState<Set<number>>(new Set());

  // Inicializar editingText quando strings mudam
  useEffect(() => {
    const initial: Record<number, string> = {};
    strings.forEach(s => {
      initial[s.id] = s.translated_text || '';
    });
    setEditingText(initial);
  }, [strings]);

  const handleTextChange = useCallback((id: number, value: string) => {
    setEditingText(prev => ({ ...prev, [id]: value }));
  }, []);

  const handleSave = useCallback(async (id: number) => {
    const text = editingText[id];
    if (text === undefined) return;
    
    setSaving(prev => new Set(prev).add(id));
    try {
      await onSaveTranslation(id, text);
    } finally {
      setSaving(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [editingText, onSaveTranslation]);

  const handleAI = useCallback(async (id: number) => {
    setGeneratingAI(prev => new Set(prev).add(id));
    try {
      await onRequestAI(id);
    } finally {
      setGeneratingAI(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [onRequestAI]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, id: number) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSave(id);
    }
  }, [handleSave]);

  if (strings.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-cat-dark-900">
        <div className="text-center">
          <p className="text-cat-dark-400 text-sm">Selecione um arquivo para começar</p>
          <p className="text-cat-dark-500 text-xs mt-1">As strings serão carregadas aqui</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 bg-cat-dark-900 flex flex-col h-full overflow-hidden">
      {/* Header do Editor */}
      <div className="px-4 py-3 border-b border-cat-dark-700 bg-cat-dark-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-cat-dark-200">
            {strings[0]?.source_file || 'Arquivo'}
          </h2>
          <span className="text-xs text-cat-dark-500">
            {strings.filter(s => s.translated_text).length} / {strings.length} traduzidas
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-cat-dark-400">Atalho: Ctrl+Enter para salvar</span>
        </div>
      </div>

      {/* Lista de Strings - Grelha Bilingue */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-cat-dark-700">
          {strings.map((stringItem, index) => {
            const isSelected = selectedStringId === stringItem.id;
            const isSaving = saving.has(stringItem.id);
            const isGenerating = generatingAI.has(stringItem.id);
            const currentText = editingText[stringItem.id] ?? (stringItem.translated_text || '');
            
            return (
              <div
                key={stringItem.id}
                onClick={() => onSelectString(stringItem.id)}
                className={`
                  group grid grid-cols-2 gap-4 p-4 cursor-pointer transition-colors
                  ${isSelected ? 'bg-cat-dark-800/80' : 'hover:bg-cat-dark-800/40'}
                `}
              >
                {/* Coluna Source (Original) */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-cat-dark-500">#{index + 1}</span>
                    <span className="text-[10px] text-cat-dark-500 font-mono truncate">
                      ID: {stringItem.path_id}
                    </span>
                  </div>
                  <div className="text-editor text-cat-dark-300 leading-relaxed font-sans">
                    <HighlightedText text={stringItem.original_text} />
                  </div>
                </div>

                {/* Coluna Target (Tradução) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <StatusBadge status={stringItem.status} />
                    
                    {/* Ações */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(currentText);
                        }}
                        className="p-1.5 rounded hover:bg-cat-dark-700 text-cat-dark-400 hover:text-cat-dark-200"
                        title="Copiar texto"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAI(stringItem.id);
                        }}
                        disabled={isGenerating}
                        className="p-1.5 rounded hover:bg-cat-dark-700 text-status-pending hover:text-status-pending disabled:opacity-50"
                        title="Gerar com IA"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-pulse' : ''}`} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSave(stringItem.id);
                        }}
                        disabled={isSaving || currentText === stringItem.translated_text}
                        className="p-1.5 rounded hover:bg-cat-dark-700 text-status-translated hover:text-status-translated disabled:opacity-50"
                        title="Salvar (Ctrl+Enter)"
                      >
                        {isSaving ? (
                          <span className="w-3.5 h-3.5 block border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Área de Edição */}
                  <textarea
                    value={currentText}
                    onChange={(e) => handleTextChange(stringItem.id, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, stringItem.id)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Digite a tradução..."
                    className="
                      w-full min-h-[80px] p-3 rounded resize-none
                      bg-cat-dark-900 border border-cat-dark-700
                      text-editor text-cat-dark-200 placeholder-cat-dark-500
                      focus:border-status-translated/50 focus:ring-1 focus:ring-status-translated/30
                      transition-all outline-none font-sans leading-relaxed
                    "
                    spellCheck={false}
                  />
                  
                  {/* Preview de tags no target */}
                  {currentText && (
                    <div className="text-xs text-cat-dark-500 flex items-center gap-2">
                      <span>Visualização:</span>
                      <span className="text-cat-dark-300">
                        <HighlightedText text={currentText} />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
