import React, { useEffect, useState } from "react";
import {
  getContexts,
  createContext,
  updateContext,
  deleteContext,
  sendTestNotification,
  triggerFollowupAlerts,
  checkLatestRelease,
  downloadAndInstallUpdate,
  isAutostartEnabled,
  setAutostart,
  type GitHubReleaseInfo,
} from "./commands";
import ThemeToggle from "./ThemeToggle";
import { PencilIcon, TrashIcon, CheckIcon, XIcon, LinkIcon } from "./Icons";
import { isTauri, syncWithCloud, getCloudConfig, CLOUD_CONFIG_KEY } from "./cloud-sync";
import type { Context, AppConfig } from "./types";
import pkg from "../package.json";

interface SettingsProps {
  theme?: "dark" | "light";
  onThemeChange?: (theme: "dark" | "light") => void;
}

const PRESET_COLORS = [
  "#6366f1", // Índigo
  "#3b82f6", // Azul
  "#06b6d4", // Ciano
  "#10b981", // Esmeralda
  "#22c55e", // Verde
  "#f59e0b", // Âmbar
  "#f97316", // Laranja
  "#ef4444", // Vermelho
  "#ec4899", // Rosa
  "#8b5cf6", // Violeta
  "#64748b", // Cinza / Ardósia
];

