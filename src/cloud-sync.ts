import { invoke } from "@tauri-apps/api/core";
import type { Item, Context } from "./types";

export const isTauri = (): boolean => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

export const CLOUD_CONFIG_KEY = "notas_fup_cloud_config";
export const DEFAULT_CLOUD_URL = "https://notas-fup-api.rlucio01.workers.dev";
export const DEFAULT_CLOUD_SECRET = isTauri() ? "rafa01!@@" : "";

export interface CloudConfig {
  enabled: boolean;
  url: string;
  secret: string;
  lastSyncAt: string | null;
  autoSync: boolean;
}

export function getCloudConfig(): CloudConfig {
  try {
    const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (raw) {
      return { ...getDefaultCloudConfig(), ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return getDefaultCloudConfig();
}

export function getDefaultCloudConfig(): CloudConfig {
  return {
    enabled: true,
    url: DEFAULT_CLOUD_URL,
    secret: DEFAULT_CLOUD_SECRET,
    lastSyncAt: null,
    autoSync: true,
  };
}

export function saveCloudConfig(config: CloudConfig): void {
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
}



// ── Cloudflare Sync Engine (Local SQLite <-> Cloudflare D1) ─────────────

export async function syncWithCloud(
  customConfig?: CloudConfig
): Promise<{ success: boolean; pushed: number; pulled: number; error?: string }> {
  const config = customConfig || getCloudConfig();
  if (!config.enabled || !config.url || !config.secret) {
    return { success: false, pushed: 0, pulled: 0, error: "Sincronização desativada ou incompleta" };
  }

  const baseUrl = config.url.replace(/\/+$/, "");

  try {
    // 1. Get all local items and contexts from local SQLite
    let localItems: Item[] = [];
    let localContexts: Context[] = [];

    if (isTauri()) {
      const [itemsJson, contextsJson] = await Promise.all([
        invoke<string>("get_today_items"),
        invoke<string>("get_contexts"),
      ]);
      const [inboxJson, doneJson] = await Promise.all([
        invoke<string>("get_inbox_items"),
        invoke<string>("get_done_items"),
      ]);

      const activeToday: Item[] = JSON.parse(itemsJson);
      const inboxItems: Item[] = JSON.parse(inboxJson);
      const doneItems: Item[] = JSON.parse(doneJson);
      localContexts = JSON.parse(contextsJson);

      // Deduplicate all local items
      const itemMap = new Map<string, Item>();
      for (const item of [...activeToday, ...inboxItems, ...doneItems]) {
        itemMap.set(item.id, item);
      }
      localItems = Array.from(itemMap.values());
    }

    // 2. Push local data to Cloudflare D1
    const pushRes = await fetch(`${baseUrl}/api/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.secret}`,
      },
      body: JSON.stringify({
        items: localItems,
        contexts: localContexts,
      }),
    });

    if (!pushRes.ok) {
      const err = await pushRes.text();
      throw new Error(`Erro ao enviar dados para a Cloudflare (${pushRes.status}): ${err}`);
    }

    // 3. Pull updates from Cloudflare D1 (since last sync or full)
    const sinceParam = config.lastSyncAt ? encodeURIComponent(config.lastSyncAt) : "";
    const pullRes = await fetch(`${baseUrl}/api/sync?since=${sinceParam}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.secret}`,
      },
    });

    if (!pullRes.ok) {
      throw new Error(`Erro ao baixar dados da Cloudflare (${pullRes.status})`);
    }

    const pullData: { server_time: string; items: Item[]; contexts: Context[] } = await pullRes.json();

    // 4. If in Tauri, apply cloud items to local SQLite via atomic ON CONFLICT upsert
    let pulledCount = 0;
    if (isTauri() && pullData.items && pullData.items.length > 0) {
      pulledCount = await invoke<number>("sync_remote_items_cmd", {
        itemsJson: JSON.stringify(pullData.items),
      });
    }

    // 5. Update last sync timestamp
    config.lastSyncAt = pullData.server_time || new Date().toISOString();
    saveCloudConfig(config);

    return {
      success: true,
      pushed: localItems.length,
      pulled: pulledCount,
    };
  } catch (err: any) {
    console.error("Falha na sincronização Cloudflare:", err);
    return {
      success: false,
      pushed: 0,
      pulled: 0,
      error: err.message || "Erro desconhecido na sincronização",
    };
  }
}
