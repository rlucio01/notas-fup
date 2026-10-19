Nova versão do Notas FUP introduzindo o sistema completo de Subtarefas com suporte a hierarquia de demandas, aninhamento intuitivo por Arrastar e Soltar (Drag & Drop), gestão visual pelo painel lateral (DetailPane), contadores de progresso e sincronização local-first estendida para a nuvem Cloudflare D1.

---

### O que há de novo na v0.3.0:

- **Sistema Completo de Subtarefas**: Capacidade de decompor demandas complexas em subtarefas ágeis com ciclo de vida e checkboxes independentes, mantendo a visualização organizada e sem poluição na lista principal.
- **Aninhamento por Arrastar e Soltar (Drag & Drop)**: Ao arrastar qualquer cartão de demanda na tela de Atividades, todas as outras tarefas revelam uma área de ancoragem pontilhada ("Solte aqui para virar subtarefa"), transformando qualquer tarefa solta em subtarefa com um único movimento.
- **Visualização em Árvore com Chevrons de Expansão**: Cada tarefa pai com subtarefas exibe um botão de alternância para recolher/expandir a árvore e linhas visuais de hierarquia, permitindo focar no que importa.
- **Contador e Indicador de Progresso**: Badges contextuais de progresso (ex: `0/2`, `1/3`) e porcentagem no painel lateral, atualizados em tempo real ao marcar ou desmarcar cada subtarefa sem concluir a demanda principal prematuramente.
- **Gestão Ágil no Painel Lateral (DetailPane)**:
  - Adição rápida de novas subtarefas via input inline com tecla `Enter`.
  - Reatribuição simples através do seletor "Mover para dentro de outra tarefa".
  - Botão de desvinculação em 1 clique ("Desvincular") para retornar a subtarefa para o nível raiz a qualquer momento.
  - Banner informativo no topo quando uma subtarefa está selecionada para edição.
- **Banco de Dados Local SQLite (Migração v4)**: Adição do campo `parent_id` auto-referenciado com índice de alta performance e suporte nativo nas consultas analíticas de agregação.
- **Sincronização Cloudflare D1 e Worker**: Migração de schema aplicada no banco D1 remoto e atualização do Worker com suporte completo a leitura, escrita e sincronização delta de subtarefas.
