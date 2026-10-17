use super::*;

const FIXTURE_TEXT: &str = r#"##EMPRESA

- Estudar outras clouds sobre IA
- Fulano Silva, resolver storages e aplicar tenant (Esperar Beltrano)
- [x] Ver com BI sobre reservar máquinas (reunião)
- GTS CICD/Functions/deploy.yml
- Aumento de cotas do repositório (Azure)

---

##FUP EMPRESA

- [x] Ciclano sub ver budget
- Cobrar resposta de email do Fulano para Beltrano (21/09) - deixar escalar
- Cobrar resposta do time de contratos da POC (29/09)

---

##PESSOAL

- Verificar com o banco problemas de escritura e assinar docs
- Mudar plano do celular

---

##PROJETO X

[x ] Colocar mais um atalho de tradução
[ x] Transcrever arquivos de áudio
[] Revisar o sistema para produção

---
Liberar acessos:

PERFIL_LEITURA

---

CHG0012345 - Hotfix da versão 5.39.1.
13/10/2026 22:00:00 - Ponto?
---
PTASK0099999	3. Correção de vulnerabilidades

https://exemplo.service-now.com/nav/ui/problem_task.do?sys_id=abc123

---
Reservas do Beltrano
"#;

#[test]
fn test_fixture_parsing() {
    let items = parse(FIXTURE_TEXT);
    assert!(!items.is_empty(), "Items should not be empty");

    // 1. ##EMPRESA section
    let item0 = items.iter().find(|i| i.title.contains("Estudar outras clouds")).expect("item 0 not found");
    assert_eq!(item0.context.as_deref(), Some("Empresa"));
    assert_eq!(item0.status, "open");

    // Fulano Silva (Esperar Beltrano)
    let item1 = items.iter().find(|i| i.title.contains("resolver storages")).expect("item 1 not found");
    assert_eq!(item1.context.as_deref(), Some("Empresa"));
    assert_eq!(item1.status, "waiting");
    assert_eq!(item1.waiting_on.as_deref(), Some("Beltrano"));

    // [x] Ver com BI
    let item2 = items.iter().find(|i| i.title.contains("Ver com BI")).expect("item 2 not found");
    assert_eq!(item2.context.as_deref(), Some("Empresa"));
    assert_eq!(item2.status, "done");

    // 2. ##FUP EMPRESA section
    // [x] Ciclano sub ver budget
    let fup_done = items.iter().find(|i| i.title.contains("Ciclano sub")).expect("fup_done not found");
    assert_eq!(fup_done.context.as_deref(), Some("Empresa"));
    assert_eq!(fup_done.status, "done");

    // Cobrar resposta de email do Fulano para Beltrano (21/09)
    let fup1 = items.iter().find(|i| i.title.contains("Cobrar resposta de email")).expect("fup1 not found");
    assert_eq!(fup1.context.as_deref(), Some("Empresa"));
    assert_eq!(fup1.status, "waiting");
    assert_eq!(fup1.waiting_on.as_deref(), Some("Fulano"));
    assert!(fup1.followup_at.is_some(), "Followup date should be detected");
    assert!(fup1.followup_at.as_ref().unwrap().ends_with("-09-21"));

    // Cobrar resposta do time de contratos da POC (29/09)
    let fup2 = items.iter().find(|i| i.title.contains("time de contratos")).expect("fup2 not found");
    assert_eq!(fup2.context.as_deref(), Some("Empresa"));
    assert_eq!(fup2.status, "waiting");
    assert!(fup2.followup_at.is_some());
    assert!(fup2.followup_at.as_ref().unwrap().ends_with("-09-29"));

    // 3. ##PESSOAL section
    let pessoal = items.iter().find(|i| i.title.contains("problemas de escritura")).expect("pessoal not found");
    assert_eq!(pessoal.context.as_deref(), Some("Pessoal"));
    assert_eq!(pessoal.status, "open");

    // 4. ##PROJETO X section with checkbox variations without dashes
    let proj1 = items.iter().find(|i| i.title.contains("Colocar mais um atalho")).expect("proj1 not found");
    assert_eq!(proj1.context.as_deref(), Some("Projeto X"));
    assert_eq!(proj1.status, "done");

    let proj2 = items.iter().find(|i| i.title.contains("Transcrever arquivos")).expect("proj2 not found");
    assert_eq!(proj2.context.as_deref(), Some("Projeto X"));
    assert_eq!(proj2.status, "done");

    let proj3 = items.iter().find(|i| i.title.contains("Revisar o sistema")).expect("proj3 not found");
    assert_eq!(proj3.context.as_deref(), Some("Projeto X"));
    assert_eq!(proj3.status, "open");

    // 5. Loose lines: Liberar acessos
    let loose1 = items.iter().find(|i| i.title.contains("Liberar acessos")).expect("loose1 not found");
    assert!(loose1.context.is_none(), "Loose lines after separator must have no context");
    assert_eq!(loose1.status, "inbox");
    assert_eq!(loose1.body.as_deref(), Some("PERFIL_LEITURA"));

    // 6. CHG0012345 ticket item with date
    let ticket1 = items.iter().find(|i| i.title.contains("CHG0012345")).expect("ticket1 not found");
    assert_eq!(ticket1.ticket_ref.as_deref(), Some("CHG0012345"));
    assert_eq!(ticket1.kind, "ticket");
    assert_eq!(ticket1.due_at.as_deref(), Some("2026-10-13T22:00:00"));

    // 7. PTASK0099999 with isolated URL on next line
    let ticket2 = items.iter().find(|i| i.title.contains("PTASK0099999")).expect("ticket2 not found");
    assert_eq!(ticket2.ticket_ref.as_deref(), Some("PTASK0099999"));
    assert_eq!(ticket2.kind, "ticket");
    assert_eq!(
        ticket2.url.as_deref(),
        Some("https://exemplo.service-now.com/nav/ui/problem_task.do?sys_id=abc123")
    );

    // 8. Reservas do Beltrano
    let last = items.iter().find(|i| i.title.contains("Reservas do Beltrano")).expect("last not found");
    assert!(last.context.is_none());
    assert_eq!(last.status, "inbox");
}

