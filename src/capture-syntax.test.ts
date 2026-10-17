import { describe, it, expect } from "vitest";
import { parseQuickCapture, parseDateToken } from "./capture-syntax";

describe("capture-syntax", () => {
  const refDate = new Date("2026-10-17T12:00:00Z");

  it("parses full syntax correctly", () => {
    const input = "cobrar resposta da POC @empresa #finops !22/10 ~beltrano";
    const res = parseQuickCapture(input, refDate);

    expect(res.title).toBe("cobrar resposta da POC");
    expect(res.context).toBe("empresa");
    expect(res.tags).toEqual(["finops"]);
    expect(res.waiting_on).toBe("beltrano");
    expect(res.followup_at).toBe("2026-10-22");
  });

  it("parses date tokens: hoje, amanha, amanha com acento", () => {
    expect(parseDateToken("hoje", refDate)).toBe("2026-10-17");
    expect(parseDateToken("amanha", refDate)).toBe("2026-10-18");
    expect(parseDateToken("amanhã", refDate)).toBe("2026-10-18");
    expect(parseDateToken("25/12", refDate)).toBe("2026-12-25");
    expect(parseDateToken("01/01/2027", refDate)).toBe("2027-01-01");
  });

  it("handles ticket reference and url", () => {
    const input = "Fix bug PTASK0012345 in production https://jira.company.com/browse/PTASK0012345 @trabalho";
    const res = parseQuickCapture(input, refDate);

    expect(res.ticket_ref).toBe("PTASK0012345");
    expect(res.url).toBe("https://jira.company.com/browse/PTASK0012345");
    expect(res.context).toBe("trabalho");
  });

  it("handles multiline input with body", () => {
    const input = "Criar nova branch de release @finops\nLinha 1 de notas\nLinha 2 de notas";
    const res = parseQuickCapture(input, refDate);

    expect(res.title).toBe("Criar nova branch de release");
    expect(res.context).toBe("finops");
    expect(res.body).toBe("Linha 1 de notas\nLinha 2 de notas");
  });

  it("handles multiple tags", () => {
    const input = "Verificar infra #aws #urgente #prod";
    const res = parseQuickCapture(input, refDate);

    expect(res.title).toBe("Verificar infra");
    expect(res.tags).toEqual(["aws", "urgente", "prod"]);
  });
});
