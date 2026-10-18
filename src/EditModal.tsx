import React, { useState, useEffect } from "react";
import { updateItem, createContext } from "./commands";
import type { Item, Context, ItemStatus } from "./types";

interface EditModalProps {
  item: Item;
  contexts: Context[];
  onClose: () => void;
  onSaved: () => void;
}

export const EditModal: React.FC<EditModalProps> = ({
  item,
  contexts,
  onClose,
  onSaved,
}) => {
  const [title, setTitle] = useState(item.title || "");
  const [body, setBody] = useState(item.body || "");
  const [contextId, setContextId] = useState<string | null>(item.context_id || null);
  const [isCreatingContext, setIsCreatingContext] = useState(false);
  const [newContextName, setNewContextName] = useState("");
  const [tags, setTags] = useState<string[]>(item.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [status, setStatus] = useState<ItemStatus>(item.status || "open");
  const [waitingOn, setWaitingOn] = useState(item.waiting_on || "");
  const [dueAt, setDueAt] = useState(item.due_at?.substring(0, 10) || "");
  const [followupAt, setFollowupAt] = useState(item.followup_at?.substring(0, 10) || "");
  const [ticketRef, setTicketRef] = useState(item.ticket_ref || "");
  const [url, setUrl] = useState(item.url || "");
  const [saving, setSaving] = useState(false);

  // Close on Escape, save on Ctrl+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [title, body, contextId, tags, status, waitingOn, dueAt, followupAt, ticketRef, url, newContextName, isCreatingContext]);

  const handleAddTag = () => {
    const clean = tagInput.trim().replace(/^#/, "").toLowerCase().replace(/\s+/g, "");
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const setRelativeDate = (days: number, target: "due" | "followup") => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const dateStr = d.toISOString().substring(0, 10);
    if (target === "due") {
      setDueAt(dateStr);
    } else {
      setFollowupAt(dateStr);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      let finalContextId = contextId;
      if (isCreatingContext && newContextName.trim()) {
        const created = await createContext(newContextName.trim(), "#3b82f6");
        finalContextId = created.id;
      }

      await updateItem({
        id: item.id,
        title: title.trim(),
        body: body.trim() || null,
        context_id: finalContextId,
        status,
        waiting_on: waitingOn.trim() || null,
        due_at: dueAt || null,
        followup_at: followupAt || null,
        ticket_ref: ticketRef.trim() || null,
        url: url.trim() || null,
        tags,
      });

      onSaved();
      onClose();
    } catch (err) {
      console.error("Erro ao atualizar item:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDrop = async () => {
    if (!window.confirm("Deseja realmente descartar esta nota?")) return;
    setSaving(true);
    try {
      await updateItem({ id: item.id, status: "dropped" });
      onSaved();
      onClose();
    } catch (err) {
      console.error("Erro ao descartar item:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Editar e Reclassificar Nota</span>
          <button className="modal-close-btn" onClick={onClose} title="Fechar (Esc)">
            &times;
          </button>
        </div>

        <div className="modal-body">
          {/* Título */}
          <div className="form-group">
            <label className="form-label">Título da Demanda / Nota</label>
            <input
              autoFocus
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Descreva o que precisa ser feito..."
            />
          </div>

          {/* Contexto e Status */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contexto (@)</label>
              {!isCreatingContext ? (
                <div style={{ display: "flex", gap: "6px" }}>
                  <select
                    className="form-select"
                    style={{ flex: 1 }}
                    value={contextId || ""}
                    onChange={(e) => {
                      if (e.target.value === "__new__") {
                        setIsCreatingContext(true);
                      } else {
                        setContextId(e.target.value ? e.target.value : null);
                      }
                    }}
                  >
                    <option value="">Sem contexto (Inbox)</option>
                    {contexts.map((c) => (
                      <option key={c.id} value={c.id}>
                        @{c.name}
                      </option>
                    ))}
                    <option value="__new__">+ Novo contexto...</option>
                  </select>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ flex: 1 }}
                    placeholder="Nome do contexto..."
                    value={newContextName}
                    onChange={(e) => setNewContextName(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setIsCreatingContext(false);
                      setNewContextName("");
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as ItemStatus)}
              >
                <option value="inbox">Inbox</option>
                <option value="open">Aberto (Em andamento)</option>
                <option value="waiting">Aguardando (~)</option>
                <option value="done">Concluído</option>
                <option value="dropped">Descartado</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div className="form-group">
            <label className="form-label">Tags (#) - Adicione ou remova tags</label>
            <div className="tags-container">
              {tags.map((t) => (
                <span key={t} className="tag-chip">
                  #{t}
                  <button
                    type="button"
                    className="tag-remove"
                    onClick={() => handleRemoveTag(t)}
                    title="Remover tag"
                  >
                    &times;
                  </button>
                </span>
              ))}
              <input
                type="text"
                className="tag-input"
                placeholder={tags.length === 0 ? "Digite uma tag e pressione Enter..." : "Adicionar tag..."}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                onBlur={handleAddTag}
              />
            </div>
          </div>

          {/* Aguardando quem */}
          {status === "waiting" && (
            <div className="form-group">
              <label className="form-label">Aguardando Quem? (~)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Flavinho, Segurança, Cliente..."
                value={waitingOn}
                onChange={(e) => setWaitingOn(e.target.value)}
              />
            </div>
          )}

          {/* Prazo e Follow-up */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Prazo Final (Due Date)</label>
              <input
                type="date"
                className="form-input"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
              <div className="quick-pills">
                <span className="quick-pill" onClick={() => setRelativeDate(0, "due")}>Hoje</span>
                <span className="quick-pill" onClick={() => setRelativeDate(1, "due")}>+1 dia</span>
                <span className="quick-pill" onClick={() => setRelativeDate(7, "due")}>+1 sem</span>
                {dueAt && <span className="quick-pill" onClick={() => setDueAt("")}>Limpar</span>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Próximo Follow-up</label>
              <input
                type="date"
                className="form-input"
                value={followupAt}
                onChange={(e) => setFollowupAt(e.target.value)}
              />
              <div className="quick-pills">
                <span className="quick-pill" onClick={() => setRelativeDate(1, "followup")}>+1 dia</span>
                <span className="quick-pill" onClick={() => setRelativeDate(3, "followup")}>+3 dias</span>
                <span className="quick-pill" onClick={() => setRelativeDate(7, "followup")}>+1 sem</span>
                {followupAt && <span className="quick-pill" onClick={() => setFollowupAt("")}>Limpar</span>}
              </div>
            </div>
          </div>

          {/* Ticket e URL */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Ticket / Referência</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: PRB-123, INC-456, #97"
                value={ticketRef}
                onChange={(e) => setTicketRef(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Link / URL</label>
              <input
                type="text"
                className="form-input"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          </div>

          {/* Detalhes / Body */}
          <div className="form-group">
            <label className="form-label">Detalhes / Conteúdo</label>
            <textarea
              className="form-textarea"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Anotações adicionais, histórico, comandos ou checklists..."
            />
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={handleDrop}
            disabled={saving}
          >
            Descartar Nota
          </button>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving || !title.trim()}
            >
              {saving ? "Salvando..." : "Salvar Alterações (Ctrl+Enter)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
