# Scan Unity Game Directory

## Description

Quando o usuário acionar este workflow, você deve utilizar a skill `unity-auto-discovery`. 

Abra um seletor de diretórios nativo do sistema operacional (via Electron dialog). Quando o usuário selecionar a pasta do jogo, inicie a varredura profunda no backend, processe os arquivos filtrados e exiba uma árvore visual de "Arquivos Traduzíveis" no frontend (React) contabilizando o total de palavras encontradas.

## Steps

1. **Abrir Seletor de Pasta**
   - Use `dialog.showOpenDialog` com `properties: ['openDirectory']`
   - Título: "Selecionar Pasta do Jogo Unity"

2. **Iniciar Varredura Profunda**
   - Instanciar `UnityAutoDiscovery`
   - Chamar `scanGameDirectory(selectedPath, onProgress)`
   - Progresso deve ser reportado ao frontend via IPC

3. **Processar Resultados**
   - Filtrar arquivos com `isTranslatable: true`
   - Ordenar por prioridade (descendente)
   - Calcular estatísticas (total de arquivos, strings, palavras)

4. **Exibir Árvore Visual**
   - Mostrar lista de arquivos encontrados
   - Indicar prioridade e confiança
   - Preview das primeiras strings
   - Botão para importar selecionados

5. **Importar para SQLite**
   - Para cada arquivo selecionado:
     - Extrair strings
     - Inserir em lote (BEGIN...COMMIT)
   - Reportar progresso de importação

## IPC Events

- `scan-started`: Início da varredura
- `scan-progress`: Progresso atual (fase, arquivo, %)
- `scan-complete`: Resultado final
- `scan-error`: Erro durante scan
- `import-progress`: Progresso de importação SQLite

## Frontend Components

- `ScanModal`: Modal de varredura com progresso
- `ScanResults`: Árvore de arquivos encontrados
- `FileTreeItem`: Item individual com checkbox
