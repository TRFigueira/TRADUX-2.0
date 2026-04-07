# Unity CAT Tool

Ferramenta CAT (Computer-Assisted Translation) para tradução de jogos Unity, desenvolvida com Electron + React.

## 🎯 Funcionalidades

### ✅ Implementadas
- **Interface Electron + React** moderna e responsiva
- **Banco de dados SQLite** para armazenamento de traduções
- **Scan inteligente** de arquivos traduzíveis (JSON, CSV, XML, TXT)
- **Integração com UABEA** para extração de arquivos .assets Unity
- **Importação/Exportação** de arquivos de tradução
- **Interface de tradução** com visualização lado a lado
- **Sistema de progresso** em tempo real
- **Gestão de projetos** de tradução

### 🔄 Em Desenvolvimento
- Extração automática com AssetStudio CLI
- API de tradução automática
- Sistema de memória de tradução
- Colaboração em equipe

## 🛠️ Tecnologias

- **Frontend**: React 18 + TypeScript + TailwindCSS
- **Backend**: Electron + Node.js
- **Banco de Dados**: Better-SQLite3
- **Build**: Vite + Electron Builder
- **Ícones**: Lucide React

## 📋 Requisitos

- Node.js 18+
- Windows 10+ (testado)
- UABEA para extração de arquivos .assets Unity

## 🚀 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/tradutor-unity-cat-tool.git
cd tradutor-unity-cat-tool
```

2. Instale as dependências:
```bash
npm install
```

3. Execute em modo desenvolvimento:
```bash
npm run dev
```

4. Para build de produção:
```bash
npm run build
npm run electron:build
```

## 📁 Estrutura do Projeto

```
src/
├── components/          # Componentes React
├── skills/            # Integrações externas (UABEA, AssetStudio)
├── types/             # Definições TypeScript
└── utils/             # Utilitários

electron/
├── main.ts            # Processo principal Electron
├── preload.ts         # Script de preload
└── database/          # Schema e operações do banco

public/                # Arquivos estáticos
dist/                  # Build do frontend
dist-electron/         # Build do backend
```

## 🎮 Como Usar

### 1. Importar Jogo
1. Clique em "Importar Jogo Unity"
2. Selecione a pasta do jogo
3. O programa fará scan automático de arquivos traduzíveis

### 2. Extrair Textos de .assets
1. Se encontrar arquivos .assets, clique em "Abrir UABEA"
2. Extraia manualmente os textos no UABEA
3. Importe os arquivos gerados

### 3. Traduzir
1. Selecione os textos na interface
2. Digite as traduções
3. Salve o progresso automaticamente

### 4. Exportar
1. Clique em "Exportar Traduções"
2. Escolha o formato desejado
3. Salve na pasta do jogo

## 🔧 Configuração

### UABEA Integration
O programa integra-se com o UABEA para extração de arquivos .assets Unity:

1. Baixe o UABEA: https://github.com/Sergeanur/UABEA
2. Extraia para a pasta de ferramentas do programa
3. O programa detectará automaticamente

### AssetStudio CLI (Opcional)
Para extração automática (em desenvolvimento):

1. Baixe AssetStudioCLI_net6_win_x64.zip
2. Extraia o executável na pasta tools/assetstudio/
3. O programa usará para extração automática

## 📊 Status do Projeto

- ✅ **MVP Completo**: Funcionalidades básicas implementadas
- 🔄 **Beta Test**: Em teste com usuários reais
- 🚧 **V2.0**: Planejando recursos avançados

## 🤝 Contribuição

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature
3. Faça commit das mudanças
4. Abra um Pull Request

## 📝 Licença

MIT License - veja o arquivo LICENSE para detalhes.

## 🙏 Agradecimentos

- **UABEA** - Ferramenta de extração de assets Unity
- **AssetStudio** - Framework para análise de arquivos Unity
- **Electron** - Framework para aplicações desktop
- **React** - Biblioteca de interface de usuário
