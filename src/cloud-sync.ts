import { invoke } from "@tauri-apps/api/core";
import type { Item, Context } from "./types";

export const isTauri = (): boolean => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

export const CLOUD_CONFIG_KEY = "notas_fup_cloud_config";
export const DEFAULT_CLOUD_URL = "https://notas-fup-api.rlucio01.workers.dev";
export const DEFAULT_CLOUD_SECRET = (import.meta.env.VITE_CLOUD_SECRET as string) || "";

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



export interface SyncOptions {
  customConfig?: CloudConfig;
  forceFull?: boolean;
}

export interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  skippedPush?: boolean;
  error?: string;
}

// ── Cloudflare Sync Engine (Local SQLite <-> Cloudflare D1) ─────────────

export async function syncWithCloud(
  optionsOrConfig?: SyncOptions | CloudConfig
): Promise<SyncResult> {
  let config: CloudConfig;
  let forceFull = false;

  if (optionsOrConfig && "enabled" in optionsOrConfig) {
    config = optionsOrConfig;
  } else if (optionsOrConfig) {
    config = optionsOrConfig.customConfig || getCloudConfig();
    forceFull = Boolean(optionsOrConfig.forceFull);
  } else {
    config = getCloudConfig();
  }

  if (!config.enabled || !config.url || !config.secret) {
    return { success: false, pushed: 0, pulled: 0, error: "Sincronização desativada ou incompleta" };
  }

  const baseUrl = config.url.replace(/\/+$/, "");

  try {
    let localItems: Item[] = [];
    let localContexts: Context[] = [];

    // 1. Get ONLY modified local data (Delta-Sync)
    if (isTauri()) {
      if (!config.lastSyncAt && !forceFull) {
        try {
          const sqliteSyncAt = await invoke<string | null>("get_last_sync_at_cmd");
          if (sqliteSyncAt) {
            config.lastSyncAt = sqliteSyncAt;
          }
        } catch {
          // ignore
        }
      }

      const sinceParam = forceFull ? null : (config.lastSyncAt || null);
      const dataJson = await invoke<string>("get_sync_data_cmd", { since: sinceParam, forceFull });
      const bundle: { items: Item[]; contexts: Context[] } = JSON.parse(dataJson);
      localItems = bundle.items || [];
      localContexts = bundle.contexts || [];
    }

    let pushedCount = 0;
    const hasLocalChanges = localItems.length > 0 || localContexts.length > 0;

    // 2. ONLY push to Cloudflare D1 if there are actually local changes!
    // This saves 99.9% of D1 row writes per day and prevents hitting the 100,000 quota.
    if (hasLocalChanges) {
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
      pushedCount = localItems.length + localContexts.length;
    }

    // 3. Pull updates from Cloudflare D1 (since last sync or full)
    const sinceParam = forceFull ? "" : (config.lastSyncAt ? encodeURIComponent(config.lastSyncAt) : "");
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

    // 4. If in Tauri, apply cloud items & contexts to local SQLite
    let pulledCount = 0;
    if (isTauri()) {
      if (pullData.items && pullData.items.length > 0) {
        pulledCount += await invoke<number>("sync_remote_items_cmd", {
          itemsJson: JSON.stringify(pullData.items),
        });
      }
      if (pullData.contexts && pullData.contexts.length > 0) {
        try {
          await invoke<number>("sync_remote_contexts_cmd", {
            contextsJson: JSON.stringify(pullData.contexts),
          });
        } catch (ctxErr) {
          console.warn("Falha ao mesclar contextos remotos:", ctxErr);
        }
      }
    }

    // 5. Update last sync timestamp in BOTH localStorage and SQLite meta table
    const nextSyncTimestamp = pullData.server_time || new Date().toISOString();
    config.lastSyncAt = nextSyncTimestamp;
    saveCloudConfig(config);
    if (isTauri()) {
      invoke("set_last_sync_at_cmd", { timestamp: nextSyncTimestamp }).catch(console.error);
    }

    return {
      success: true,
      pushed: pushedCount,
      pulled: pulledCount,
      skippedPush: !hasLocalChanges,
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
