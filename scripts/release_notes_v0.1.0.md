Primeiro release estável do **Notas FUP** (MVP), um substituto leve e de alta velocidade para o Notepad do Windows, projetado para captura instantânea de demandas, links, tickets e follow-ups ao longo do dia.

---

### O que há de novo na v0.1.0:

- **Desempenho Zero Idle Memory**: Arquitetura headless em Tauri 2 (Rust) com janelas criadas sob demanda e destruídas (`destroy()`) ao fechar. Processo residente na bandeja consumindo apenas **2,33 MB de Private Memory** e executável compilado de **5,37 MB**.
- **Captura Rápida Global (`Ctrl+Alt+N`)**: Janela suspensa sem bordas, centralizada e sempre no topo com sintaxe rápida na própria linha (`@contexto`, `#tag`, `!data`, `~pessoa`) e detecção automática do aplicativo em foco no momento da captura via Win32.
- **Armazenamento Local-First com SQLite e FTS5**: Banco de dados relacional embarcado (`rusqlite bundled`), chaves UUID v7 temporalmente ordenáveis, tombstones de soft-delete e busca full-text com remoção de diacríticos (`unicode61`).
- **Triagem no Inbox 100% por Teclado**: Atalhos para processamento em poucos segundos: `J`/`K` (navegar), `C` (contexto), `T` (tags), `D` (follow-up), `W` (aguardando), `X` (concluir) e `Del` (descartar).
- **Importador Inteligente do Notepad**: Módulo em Rust puro com 12 regras estruturadas (cabeçalhos `##`, blocos `##FUP`, checkboxes tolerantes `[x]`/`[]`, tickets `CHG`/`PTASK`/`PRB`, datas brasileiras e sanitização de segredos/senhas).
- **Busca Rápida (`Ctrl+K`)**: Pesquisa global instantânea com filtros cruzados por contexto, tipo, status e responsável.
- **Visão do Dia e Revisão Diária**: Tela inicial segmentada em Atrasados, Hoje, Aguardando (agrupado por pessoa) e Inbox, além de tela de revisão de fechamento de expediente e arquivo de concluídos.
- **Configurações com Auto-Save**: Personalização de atalhos globais, inicialização com o sistema, dias para alerta de estagnação e gestão de contextos de organização.