#[test]
fn test_checkbox_variations() {
    let input = r#"
- [x] Marked with dash
- [X] Uppercase X with dash
- [x ] X space with dash
- [ x] Space X with dash
- [ ] Empty with dash
- [] Brackets only with dash
[x] No dash marked
[X] No dash uppercase
[x ] No dash x space
[ x] No dash space x
[ ] No dash empty
[] No dash empty brackets
"#;
    let items = parse(input);
    assert_eq!(items.len(), 12);

    let done_count = items.iter().filter(|i| i.status == "done").count();
    let open_count = items.iter().filter(|i| i.status == "open").count();

    assert_eq!(done_count, 8);
    assert_eq!(open_count, 4);
}

#[test]
fn test_context_normalization() {
    assert_eq!(normalize_context("EMPRESA"), "Empresa");
    assert_eq!(normalize_context("RDSL"), "RDSL");
    assert_eq!(normalize_context("POC"), "POC");
    assert_eq!(normalize_context("Projeto X"), "Projeto X");
    assert_eq!(normalize_context("trabalho"), "trabalho");
}

#[test]
fn test_secret_detection() {
    let input = r#"
- Anotar senha: SuperSecret123!
- Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz
- Normal note without secrets
- password = my_database_pass_2026
"#;
    let items = parse(input);
    assert_eq!(items.len(), 4);

    assert!(items[0].is_secret, "senha should be flagged as secret");
    assert!(!items[0].force_import);

    assert!(items[1].is_secret, "Token should be flagged as secret");
    assert!(!items[1].force_import);

    assert!(!items[2].is_secret, "Normal note must NOT be secret");

    assert!(items[3].is_secret, "password should be flagged as secret");
}

#[test]
fn test_dates_extraction() {
    // dd/mm/aaaa hh:mm:ss
    assert_eq!(
        detect_date("Reunião 15/04/2026 14:30:00 com diretoria"),
        Some("2026-04-15T14:30:00".to_string())
    );

    // dd/mm/aaaa
    assert_eq!(
        detect_date("Entrega do relatório em 20/05/2026 impreterivelmente"),
        Some("2026-05-20".to_string())
    );

    // dd/mm (current year)
    let d = detect_date("Cobrar fulano (21/09)");
    assert!(d.is_some());
    assert!(d.unwrap().ends_with("-09-21"));
}

#[test]
fn test_ticket_detection() {
    assert_eq!(detect_ticket("PTASK0012345"), Some("PTASK0012345".to_string()));
    assert_eq!(detect_ticket("Fix for CHG0012345 is ready"), Some("CHG0012345".to_string()));
    assert_eq!(detect_ticket("Incident INC0098765 opened"), Some("INC0098765".to_string()));
    assert_eq!(detect_ticket("No ticket here"), None);
}

#[test]
fn test_no_data_discarded() {
    let unclassified = "Alguma linha solta que nao se parece com nada";
    let items = parse(unclassified);
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].title, unclassified);
    assert_eq!(items[0].status, "inbox");
    assert!(items[0].context.is_none());
}
