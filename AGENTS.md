# AGENTS.md -- Notas FUP

Guia de arquitetura, desenvolvimento e testes para o Notas FUP.

## Visão Geral

- **Objetivo**: Substituto ágil do Notepad do Windows para captura de demandas, follow-ups e busca local com foco em baixo consumo de memória.
- **Stack**: Tauri 2 (Rust) + React 19 + TypeScript + Vite.
- **Armazenamento**: SQLite embarcado (`rusqlite` com `bundled` e FTS5).
- **Alvo**: Windows 10/11 x64.

## Decisões de Arquitetura

1. **Ciclo de Vida das Janelas (Zero Idle Memory)**:
   - Nenhuma janela é pré-carregada ou declarada estaticamente no `tauri.conf.json`.
   - O aplicativo roda headless com ícone na bandeja do sistema (`tray-icon`).
   - Janelas de Captura Rápida (`capture`) e Principal (`main`) são criadas via `WebviewWindowBuilder` sob demanda e **destruídas (`destroy()`)** ao fechar.
   - O WebView2 não consome RAM enquanto em repouso.

2. **Modelo de Dados e Sincronização Local-First**:
   - Chave primária `id TEXT` gerada com **UUID v7** (temporalmente ordenável).
   - Colunas `created_at`, `updated_at` (ISO 8601 UTC) e `deleted_at` (soft-delete / tombstone).
   - Tabela `meta` armazena `device_id` único por instalação.
   - FTS5 com tokenizer `unicode61 remove_diacritics 2` e sincronização via triggers no SQLite.

3. **Parser do Notepad**:
   - Módulo isolado em Rust puro (`src-tauri/src/parser/`), testável sem Tauri.
   - Suporta as 12 regras de extração (cabeçalhos `##`, `FUP`, checkboxes tolerantes, URLs vinculadas, tickets, datas, aguardando/cobrança, detecção de segredos).

4. **Interface e Usabilidade**:
   - Sem emojis na UI.
   - Interface em Português do Brasil (código e identificadores em Inglês).
   - Sem dependência de Tailwind; estilos com CSS puro estruturado e variáveis de tema com suporte a `prefers-color-scheme`.
   - Navegação por atalhos no Inbox (`C`, `T`, `D`, `W`, `X`, `Del`).

## Comandos Úteis

### Backend (Rust / Tauri)
```bash
# Rodar testes unitários e de integração
cd src-tauri && cargo test

# Verificar lints e estilo
cd src-tauri && cargo clippy --all-targets -- -D warnings

# Build de desenvolvimento
cd src-tauri && cargo build
```

### Frontend (React / Vite / Vitest)
```bash
# Instalar dependências
npm install

# Rodar servidor de desenvolvimento Vite
npm run dev

# Rodar testes Vitest
npm test

# Build de produção do frontend
npm run build
```

### Projeto Completo
```bash
# Rodar todos os testes (frontend + backend)
npm run test:all

# Executar aplicação Tauri em modo dev
npm run tauri dev
```
