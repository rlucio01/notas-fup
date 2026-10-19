Atualização de correção e estabilidade do Notas FUP, corrigindo a inicialização automática com o Windows e garantindo sincronização em tempo real entre a interface de Configurações e o Registro do sistema operacional.

---

### O que há de novo na v0.2.2:

- **Inicialização Automática com o Windows (Autostart)**: Conexão da opção "Iniciar com o Windows" nas Configurações com o Registro do sistema (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`), permitindo que a aplicação seja carregada minimizada na bandeja do sistema ao ligar o computador.
- **Sincronização de Estado nas Configurações**: A interface agora consulta diretamente o status real do Windows ao abrir a tela de configurações e sincroniza automaticamente a inicialização no boot.
- **Resiliência e Recuperação de Erros**: Tratamento robusto contra falhas de permissão no Registro do Windows e feedback visual imediato em caso de inconsistência.
- **Testes Unitários de Autostart**: Cobertura automatizada no frontend e garantia de integridade nas chamadas do ecossistema desktop.
