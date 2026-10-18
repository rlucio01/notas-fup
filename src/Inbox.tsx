import React, { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { getInboxItems, getContexts, updateItem, reorderItems } from "./commands";
import { isTauri } from "./cloud-sync";
import { parseDateToken } from "./capture-syntax";
import { EditModal } from "./EditModal";
import { FolderIcon, CalendarIcon, TrashIcon, GripIcon, PaperclipIcon } from "./Icons";
import type { Item, Context } from "./types";

export const Inbox: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

  // Drag and drop state for prioritizing inbox items
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Active modal/prompt state for keyboard shortcuts
  const [promptMode, setPromptMode] = useState<"context" | "tag" | "date" | "waiting" | null>(null);
  const [promptValue, setPromptValue] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [inboxItems, ctxs] = await Promise.all([getInboxItems(), getContexts()]);
      setItems(inboxItems);
      setContexts(ctxs);
      setSelectedIndex((idx) => (inboxItems.length > 0 ? Math.min(idx, inboxItems.length - 1) : 0));
    } catch (e) {
      console.error("Erro ao carregar Inbox:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    let unlistenCreated: (() => void) | undefined;
    let unlistenUpdated: (() => void) | undefined;
    let unlistenContext: (() => void) | undefined;

    if (isTauri()) {
      listen("item-created", () => loadData()).then((un) => {
        unlistenCreated = un;
      });
      listen("item-updated", () => loadData()).then((un) => {
        unlistenUpdated = un;
      });
      listen("context-updated", () => loadData()).then((un) => {
        unlistenContext = un;
      });
    }

    return () => {
      unlistenCreated?.();
      unlistenUpdated?.();
      unlistenContext?.();
    };
  }, [loadData]);

  const handleDrop = async (targetId: string, e?: React.DragEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const sourceId = e?.dataTransfer?.getData("text/plain") || draggedId;
    if (!sourceId || sourceId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const list = [...items];
    const fromIdx = list.findIndex((i) => i.id === sourceId);
    const toIdx = list.findIndex((i) => i.id === targetId);
    if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      setItems(list);
      setSelectedIndex(toIdx);
      try {
        await reorderItems(list.map((i) => i.id));
      } catch (err) {
        console.error("Erro ao reordenar inbox:", err);
      }
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const selectedItem = items[selectedIndex] || null;

  // Handle global keyboard shortcuts on the inbox
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // If a modal prompt or edit modal is open, don't intercept keys
      if (promptMode !== null || editingItem !== null) return;
      if (!selectedItem) return;

      const key = e.key.toLowerCase();

      if (e.key === "ArrowDown" || key === "j") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === "ArrowUp" || key === "k") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (key === "e") {
        e.preventDefault();
        setEditingItem(selectedItem);
      } else if (key === "c") {
        e.preventDefault();
        setPromptMode("context");
        setPromptValue("");
      } else if (key === "t") {
        e.preventDefault();
        setPromptMode("tag");
        setPromptValue("");
      } else if (key === "d") {
        e.preventDefault();
        setPromptMode("date");
        setPromptValue("amanhã");
      } else if (key === "w") {
        e.preventDefault();
        setPromptMode("waiting");
        setPromptValue("");
      } else if (key === "x") {
        e.preventDefault();
        await updateItem({ id: selectedItem.id, status: "done" });
        loadData();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        await updateItem({ id: selectedItem.id, status: "dropped" });
        loadData();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [promptMode, editingItem, selectedItem, items.length, loadData]);

  const handlePromptSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedItem || !promptMode) return;

    if (promptMode === "context") {
      const trimmed = promptValue.trim();
      if (trimmed) {
        // Find existing context or assign by name
        const match = contexts.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
        const ctxId = match ? match.id : null;
        await updateItem({
          id: selectedItem.id,
          context_id: ctxId,
          status: "open", // Rule: receiving context promotes from inbox to open
        });
      }
    } else if (promptMode === "tag") {
      const tag = promptValue.trim().toLowerCase();
      if (tag) {
        const currentTags = selectedItem.tags || [];
        if (!currentTags.includes(tag)) {
          await updateItem({
            id: selectedItem.id,
            tags: [...currentTags, tag],
          });
        }
      }
    } else if (promptMode === "date") {
      const parsed = parseDateToken(promptValue.trim());
      if (parsed) {
        if (selectedItem.status === "waiting") {
          await updateItem({ id: selectedItem.id, followup_at: parsed });
        } else {
          await updateItem({ id: selectedItem.id, due_at: parsed });
        }
      }
    } else if (promptMode === "waiting") {
      const person = promptValue.trim();
      if (person) {
        await updateItem({
          id: selectedItem.id,
          waiting_on: person,
          status: "waiting",
        });
      }
    }

    setPromptMode(null);
    setPromptValue("");
    loadData();
  };

  const handleSelectContextOption = async (ctx: Context) => {
    if (!selectedItem) return;
    await updateItem({
      id: selectedItem.id,
      context_id: ctx.id,
      status: "open",
    });
    setPromptMode(null);
    loadData();
  };

  if (loading) {
    return (
      <div className="page-body">
        <div className="empty-state">Carregando Inbox...</div>
      </div>
    );
  }

  return (
    <div className="page-body">
      {/* Keyboard Shortcut Bar */}
      <div className="shortcut-bar">
        <span>Atalhos rápidos:</span>
        <span><span className="kbd-badge">J</span>/<span className="kbd-badge">K</span> navegar</span>
        <span><span className="kbd-badge">E</span> editar tudo</span>
        <span><span className="kbd-badge">C</span> contexto</span>
        <span><span className="kbd-badge">T</span> tag</span>
        <span><span className="kbd-badge">D</span> data</span>
        <span><span className="kbd-badge">W</span> aguardando</span>
        <span><span className="kbd-badge">X</span> concluir</span>
        <span><span className="kbd-badge">Del</span> descartar</span>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          Inbox completamente limpo! Use o atalho global Ctrl+Alt+N para capturar novas notas.
        </div>
      ) : (
        <div className="item-list">
          {items.map((item, index) => {
            const isSelected = index === selectedIndex;
            const isBeingDragged = draggedId === item.id;
            const isDragOver = dragOverId === item.id && draggedId !== item.id;

            return (
              <div
                key={item.id}
                className={`item-row ${isSelected ? "selected" : ""} ${isBeingDragged ? "is-dragging" : ""} ${isDragOver ? "drag-over-top" : ""}`}
                onClick={() => setSelectedIndex(index)}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", item.id);
                  e.dataTransfer.effectAllowed = "move";
                  setDraggedId(item.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (draggedId && draggedId !== item.id && dragOverId !== item.id) {
                    setDragOverId(item.id);
                  }
                }}
                onDragEnter={(e) => {
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
                  handleDrop(item.id, e);
                }}
                onDragEnd={() => {
                  setDraggedId(null);
                  setDragOverId(null);
                }}
              >
                <span
                  className="drag-handle"
                  title="Arraste para priorizar no Inbox"
                  draggable={true}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData("text/plain", item.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDraggedId(item.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <GripIcon size={14} />
                </span>

                <div className="item-row-top">
                  <input
                    type="checkbox"
                    className="item-checkbox"
                    checked={false}
                    onChange={async () => {
                      await updateItem({ id: item.id, status: "done" });
                      loadData();
                    }}
                    title="Concluir item (X)"
                  />

                  <div
                    className="item-main"
                    style={{ cursor: "pointer" }}
                    onClick={() => setEditingItem(item)}
                    title="Clique para editar ou reclassificar (E)"
                  >
                    <div className="item-title-row">
                      <span className="item-title">{item.title}</span>
                    </div>

                    {Boolean(
                      item.ticket_ref ||
                        item.waiting_on ||
                        item.due_at ||
                        item.followup_at ||
                        (item.tags && item.tags.length > 0) ||
                        (item.attachment_count !== undefined && item.attachment_count > 0)
                    ) && (
                      <div className="item-badges-row">
                        {item.ticket_ref && (
                          <span className="badge badge-ticket">{item.ticket_ref}</span>
                        )}

                        {item.waiting_on && (
                          <span className="badge badge-waiting">~{item.waiting_on}</span>
                        )}

                        {(item.due_at || item.followup_at) && (
                          <span className="badge badge-today">
                            {(item.due_at || item.followup_at)?.substring(0, 10)}
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
                    )}

                    {item.body && <div className="item-body">{item.body}</div>}
                  </div>
                </div>

                <div className="item-actions">
                  <button
                    className="btn btn-secondary btn-sm btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIndex(index);
                      setPromptMode("context");
                    }}
                    title="Definir contexto (C)"
                  >
                    <FolderIcon size={12} />
                    <span>Contexto</span>
                  </button>
                  <button
                    className="btn btn-secondary btn-sm btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIndex(index);
                      setPromptMode("date");
                    }}
                    title="Definir data (D)"
                  >
                    <CalendarIcon size={12} />
                    <span>Data</span>
                  </button>
                  <button
                    className="btn btn-danger btn-sm btn-icon"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await updateItem({ id: item.id, status: "dropped" });
                      loadData();
                    }}
                    title="Descartar (Del)"
                  >
                    <TrashIcon size={12} />
                    <span>Descartar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal / Popover for Quick Keyboard Actions */}
      {promptMode !== null && selectedItem && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setPromptMode(null)}
        >
          <div
            className="card"
            style={{ width: "420px", maxWidth: "90vw" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <span className="card-title">
                {promptMode === "context" && "Definir Contexto"}
                {promptMode === "tag" && "Adicionar Tag"}
                {promptMode === "date" && "Definir Data de Follow-up"}
                {promptMode === "waiting" && "Aguardando Quem?"}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPromptMode(null)}
              >
                Esc
              </button>
            </div>

            {promptMode === "context" && contexts.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginBottom: "12px",
                }}
              >
                {contexts.map((ctx) => (
                  <button
                    key={ctx.id}
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSelectContextOption(ctx)}
                  >
                    @{ctx.name}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handlePromptSubmit}>
              <input
                autoFocus
                type="text"
                className="capture-textarea"
                style={{ width: "100%", height: "38px", marginBottom: "12px" }}
                placeholder={
                  promptMode === "context"
                    ? "Nome do contexto (ex: Empresa, Pessoal)"
                    : promptMode === "tag"
                    ? "Nome da tag (ex: urgente, faturamento)"
                    : promptMode === "date"
                    ? "Ex: amanhã, hoje, 25/10"
                    : "Nome da pessoa ou time (ex: Beltrano, Contratos)"
                }
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setPromptMode(null);
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPromptMode(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Salvar (Enter)
                </button>
              </div>
            </form>
          </div>
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

export default Inbox;
