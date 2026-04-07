# TRADUX 2.0

Ferramenta CAT (Computer-Assisted Translation) para tradução de jogos Unity - Versão 2.0

## 🎯 Visão Geral

TRADUX 2.0 é uma ferramenta completa para tradução de jogos Unity, desenvolvida com tecnologias modernas para oferecer a melhor experiência possível para tradutores.

## ✅ Funcionalidades Principais

### 🎮 Extração de Textos
- **Scan inteligente** de arquivos traduzíveis (JSON, CSV, XML, TXT)
- **Integração UABEA** para extração de arquivos .assets Unity
- **Suporte AssetStudio CLI** para extração automática (em desenvolvimento)
- **Detecção automática** de pastas prioritárias (StreamingAssets, Resources, etc.)

### 📝 Interface de Tradução
- **Editor lado a lado** com texto original e tradução
- **Sistema de progresso** em tempo real
- **Busca e filtros** avançados
- **Visualização de contexto** para melhor tradução

### 🗄️ Gestão de Projetos
- **Banco de dados SQLite** para armazenamento eficiente
- **Importação/Exportação** em múltiplos formatos
- **Histórico de traduções** e backup automático
- **Suporte a múltiplos idiomas**

### 🎨 Interface Moderna
- **Design responsivo** com TailwindCSS
- **Ícones intuitivos** com Lucide React
- **Tema escuro** para conforto visual
- **Atalhos de teclado** para produtividade

## 🛠️ Tecnologias

- **Frontend**: React 18 + TypeScript + TailwindCSS
- **Backend**: Electron + Node.js
- **Banco de Dados**: Better-SQLite3
- **Build**: Vite + Electron Builder
- **Integrações**: UABEA, AssetStudio CLI

## 📋 Requisitos

- Node.js 18+
- Windows 10+ (testado)
- UABEA para extração de arquivos .assets Unity

## 🚀 Instalação Rápida

1. **Clone o repositório:**
```bash
git clone https://github.com/TRFigueira/TRADUX-2.0.git
cd TRADUX-2.0
```

2. **Instale as dependências:**
```bash
npm install
```

3. **Execute em modo desenvolvimento:**
```bash
npm run dev
```

## 📖 Como Usar

### 1. Importar Jogo
1. Clique em **"Importar Jogo Unity"**
2. Selecione a pasta principal do jogo
3. Aguarde o scan automático de arquivos traduzíveis

### 2. Extrair Textos de .assets
1. Se encontrar arquivos .assets, clique em **"Abrir UABEA"**
2. Extraia manualmente os textos no UABEA
3. Importe os arquivos gerados no TRADUX

### 3. Traduzir
1. Selecione os textos na lista
2. Digite suas traduções no editor
3. Use o contexto para referência
4. Salve automaticamente

### 4. Exportar Traduções
1. Clique em **"Exportar Traduções"**
2. Escolha o formato desejado
3. Salve na pasta do jogo

## 📁 Estrutura do Projeto

```
TRADUX-2.0/
├── src/
│   ├── components/          # Componentes React
│   │   ├── ScanModal.tsx   # Modal de importação
│   │   ├── Editor.tsx      # Editor de tradução
│   │   └── ...
│   ├── skills/            # Integrações externas
│   │   ├── uabeaIntegration.ts
│   │   └── assetStudioIntegration.ts
│   └── utils/            # Utilitários
├── electron/
│   ├── main.ts           # Processo principal
│   ├── preload.ts        # Script de preload
│   └── database/         # Schema do banco
├── public/              # Arquivos estáticos
└── dist/               # Build da aplicação
```

## 🔧 Configuração

### UABEA Integration
1. Baixe UABEA: https://github.com/Sergeanur/UABEA
2. Extraia para a pasta de ferramentas
3. O programa detectará automaticamente

### AssetStudio CLI (Opcional)
1. Baixe AssetStudioCLI_net6_win_x64.zip
2. Extraia para tools/assetstudio/
3. Habilite extração automática

## 📊 Roadmap

### ✅ Versão 2.0 (Atual)
- [x] Interface Electron + React completa
- [x] Integração UABEA funcional
- [x] Banco de dados SQLite
- [x] Sistema de progresso

### 🔄 Versão 2.1 (Próxima)
- [ ] API de tradução automática
- [ ] Memória de tradução compartilhada
- [ ] Colaboração em equipe
- [ ] Plugin system

### 🚧 Versão 3.0 (Futura)
- [ ] Interface web
- [ ] Cloud sync
- [ ] IA assistance
- [ ] Marketplace de plugins

## 🤝 Contribuição

Contribuições são bem-vindas! Por favor:

1. **Fork** o repositório
2. **Crie** uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. **Commit** suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. **Push** para a branch (`git push origin feature/AmazingFeature`)
5. **Abra** um Pull Request

## 📝 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🙏 Agradecimentos

- **UABEA** - Ferramenta essencial para extração de assets Unity
- **AssetStudio** - Framework poderoso para análise de arquivos Unity
- **Electron** - Plataforma para aplicações desktop modernas
- **React** - Biblioteca fantástica para interfaces de usuário

## 📞 Suporte

- 🐛 **Reporte bugs**: [Issues](https://github.com/TRFigueira/TRADUX-2.0/issues)
- 💡 **Sugestões**: [Discussions](https://github.com/TRFigueira/TRADUX-2.0/discussions)
- 📧 **Contato**: [GitHub Profile](https://github.com/TRFigueira)

---

**TRADUX 2.0** - Tradução de jogos Unity, simplificada. 🎮✨
