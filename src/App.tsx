import React, { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getInboxItems, openCaptureWindow } from "./commands";
import Today from "./Today";
import Inbox from "./Inbox";
import Search from "./Search";
import Import from "./Import";
import Review from "./Review";
import Done from "./Done";
import Settings from "./Settings";
import "./App.css";

type TabId = "today" | "inbox" | "search" | "import" | "review" | "done" | "settings";
type Theme = "dark" | "light";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>("today");
  const [inboxCount, setInboxCount] = useState<number>(0);
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
    refreshInboxCount();

    let unlistenCreated: (() => void) | undefined;
    let unlistenUpdated: (() => void) | undefined;
    let unlistenImported: (() => void) | undefined;

    listen("item-created", () => refreshInboxCount()).then((un) => {
      unlistenCreated = un;
    });
    listen("item-updated", () => refreshInboxCount()).then((un) => {
      unlistenUpdated = un;
    });
    listen("items-imported", () => refreshInboxCount()).then((un) => {
      unlistenImported = un;
    });

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

  const navItems: { id: TabId; label: string; shortcut: string; count?: number }[] = [
    { id: "today", label: "Hoje", shortcut: "1" },
    { id: "inbox", label: "Inbox", shortcut: "2", count: inboxCount },
    { id: "search", label: "Busca", shortcut: "3" },
    { id: "import", label: "Importar", shortcut: "4" },
    { id: "review", label: "Revisão", shortcut: "5" },
    { id: "done", label: "Concluídos", shortcut: "6" },
    { id: "settings", label: "Configurações", shortcut: "7" },
  ];

  const getPageTitle = (tab: TabId) => {
    switch (tab) {
      case "today":
        return "Hoje -- Demandas e Prazos";
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
        return "Visão consolidada de itens em atraso, para hoje e aguardando retorno.";
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

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand-box">
            <div className="brand-title">Notas FUP</div>
            <div className="brand-subtitle">Captura e Follow-up</div>
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
                  <span className="kbd-badge">{item.shortcut}</span>
                  <span className="nav-item-text">{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span className="nav-badge">{item.count}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className="btn btn-primary btn-sm"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => openCaptureWindow()}
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
          <div>
            <h1 className="page-title">{getPageTitle(activeTab)}</h1>
            <p className="page-subtitle">{getPageSubtitle(activeTab)}</p>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={toggleTheme}
              title="Alternar entre tema Claro e Escuro"
            >
              {theme === "dark" ? "Tema Claro" : "Tema Escuro"}
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => openCaptureWindow()}
            >
              Nova Nota (Ctrl+Alt+N)
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
    </div>
  );
};

export default App;
