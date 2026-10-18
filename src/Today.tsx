import React, { useEffect, useState, useCallback, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { getTodayItems, getInboxItems, updateItem, getContexts, reorderItems, getFollowupAlerts } from "./commands";
import { computeTodayBlocks } from "./today-blocks";
import { EditModal } from "./EditModal";
import { CalendarIcon, LinkIcon, GripIcon, PaperclipIcon } from "./Icons";
import type { Item, Context, FollowupAlerts } from "./types";

interface TodayProps {
  onNavigateToInbox: () => void;
}

export const Today: React.FC<TodayProps> = ({ onNavigateToInbox }) => {
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [inboxCount, setInboxCount] = useState<number>(0);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [selectedContext, setSelectedContext] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"all" | "executing" | "waiting">("all");
  const [alerts, setAlerts] = useState<FollowupAlerts | null>(null);
  const [dismissedAlert, setDismissedAlert] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

  // Drag and drop state for prioritizing tasks
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragSection, setDragSection] = useState<"executing" | "today" | "overdue" | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [items, inbox, ctxs, fupAlerts] = await Promise.all([
        getTodayItems(),
        getInboxItems(),
        getContexts(),
        getFollowupAlerts().catch(() => null),
      ]);
      setContexts(ctxs);
      setAllItems(items);
      setInboxCount(inbox.length);
      if (fupAlerts) setAlerts(fupAlerts);
    } catch (e) {
      console.error("Erro ao carregar demandas:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Listen to real-time events from Tauri without polling
    let unlistenCreated: (() => void) | undefined;
    let unlistenUpdated: (() => void) | undefined;
    let unlistenImported: (() => void) | undefined;
    let unlistenContext: (() => void) | undefined;

    listen("item-created", () => loadData()).then((un) => {
      unlistenCreated = un;
    });
    listen("item-updated", () => loadData()).then((un) => {
      unlistenUpdated = un;
    });
    listen("items-imported", () => loadData()).then((un) => {
      unlistenImported = un;
    });
    listen("context-updated", () => loadData()).then((un) => {
      unlistenContext = un;
    });

    return () => {
      unlistenCreated?.();
      unlistenUpdated?.();
      unlistenImported?.();
      unlistenContext?.();
    };
  }, [loadData]);

  // Aggregate active contexts and task counts
  const { contextFilterList, totalActiveCount, noContextCount } = useMemo(() => {
    const active = allItems.filter((i) => i.status !== "done" && i.status !== "dropped");
    const counts: Record<string, { key: string; name: string; color?: string | null; count: number }> = {};
    let noCtx = 0;

    for (const item of active) {
      if (item.context_name) {
        const key = item.context_name.toLowerCase();
        if (!counts[key]) {
          counts[key] = {
            key,
            name: item.context_name,
            color: item.context_color,
            count: 0,
          };
        }
        counts[key].count += 1;
      } else {
        noCtx += 1;
      }
    }

    const list = Object.values(counts).sort((a, b) => b.count - a.count);

    return {
      contextFilterList: list,
      totalActiveCount: active.length,
      noContextCount: noCtx,
    };
  }, [allItems]);

  // Filter items by context selection
  const filteredItems = useMemo(() => {
    if (selectedContext === "all") return allItems;
    if (selectedContext === "none") {
      return allItems.filter((i) => !i.context_id && !i.context_name);
    }
    const selLower = selectedContext.toLowerCase();
    return allItems.filter((i) => {
      if (i.context_id && i.context_id.toLowerCase() === selLower) return true;
      if (i.context_name && i.context_name.toLowerCase() === selLower) return true;
      return false;
    });
  }, [allItems, selectedContext]);

  // Compute blocks based on filtered items
  const blocks = useMemo(() => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const computed = computeTodayBlocks(filteredItems, todayStr);
    computed.inbox_count = inboxCount;
    return computed;
  }, [filteredItems, inboxCount]);

  const waitingCount = useMemo(() => {
    return Object.values(blocks.waiting).reduce((sum, list) => sum + list.length, 0);
  }, [blocks.waiting]);

  const handleToggleDone = async (item: Item) => {
    const newStatus = item.status === "done" ? "open" : "done";
    await updateItem({ id: item.id, status: newStatus });
    loadData();
  };

  const handlePostponeTomorrow = async (item: Item) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().substring(0, 10);

    if (item.status === "waiting") {
      await updateItem({ id: item.id, followup_at: dateStr });
    } else {
      await updateItem({ id: item.id, due_at: dateStr });
    }
    loadData();
  };

  const handleMoveToWaiting = async (item: Item) => {
    const person = window.prompt("Aguardando retorno de quem? (ex: Gustavo, Massao, Cliente)");
    if (person === null) return;
    await updateItem({
      id: item.id,
      status: "waiting",
      waiting_on: person.trim() || "Sem responsável",
    });
    loadData();
  };

  const handleResumeExecution = async (item: Item) => {
    await updateItem({
      id: item.id,
      status: "open",
      waiting_on: null,
    });
    loadData();
  };

  const handleDrop = async (
    targetId: string,
    section: "executing" | "today" | "overdue",
    e?: React.DragEvent
  ) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const sourceId = e?.dataTransfer?.getData("text/plain") || draggedId;
    if (!sourceId || sourceId === targetId || (dragSection && dragSection !== section)) {
      setDraggedId(null);
      setDragOverId(null);
      setDragSection(null);
      return;
    }

    let list: Item[] = [];
    if (section === "executing") {
      list = [...blocks.executing];
    } else if (section === "today") {
      list = [...blocks.today];
    } else if (section === "overdue") {
      list = [...blocks.overdue];
    }

    const fromIdx = list.findIndex((i) => i.id === sourceId);
    const toIdx = list.findIndex((i) => i.id === targetId);
    if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);

      // Instant optimistic UI update
      const newOrderIds = list.map((i) => i.id);

      setAllItems((prev) => {
        const others = prev.filter((i) => !newOrderIds.includes(i.id));
        const reordered = newOrderIds
          .map((id) => prev.find((i) => i.id === id)!)
          .filter(Boolean);

        if (section === "executing") {
          return [...reordered, ...others];
        } else {
          return prev.map((item) => {
            const idx = newOrderIds.indexOf(item.id);
            return idx >= 0 ? list[idx] : item;
          });
        }
      });

      // Synchronize all open items to prevent position collisions in SQLite
      const allOpen = allItems.filter((i) => i.status === "open");
      const fromInAll = allOpen.findIndex((i) => i.id === sourceId);
      const toInAll = allOpen.findIndex((i) => i.id === targetId);
      let idsToPersist = newOrderIds;
      if (fromInAll >= 0 && toInAll >= 0 && section === "executing") {
        const [movedOpen] = allOpen.splice(fromInAll, 1);
        allOpen.splice(toInAll, 0, movedOpen);
        idsToPersist = allOpen.map((i) => i.id);
      }

      try {
        await reorderItems(idsToPersist);
      } catch (err) {
        console.error("Erro ao reordenar tarefas no banco:", err);
      } finally {
        loadData();
      }
    }

    setDraggedId(null);
    setDragOverId(null);
    setDragSection(null);
  };

  const renderItemRow = (
    item: Item,
    showOverdueBadge = false,
    section?: "executing" | "today" | "overdue" | "waiting",
    priorityIndex?: number
  ) => {
    const isDone = item.status === "done";
    const dateLabel = item.due_at || item.followup_at;
    const isDraggable = section === "executing" || section === "today" || section === "overdue";
    const isBeingDragged = draggedId === item.id;
    const isDragOver = dragOverId === item.id && draggedId !== item.id;

    return (
      <div
        key={item.id}
        className={`item-row ${isBeingDragged ? "is-dragging" : ""} ${
          isDragOver ? "drag-over-top" : ""
        }`}
        draggable={isDraggable}
        onDragStart={(e) => {
          if (!isDraggable) return;
          e.dataTransfer.setData("text/plain", item.id);
          e.dataTransfer.setData("application/x-fup-id", item.id);
          e.dataTransfer.effectAllowed = "move";
          setDraggedId(item.id);
          setDragSection(section || null);
        }}
        onDragOver={(e) => {
          if (!isDraggable) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (draggedId && draggedId !== item.id && dragOverId !== item.id) {
            setDragOverId(item.id);
          }
        }}
        onDragEnter={(e) => {
          if (!isDraggable) return;
          e.preventDefault();
          if (draggedId && draggedId !== item.id) {
            setDragOverId(item.id);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget && !e.currentTarget.contains(e.relatedTarget as Node)) {
            if (dragOverId === item.id) {
              setDragOverId(null);
            }
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isDraggable && section) {
            handleDrop(item.id, section, e);
          }
        }}
        onDragEnd={() => {
          setDraggedId(null);
          setDragOverId(null);
          setDragSection(null);
        }}
      >
        {isDraggable && (
          <span
            className="drag-handle"
            title="Arraste para definir a ordem de prioridade"
            draggable={isDraggable}
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.setData("text/plain", item.id);
              e.dataTransfer.setData("application/x-fup-id", item.id);
              e.dataTransfer.effectAllowed = "move";
              setDraggedId(item.id);
              setDragSection(section || null);
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <GripIcon size={14} />
          </span>
        )}

        <input
          type="checkbox"
          className="item-checkbox"
          checked={isDone}
          onChange={() => handleToggleDone(item)}
          title="Marcar como concluído"
        />

        <div
          className="item-main"
          style={{ cursor: "pointer" }}
          onClick={() => setEditingItem(item)}
          title="Clique para editar ou reclassificar"
        >
          <div className="item-title-line">
            {priorityIndex !== undefined && (
              <span
                className={`badge badge-priority ${priorityIndex === 0 ? "top-focus" : ""}`}
                title={`Prioridade #${priorityIndex + 1}${
                  priorityIndex === 0 ? " (Foco Principal)" : ""
                }`}
              >
                #{priorityIndex + 1}
              </span>
            )}

            <span className={`item-title ${isDone ? "done" : ""}`}>
              {item.title}
            </span>

            {showOverdueBadge && (
              <span className="badge badge-overdue">Atrasado</span>
            )}

            {item.context_name && (
              <span
                className="badge badge-context"
                style={{
                  borderColor: item.context_color || undefined,
                  cursor: "pointer",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedContext((prev) =>
                    prev === item.context_name?.toLowerCase()
                      ? "all"
                      : (item.context_name?.toLowerCase() || "all")
                  );
                }}
                title={`Clique para filtrar pelo contexto @${item.context_name}`}
              >
                @{item.context_name}
              </span>
            )}

            {item.ticket_ref && (
              <span className="badge badge-ticket">{item.ticket_ref}</span>
            )}

            {item.waiting_on && (
              <span className="badge badge-waiting">~{item.waiting_on}</span>
            )}

            {dateLabel && (
              <span className="badge badge-today">
                {dateLabel.substring(0, 10)}
              </span>
            )}

            {item.tags?.map((t) => (
              <span key={t} className="badge badge-tag">
                #{t}
              </span>
            ))}

            {item.attachment_count !== undefined && item.attachment_count > 0 && (
              <span
                className="badge badge-attachment"
                title={`${item.attachment_count} anexo(s)`}
              >
                <PaperclipIcon size={11} />
                {item.attachment_count} {item.attachment_count === 1 ? "anexo" : "anexos"}
              </span>
            )}
          </div>

          {item.body && <div className="item-body">{item.body}</div>}
        </div>

        <div className="item-actions">
          {item.status === "open" && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleMoveToWaiting(item)}
              title="Colocar demanda em espera de terceiros"
            >
              Aguardar...
            </button>
          )}

          {item.status === "waiting" && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleResumeExecution(item)}
              title="Retomar demanda para minha execução ativa"
            >
              Assumir / Executar
            </button>
          )}

          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm btn-icon"
              title={item.url}
            >
              <LinkIcon size={12} />
              <span>Link</span>
            </a>
          )}

          <button
            className="btn btn-secondary btn-sm btn-icon"
            onClick={() => handlePostponeTomorrow(item)}
            title="Adiar para amanhã (+1 dia)"
          >
            <CalendarIcon size={12} />
            <span>+1 dia</span>
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="page-body">
        <div className="empty-state">Carregando atividades e demandas...</div>
      </div>
    );
  }

  const hasAnyItems = allItems.length > 0 || blocks.inbox_count > 0;

  return (
    <div className="page-body">
      {/* Banner de Alerta de Follow-up (Vencendo Hoje / Amanhã / Atrasado) */}
      {!dismissedAlert && alerts && (alerts.due_today.length > 0 || alerts.due_tomorrow.length > 0 || alerts.overdue.length > 0) && (
        <div className="followup-alert-banner">
          <div className="alert-banner-content">
            <span className="alert-banner-badge">Alerta de Follow-up</span>
            <div className="alert-banner-text">
              {alerts.due_today.length > 0 && (
                <span>
                  <strong>{alerts.due_today.length}</strong> cobrança(s) para <strong>hoje</strong>.{" "}
                </span>
              )}
              {alerts.due_tomorrow.length > 0 && (
                <span>
                  <strong>{alerts.due_tomorrow.length}</strong> vence(m) <strong>amanhã</strong> (1 dia antes).{" "}
                </span>
              )}
              {alerts.overdue.length > 0 && (
                <span style={{ color: "var(--danger)" }}>
                  (<strong>{alerts.overdue.length}</strong> em atraso)
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setViewMode("waiting")}
            >
              Ver Cobranças
            </button>
            <button
              type="button"
              className="alert-banner-close"
              onClick={() => setDismissedAlert(true)}
              title="Dispensar aviso por agora"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Abas de Modo de Visão: Em Execução / Aguardando / Geral */}
      <div className="view-mode-tabs">
        <button
          type="button"
          className={`view-mode-tab ${viewMode === "all" ? "active" : ""}`}
          onClick={() => setViewMode("all")}
        >
          <span>Visão Geral</span>
          <span className="tab-badge">{blocks.executing.length + waitingCount}</span>
        </button>

        <button
          type="button"
          className={`view-mode-tab ${viewMode === "executing" ? "active" : ""}`}
          onClick={() => setViewMode("executing")}
        >
          <span>Em Execução (Prioridade)</span>
          <span className="tab-badge">{blocks.executing.length}</span>
        </button>

        <button
          type="button"
          className={`view-mode-tab ${viewMode === "waiting" ? "active" : ""}`}
          onClick={() => setViewMode("waiting")}
        >
          <span>Aguardando Retorno (Follow-Up)</span>
          <span className="tab-badge">{waitingCount}</span>
        </button>
      </div>

      {/* Barra de Filtro por Contexto */}
      {contextFilterList.length > 0 && (
        <div className="context-filter-bar">
          <span className="context-filter-label">Contexto:</span>
          <div className="context-filter-pills">
            <button
              type="button"
              className={`context-filter-pill ${selectedContext === "all" ? "active" : ""}`}
              onClick={() => setSelectedContext("all")}
            >
              <span>Todos</span>
              <span className="filter-count-badge">{totalActiveCount}</span>
            </button>

            {contextFilterList.map((ctx) => (
              <button
                key={ctx.key}
                type="button"
                className={`context-filter-pill ${selectedContext === ctx.key ? "active" : ""}`}
                onClick={() => setSelectedContext(selectedContext === ctx.key ? "all" : ctx.key)}
                style={
                  selectedContext === ctx.key && ctx.color
                    ? { backgroundColor: ctx.color + "22", borderColor: ctx.color, color: ctx.color }
                    : undefined
                }
                title={`Filtrar apenas demandas de @${ctx.name}`}
              >
                <span
                  className="context-pill-indicator"
                  style={{ backgroundColor: ctx.color || "var(--accent)" }}
                />
                <span>@{ctx.name}</span>
                <span className="filter-count-badge">{ctx.count}</span>
              </button>
            ))}

            {noContextCount > 0 && (
              <button
                type="button"
                className={`context-filter-pill ${selectedContext === "none" ? "active" : ""}`}
                onClick={() => setSelectedContext(selectedContext === "none" ? "all" : "none")}
                title="Filtrar demandas sem contexto definido"
              >
                <span>Sem contexto</span>
                <span className="filter-count-badge">{noContextCount}</span>
              </button>
            )}

            {selectedContext !== "all" && (
              <button
                type="button"
                className="context-filter-clear"
                onClick={() => setSelectedContext("all")}
                title="Limpar filtro de contexto"
              >
                Limpar filtro
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bloco: Demandas Atrasadas (se houver) */}
      {(viewMode === "all" || viewMode === "executing") && blocks.overdue.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ color: "var(--danger)" }}>
              <span>Atrasados</span>
              <span className="badge badge-overdue">
                {blocks.overdue.length}
              </span>
            </div>
          </div>
          <div className="item-list">
            {blocks.overdue.map((item) => renderItemRow(item, true, "overdue"))}
          </div>
        </div>
      )}

      {/* Bloco Principal: Atividades em Execução (Ordem de Prioridade) */}
      {(viewMode === "all" || viewMode === "executing") && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <span>Atividades em Execução (Ordem de Prioridade)</span>
                <span className="card-count">{blocks.executing.length}</span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                Arraste os itens pelo ícone à esquerda para ordenar por prioridade. O item #1 é seu foco principal.
              </div>
            </div>
          </div>

          {blocks.executing.length === 0 ? (
            <div className="empty-state">
              {selectedContext === "all"
                ? "Nenhuma atividade em execução no momento. Use Nova Nota (Ctrl+Alt+N) ou retire itens de Aguardando Retorno."
                : "Nenhuma atividade em execução para este contexto."}
            </div>
          ) : (
            <div className="item-list">
              {blocks.executing.map((item, idx) =>
                renderItemRow(item, false, "executing", idx)
              )}
            </div>
          )}
        </div>
      )}

      {/* Bloco: Aguardando Retorno (por pessoa) */}
      {(viewMode === "all" || viewMode === "waiting") && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <span>Aguardando Retorno (Follow-Up de Terceiros)</span>
                <span className="card-count">{waitingCount}</span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                Demandas sob responsabilidade de terceiros. Clique em &quot;Assumir / Executar&quot; para puxar de volta à sua fila.
              </div>
            </div>
          </div>

          {waitingCount === 0 ? (
            <div className="empty-state">
              {selectedContext === "all"
                ? "Nenhum item aguardando resposta de terceiros."
                : "Nenhum item aguardando resposta de terceiros neste contexto."}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {Object.entries(blocks.waiting).map(([person, items]) => (
                <div key={person}>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: "8px",
                    }}
                  >
                    {person} ({items.length})
                  </div>
                  <div className="item-list">
                    {items.map((item) => renderItemRow(item, false, "waiting"))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bloco: Inbox para processar */}
      {viewMode === "all" && (
        <div className="card" style={{ background: "var(--accent-light)" }}>
          <div className="card-header">
            <div className="card-title">
              <span>Inbox para Processar</span>
              <span className="card-count">{blocks.inbox_count}</span>
            </div>
            {blocks.inbox_count > 0 && (
              <button className="btn btn-primary btn-sm" onClick={onNavigateToInbox}>
                Processar Inbox (teclado)
              </button>
            )}
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            {blocks.inbox_count === 0
              ? "Inbox zerado. Pressione Ctrl+Alt+N a qualquer momento para capturar novas demandas."
              : `Você tem ${blocks.inbox_count} ${
                  blocks.inbox_count === 1 ? "item pendente" : "itens pendentes"
                } para categorizar.`}
          </p>
        </div>
      )}

      {!hasAnyItems && (
        <div className="empty-state">
          Nenhuma demanda ativa. Capture itens com o atalho global Ctrl+Alt+N ou importe do Notepad.
        </div>
      )}

      {editingItem && (
        <EditModal
          item={editingItem}
          contexts={contexts}
          onClose={() => setEditingItem(null)}
          onSaved={loadData}
        />
      )}
    </div>
  );
};

export default Today;
