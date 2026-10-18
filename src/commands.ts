import { invoke } from "@tauri-apps/api/core";
import { isTauri, getCloudConfig, DEFAULT_CLOUD_URL, DEFAULT_CLOUD_SECRET } from "./cloud-sync";
import type { Context, Item, ProposedItem, FollowupAlerts, ItemStatus, ItemKind } from "./types";

const getApiHeaders = () => {
  const config = getCloudConfig();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.secret || DEFAULT_CLOUD_SECRET}`,
  };
};

const getApiUrl = (endpoint: string) => {
  const config = getCloudConfig();
  const base = (config.url || DEFAULT_CLOUD_URL).replace(/\/+$/, "");
  return `${base}${endpoint}`;
};

export async function getTodayItems(): Promise<Item[]> {
  if (isTauri()) {
    const json = await invoke<string>("get_today_items");
    return JSON.parse(json);
  }
  const res = await fetch(getApiUrl("/api/items"), { headers: getApiHeaders() });
  if (!res.ok) throw new Error("Falha ao obter itens da nuvem");
  const items: Item[] = await res.json();
  return items.filter((i) => i.status !== "done" && i.status !== "dropped");
}

export async function getInboxItems(): Promise<Item[]> {
  if (isTauri()) {
    const json = await invoke<string>("get_inbox_items");
    return JSON.parse(json);
  }
  const res = await fetch(getApiUrl("/api/items"), { headers: getApiHeaders() });
  if (!res.ok) throw new Error("Falha ao obter inbox da nuvem");
  const items: Item[] = await res.json();
  return items.filter((i) => i.status === "inbox");
}

export async function getDoneItems(): Promise<Item[]> {
  if (isTauri()) {
    const json = await invoke<string>("get_done_items");
    return JSON.parse(json);
  }
  const res = await fetch(getApiUrl("/api/items"), { headers: getApiHeaders() });
  if (!res.ok) throw new Error("Falha ao obter concluídos da nuvem");
  const items: Item[] = await res.json();
  return items.filter((i) => i.status === "done" || i.status === "dropped");
}

export async function getReviewItems(staleDays: number = 5): Promise<Item[]> {
  if (isTauri()) {
    const json = await invoke<string>("get_review_items", { staleDays });
    return JSON.parse(json);
  }
  const res = await fetch(getApiUrl("/api/items"), { headers: getApiHeaders() });
  if (!res.ok) return [];
  const items: Item[] = await res.json();
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - staleDays);
  return items.filter((i) => i.status !== "done" && new Date(i.updated_at) < staleThreshold);
}

export async function getContexts(): Promise<Context[]> {
  if (isTauri()) {
    const json = await invoke<string>("get_contexts");
    return JSON.parse(json);
  }
  const res = await fetch(getApiUrl("/api/contexts"), { headers: getApiHeaders() });
  if (!res.ok) throw new Error("Falha ao obter contextos da nuvem");
  return res.json();
}

export async function createContext(name: string, color: string): Promise<Context> {
  if (isTauri()) {
    const json = await invoke<string>("create_context", { name, color });
    return JSON.parse(json);
  }
  const res = await fetch(getApiUrl("/api/contexts"), {
    method: "POST",
    headers: getApiHeaders(),
    body: JSON.stringify({ name, color }),
  });
  if (!res.ok) throw new Error("Falha ao criar contexto na nuvem");
  return res.json();
}

export async function updateContext(id: string, name: string, color: string): Promise<Context> {
  if (isTauri()) {
    const json = await invoke<string>("update_context", { id, name, color });
    return JSON.parse(json);
  }
  const res = await fetch(getApiUrl(`/api/contexts/${id}`), {
    method: "PATCH",
    headers: getApiHeaders(),
    body: JSON.stringify({ name, color }),
  });
  if (!res.ok) throw new Error("Falha ao atualizar contexto na nuvem");
  return res.json();
}

export async function deleteContext(id: string): Promise<void> {
  if (isTauri()) {
    await invoke("delete_context", { id });
    return;
  }
  await fetch(getApiUrl(`/api/contexts/${id}`), {
    method: "DELETE",
    headers: getApiHeaders(),
  });
}

export async function createItem(item: Partial<Item>): Promise<Item> {
  if (isTauri()) {
    const json = await invoke<string>("create_item", { itemJson: JSON.stringify(item) });
    return JSON.parse(json);
  }
  const res = await fetch(getApiUrl("/api/items"), {
    method: "POST",
    headers: getApiHeaders(),
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error("Falha ao criar item na nuvem");
  return res.json();
}

export async function updateItem(update: {
  id: string;
  context_id?: string | null;
  kind?: string;
  title?: string;
  body?: string | null;
  status?: string;
  waiting_on?: string | null;
  followup_at?: string | null;
  due_at?: string | null;
  ticket_ref?: string | null;
  url?: string | null;
  tags?: string[];
}): Promise<Item> {
  if (isTauri()) {
    const json = await invoke<string>("update_item", { itemJson: JSON.stringify(update) });
    return JSON.parse(json);
  }
  const res = await fetch(getApiUrl(`/api/items/${update.id}`), {
    method: "PATCH",
    headers: getApiHeaders(),
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error("Falha ao atualizar item na nuvem");
  return res.json();
}

export async function searchItems(query: string): Promise<Item[]> {
  if (isTauri()) {
    const json = await invoke<string>("search_items", { query });
    return JSON.parse(json);
  }
  const res = await fetch(getApiUrl("/api/items"), { headers: getApiHeaders() });
  if (!res.ok) return [];
  const items: Item[] = await res.json();
  const q = query.toLowerCase();
  return items.filter(
    (i) =>
      i.title.toLowerCase().includes(q) ||
      (i.body && i.body.toLowerCase().includes(q)) ||
      (i.ticket_ref && i.ticket_ref.toLowerCase().includes(q)) ||
      (i.context_name && i.context_name.toLowerCase().includes(q))
  );
}

export async function parseNotepadText(text: string): Promise<ProposedItem[]> {
  if (isTauri()) {
    const json = await invoke<string>("parse_notepad_text", { text });
    return JSON.parse(json);
  }
  // Basic fallback parser for web
  return [
    {
      title: text.split("\n")[0] || "Nova Nota",
      body: text,
      status: "inbox",
      kind: "task",
      tags: [],
      is_secret: false,
      force_import: false,
    },
  ];
}

export async function importItems(items: ProposedItem[]): Promise<Item[]> {
  if (isTauri()) {
    const json = await invoke<string>("import_items", { itemsJson: JSON.stringify(items) });
    return JSON.parse(json);
  }
  const created: Item[] = [];
  for (const p of items) {
    const item = await createItem({
      title: p.title,
      body: p.body,
      status: (p.status || "inbox") as ItemStatus,
      kind: (p.kind || "task") as ItemKind,
      due_at: p.due_at,
      followup_at: p.followup_at,
      waiting_on: p.waiting_on,
      ticket_ref: p.ticket_ref,
      url: p.url,
      tags: p.tags,
    });
    created.push(item);
  }
  return created;
}

export async function saveCapture(text: string, originApp?: string | null): Promise<Item> {
  if (isTauri()) {
    const json = await invoke<string>("save_capture", {
      text,
      originApp: originApp ?? null,
    });
    return JSON.parse(json);
  }
  return createItem({
    title: text.trim().split("\n")[0] || "Captura Rápida",
    body: text,
    origin_app: originApp ?? "mobile",
    status: "inbox",
  });
}

export async function getActiveApp(): Promise<string | null> {
  if (isTauri()) {
    try {
      return await invoke<string | null>("get_active_app");
    } catch {
      return null;
    }
  }
  return "Navegador Web";
}

export async function openCaptureWindow(): Promise<void> {
  if (isTauri()) {
    await invoke("open_capture_window_cmd");
  }
}

export async function closeCaptureWindow(): Promise<void> {
  if (isTauri()) {
    await invoke("close_capture_window_cmd");
  }
}

export async function openMainWindow(): Promise<void> {
  if (isTauri()) {
    await invoke("open_main_window_cmd");
  }
}

export async function closeMainWindow(): Promise<void> {
  if (isTauri()) {
    await invoke("close_main_window_cmd");
  }
}

export async function addAttachment(
  itemId: string,
  data: string,
  mimeType: string = "image/png",
  filename?: string
): Promise<import("./types").Attachment> {
  if (isTauri()) {
    const json = await invoke<string>("add_attachment", {
      itemId,
      filename: filename ?? null,
      mimeType,
      data,
    });
    return JSON.parse(json);
  }
  return {
    id: crypto.randomUUID(),
    item_id: itemId,
    filename: filename || "anexo",
    mime_type: mimeType,
    data,
    created_at: new Date().toISOString(),
  };
}

export async function getItemAttachments(itemId: string): Promise<import("./types").Attachment[]> {
  if (isTauri()) {
    const json = await invoke<string>("get_item_attachments", { itemId });
    return JSON.parse(json);
  }
  return [];
}

export async function deleteAttachment(id: string, itemId?: string): Promise<void> {
  if (isTauri()) {
    await invoke("delete_attachment", { id, itemId: itemId ?? null });
  }
}

export async function reorderItems(itemIds: string[]): Promise<void> {
  if (isTauri()) {
    await invoke("reorder_items", { itemIds });
    return;
  }
  await fetch(getApiUrl("/api/items/reorder"), {
    method: "POST",
    headers: getApiHeaders(),
    body: JSON.stringify({ itemIds }),
  });
}

export async function getFollowupAlerts(): Promise<FollowupAlerts> {
  if (isTauri()) {
    const json = await invoke<string>("get_followup_alerts");
    return JSON.parse(json);
  }
  const items = await getTodayItems();
  const todayStr = new Date().toISOString().substring(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().substring(0, 10);

  const overdue: Item[] = [];
  const due_today: Item[] = [];
  const due_tomorrow: Item[] = [];

  for (const item of items) {
    if (item.status === "waiting" && item.followup_at) {
      const d = item.followup_at.substring(0, 10);
      if (d < todayStr) overdue.push(item);
      else if (d === todayStr) due_today.push(item);
      else if (d === tomorrowStr) due_tomorrow.push(item);
    }
  }

  return { overdue, due_today, due_tomorrow };
}

export async function triggerFollowupAlerts(): Promise<number> {
  if (isTauri()) {
    return await invoke<number>("trigger_followup_alerts");
  }
  const alerts = await getFollowupAlerts();
  return alerts.due_today.length + alerts.due_tomorrow.length + alerts.overdue.length;
}

export async function sendTestNotification(): Promise<void> {
  if (isTauri()) {
    await invoke("send_test_notification_cmd");
    return;
  }
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification("Notas FUP", { body: "Notificações na nuvem ativas!" });
    } else {
      await Notification.requestPermission();
    }
  }
}
