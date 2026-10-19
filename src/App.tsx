import React, { useState, useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { getInboxItems, openCaptureWindow, getContexts, createItem } from "./commands";
import { isTauri, getCloudConfig, syncWithCloud } from "./cloud-sync";
import { WebAuth } from "./WebAuth";
import { EditModal } from "./EditModal";
import type { Context, Item } from "./types";
import Today from "./Today";
import Inbox from "./Inbox";
import Search from "./Search";
import Import from "./Import";
import Review from "./Review";
import Done from "./Done";
import Settings from "./Settings";
import ThemeToggle from "./ThemeToggle";
import {
  PlusIcon,
  LayoutGridIcon,
  InboxIcon,
  SearchIcon,
  FileTextIcon,
  SparklesIcon,
  CheckCircle2Icon,
  SettingsIcon,
} from "./Icons";
import "./App.css";

type TabId = "today" | "inbox" | "search" | "import" | "review" | "done" | "settings";
type Theme = "dark" | "light";

export const App: React.FC = () => {
  const [authenticated, setAuthenticated] = useState<boolean>(() => {
    if (isTauri()) return true;
    const config = getCloudConfig();
    return Boolean(config && config.secret && config.secret.trim().length > 0);
  });
  const [activeTab, setActiveTab] = useState<TabId>("today");
  const [inboxCount, setInboxCount] = useState<number>(0);
  const [editingNewItem, setEditingNewItem] = useState<Item | null>(null);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("notas_fup_sidebar_collapsed") === "true";
  });
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("notas_fup_theme");
    if (saved === "light" || saved === "dark") return saved;
    return "dark"; // Dark mode by default
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("notas_fup_theme", theme);
  }, [theme]);

  // ── Two-way Cloudflare Sync (Desktop <-> Cloudflare D1) ─────────────────
  const syncTimeoutRef = useRef<any>(null);
  const triggerDebouncedSync = useCallback((delay = 2000) => {
    if (!isTauri()) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      syncWithCloud().catch(console.error);
    }, delay);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    // 1. Initial sync on launch (immediate after mount)
    triggerDebouncedSync(800);

    // 2. Sync whenever desktop window gains focus (e.g. user returns to PC)
    const handleFocus = () => {
      triggerDebouncedSync(1000);
    };
    window.addEventListener("focus", handleFocus);

    // 3. Periodic pull every 60 seconds (only if document is active/visible)
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        syncWithCloud().catch(console.error);
      }
    }, 60 * 1000);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [triggerDebouncedSync]);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("notas_fup_sidebar_collapsed", String(next));
      return next;
    });
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const refreshInboxCount = async () => {
    try {
      const items = await getInboxItems();
      setInboxCount(items.length);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!authenticated && !isTauri()) return;
    refreshInboxCount();

    let unlistenCreated: (() => void) | undefined;
    let unlistenUpdated: (() => void) | undefined;
    let unlistenImported: (() => void) | undefined;

    if (isTauri()) {
      listen("item-created", () => {
        refreshInboxCount();
        triggerDebouncedSync(2000);
      }).then((un) => {
        unlistenCreated = un;
      });

      listen("item-updated", (event) => {
        refreshInboxCount();
        // If the update originated locally on desktop (not from remote-sync), push to cloud
        if (event.payload !== "remote-sync") {
          triggerDebouncedSync(2000);
        }
      }).then((un) => {
        unlistenUpdated = un;
      });

      listen("items-imported", () => {
        refreshInboxCount();
        triggerDebouncedSync(2000);
      }).then((un) => {
        unlistenImported = un;
      });
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow Ctrl+B to toggle sidebar anywhere
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Don't trigger tab shortcuts if inside an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setActiveTab("search");
        return;
      }

      switch (e.key) {
        case "1":
          setActiveTab("today");
          break;
        case "2":
          setActiveTab("inbox");
          break;
        case "3":
          setActiveTab("search");
          break;
        case "4":
          setActiveTab("import");
          break;
        case "5":
          setActiveTab("review");
          break;
        case "6":
          setActiveTab("done");
          break;
        case "7":
          setActiveTab("settings");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unlistenCreated?.();
      unlistenUpdated?.();
      unlistenImported?.();
    };
  }, []);

  const navItems: {
    id: TabId;
    label: string;
    shortcut: string;
    count?: number;
    icon: React.ReactNode;
  }[] = [
    { id: "today", label: "Atividades", shortcut: "1", icon: <LayoutGridIcon size={16} /> },
    { id: "inbox", label: "Inbox", shortcut: "2", count: inboxCount, icon: <InboxIcon size={16} /> },
    { id: "search", label: "Busca", shortcut: "3", icon: <SearchIcon size={16} /> },
    { id: "import", label: "Importar", shortcut: "4", icon: <FileTextIcon size={16} /> },
    { id: "review", label: "Revisão", shortcut: "5", icon: <SparklesIcon size={16} /> },
    { id: "done", label: "Concluídos", shortcut: "6", icon: <CheckCircle2Icon size={16} /> },
    { id: "settings", label: "Configurações", shortcut: "7", icon: <SettingsIcon size={16} /> },
  ];

  const getPageTitle = (tab: TabId) => {
    switch (tab) {
      case "today":
        return "Atividades & Follow-Up";
      case "inbox":
        return "Inbox -- Triagem Rápida";
      case "search":
        return "Busca FTS5 e Filtros";
      case "import":
        return "Importar Anotações do Notepad";
      case "review":
        return "Revisão do Dia";
      case "done":
        return "Arquivo de Concluídos";
      case "settings":
        return "Configurações";
    }
  };

  const getPageSubtitle = (tab: TabId) => {
    switch (tab) {
      case "today":
        return "Ordene suas atividades em execução por prioridade e acompanhe retornos de terceiros.";
      case "inbox":
        return "Navegue pelo teclado para classificar contexto, tags e prazos em segundos.";
      case "search":
        return "Localize qualquer anotação instantaneamente por texto, tickets ou pessoas.";
      case "import":
        return "Transforme texto corrido sem estado em itens estruturados com preview.";
      case "review":
        return "Balanço do dia: o que entrou, o que venceu e itens parados.";
      case "done":
        return "Histórico de tudo que foi finalizado, pesquisável a qualquer momento.";
      case "settings":
        return "Preferências gerais, atalhos do sistema e contextos.";
    }
  };

  const handleOpenCaptureOrNew = async () => {
    if (isTauri()) {
      openCaptureWindow();
    } else {
      try {
        const [newItem, allContexts] = await Promise.all([
          createItem({ title: "Nova Anotação", body: "", status: "inbox" }),
          getContexts(),
        ]);
        setContexts(allContexts);
        setEditingNewItem(newItem);
      } catch (err) {
        console.error("Erro ao criar nova anotação:", err);
      }
    }
  };

  if (!authenticated && !isTauri()) {
    return <WebAuth onAuthenticated={() => setAuthenticated(true)} />;
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand-box">
            <img
              src="/favicon.png"
              alt="Notas FUP Logo"
              className="sidebar-brand-icon"
              onClick={toggleSidebar}
            />
            <div className="sidebar-brand-text">
              <div className="brand-title">Notas FUP</div>
              <div className="brand-subtitle">Captura e Follow-up</div>
            </div>
          </div>
          <button
            className="sidebar-toggle-btn"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expandir barra lateral (Ctrl+B)" : "Recolher barra lateral (Ctrl+B)"}
          >
            {sidebarCollapsed ? "»" : "«"}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? "active" : ""}`}
                onClick={() => setActiveTab(item.id)}
                title={sidebarCollapsed ? `${item.label} (${item.shortcut})` : undefined}
              >
                <div className="nav-label">
                  <span className="nav-icon" style={{ display: "inline-flex", alignItems: "center" }}>
                    {item.icon}
                  </span>
                  <span className="nav-item-text">{item.label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="nav-badge">{item.count}</span>
                  )}
                  <span className="kbd-badge nav-shortcut-badge">{item.shortcut}</span>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className="btn btn-primary btn-sm"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={handleOpenCaptureOrNew}
            title="Abrir captura rápida (Ctrl+Alt+N)"
          >
            <span className="sidebar-footer-text">Captura (Ctrl+Alt+N)</span>
            {sidebarCollapsed && <span>+</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="page-header">
          <div className="page-header-titles">
            <h1 className="page-title">{getPageTitle(activeTab)}</h1>
            <p className="page-subtitle">{getPageSubtitle(activeTab)}</p>
          </div>

          {/* Quick Command & Search bar (Pane Style) */}
          <div
            className="topbar-center-search"
            onClick={() => setActiveTab("search")}
            title="Buscar em todas as notas, tickets e follow-ups (Ctrl+K)"
          >
            <SearchIcon size={14} />
            <span className="topbar-center-search-text">Buscar notas, tickets, follow-ups...</span>
            <span className="kbd-badge">Ctrl+K</span>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div className="topbar-workspace-status" title="Armazenamento SQLite local com busca instantânea FTS5">
              <span className="status-pulse-dot" />
              <span>SQLite Local</span>
            </div>

            <ThemeToggle theme={theme} onToggle={toggleTheme} />

            <button
              className="btn btn-primary btn-sm btn-icon"
              onClick={handleOpenCaptureOrNew}
              title="Criar nova nota ou demanda (Ctrl+Alt+N)"
            >
              <PlusIcon size={13} />
              <span>Nova Nota</span>
            </button>
          </div>
        </header>

        {activeTab === "today" && <Today onNavigateToInbox={() => setActiveTab("inbox")} />}
        {activeTab === "inbox" && <Inbox />}
        {activeTab === "search" && <Search />}
        {activeTab === "import" && <Import onImportComplete={() => setActiveTab("today")} />}
        {activeTab === "review" && <Review />}
        {activeTab === "done" && <Done />}
        {activeTab === "settings" && <Settings theme={theme} onThemeChange={setTheme} />}
      </main>

      {/* Botão Flutuante de Ação Rápida (FAB no Mobile) */}
      <button
        type="button"
        className="mobile-fab-btn"
        onClick={handleOpenCaptureOrNew}
        title="Criar nova nota"
        aria-label="Criar nova nota"
      >
        <PlusIcon size={22} />
      </button>

      {editingNewItem && (
        <EditModal
          item={editingNewItem}
          contexts={contexts}
          onClose={() => setEditingNewItem(null)}
          onSaved={async () => {
            setEditingNewItem(null);
            refreshInboxCount();
          }}
        />
      )}
    </div>
  );
};

export default App;
