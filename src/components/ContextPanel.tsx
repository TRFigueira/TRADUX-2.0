import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Lightbulb, Database, Zap } from 'lucide-react';

/**
 * Componente ContextPanel - Painel de Contexto e QA
 * 
 * Apresenta informações contextuais sobre a string selecionada:
 * - Fuzzy Matches da Translation Memory (via SQLite FTS5)
 * - Avisos de QA (tags em falta, etc.)
 * - Sugestões de tradução
 */

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

interface ContextPanelProps {
  selectedString: {
    id: number;
    original_text: string;
    translated_text: string | null;
    shielded_text: string;
    status: string;
  } | null;
  fuzzyMatches: FuzzyMatch[];
  qaResult: QAResult | null;
  onApplyFuzzy: (text: string) => void;
  loading?: boolean;
}

/**
 * Componente de barra de similaridade visual.
 */
function SimilarityBar({ value }: { value: number }) {
  const percentage = Math.round(value * 100);
  let color = 'bg-cat-dark-500';
  if (percentage >= 90) color = 'bg-status-approved';
  else if (percentage >= 70) color = 'bg-status-translated';
  else if (percentage >= 50) color = 'bg-status-pending';
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-cat-dark-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-[10px] text-cat-dark-400 w-8 text-right">{percentage}%</span>
    </div>
  );
}

/**
 * Highlight de diferenças entre texto original e fuzzy match.
 */
function DiffHighlight({ text }: { text: string }) {
  // Simplificação: apenas truncar se muito longo
  const display = text.length > 100 ? text.substring(0, 100) + '...' : text;
  return <span className="text-cat-dark-300 text-xs leading-relaxed">{display}</span>;
}

