/**
 * Módulo Unshield - Restauração de Tags Unity
 * 
 * Este módulo reverte o processo de shielding, restaurando os tokens
 * protegidos ([TAG_N], [VAR_N], [BIND_N]) pelas tags nativas da Unity.
 * 
 * É o passo final antes do reempacotamento, garantindo que o jogo
 * recebe as strings com a formatação original funcional.
 */

/**
 * Interface do dicionário de tags guardado durante a extração.
 */
export interface TagDictionary {
  /** Mapeamento de token para tag original */
  tags: Record<string, string>;
  /** Timestamp da extração */
  extractedAt?: string;
  /** Arquivo de origem */
  sourceFile?: string;
}

/**
 * Resultado da operação de unshield.
 */
export interface UnshieldResult {
  /** Texto com tags restauradas */
  restoredText: string;
  /** Tokens que foram restaurados */
  restoredTokens: string[];
  /** Tokens que não foram encontrados no dicionário */
  missingTokens: string[];
  /** Sucesso total da operação */
  success: boolean;
}

/**
 * Erro específico de unshielding.
 */
export class UnshieldError extends Error {
  constructor(
    message: string,
    public readonly missingTokens: string[]
  ) {
    super(message);
    this.name = 'UnshieldError';
  }
}

/**
 * Restaura as tags nativas num texto traduzido.
 * 
 * Processo:
 * 1. Encontra todos os tokens [TAG_N], [VAR_N], [BIND_N] no texto
 * 2. Substitui cada token pela tag original do dicionário
 * 3. Reporta tokens não encontrados
 * 
 * @param shieldedText Texto com tokens protegidos
 * @param tagDict Dicionário de tags da extração
 * @returns Resultado com texto restaurado
 */
export function unshieldText(
  shieldedText: string,
  tagDict: TagDictionary
): UnshieldResult {
  const restoredTokens: string[] = [];
  const missingTokens: string[] = [];
  
  // Regex para capturar todos os tokens protegidos
  const tokenRegex = /\[(TAG|VAR|BIND)_(\d+)\]/g;
  
  let restoredText = shieldedText;
  let match;
  
  // Criar conjunto de tokens únicos no texto
  const tokensInText = new Set<string>();
  while ((match = tokenRegex.exec(shieldedText)) !== null) {
    tokensInText.add(match[0]);
  }
  
  // Ordenar tokens por tamanho descendente para evitar substituições parciais
  // Ex: [TAG_10] deve ser substituído antes de [TAG_1]
  const sortedTokens = Array.from(tokensInText).sort((a, b) => b.length - a.length);
  
  for (const token of sortedTokens) {
    const originalTag = tagDict.tags[token];
    
    if (originalTag !== undefined) {
      // Escapar caracteres especiais regex no token
      const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedToken, 'g');
      
      restoredText = restoredText.replace(regex, originalTag);
      restoredTokens.push(token);
    } else {
      missingTokens.push(token);
    }
  }
  
  const success = missingTokens.length === 0;
  
  if (!success) {
    console.warn(`[Unshield] Tokens não encontrados: ${missingTokens.join(', ')}`);
  }
  
  return {
    restoredText,
    restoredTokens,
    missingTokens,
    success
  };
}

/**
 * Verifica se um texto contém tokens protegidos.
 * Útil para validação antes do unshield.
 */
export function hasProtectedTokens(text: string): boolean {
  return /\[(TAG|VAR|BIND)_\d+\]/.test(text);
}

/**
 * Extrai lista de tokens únicos de um texto.
 */
export function extractTokens(text: string): string[] {
  const matches = text.match(/\[(TAG|VAR|BIND)_\d+\]/g);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Cria um dicionário de tags vazio para inicialização.
 */
export function createEmptyTagDictionary(sourceFile?: string): TagDictionary {
  return {
    tags: {},
    extractedAt: new Date().toISOString(),
    sourceFile
  };
}
