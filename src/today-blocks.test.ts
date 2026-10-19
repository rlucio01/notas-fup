import { describe, it, expect } from "vitest";
import { computeTodayBlocks } from "./today-blocks";
import type { Item } from "./types";

describe("today-blocks", () => {
  const todayStr = "2026-10-17";

  const makeItem = (partial: Partial<Item>): Item => ({
    id: "018f0000-0000-7000-8000-000000000001",
    context_id: "ctx1",
    kind: "task",
    title: "Item de teste",
    body: null,
    status: "open",
    waiting_on: null,
    followup_at: null,
    due_at: null,
    ticket_ref: null,
    url: null,
    done_at: null,
    source: "manual",
    origin_app: null,
    created_at: "2026-10-17T00:00:00Z",
    updated_at: "2026-10-17T00:00:00Z",
    deleted_at: null,
    ...partial,
  });

  it("classifies overdue items correctly", () => {
    const items: Item[] = [
      makeItem({ id: "1", title: "Atrasado", due_at: "2026-10-15" }),
      makeItem({ id: "2", title: "Para hoje", due_at: "2026-10-17" }),
      makeItem({ id: "3", title: "Futuro", due_at: "2026-10-25" }),
    ];

    const blocks = computeTodayBlocks(items, todayStr);
    expect(blocks.overdue.length).toBe(1);
    expect(blocks.overdue[0].id).toBe("1");
    expect(blocks.today.length).toBe(1);
    expect(blocks.today[0].id).toBe("2");
  });

  it("groups waiting items by person", () => {
    const items: Item[] = [
      makeItem({ id: "1", status: "waiting", waiting_on: "Beltrano", title: "Cobrar deploy" }),
      makeItem({ id: "2", status: "waiting", waiting_on: "Beltrano", title: "Cobrar PR" }),
      makeItem({ id: "3", status: "waiting", waiting_on: "Fulano", title: "Aguardar aprovação" }),
      makeItem({ id: "4", status: "waiting", waiting_on: null, title: "Sem nome" }),
    ];

    const blocks = computeTodayBlocks(items, todayStr);
    expect(Object.keys(blocks.waiting)).toContain("Beltrano");
    expect(Object.keys(blocks.waiting)).toContain("Fulano");
    expect(Object.keys(blocks.waiting)).toContain("Sem responsável");
    expect(blocks.waiting["Beltrano"].length).toBe(2);
    expect(blocks.waiting["Fulano"].length).toBe(1);
  });

  it("counts inbox items and excludes done items", () => {
    const items: Item[] = [
      makeItem({ id: "1", status: "inbox" }),
      makeItem({ id: "2", status: "inbox" }),
      makeItem({ id: "3", status: "done" }),
      makeItem({ id: "4", status: "dropped" }),
    ];

    const blocks = computeTodayBlocks(items, todayStr);
    expect(blocks.inbox_count).toBe(2);
    expect(blocks.overdue.length).toBe(0);
    expect(blocks.today.length).toBe(0);
  });

  it("excludes subtasks from top-level blocks", () => {
    const items: Item[] = [
      makeItem({ id: "parent-1", status: "open", title: "Tarefa Pai" }),
      makeItem({ id: "sub-1", status: "open", parent_id: "parent-1", title: "Subtarefa 1" }),
      makeItem({ id: "sub-2", status: "open", parent_id: "parent-1", title: "Subtarefa 2" }),
    ];

    const blocks = computeTodayBlocks(items, todayStr);
    expect(blocks.executing.length).toBe(1);
    expect(blocks.executing[0].id).toBe("parent-1");
  });
});
