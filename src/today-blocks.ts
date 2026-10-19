import type { Item, TodayBlocks } from "./types";

export function computeTodayBlocks(items: Item[], todayDateStr: string): TodayBlocks {
  const executing: Item[] = [];
  const overdue: Item[] = [];
  const today: Item[] = [];
  const waiting: Record<string, Item[]> = {};
  let inbox_count = 0;

  for (const item of items) {
    if (item.parent_id) {
      continue;
    }

    if (item.status === "done" || item.status === "dropped") {
      continue;
    }

    if (item.status === "inbox") {
      inbox_count += 1;
      continue;
    }

    // Check dates
    const itemDate = item.due_at || item.followup_at;
    const isOverdue = itemDate ? itemDate.substring(0, 10) < todayDateStr : false;
    const isToday = itemDate ? itemDate.substring(0, 10) === todayDateStr : false;

    if (isOverdue) {
      overdue.push(item);
    } else if (isToday) {
      today.push(item);
    }

    // Executing items: all active open tasks that the user is working on or has to execute
    if (item.status === "open") {
      executing.push(item);
    }

    // Waiting items (can also be in overdue/today if they have a date, but are grouped by person)
    if (item.status === "waiting") {
      const person = item.waiting_on ? item.waiting_on.trim() : "Sem responsável";
      if (!waiting[person]) {
        waiting[person] = [];
      }
      waiting[person].push(item);
    }
  }

  return {
    executing,
    overdue,
    today,
    waiting,
    inbox_count,
  };
}
