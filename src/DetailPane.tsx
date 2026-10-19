import React, { useState, useEffect } from "react";
import { updateItem } from "./commands";
import {
  CalendarIcon,
  LinkIcon,
  TagIcon,
  FolderIcon,
  TrashIcon,
  CheckIcon,
  PencilIcon,
  XIcon,
  UserIcon,
  PaperclipIcon,
} from "./Icons";
import type { Item, Context, ItemStatus } from "./types";

interface DetailPaneProps {
  item: Item | null;
  contexts: Context[];
  onClose: () => void;
  onUpdated: () => void;
  onOpenFullEdit?: (item: Item) => void;
}

export const DetailPane: React.FC<DetailPaneProps> = ({
  item,
  contexts,
  onClose,
  onUpdated,
  onOpenFullEdit,
}) => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<ItemStatus>("open");
  const [contextId, setContextId] = useState<string | null>(null);
  const [dueAt, setDueAt] = useState("");
  const [followupAt, setFollowupAt] = useState("");
  const [waitingOn, setWaitingOn] = useState("");
  const [ticketRef, setTicketRef] = useState("");
  const [url, setUrl] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setTitle(item.title || "");
      setBody(item.body || "");
      setStatus(item.status || "open");
      setContextId(item.context_id || null);
      setDueAt(item.due_at?.substring(0, 10) || "");
      setFollowupAt(item.followup_at?.substring(0, 10) || "");
      setWaitingOn(item.waiting_on || "");
      setTicketRef(item.ticket_ref || "");
      setUrl(item.url || "");
      setIsDirty(false);
    }
  }, [item]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await updateItem({
        id: item.id,
        title: title.trim() || "Sem título",
        body: body.trim() || null,
        status,
        context_id: contextId,
        due_at: dueAt || null,
        followup_at: followupAt || null,
        waiting_on: waitingOn.trim() || null,
        ticket_ref: ticketRef.trim() || null,
        url: url.trim() || null,
      });
      setIsDirty(false);
      onUpdated();
    } catch (err) {
      console.error("Erro ao salvar detalhes:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDone = async () => {
    const newStatus: ItemStatus = status === "done" ? "open" : "done";
    setStatus(newStatus);
    await updateItem({ id: item.id, status: newStatus });
    onUpdated();
  };

  const handlePostponeTomorrow = async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().substring(0, 10);
    if (status === "waiting") {
      setFollowupAt(dateStr);
      await updateItem({ id: item.id, followup_at: dateStr });
    } else {
      setDueAt(dateStr);
      await updateItem({ id: item.id, due_at: dateStr });
    }
    onUpdated();
  };

  const handleDelete = async () => {
    if (window.confirm(`Descartar "${item.title}"?`)) {
      await updateItem({ id: item.id, status: "dropped" });
      onClose();
      onUpdated();
    }
  };

  const currentContext = contexts.find((c) => c.id === contextId);

  return (
    <aside className="detail-pane" aria-label="Painel de Detalhes da Nota">
      {/* Header com ações rápidas */}
      <div className="detail-pane-header">
        <div className="detail-pane-status-pill">
          <select
            className="detail-status-select"
            value={status}
            onChange={(e) => {
              const val = e.target.value as ItemStatus;
              setStatus(val);
              setIsDirty(true);
            }}
          >
            <option value="inbox">Inbox</option>
            <option value="open">Em Execução</option>
            <option value="waiting">Aguardando FUP</option>
            <option value="done">Concluído</option>
            <option value="dropped">Descartado</option>
          </select>
        </div>

        <div className="detail-pane-actions">
          <button
            type="button"
            className={`btn btn-sm ${status === "done" ? "btn-secondary" : "btn-primary"}`}
            onClick={handleToggleDone}
            title={status === "done" ? "Reabrir demanda" : "Marcar como concluída"}
          >
            <CheckIcon size={12} />
            <span>{status === "done" ? "Reabrir" : "Concluir"}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handlePostponeTomorrow}
            title="Adiar para amanhã (+1 dia)"
          >
            <CalendarIcon size={12} />
            <span>+1d</span>
          </button>

          {onOpenFullEdit && (
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-icon-only"
              onClick={() => onOpenFullEdit(item)}
              title="Abrir editor completo"
            >
              <PencilIcon size={13} />
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm btn-icon-only"
            onClick={handleDelete}
            title="Excluir nota"
          >
            <TrashIcon size={13} />
          </button>

          <button
            type="button"
            className="detail-pane-close"
            onClick={onClose}
            title="Fechar painel (Esc)"
          >
            <XIcon size={14} />
          </button>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="detail-pane-body">
        {/* Título */}
        <div className="detail-section">
          <label className="detail-label">Título</label>
          <input
            type="text"
            className="detail-title-input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setIsDirty(true);
            }}
            placeholder="Título da demanda..."
          />
        </div>

        {/* Metadados Estilo Pane */}
        <div className="detail-props-grid">
          {/* Contexto */}
          <div className="detail-prop-row">
            <span className="detail-prop-key">
              <FolderIcon size={13} />
              <span>Contexto</span>
            </span>
            <div className="detail-prop-val">
              <select
                className="detail-prop-select"
                value={contextId || ""}
                onChange={(e) => {
                  setContextId(e.target.value || null);
                  setIsDirty(true);
                }}
              >
                <option value="">(Nenhum)</option>
                {contexts.map((ctx) => (
                  <option key={ctx.id} value={ctx.id}>
                    @{ctx.name}
                  </option>
                ))}
              </select>
              {currentContext?.color && (
                <span
                  className="detail-color-indicator"
                  style={{ backgroundColor: currentContext.color }}
                />
              )}
            </div>
          </div>

          {/* Vencimento */}
          <div className="detail-prop-row">
            <span className="detail-prop-key">
              <CalendarIcon size={13} />
              <span>Vencimento</span>
            </span>
            <div className="detail-prop-val">
              <input
                type="date"
                className="detail-prop-input"
                value={dueAt}
                onChange={(e) => {
                  setDueAt(e.target.value);
                  setIsDirty(true);
                }}
              />
            </div>
          </div>

          {/* Follow-up / Cobrança */}
          <div className="detail-prop-row">
            <span className="detail-prop-key">
              <UserIcon size={13} />
              <span>Aguardando</span>
            </span>
            <div className="detail-prop-val">
              <input
                type="text"
                className="detail-prop-input"
                placeholder="Ex: Gustavo, Massao..."
                value={waitingOn}
                onChange={(e) => {
                  setWaitingOn(e.target.value);
                  setIsDirty(true);
                }}
              />
            </div>
          </div>

          {/* Data do Follow-up */}
          {status === "waiting" && (
            <div className="detail-prop-row">
              <span className="detail-prop-key">
                <CalendarIcon size={13} />
                <span>Cobrar em</span>
              </span>
              <div className="detail-prop-val">
                <input
                  type="date"
                  className="detail-prop-input"
                  value={followupAt}
                  onChange={(e) => {
                    setFollowupAt(e.target.value);
                    setIsDirty(true);
                  }}
                />
              </div>
            </div>
          )}

          {/* Ticket */}
          <div className="detail-prop-row">
            <span className="detail-prop-key">
              <TagIcon size={13} />
              <span>Ticket</span>
            </span>
            <div className="detail-prop-val">
              <input
                type="text"
                className="detail-prop-input"
                placeholder="Ex: TK-1029, JIRA-42"
                value={ticketRef}
                onChange={(e) => {
                  setTicketRef(e.target.value);
                  setIsDirty(true);
                }}
              />
            </div>
          </div>

          {/* URL / Link */}
          <div className="detail-prop-row">
            <span className="detail-prop-key">
              <LinkIcon size={13} />
              <span>Link URL</span>
            </span>
            <div className="detail-prop-val" style={{ display: "flex", gap: "6px" }}>
              <input
                type="url"
                className="detail-prop-input"
                placeholder="https://..."
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setIsDirty(true);
                }}
              />
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm btn-icon-only"
                  title="Abrir URL externa"
                >
                  <LinkIcon size={12} />
                </a>
              )}
            </div>
          </div>

          {/* Anexos */}
          {item.attachment_count !== undefined && item.attachment_count > 0 && (
            <div className="detail-prop-row">
              <span className="detail-prop-key">
                <PaperclipIcon size={13} />
                <span>Anexos</span>
              </span>
              <div className="detail-prop-val">
                <span className="badge badge-attachment">
                  {item.attachment_count} arquivo(s)
                </span>
                {onOpenFullEdit && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: "8px", padding: "2px 8px", fontSize: "11px" }}
                    onClick={() => onOpenFullEdit(item)}
                  >
                    Gerenciar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="detail-section">
            <label className="detail-label">Tags</label>
            <div className="detail-tags-list">
              {item.tags.map((t) => (
                <span key={t} className="badge badge-tag">
                  #{t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Corpo / Anotações */}
        <div className="detail-section" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <label className="detail-label">Descrição & Anotações</label>
          <textarea
            className="detail-body-textarea"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setIsDirty(true);
            }}
            placeholder="Adicione detalhes, checklists, anotações de reunião ou contexto..."
          />
        </div>

        {/* Rodapé do Painel com datas */}
        <div className="detail-pane-footer">
          <div className="detail-timestamps">
            {item.created_at && (
              <span>Criado: {new Date(item.created_at).toLocaleDateString("pt-BR")}</span>
            )}
            {item.updated_at && (
              <span> • Atualizado: {new Date(item.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            )}
          </div>

          {isDirty && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar Alterações"}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default DetailPane;
