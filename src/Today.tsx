import React, { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { getTodayItems, getInboxItems, updateItem, getContexts, reorderItems } from "./commands";
import { computeTodayBlocks } from "./today-blocks";
import { EditModal } from "./EditModal";
import { PencilIcon, CalendarIcon, LinkIcon, GripIcon, PaperclipIcon } from "./Icons";
import type { Item, TodayBlocks, Context } from "./types";

interface TodayProps {
  onNavigateToInbox: () => void;
}

export const Today: React.FC<TodayProps> = ({ onNavigateToInbox }) => {
  const [blocks, setBlocks] = useState<TodayBlocks>({
    overdue: [],
    today: [],
    waiting: {},
    inbox_count: 0,
  });
  const [contexts, setContexts] = useState<Context[]>([]);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

  // Drag and drop state for prioritizing tasks
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragSection, setDragSection] = useState<"today" | "overdue" | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [items, inbox, ctxs] = await Promise.all([
        getTodayItems(),
        getInboxItems(),
        getContexts(),
      ]);
      setContexts(ctxs);
      const todayStr = new Date().toISOString().substring(0, 10);
      const computed = computeTodayBlocks(items, todayStr);
      computed.inbox_count = inbox.length;
      setBlocks(computed);
    } catch (e) {
      console.error("Erro ao carregar itens de hoje:", e);
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

    listen("item-created", () => loadData()).then((un) => {
      unlistenCreated = un;
    });
    listen("item-updated", () => loadData()).then((un) => {
      unlistenUpdated = un;
    });
    listen("items-imported", () => loadData()).then((un) => {
      unlistenImported = un;
    });

    return () => {
      unlistenCreated?.();
      unlistenUpdated?.();
      unlistenImported?.();
    };
  }, [loadData]);

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

  const handleDrop = async (targetId: string, section: "today" | "overdue") => {
    if (!draggedId || draggedId === targetId || dragSection !== section) return;

    if (section === "today") {
      const list = [...blocks.today];
      const fromIdx = list.findIndex((i) => i.id === draggedId);
      const toIdx = list.findIndex((i) => i.id === targetId);
      if (fromIdx >= 0 && toIdx >= 0) {
        const [moved] = list.splice(fromIdx, 1);
        list.splice(toIdx, 0, moved);
        setBlocks((prev) => ({ ...prev, today: list }));
        try {
          await reorderItems(list.map((i) => i.id));
        } catch (err) {
          console.error("Erro ao reordenar tarefas:", err);
        }
      }
    } else if (section === "overdue") {
      const list = [...blocks.overdue];
      const fromIdx = list.findIndex((i) => i.id === draggedId);
      const toIdx = list.findIndex((i) => i.id === targetId);
      if (fromIdx >= 0 && toIdx >= 0) {
        const [moved] = list.splice(fromIdx, 1);
        list.splice(toIdx, 0, moved);
        setBlocks((prev) => ({ ...prev, overdue: list }));
        try {
          await reorderItems(list.map((i) => i.id));
        } catch (err) {
          console.error("Erro ao reordenar atrasadas:", err);
        }
      }
    }

    setDraggedId(null);
    setDragOverId(null);
    setDragSection(null);
  };

  const renderItemRow = (
    item: Item,
    showOverdueBadge = false,
    section?: "today" | "overdue" | "waiting"
  ) => {
    const isDone = item.status === "done";
    const dateLabel = item.due_at || item.followup_at;
    const isDraggable = section === "today" || section === "overdue";
    const isBeingDragged = draggedId === item.id;
    const isDragOver = dragOverId === item.id && draggedId !== item.id;

    return (
      <div
        key={item.id}
        className={`item-row ${isBeingDragged ? "is-dragging" : ""} ${isDragOver ? "drag-over-top" : ""}`}
        draggable={isDraggable}
        onDragStart={(e) => {
          if (!isDraggable) return;
          e.dataTransfer.setData("text/plain", item.id);
          e.dataTransfer.effectAllowed = "move";
          setDraggedId(item.id);
          setDragSection(section);
        }}
        onDragOver={(e) => {
          if (!isDraggable || dragSection !== section) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDragEnter={() => {
          if (isDraggable && draggedId && draggedId !== item.id && dragSection === section) {
            setDragOverId(item.id);
          }
        }}
        onDragLeave={() => {
          if (dragOverId === item.id) {
            setDragOverId(null);
          }
        }}
        onDrop={(e) => {
          if (!isDraggable || !section) return;
          e.preventDefault();
          handleDrop(item.id, section);
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
            title="Arraste para definir a prioridade (solte acima ou abaixo)"
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
                }}
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
            onClick={() => setEditingItem(item)}
            title="Editar ou Reclassificar (Contexto, Tags, Datas)"
          >
            <PencilIcon size={12} />
            <span>Editar</span>
          </button>
          <button
            className="btn btn-secondary btn-sm btn-icon"
            onClick={() => handlePostponeTomorrow(item)}
            title="Adiar para amanhã"
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
        <div className="empty-state">Carregando itens de hoje...</div>
      </div>
    );
  }

  const hasAnyItems =
    blocks.overdue.length > 0 ||
    blocks.today.length > 0 ||
    Object.keys(blocks.waiting).length > 0 ||
    blocks.inbox_count > 0;

  return (
    <div className="page-body">
      {/* Bloco 1: Atrasados */}
      {blocks.overdue.length > 0 && (
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

      {/* Bloco 2: Hoje */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span>Hoje</span>
            <span className="card-count">{blocks.today.length}</span>
          </div>
        </div>
        {blocks.today.length === 0 ? (
          <div className="empty-state">
            Nenhuma demanda agendada para hoje.
          </div>
        ) : (
          <div className="item-list">
            {blocks.today.map((item) => renderItemRow(item, false, "today"))}
          </div>
        )}
      </div>

      {/* Bloco 3: Aguardando (por pessoa) */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span>Aguardando Retorno</span>
            <span className="card-count">
              {Object.values(blocks.waiting).reduce(
                (sum, list) => sum + list.length,
                0,
              )}
            </span>
          </div>
        </div>

        {Object.keys(blocks.waiting).length === 0 ? (
          <div className="empty-state">
            Nenhum item aguardando resposta de terceiros.
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

      {/* Bloco 4: Inbox para processar */}
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
