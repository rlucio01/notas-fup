# Notas FUP

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="Notas FUP Logo" width="96" height="96" />
</p>

<p align="center">
  <strong>Substituto leve e ágil do Bloco de Notas para captura de demandas, follow-ups e busca local com foco em consumo mínimo de memória.</strong>
</p>

<p align="center">
  <a href="https://github.com/rlucio01/notas-fup/releases/latest"><img src="https://img.shields.io/github/v/release/rlucio01/notas-fup?color=3b82f6&label=vers%C3%A3o" alt="Versão Mais Recente" /></a>
  <img src="https://img.shields.io/badge/plataforma-Windows%2010%20%2F%2011%20%7C%20Web%20Mobile-blue" alt="Plataforma" />
  <img src="https://img.shields.io/badge/stack-Tauri%202%20%2B%20Rust%20%2B%20React%2019-10b981" alt="Stack" />
  <img src="https://img.shields.io/badge/mem%C3%B3ria-%3C%2010%20MB%20em%20repouso-f59e0b" alt="Consumo de Memória" />
  <img src="https://img.shields.io/badge/licen%C3%A7a-MIT-8b5cf6" alt="Licença" />
</p>

---

## 💡 Por que o Notas FUP?

O Bloco de Notas do Windows (*Notepad*) é imbatível na velocidade de abertura para rabiscos temporários, mas não oferece estrutura: demandas se perdem, prazos de retorno passam despercebidos e tickets ficam espalhados. Aplicativos corporativos pesados, por outro lado, demoram para abrir e consomem centenas de megabytes de memória.

O **Notas FUP** une o melhor dos dois mundos:
1. **Velocidade do Notepad**: Abra a janela de captura com um atalho global instantâneo (`Ctrl + Alt + N`).
2. **Zero Idle Memory (< 10 MB RAM)**: O aplicativo roda na bandeja do sistema. O motor WebView2 é instanciado apenas quando uma janela é solicitada e é completamente destruído ao fechar.
3. **Local-First & Offline**: Armazenamento 100% local com SQLite embarcado e busca FTS5 instantânea.
4. **Sincronização em Nuvem & Acesso Móvel**: Sincronização em tempo real via Cloudflare D1 e portal web responsivo para você consultar e atualizar suas notas pelo celular.

---

## ✨ Funcionalidades Principais

- ⚡ **Captura Global Instantânea (`Ctrl + Alt + N`)**: Janela minimalista focada no teclado para registrar uma demanda sem perder o foco da sua tarefa atual.
- 📋 **Parser Inteligente de Anotações**: Cole um bloco de notas bruto; o parser extrai automaticamente contextos (`@trabalho`), tags (`#urgente`), datas de cobrança, pendências de terceiros (`aguardando: alguém`), URLs e referências de tickets (ex: `PTASK...`, `#1234`).
- 🎯 **Atividades & Follow-Up (Execução + Cobrança)**:
  - Separação clara entre tarefas em execução e pendências aguardando resposta de terceiros.
  - Reordenação de prioridades no topo da lista.
  - Ações rápidas de cobrança (+1 dia, +3 dias, etc.).
- 📥 **Inbox & Triagem pelo Teclado**: Navegue e classifique novas anotações em segundos com atalhos direcionais (`C`, `T`, `D`, `W`, `X`, `Del`).
- 🔍 **Busca Textual Ultrarrápida (SQLite FTS5)**: Busca por prefixo, título, conteúdo ou ticket sem distinção de acentos ou maiúsculas.
- ☁️ **Sincronização em Nuvem (Cloudflare D1 & Pages)**: Suas notas sincronizadas com criptografia e autenticação por chave para acesso via celular ou qualquer navegador.
- 🔄 **Atualizador Integrado (In-App Updater)**: Notificação e instalação direta de novos lançamentos publicados no GitHub Releases com apenas 1 clique.

---

## 🚀 Instalação Rápida no Windows

Você não precisa compilar nada para usar o Notas FUP:

