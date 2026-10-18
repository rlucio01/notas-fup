import React, { useEffect, useState } from "react";
import { getContexts, createContext } from "./commands";
import ThemeToggle from "./ThemeToggle";
import type { Context, AppConfig } from "./types";

interface SettingsProps {
  theme?: "dark" | "light";
  onThemeChange?: (theme: "dark" | "light") => void;
}

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
  const [newContextColor, setNewContextColor] = useState("#2563eb");
  const [saveStatus, setSaveStatus] = useState<string>("Salvo automaticamente");

  useEffect(() => {
    getContexts().then(setContexts);
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
    } catch (err) {
      console.error("Erro ao criar contexto:", err);
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
              onChange={(e) => updateConfig({ autostart: e.target.checked })}
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

      {/* Gerenciamento de Contextos */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Contextos de Organização</span>
          <span className="card-count">{contexts.length}</span>
        </div>

        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "14px" }}>
          Contextos são grupos como Trabalho, Pessoal ou Projetos. Itens com contexto saem automaticamente do Inbox para a lista ativa.
        </p>

        {/* Existing contexts list */}
        <div className="item-list" style={{ marginBottom: "16px" }}>
          {contexts.map((ctx) => (
            <div
              key={ctx.id}
              className="item-row"
              style={{ padding: "8px 12px" }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "3px",
                  background: ctx.color || "var(--accent)",
                }}
              />
              <span style={{ fontWeight: 500, fontSize: "13px", flex: 1 }}>
                @{ctx.name}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: ctx.sync_enabled ? "var(--success-text)" : "var(--text-muted)",
                }}
              >
                {ctx.sync_enabled ? "Sincronização Ativa" : "Local apenas"}
              </span>
            </div>
          ))}
        </div>

        {/* Add context form */}
        <form onSubmit={handleAddContext} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="text"
            className="capture-textarea"
            style={{ height: "36px", flex: 1 }}
            placeholder="Nome do novo contexto (ex: Freelance, Casa)"
            value={newContextName}
            onChange={(e) => setNewContextName(e.target.value)}
          />

          <input
            type="color"
            value={newContextColor}
            onChange={(e) => setNewContextColor(e.target.value)}
            style={{ width: "36px", height: "36px", border: "none", cursor: "pointer", background: "transparent" }}
            title="Escolha a cor do contexto"
          />

          <button type="submit" className="btn btn-primary btn-sm" disabled={!newContextName.trim()}>
            Adicionar
          </button>
        </form>
      </div>

      {/* Sobre e Memória */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Sobre e Arquitetura</span>
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          <p><strong>Notas FUP</strong> versão 0.1.0 (MVP)</p>
          <p>Desenvolvido com Tauri 2, React 19 e SQLite FTS5 local-first.</p>
          <p>O aplicativo reside na bandeja consumindo menos de 10 MB de RAM em repouso. Ao fechar a janela, o WebView2 é completamente destruído para liberar memória imediatamente.</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
