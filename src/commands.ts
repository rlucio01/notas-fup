import { invoke } from "@tauri-apps/api/core";
import type { Context, Item, ProposedItem } from "./types";

export async function getTodayItems(): Promise<Item[]> {
  const json = await invoke<string>("get_today_items");
  return JSON.parse(json);
}

export async function getInboxItems(): Promise<Item[]> {
  const json = await invoke<string>("get_inbox_items");
  return JSON.parse(json);
}

export async function getDoneItems(): Promise<Item[]> {
  const json = await invoke<string>("get_done_items");
  return JSON.parse(json);
}

export async function getReviewItems(staleDays: number = 5): Promise<Item[]> {
  const json = await invoke<string>("get_review_items", { staleDays });
  return JSON.parse(json);
}

export async function getContexts(): Promise<Context[]> {
  const json = await invoke<string>("get_contexts");
  return JSON.parse(json);
}

export async function createContext(name: string, color: string): Promise<Context> {
  const json = await invoke<string>("create_context", { name, color });
  return JSON.parse(json);
}

export async function createItem(item: Partial<Item>): Promise<Item> {
  const json = await invoke<string>("create_item", { itemJson: JSON.stringify(item) });
  return JSON.parse(json);
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
  const json = await invoke<string>("update_item", { itemJson: JSON.stringify(update) });
  return JSON.parse(json);
}

export async function searchItems(query: string): Promise<Item[]> {
  const json = await invoke<string>("search_items", { query });
  return JSON.parse(json);
}

export async function parseNotepadText(text: string): Promise<ProposedItem[]> {
  const json = await invoke<string>("parse_notepad_text", { text });
  return JSON.parse(json);
}

export async function importItems(items: ProposedItem[]): Promise<Item[]> {
  const json = await invoke<string>("import_items", { itemsJson: JSON.stringify(items) });
  return JSON.parse(json);
}

export async function saveCapture(text: string, originApp?: string | null): Promise<Item> {
  const json = await invoke<string>("save_capture", {
    text,
    originApp: originApp ?? null,
  });
  return JSON.parse(json);
}

export async function getActiveApp(): Promise<string | null> {
  try {
    return await invoke<string | null>("get_active_app");
  } catch {
    return null;
  }
}

export async function openCaptureWindow(): Promise<void> {
  await invoke("open_capture_window_cmd");
}

export async function closeCaptureWindow(): Promise<void> {
  await invoke("close_capture_window_cmd");
}

export async function openMainWindow(): Promise<void> {
  await invoke("open_main_window_cmd");
}

export async function closeMainWindow(): Promise<void> {
  await invoke("close_main_window_cmd");
}

export async function addAttachment(
  itemId: string,
  data: string,
  mimeType: string = "image/png",
  filename?: string
): Promise<import("./types").Attachment> {
  const json = await invoke<string>("add_attachment", {
    itemId,
    filename: filename ?? null,
    mimeType,
    data,
  });
  return JSON.parse(json);
}

export async function getItemAttachments(itemId: string): Promise<import("./types").Attachment[]> {
  const json = await invoke<string>("get_item_attachments", { itemId });
  return JSON.parse(json);
}

export async function deleteAttachment(id: string, itemId?: string): Promise<void> {
  await invoke("delete_attachment", { id, itemId: itemId ?? null });
}

export async function reorderItems(itemIds: string[]): Promise<void> {
  await invoke("reorder_items", { itemIds });
}
