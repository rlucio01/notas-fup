import React, { useState, useEffect, useRef, useMemo } from "react";
import { updateItem, getTags } from "./commands";
import { useAutocomplete } from "./useAutocomplete";
import { AutocompleteDropdown } from "./AutocompleteDropdown";
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
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [allAvailableTags, setAllAvailableTags] = useState<string[]>([]);
  const [selectedTagIndex, setSelectedTagIndex] = useState(0);
  const [dueAt, setDueAt] = useState("");
  const [followupAt, setFollowupAt] = useState("");
  const [waitingOn, setWaitingOn] = useState("");
  const [ticketRef, setTicketRef] = useState("");
  const [url, setUrl] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getTags().then(setAllAvailableTags).catch(console.error);
  }, []);

  useEffect(() => {
    if (item) {
      setTitle(item.title || "");
      setBody(item.body || "");
      setStatus(item.status || "open");
      setContextId(item.context_id || null);
      setTags(item.tags || []);
      setTagInput("");
      setDueAt(item.due_at?.substring(0, 10) || "");
      setFollowupAt(item.followup_at?.substring(0, 10) || "");
      setWaitingOn(item.waiting_on || "");
      setTicketRef(item.ticket_ref || "");
      setUrl(item.url || "");
      setIsDirty(false);
    }
  }, [item]);

  const bodyAutocomplete = useAutocomplete(
    body,
    (val) => {
      setBody(val);
      setIsDirty(true);
    },
    bodyRef,
    contexts,
    allAvailableTags
  );

  const matchingTags = useMemo(() => {
    const q = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (!q) return [];
    return allAvailableTags
      .filter((t) => t.toLowerCase().includes(q) && !tags.includes(t))
      .slice(0, 8);
  }, [tagInput, allAvailableTags, tags]);

  const handleAddTag = (tagToAdd?: string) => {
    const raw = tagToAdd || tagInput;
    const clean = raw.trim().toLowerCase().replace(/^#/, "");
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setIsDirty(true);
      if (!allAvailableTags.includes(clean)) {
        setAllAvailableTags((prev) => [...prev, clean]);
      }
    }
    setTagInput("");
    setSelectedTagIndex(0);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
    setIsDirty(true);
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (matchingTags.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedTagIndex((idx) => (idx + 1) % matchingTags.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedTagIndex((idx) => (idx - 1 + matchingTags.length) % matchingTags.length);
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && matchingTags[selectedTagIndex]) {
        e.preventDefault();
        handleAddTag(matchingTags[selectedTagIndex]);
        return;
      }
    }
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      handleAddTag();
    }
  };

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
        tags,
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
        <div className="detail-section">
          <label className="detail-label">Tags (#)</label>
          <div className="detail-tags-list" style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
            {tags.map((t) => (
              <span key={t} className="badge badge-tag" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                #{t}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(t)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "inherit",
                    padding: 0,
                    lineHeight: 1,
                    fontSize: "13px",
                  }}
                  title={`Remover tag #${t}`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>

          <div style={{ position: "relative" }}>
            <input
              type="text"
              className="detail-prop-input"
              style={{ width: "100%" }}
              placeholder="Adicionar tag (ex: #FinOps)..."
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                setSelectedTagIndex(0);
              }}
              onKeyDown={handleTagInputKeyDown}
            />

            {matchingTags.length > 0 && (
              <div
                className="autocomplete-dropdown"
                style={{
                  top: "100%",
                  left: 0,
                  width: "100%",
                  marginTop: "4px",
                  zIndex: 200,
                }}
              >
                <div className="autocomplete-header">Sugestões de Tags (#)</div>
                {matchingTags.map((mt, idx) => (
                  <div
                    key={mt}
                    className={`autocomplete-item ${idx === selectedTagIndex ? "selected" : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleAddTag(mt);
                    }}
                  >
                    <span className="autocomplete-prefix">#</span>
                    <span className="autocomplete-name">{mt}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Corpo / Anotações */}
        <div className="detail-section" style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
          <label className="detail-label">Descrição & Anotações (@contexto, #tag)</label>
          <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
            <textarea
              ref={bodyRef}
              className="detail-body-textarea"
              value={body}
              onChange={(e) => {
                const val = e.target.value;
                setBody(val);
                setIsDirty(true);
                bodyAutocomplete.checkTrigger(val, e.target.selectionStart || val.length);
              }}
              onKeyUp={(e) => {
                bodyAutocomplete.checkTrigger(body, e.currentTarget.selectionStart || body.length);
              }}
              onClick={(e) => {
                bodyAutocomplete.checkTrigger(body, e.currentTarget.selectionStart || body.length);
              }}
              onKeyDown={(e) => {
                if (bodyAutocomplete.isOpen) {
                  const handled = bodyAutocomplete.handleKeyDown(e);
                  if (handled) return;
                }
              }}
              placeholder="Adicione detalhes, checklists (@contexto, #tag) ou notas..."
            />

            {bodyAutocomplete.isOpen && (
              <AutocompleteDropdown
                items={bodyAutocomplete.items}
                selectedIndex={bodyAutocomplete.selectedIndex}
                onSelect={bodyAutocomplete.handleSelect}
                title={bodyAutocomplete.trigger === "@" ? "Contextos (@)" : "Tags (#)"}
                style={{ bottom: "100%", left: 0, width: "100%", marginBottom: "4px" }}
              />
            )}
          </div>
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