export const Settings: React.FC<SettingsProps> = ({ theme = "dark", onThemeChange }) => {
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem("notas_fup_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      shortcut: "Ctrl+Alt+N",
      autostart: true,
      start_in_tray: true,
      stale_days: 5,
    };
  });

  const [contexts, setContexts] = useState<Context[]>([]);
  const [newContextName, setNewContextName] = useState("");
  const [newContextColor, setNewContextColor] = useState("#3b82f6");
  const [editingContextId, setEditingContextId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#3b82f6");
  const [saveStatus, setSaveStatus] = useState<string>("Salvo automaticamente");
  const [cloudConfig, setCloudConfig] = useState(getCloudConfig);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Updater state
  const currentVersion = pkg.version;
  const [releaseInfo, setReleaseInfo] = useState<GitHubReleaseInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [hasCheckedUpdate, setHasCheckedUpdate] = useState(false);

  const compareSemver = (v1: string, v2: string) => {
    const s1 = v1.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
    const s2 = v2.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(s1.length, s2.length); i++) {
      const num1 = s1[i] || 0;
      const num2 = s2[i] || 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  };

  const handleCheckUpdate = async (manual: boolean = false) => {
    setCheckingUpdate(true);
    setUpdateMsg(null);
    try {
      const info = await checkLatestRelease();
      setReleaseInfo(info);
      setHasCheckedUpdate(true);
      if (manual && info) {
        const isNewer = compareSemver(info.tag_name, currentVersion) > 0;
        if (!isNewer) {
          setUpdateMsg(`Você já está na versão mais recente (v${currentVersion})!`);
        }
      }
    } catch {
      if (manual) {
        setUpdateMsg("Não foi possível verificar atualizações no momento.");
      }
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = async () => {
    if (!releaseInfo?.installer_url) {
      window.open(releaseInfo?.html_url || "https://github.com/rlucio01/notas-fup/releases", "_blank");
      return;
    }
    setUpdating(true);
    setUpdateMsg(isTauri() ? "Baixando instalador e iniciando atualização..." : "Iniciando download do instalador...");
    try {
      const res = await downloadAndInstallUpdate(releaseInfo.installer_url);
      setUpdateMsg(res);
    } catch (err: any) {
      setUpdateMsg(`Erro ao atualizar: ${err?.message || err}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleManualSync = async (forceFull = false) => {
    setSyncing(true);
    setSyncMsg(forceFull ? "Enviando banco completo para Cloudflare D1..." : "Sincronizando com Cloudflare D1...");
    try {
      const result = await syncWithCloud({ customConfig: cloudConfig, forceFull });
      if (result.success) {
        if (result.skippedPush && result.pulled === 0) {
          setSyncMsg("Tudo atualizado! (Nenhuma alteração pendente)");
        } else {
          setSyncMsg(`Sincronizado com sucesso! (${result.pushed} enviados, ${result.pulled} recebidos)`);
        }
        setCloudConfig(getCloudConfig());
      } else {
        setSyncMsg(`Erro: ${result.error || "Falha na sincronização"}`);
      }
    } catch (err: any) {
      const msg = typeof err === "string" ? err : err?.message || String(err);
      setSyncMsg(`Erro: ${msg || "Falha na sincronização"}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleLogoutWeb = () => {
    localStorage.removeItem(CLOUD_CONFIG_KEY);
    window.location.reload();
  };

  useEffect(() => {
    getContexts().then(setContexts);
    handleCheckUpdate(false);
    isAutostartEnabled()
      .then((enabled) => {
        setConfig((prev) => ({ ...prev, autostart: enabled }));
      })
      .catch((err) => {
        console.error("Erro ao obter estado de autostart:", err);
      });
  }, []);

  const updateConfig = (patch: Partial<AppConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("notas_fup_config", JSON.stringify(next));
      setSaveStatus("Alterações salvas");
      setTimeout(() => setSaveStatus("Salvo automaticamente"), 2000);
      return next;
    });
  };

  const handleAddContext = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newContextName.trim();
    if (!name) return;
    try {
      const created = await createContext(name, newContextColor);
      setContexts((prev) => [...prev, created]);
      setNewContextName("");
      setNewContextColor("#3b82f6");
    } catch (err) {
      console.error("Erro ao criar contexto:", err);
    }
  };

  const handleQuickColorChange = async (ctx: Context, newColor: string) => {
    try {
      const updated = await updateContext(ctx.id, ctx.name, newColor);
      setContexts((prev) => prev.map((c) => (c.id === ctx.id ? updated : c)));
    } catch (err) {
      console.error("Erro ao atualizar cor do contexto:", err);
    }
  };

  const startEditing = (ctx: Context) => {
    setEditingContextId(ctx.id);
    setEditName(ctx.name);
    setEditColor(ctx.color || "#3b82f6");
  };

  const cancelEditing = () => {
    setEditingContextId(null);
    setEditName("");
    setEditColor("#3b82f6");
  };

  const saveEditing = async (ctx: Context) => {
    const name = editName.trim();
    if (!name) return;
    try {
      const updated = await updateContext(ctx.id, name, editColor);
      setContexts((prev) => prev.map((c) => (c.id === ctx.id ? updated : c)));
      cancelEditing();
    } catch (err) {
      console.error("Erro ao atualizar contexto:", err);
    }
  };

  const handleDeleteContext = async (ctx: Context) => {
    const ok = window.confirm(`Deseja realmente excluir o contexto @${ctx.name}?`);
    if (!ok) return;
    try {
      await deleteContext(ctx.id);
      setContexts((prev) => prev.filter((c) => c.id !== ctx.id));
      if (editingContextId === ctx.id) {
        cancelEditing();
      }
    } catch (err) {
      console.error("Erro ao excluir contexto:", err);
    }
  };

  return (
    <div className="page-body">
      {/* Auto-save notification */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          {saveStatus}
        </span>
      </div>

      {/* Aparência e Tema */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Aparência e Tema</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 500 }}>Tema Visual</div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                Alterne suavemente entre o tema Escuro de alto contraste e o tema Claro
              </div>
            </div>
            <ThemeToggle
              theme={theme}
              onToggle={() => onThemeChange?.(theme === "dark" ? "light" : "dark")}
            />
          </div>
        </div>
      </div>

      {/* Geral */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Atalhos e Inicialização</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 500 }}>Atalho Global de Captura</div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                Abre a janelinha instantânea de notas em qualquer ponto do Windows
              </div>
            </div>
            <span className="kbd-badge" style={{ padding: "4px 8px" }}>
              {config.shortcut}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 500 }}>Iniciar com o Windows</div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                Carrega o aplicativo minimizado ao ligar o computador
              </div>
            </div>
            <input
              type="checkbox"
              className="item-checkbox"
              checked={config.autostart}
              onChange={async (e) => {
                const checked = e.target.checked;
                try {
                  const actual = await setAutostart(checked);
                  updateConfig({ autostart: actual });
                } catch (err) {
                  console.error("Falha ao configurar inicialização com o Windows:", err);
                  setSaveStatus("Erro ao configurar inicialização no Windows");
                  setTimeout(() => setSaveStatus("Salvo automaticamente"), 3000);
                }
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 500 }}>Iniciar na Bandeja (Tray)</div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                Sem abrir a janela principal até que seja solicitada
              </div>
            </div>
            <input
              type="checkbox"
              className="item-checkbox"
              checked={config.start_in_tray}
              onChange={(e) => updateConfig({ start_in_tray: e.target.checked })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 500 }}>Dias para Alerta de Sem Movimento</div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                Itens sem alteração há mais de N dias aparecem na Revisão Diária
              </div>
            </div>
            <input
              type="number"
              min={1}
              max={60}
              className="capture-textarea"
              style={{ width: "80px", height: "32px", padding: "4px 8px" }}
              value={config.stale_days}
              onChange={(e) => updateConfig({ stale_days: parseInt(e.target.value, 10) || 5 })}
            />
          </div>
        </div>
      </div>

      {/* Alertas e Notificações de Follow-Up */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Alertas e Notificações de Follow-Up</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 500 }}>Alertas Nativos do Windows</div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                Notificações na área de trabalho tanto 1 dia antes quanto no dia do vencimento da cobrança
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  try {
                    await sendTestNotification();
                  } catch (e) {
                    console.error("Erro ao enviar notificação de teste:", e);
                  }
                }}
              >
                Testar Notificação
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  try {
                    const count = await triggerFollowupAlerts();
                    alert(`Verificação executada: ${count} notificação(ões) enviada(s).`);
                  } catch (e) {
                    console.error("Erro ao verificar follow-ups:", e);
                  }
                }}
              >
                Verificar Agora
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Gerenciamento de Contextos */}
      <div className="card">
        <div className="card-header">
          <div>
            <span className="card-title">Contextos de Organização</span>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
              Personalize o nome e as cores dos contextos. Clique diretamente no quadrado colorido para trocar de cor ou no lápis para editar.
            </div>
          </div>
          <span className="card-count">{contexts.length}</span>
        </div>

        {/* Existing contexts list */}
        <div className="item-list" style={{ marginBottom: "16px" }}>
          {contexts.map((ctx) => {
            const isEditing = editingContextId === ctx.id;
            const currentColor = ctx.color || "var(--accent)";

            if (isEditing) {
              return (
                <div key={ctx.id} className="context-row-item">
                  <div className="context-edit-container">
                    <div className="context-edit-inputs">
                      <input
                        type="text"
                        className="capture-textarea"
                        style={{ height: "34px", flex: 1, padding: "4px 8px" }}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveEditing(ctx);
                          } else if (e.key === "Escape") {
                            cancelEditing();
                          }
                        }}
                        placeholder="Nome do contexto"
                        autoFocus
                      />

                      <div
                        className="context-color-btn"
                        style={{ background: editColor, width: "26px", height: "26px", borderRadius: "5px" }}
                        title="Clique para escolher cor personalizada"
                      >
                        <input
                          type="color"
                          className="context-color-native-input"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                        />
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm btn-icon"
                        onClick={() => saveEditing(ctx)}
                        title="Salvar alterações"
                        disabled={!editName.trim()}
                      >
                        <CheckIcon size={13} />
                        <span>Salvar</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-icon"
                        onClick={cancelEditing}
                        title="Cancelar"
                      >
                        <XIcon size={13} />
                      </button>
                    </div>

                    {/* Quick color preset dots */}
                    <div className="color-palette-row">
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", marginRight: "4px" }}>
                        Cores rápidas:
                      </span>
                      {PRESET_COLORS.map((col) => (
                        <button
                          key={col}
                          type="button"
                          className={`color-dot-choice ${editColor.toLowerCase() === col.toLowerCase() ? "selected" : ""}`}
                          style={{ backgroundColor: col }}
                          onClick={() => setEditColor(col)}
                          title={col}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={ctx.id} className="context-row-item">
                {/* Clickable color swatch button that opens color picker immediately */}
                <div
                  className="context-color-btn"
                  style={{ background: currentColor }}
                  title="Clique para trocar a cor deste contexto"
                >
                  <input
                    type="color"
                    className="context-color-native-input"
                    value={ctx.color || "#3b82f6"}
                    onChange={(e) => handleQuickColorChange(ctx, e.target.value)}
                    title="Escolha uma nova cor"
                  />
                </div>

                <span style={{ fontWeight: 500, fontSize: "13px", flex: 1, color: "var(--text-primary)" }}>
                  @{ctx.name}
                </span>

                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm btn-icon"
                    onClick={() => startEditing(ctx)}
                    title="Editar nome e cor"
                  >
                    <PencilIcon size={12} />
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm btn-icon"
                    onClick={() => handleDeleteContext(ctx)}
                    title="Excluir contexto"
                    style={{ color: "var(--danger)" }}
                  >
                    <TrashIcon size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add context form */}
        <form onSubmit={handleAddContext} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              className="capture-textarea"
              style={{ height: "36px", flex: 1 }}
              placeholder="Nome do novo contexto (ex: Freelance, Casa)"
              value={newContextName}
              onChange={(e) => setNewContextName(e.target.value)}
            />

            <div
              className="context-color-btn"
              style={{ background: newContextColor, width: "32px", height: "32px", borderRadius: "6px" }}
              title="Clique para escolher cor personalizada"
            >
              <input
                type="color"
                className="context-color-native-input"
                value={newContextColor}
                onChange={(e) => setNewContextColor(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-sm" disabled={!newContextName.trim()}>
              Adicionar
            </button>
          </div>

          {/* Preset color pills for new context */}
          <div className="color-palette-row" style={{ marginTop: "2px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", marginRight: "4px" }}>
              Sugestões de cores:
            </span>
            {PRESET_COLORS.map((col) => (
              <button
                key={col}
                type="button"
                className={`color-dot-choice ${newContextColor.toLowerCase() === col.toLowerCase() ? "selected" : ""}`}
                style={{ backgroundColor: col }}
                onClick={() => setNewContextColor(col)}
                title={col}
              />
            ))}
          </div>
        </form>
      </div>

      {/* Sincronização em Nuvem (Cloudflare D1 & Celular) */}
      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span className="card-title">Sincronização em Nuvem (Cloudflare D1)</span>
            <span className="card-desc">Sincronize com o Cloudflare para acessar no celular e em qualquer navegador</span>
          </div>
          <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--success)" }} />
            Conectado
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
          <div className="setting-row">
            <div>
              <div className="setting-label">API Cloudflare Worker</div>
              <div className="setting-desc" style={{ fontFamily: "monospace", fontSize: "11px" }}>
                {cloudConfig.url}
              </div>
            </div>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Acesso Web & Celular (Cloudflare Pages)</div>
              <div className="setting-desc">
                Abra no seu celular ou qualquer computador para visualizar e editar tarefas
              </div>
            </div>
            <a
              href="https://notas-fup.pages.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none" }}
            >
              <LinkIcon size={12} />
              <span>Abrir Web</span>
            </a>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Última Sincronização</div>
              <div className="setting-desc">
                {cloudConfig.lastSyncAt ? new Date(cloudConfig.lastSyncAt).toLocaleString("pt-BR") : "Ainda não sincronizado"}
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleManualSync(false)}
                disabled={syncing}
              >
                {syncing ? "Sincronizando..." : "Sincronizar Agora"}
              </button>

              {isTauri() && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleManualSync(true)}
                  disabled={syncing}
                  title="Envia todos os itens e contextos locais para a nuvem sem filtro delta"
                >
                  Forçar Envio Completo
                </button>
              )}

              {!isTauri() && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleLogoutWeb}
                  title="Desconectar e limpar chave de acesso neste dispositivo"
                >
                  Sair
                </button>
              )}
            </div>
          </div>

          {syncMsg && (
            <div
              style={{
                fontSize: "12px",
                padding: "8px 12px",
                borderRadius: "6px",
                backgroundColor: syncMsg.startsWith("Erro") ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)",
                color: syncMsg.startsWith("Erro") ? "var(--danger)" : "var(--success)",
              }}
            >
              {syncMsg}
            </div>
          )}
        </div>
      </div>

      {/* Sobre & Atualizações */}
      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src="/favicon.png" width="28" height="28" alt="Notas FUP Logo" style={{ borderRadius: "6px" }} />
            <div>
              <span className="card-title">Sobre & Atualizações</span>
              <span className="card-desc">Sincronizado diretamente com os lançamentos oficiais do GitHub</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="badge badge-info" style={{ fontWeight: 600 }}>
              v{currentVersion}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleCheckUpdate(true)}
              disabled={checkingUpdate || updating}
              title="Buscar nova versão no repositório do GitHub"
            >
              {checkingUpdate ? "Verificando..." : "Verificar Atualizações"}
            </button>
          </div>
        </div>

        {/* Update status message */}
        {updateMsg && (
          <div
            style={{
              marginTop: "12px",
              fontSize: "12px",
              padding: "8px 12px",
              borderRadius: "6px",
              backgroundColor: updateMsg.includes("Erro")
                ? "rgba(239, 68, 68, 0.15)"
                : updateMsg.includes("iniciado") || updateMsg.includes("sucesso")
                ? "rgba(34, 197, 94, 0.15)"
                : "rgba(59, 130, 246, 0.15)",
              color: updateMsg.includes("Erro")
                ? "var(--danger)"
                : updateMsg.includes("iniciado") || updateMsg.includes("sucesso")
                ? "var(--success)"
                : "var(--accent)",
            }}
          >
            {updateMsg}
          </div>
        )}

        {/* New Release Available Banner */}
        {releaseInfo && compareSemver(releaseInfo.tag_name, currentVersion) > 0 && (
          <div
            style={{
              marginTop: "14px",
              padding: "14px",
              borderRadius: "8px",
              border: "1px solid var(--accent)",
              background: "rgba(59, 130, 246, 0.08)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="badge badge-success" style={{ fontSize: "11px", fontWeight: 600 }}>
                  Nova versão disponível: {releaseInfo.tag_name}
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  Publicada em {new Date(releaseInfo.published_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <a
                href={releaseInfo.html_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "11px", color: "var(--accent)", textDecoration: "none" }}
              >
                Ver notas da release no GitHub &rarr;
              </a>
            </div>

            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
              {releaseInfo.name}
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleInstallUpdate}
                disabled={updating}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                {updating ? (
                  "Instalando..."
                ) : (
                  <>
                    <span>Instalar Atualização Agora ({releaseInfo.tag_name})</span>
                  </>
                )}
              </button>

              <a
                href={releaseInfo.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                Abrir no GitHub
              </a>
            </div>
          </div>
        )}

        {/* Up-to-date state badge when checked */}
        {hasCheckedUpdate && releaseInfo && compareSemver(releaseInfo.tag_name, currentVersion) <= 0 && !updateMsg && (
          <div
            style={{
              marginTop: "12px",
              fontSize: "12px",
              color: "var(--success)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--success)" }} />
            <span>Você está utilizando a versão mais recente do Notas FUP (v{currentVersion}).</span>
          </div>
        )}

        <div style={{ marginTop: "14px", borderTop: "1px solid var(--border-color)", paddingTop: "12px", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          <p>
            <strong>Notas FUP</strong> versão <strong>v{currentVersion}</strong> &bull; Desenvolvido com Tauri 2, React 19 e SQLite FTS5 local-first.
          </p>
          <p>
            O aplicativo reside na bandeja consumindo menos de 10 MB de RAM em repouso. Ao fechar a janela, o WebView2 é completamente destruído para liberar memória imediatamente.
          </p>
          <div style={{ marginTop: "6px" }}>
            <a
              href="https://github.com/rlucio01/notas-fup/releases"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", textDecoration: "none", fontSize: "11px" }}
            >
              Acessar Repositório & Releases no GitHub &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