1. Acesse a página de **[Lançamentos (Releases)](https://github.com/rlucio01/notas-fup/releases/latest)**.
2. Baixe o instalador executável: `Notas FUP_x.y.z_x64-setup.exe`.
3. Execute o instalador (instalação rápida no perfil do usuário, sem exigir privilégios de administrador).
4. O ícone 3D do Notas FUP aparecerá na barra de notificações (System Tray) e o atalho `Ctrl + Alt + N` estará ativo.

> 📱 **Acesso Web / Mobile**: Utilize o portal oficial em [https://notas-fup.pages.dev](https://notas-fup.pages.dev) para consultar e adicionar anotações pelo smartphone.

---

## ⌨️ Guia de Atalhos de Teclado

### Atalhos Globais
| Atalho | Ação |
| :--- | :--- |
| `Ctrl + Alt + N` | Abrir a Janela de Captura Rápida de qualquer lugar |
| `Ctrl + B` | Recolher / Expandir a barra lateral do aplicativo |
| `Ctrl + K` | Ir diretamente para a tela de Busca FTS5 |

### Navegação nas Telas Principais
| Tecla | Aba |
| :---: | :--- |
| `1` | Atividades & Follow-Up |
| `2` | Inbox (Triagem) |
| `3` | Busca FTS5 |
| `4` | Importar Texto do Notepad |
| `5` | Revisão Diária |
| `6` | Concluídos |
| `7` | Configurações |

### Triagem Rápida no Inbox
| Tecla | Ação |
| :---: | :--- |
| `C` | Atribuir ou alterar Contexto |
| `T` | Adicionar ou remover Tags |
| `D` | Definir prazo ou data de Follow-up |
| `W` | Marcar como aguardando retorno de terceiros |
| `X` | Concluir item |
| `Del` | Excluir item |

---

## 📝 Sintaxe da Captura Rápida

Ao digitar na Janela de Captura Rápida (`Ctrl + Alt + N`), você pode enriquecer a anotação na própria digitação:

```text
Alinhar deploy da API com o time @Contech #producao aguardando: Marcos cobrar: 2026-10-20 PTASK0018072 https://github.com/org/repo/pull/42
```

- `@Contexto`: Define a área ou projeto da demanda (ex: `@Belzya`, `@Contech`, `@Pessoal`).
- `#tag`: Adiciona marcadores de categorização (ex: `#urgente`, `#infra`).
- `aguardando: Nome`: Classifica automaticamente o item como follow-up aguardando retorno.
- `cobrar: YYYY-MM-DD` ou `amanhã`: Define o lembrete de follow-up.
- `TICKET` / `PTASK...`: Detecta referências de chamados automaticamente.
- `http...`: Converte em link clicável no item.

---

## 🛠️ Desenvolvimento Local

Caso queira contribuir ou executar o projeto a partir do código-fonte:

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- [Rust & Cargo](https://rustup.rs/) (ferramentas de build para Windows x64)
- PowerShell (Windows 10/11)

### Passos de Instalação

```powershell
# 1. Clonar o repositório
git clone https://github.com/rlucio01/notas-fup.git
cd "notas-fup"

# 2. Instalar dependências do Frontend
npm install

# 3. Configurar variáveis de ambiente opcionais (copie o exemplo)
Copy-Item .env.example .env

# 4. Executar em modo de desenvolvimento (Tauri + Vite)
.\scripts\dev.ps1 dev
```

### Comandos Úteis

```powershell
# Executar todos os testes (Vitest no Frontend + Cargo Test no Backend)
.\scripts\dev.ps1 test

# Verificação de linter e estilo Rust
.\scripts\dev.ps1 clippy

# Compilar instalador executável de produção (.exe)
npm run tauri build
```

---

## 🏗️ Arquitetura do Projeto

```
notas-fup/
├── src/                    # Frontend React 19 + TypeScript (SPA)
│   ├── App.tsx             # Layout principal, navegação e ciclo de vida
│   ├── Today.tsx           # Gestão de atividades em execução e follow-ups
│   ├── Inbox.tsx           # Triagem de demandas com atalhos de teclado
│   ├── Search.tsx          # Busca com SQLite FTS5 e filtros
│   ├── Settings.tsx        # Configurações, contextos e atualizador do GitHub
│   ├── Capture.tsx         # Janela compacta de captura rápida
│   └── cloud-sync.ts       # Mecanismo de sincronização bidirecional
├── src-tauri/              # Backend Rust nativo (Tauri 2)
│   ├── src/db/             # SQLite embarcado (rusqlite + triggers FTS5)
│   ├── src/parser/         # Parser com 12 regras de extração estruturada
│   ├── src/tray/           # System Tray nativo com ciclo de vida headless
│   ├── src/capture/        # Construtor dinâmico de janelas sem pré-alocação
│   └── tauri.conf.json     # Configuração de empacotamento NSIS para Windows
├── worker/                 # Backend Serverless opcional (Cloudflare Worker + D1)
│   ├── src/index.ts        # API REST para sincronização na nuvem
│   └── wrangler.toml       # Configuração de deploy do Cloudflare Worker
└── scripts/                # Scripts de automação (dev, testes, release)
```

---

## 🔒 Segurança & Privacidade

- **Dados Locais**: Seu banco de dados SQLite (`notas-fup.db`) fica salvo exclusivamente no seu computador (`%APPDATA%\com.rlucio.notasfup\`).
- **Nenhum Dado Sensível**: O repositório público não armazena nenhuma credencial, token ou segredo.
- **Detecção de Segredos**: O parser nativo possui regras de detecção automática para prevenir que senhas ou tokens colados acidentalmente sejam salvos sem o seu consentimento explícito.

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo [LICENSE](LICENSE) para obter mais informações.
