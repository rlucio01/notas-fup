Nova versão do Notas FUP introduzindo o novo sistema dinâmico de filtragem por tags na tela de Atividades, sincronização delta estrita para Cloudflare D1 com zero gravações em repouso, correção no contraste de badges de filtros ativos e melhorias visuais.

---

### O que há de novo na v0.2.4:

- **Filtro Dinâmico por Tags**: Nova barra de tags na tela de Atividades que surge automaticamente quando houver demandas com tags (`#tag`), permitindo filtrar por uma tag específica ou combinar múltiplos filtros (Contexto `@` + Tag `#`).
- **Atalho Rápido de 1 Clique nos Cards**: Clicar diretamente no badge de qualquer tag nos cards das demandas (tanto no modo Lista quanto no modo Quadro Kanban) já ativa o filtro correspondente instantaneamente.
- **Botão "Limpar Filtros"**: Exibição contextual de botão para restaurar a visão geral completa quando qualquer filtro estiver ativo.
- **Sincronização Delta Estrita e Otimização de Quota D1**: Correção na desserialização de tipos booleanos originados do D1/SQLite (`sync_enabled`, `archived`), persistência segura do carimbo de sincronização (`last_sync_at`) na tabela local `meta` do SQLite e mecanismo de curto-circuito para evitar chamadas de gravação redundantes, mantendo o consumo de quota diária em zero quando em repouso.
- **Correção Visual do Contador de Filtros Ativos**: Solução para o contraste do badge numérico no filtro selecionado, garantindo visibilidade clara do total em ambos os modos claro e escuro.
- **Animação Incandescente de Conclusão**: Efeito visual de queima incandescente e transição polida ao marcar atividades como concluídas.