export function ContextPanel({ 
  selectedString, 
  fuzzyMatches, 
  qaResult, 
  onApplyFuzzy,
  loading = false 
}: ContextPanelProps) {
  const [activeTab, setActiveTab] = useState<'tm' | 'qa'>('tm');

  if (!selectedString) {
    return (
      <aside className="w-80 bg-cat-dark-800 border-l border-cat-dark-700 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <Database className="w-12 h-12 text-cat-dark-600 mx-auto mb-3" />
            <p className="text-sm text-cat-dark-400">
              Selecione uma string no editor para ver sugestões da Translation Memory
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-cat-dark-800 border-l border-cat-dark-700 flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-cat-dark-700">
        <button
          onClick={() => setActiveTab('tm')}
          className={`
            flex-1 px-4 py-3 text-xs font-medium flex items-center justify-center gap-2
            transition-colors border-b-2
            ${activeTab === 'tm' 
              ? 'text-status-translated border-status-translated bg-cat-dark-700/30' 
              : 'text-cat-dark-400 border-transparent hover:text-cat-dark-200 hover:bg-cat-dark-700/20'
            }
          `}
        >
          <Database className="w-4 h-4" />
          Fuzzy Matches
          {fuzzyMatches.length > 0 && (
            <span className="px-1.5 py-0.5 bg-cat-dark-700 rounded-full text-[10px]">
              {fuzzyMatches.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('qa')}
          className={`
            flex-1 px-4 py-3 text-xs font-medium flex items-center justify-center gap-2
            transition-colors border-b-2
            ${activeTab === 'qa' 
              ? 'text-status-pending border-status-pending bg-cat-dark-700/30' 
              : 'text-cat-dark-400 border-transparent hover:text-cat-dark-200 hover:bg-cat-dark-700/20'
            }
          `}
        >
          <Zap className="w-4 h-4" />
          QA
          {qaResult && !qaResult.passed && (
            <span className="px-1.5 py-0.5 bg-status-pending/20 text-status-pending rounded-full text-[10px]">
              {qaResult.warnings.length}
            </span>
          )}
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'tm' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-cat-dark-400">
              <Lightbulb className="w-4 h-4" />
              <span>Memória de Tradução - Sugestões similares</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-cat-dark-600 border-t-status-translated rounded-full animate-spin" />
              </div>
            ) : fuzzyMatches.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-cat-dark-500">Nenhum match encontrado</p>
                <p className="text-xs text-cat-dark-600 mt-1">
                  A string será traduzida via IA
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {fuzzyMatches.map((match, index) => (
                  <div 
                    key={match.id}
                    className="
                      p-3 rounded-lg border border-cat-dark-700 bg-cat-dark-900/50
                      hover:border-cat-dark-600 transition-all group
                    "
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-cat-dark-500">
                        Match #{index + 1}
                      </span>
                      <SimilarityBar value={match.similarity} />
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <p className="text-[10px] text-cat-dark-500 uppercase mb-1">Original</p>
                        <DiffHighlight text={match.original_text} />
                      </div>
                      
                      <div className="border-t border-cat-dark-700/50 pt-2">
                        <p className="text-[10px] text-cat-dark-500 uppercase mb-1">Tradução</p>
                        <p className="text-sm text-cat-dark-200 leading-relaxed">
                          {match.translated_text}
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => onApplyFuzzy(match.translated_text)}
                      className="
                        mt-3 w-full py-2 px-3 rounded text-xs
                        bg-cat-dark-700 text-cat-dark-300
                        hover:bg-status-translated/20 hover:text-status-translated
                        transition-colors flex items-center justify-center gap-2
                        opacity-0 group-hover:opacity-100
                      "
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Usar esta tradução
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'qa' && (
          <div className="space-y-4">
            {!qaResult ? (
              <div className="text-center py-8">
                <p className="text-sm text-cat-dark-500">Aguardando verificação...</p>
              </div>
            ) : qaResult.passed ? (
              <div className="p-4 rounded-lg bg-status-translated/10 border border-status-translated/30">
                <div className="flex items-center gap-2 text-status-translated">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium text-sm">Verificação Aprovada</span>
                </div>
                <p className="text-xs text-cat-dark-400 mt-2">
                  Nenhum problema detectado na tradução.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-status-pending/10 border border-status-pending/30">
                  <div className="flex items-center gap-2 text-status-pending">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium text-sm">Avisos de Qualidade</span>
                  </div>
                  <p className="text-xs text-cat-dark-400 mt-2">
                    Foram encontrados {qaResult.warnings.length} problema(s) que requerem atenção.
                  </p>
                </div>

                <div className="space-y-2">
                  {qaResult.warnings.map((warning, index) => (
                    <div 
                      key={index}
                      className="p-3 rounded bg-cat-dark-900/50 border border-cat-dark-700"
                    >
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-status-pending flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-cat-dark-300 leading-relaxed">{warning}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {qaResult.originalLength !== undefined && qaResult.translatedLength !== undefined && (
                  <div className="p-3 rounded bg-cat-dark-900/50 border border-cat-dark-700">
                    <p className="text-[10px] text-cat-dark-500 uppercase mb-2">Estatísticas</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-cat-dark-500">Original:</span>
                        <span className="text-cat-dark-300 ml-1">{qaResult.originalLength} chars</span>
                      </div>
                      <div>
                        <span className="text-cat-dark-500">Tradução:</span>
                        <span className="text-cat-dark-300 ml-1">{qaResult.translatedLength} chars</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer com info da string */}
      <div className="p-3 border-t border-cat-dark-700 bg-cat-dark-900/50">
        <p className="text-[10px] text-cat-dark-500 uppercase mb-1">String Selecionada</p>
        <p className="text-xs text-cat-dark-300 truncate">ID: {selectedString.id}</p>
        <p className="text-[10px] text-cat-dark-500 mt-1 truncate">
          {selectedString.original_text.substring(0, 50)}
          {selectedString.original_text.length > 50 ? '...' : ''}
        </p>
      </div>
    </aside>
  );
}
