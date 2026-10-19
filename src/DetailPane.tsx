import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  updateItem,
  createItem,
  createContext,
  getItemAttachments,
  addAttachment,
  deleteAttachment,
  getTags,
} from "./commands";
import { useAutocomplete } from "./useAutocomplete";
import { AutocompleteDropdown } from "./AutocompleteDropdown";
import {
  CalendarIcon,
  LinkIcon,
  TagIcon,
  FolderIcon,
  TrashIcon,
  CheckIcon,
  XIcon,
  UserIcon,
  PaperclipIcon,
  DownloadIcon,
} from "./Icons";
import type { Item, Context, ItemStatus, Attachment } from "./types";

const isImageAttachment = (att: Attachment): boolean => {
  if (att.mime_type && att.mime_type.startsWith("image/")) return true;
  const ext = (att.filename || "").split(".").pop()?.toLowerCase();
  return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico"].includes(ext || "");
};

const getFileBadgeInfo = (filename: string | null) => {
  const ext = (filename || "").split(".").pop()?.toUpperCase() || "ARQ";
  switch (ext) {
    case "PDF":
      return { label: "PDF", bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "rgba(239, 68, 68, 0.3)" };
    case "DOC":
    case "DOCX":
      return { label: "DOC", bg: "rgba(37, 99, 235, 0.15)", color: "#3b82f6", border: "rgba(37, 99, 235, 0.3)" };
    case "XLS":
    case "XLSX":
    case "CSV":
      return { label: ext === "CSV" ? "CSV" : "XLS", bg: "rgba(22, 163, 74, 0.15)", color: "#22c55e", border: "rgba(22, 163, 74, 0.3)" };
    case "PPT":
    case "PPTX":
      return { label: "PPT", bg: "rgba(234, 88, 12, 0.15)", color: "#f97316", border: "rgba(234, 88, 12, 0.3)" };
    case "ZIP":
    case "RAR":
    case "7Z":
    case "TAR":
    case "GZ":
      return { label: "ZIP", bg: "rgba(147, 51, 234, 0.15)", color: "#a855f7", border: "rgba(147, 51, 234, 0.3)" };
    case "TXT":
    case "MD":
    case "LOG":
    case "JSON":
    case "XML":
    case "SQL":
      return { label: ext, bg: "rgba(100, 116, 139, 0.15)", color: "#94a3b8", border: "rgba(100, 116, 139, 0.3)" };
    default:
      return { label: ext.slice(0, 4), bg: "rgba(100, 116, 139, 0.15)", color: "#94a3b8", border: "rgba(100, 116, 139, 0.3)" };
  }
};

const formatFileSize = (base64Data: string): string => {
  const commaIdx = base64Data.indexOf(",");
  const base64Len = commaIdx !== -1 ? base64Data.length - commaIdx - 1 : base64Data.length;
  const bytes = Math.floor((base64Len * 3) / 4);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const handleDownloadAttachment = (att: Attachment) => {
  const a = document.createElement("a");
  a.href = att.data;
  a.download = att.filename || "anexo";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

interface DetailPaneProps {
  item: Item | null;
  contexts: Context[];
  allItems?: Item[];
  onClose: () => void;
  onUpdated: () => void;
  onSelectItem?: (item: Item) => void;
  onToggleDone?: (item: Item) => void;
  onOpenFullEdit?: (item: Item) => void;
}

export const DetailPane: React.FC<DetailPaneProps> = ({
  item,
  contexts,
  allItems = [],
  onClose,
  onUpdated,
  onSelectItem,
  onToggleDone,
}) => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<ItemStatus>("open");
  const [contextId, setContextId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isCreatingContext, setIsCreatingContext] = useState(false);
  const [newContextName, setNewContextName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [allAvailableTags, setAllAvailableTags] = useState<string[]>([]);
  const [selectedTagIndex, setSelectedTagIndex] = useState(0);
  const [dueAt, setDueAt] = useState("");
  const [followupAt, setFollowupAt] = useState("");
  const [waitingOn, setWaitingOn] = useState("");
  const [ticketRef, setTicketRef] = useState("");
  const [url, setUrl] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

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
      setParentId(item.parent_id || null);
      setNewSubtaskTitle("");
      setIsCreatingContext(false);
      setNewContextName("");
      setTags(item.tags || []);
      setTagInput("");
      setDueAt(item.due_at?.substring(0, 10) || "");
      setFollowupAt(item.followup_at?.substring(0, 10) || "");
      setWaitingOn(item.waiting_on || "");
      setTicketRef(item.ticket_ref || "");
      setUrl(item.url || "");
      setIsDirty(false);
      setSavedSuccess(false);

      // Load attachments for this item
      getItemAttachments(item.id)
        .then(setAttachments)
        .catch((err) => console.error("Erro ao carregar anexos:", err));
    }
  }, [item?.id]);

  // Subtasks derived data
  const subtasks = useMemo(() => {
    if (!item) return [];
    return allItems.filter((i) => i.parent_id === item.id && !i.deleted_at);
  }, [allItems, item?.id]);

  const subtasksDoneCount = useMemo(() => {
    return subtasks.filter((s) => s.status === "done").length;
  }, [subtasks]);

  const parentItem = useMemo(() => {
    if (!parentId) return null;
    return allItems.find((i) => i.id === parentId) || null;
  }, [allItems, parentId]);

  const candidateParents = useMemo(() => {
    if (!item) return [];
    return allItems.filter(
      (i) => i.id !== item.id && !i.parent_id && i.status !== "done" && i.status !== "dropped"
    );
  }, [allItems, item?.id]);

  const handleToggleSubtask = async (st: Item) => {
    const nextStatus: ItemStatus = st.status === "done" ? "open" : "done";
    await updateItem({ id: st.id, status: nextStatus });
    onUpdated();
  };

  const handleUnlinkSubtask = async (subtaskId: string) => {
    await updateItem({ id: subtaskId, parent_id: null });
    onUpdated();
  };

  const handleUnlinkParent = async () => {
    if (!item) return;
    setParentId(null);
    setIsDirty(true);
    await updateItem({ id: item.id, parent_id: null });
    onUpdated();
  };

  const handleLinkToParent = async (targetParentId: string) => {
    if (!item) return;
    setParentId(targetParentId);
    setIsDirty(true);
    await updateItem({ id: item.id, parent_id: targetParentId });
    onUpdated();
  };

  const handleAddSubtask = async () => {
    if (!item || !newSubtaskTitle.trim()) return;
    const taskTitle = newSubtaskTitle.trim();
    setNewSubtaskTitle("");
    await createItem({
      title: taskTitle,
      parent_id: item.id,
      context_id: item.context_id,
      status: "open",
      kind: "task",
    });
    onUpdated();
  };

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

  const setRelativeDate = (days: number, target: "due" | "followup") => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const dateStr = d.toISOString().substring(0, 10);
    if (target === "due") {
      setDueAt(dateStr);
    } else {
      setFollowupAt(dateStr);
    }
    setIsDirty(true);
  };

  const handleCreateContext = async () => {
    const trimmed = newContextName.trim();
    if (!trimmed) {
      setIsCreatingContext(false);
      return;
    }
    try {
      const created = await createContext(trimmed, "#3b82f6");
      setContextId(created.id);
      setIsCreatingContext(false);
      setNewContextName("");
      setIsDirty(true);
      onUpdated();
    } catch (err) {
      console.error("Erro ao criar contexto:", err);
    }
  };

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      if (!item) return;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = async (evt) => {
          const dataUrl = evt.target?.result as string;
          if (dataUrl) {
            try {
              const isImg = file.type?.startsWith("image/");
              const fallbackName = isImg ? `print_${Date.now()}.png` : `anexo_${Date.now()}`;
              const created = await addAttachment(
                item.id,
                dataUrl,
                file.type || "application/octet-stream",
                file.name || fallbackName
              );
              setAttachments((prev) => [...prev, created]);
              onUpdated();
            } catch (err) {
              console.error("Erro ao salvar anexo:", err);
            }
          }
        };
        reader.readAsDataURL(file);
      }
    },
    [item, onUpdated]
  );

  // Paste listener for prints or attached files
  useEffect(() => {
    if (!item) return;

    const handlePaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        processFiles(files);
        return;
      }

      const clipItems = e.clipboardData?.items;
      if (!clipItems) return;

      for (let i = 0; i < clipItems.length; i++) {
        const clip = clipItems[i];
        if (clip.type.indexOf("image") !== -1) {
          const file = clip.getAsFile();
          if (file) {
            processFiles([file]);
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [item, processFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    e.target.value = "";
  };

  const handleDropFiles = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDeleteAttachment = async (attId: string) => {
    if (!item) return;
    try {
      await deleteAttachment(attId, item.id);
      setAttachments((prev) => prev.filter((a) => a.id !== attId));
      onUpdated();
    } catch (err) {
      console.error("Erro ao excluir anexo:", err);
    }
  };

  const handleSave = useCallback(async () => {
    if (!item) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setSaving(true);
    try {
      let finalContextId = contextId;
      if (isCreatingContext && newContextName.trim()) {
        const created = await createContext(newContextName.trim(), "#3b82f6");
        finalContextId = created.id;
        setContextId(created.id);
        setIsCreatingContext(false);
        setNewContextName("");
      }

      await updateItem({
        id: item.id,
        title: trimmedTitle,
        body: body.trim() || null,
        status,
        context_id: finalContextId,
        tags,
        due_at: dueAt || null,
        followup_at: followupAt || null,
        waiting_on: waitingOn.trim() || null,
        ticket_ref: ticketRef.trim() || null,
        url: url.trim() || null,
        parent_id: parentId,
      });

      setIsDirty(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
      onUpdated();
    } catch (err) {
      console.error("Erro ao salvar detalhes:", err);
    } finally {
      setSaving(false);
    }
  }, [
    item,
    title,
    body,
    status,
    contextId,
    parentId,
    isCreatingContext,
    newContextName,
    tags,
    dueAt,
    followupAt,
    waitingOn,
    ticketRef,
    url,
    onUpdated,
  ]);

  // Global keydown: Escape closes, Ctrl+Enter saves
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightboxImage) {
          setLightboxImage(null);
        } else {
          onClose();
        }
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        if (!bodyAutocomplete.isOpen) {
          e.preventDefault();
          handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxImage, onClose, handleSave, bodyAutocomplete.isOpen]);

  if (!item) return null;

  const handleToggleDone = async () => {
    if (!item) return;
    if (onToggleDone && status !== "done") {
      setStatus("done");
      onToggleDone(item);
      return;
    }
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
    if (window.confirm(`Descartar "${title || item.title}"?`)) {
      await updateItem({ id: item.id, status: "dropped" });
      onClose();
      onUpdated();
    }
  };

  const currentContext = contexts.find((c) => c.id === contextId);

  return (
    <aside className="detail-pane" aria-label="Painel de Edição Completa da Nota">
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

          <button
            type="button"
            className="btn btn-secondary btn-sm btn-icon-only"
            onClick={handleDelete}
            title="Descartar nota"
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

      {/* Conteúdo principal - Edição Completa */}
      <div className="detail-pane-body">
        {/* Título da Demanda */}
        <div className="detail-section">
          <label className="detail-label">Título da Demanda / Nota</label>
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

        {/* Metadados e Propriedades */}
        <div className="detail-props-grid">
          {/* Contexto */}
          <div className="detail-prop-row">
            <span className="detail-prop-key">
              <FolderIcon size={13} />
              <span>Contexto</span>
            </span>
            <div className="detail-prop-val">
              {isCreatingContext ? (
                <div style={{ display: "flex", gap: "4px", width: "100%", justifyContent: "flex-end" }}>
                  <input
                    type="text"
                    className="detail-prop-input"
                    style={{ flex: 1, maxWidth: "150px" }}
                    placeholder="Novo contexto..."
                    value={newContextName}
                    onChange={(e) => setNewContextName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateContext();
                      } else if (e.key === "Escape") {
                        setIsCreatingContext(false);
                      }
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ padding: "2px 8px", fontSize: "11px" }}
                    onClick={handleCreateContext}
                  >
                    Criar
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: "2px 6px", fontSize: "11px" }}
                    onClick={() => setIsCreatingContext(false)}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <select
                    className="detail-prop-select"
                    value={contextId || ""}
                    onChange={(e) => {
                      if (e.target.value === "__NEW__") {
                        setIsCreatingContext(true);
                      } else {
                        setContextId(e.target.value || null);
                        setIsDirty(true);
                      }
                    }}
                  >
                    <option value="">(Nenhum)</option>
                    {contexts.map((ctx) => (
                      <option key={ctx.id} value={ctx.id}>
                        @{ctx.name}
                      </option>
                    ))}
                    <option value="__NEW__">+ Criar novo...</option>
                  </select>
                  {currentContext?.color && (
                    <span
                      className="detail-color-indicator"
                      style={{ backgroundColor: currentContext.color }}
                    />
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: "2px 6px", fontSize: "11px" }}
                    onClick={() => setIsCreatingContext(true)}
                    title="Criar novo contexto"
                  >
                    + Novo
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Prazo Final (Due Date) com Quick Pills */}
          <div className="detail-prop-row" style={{ alignItems: "flex-start" }}>
            <span className="detail-prop-key" style={{ paddingTop: "6px" }}>
              <CalendarIcon size={13} />
              <span>Prazo Final</span>
            </span>
            <div className="detail-prop-val" style={{ flexDirection: "column", alignItems: "flex-end" }}>
              <input
                type="date"
                className="detail-prop-input"
                value={dueAt}
                onChange={(e) => {
                  setDueAt(e.target.value);
                  setIsDirty(true);
                }}
              />
              <div className="quick-pills">
                <span className="quick-pill" onClick={() => setRelativeDate(0, "due")}>Hoje</span>
                <span className="quick-pill" onClick={() => setRelativeDate(1, "due")}>+1 dia</span>
                <span className="quick-pill" onClick={() => setRelativeDate(7, "due")}>+1 sem</span>
                {dueAt && (
                  <span
                    className="quick-pill"
                    onClick={() => {
                      setDueAt("");
                      setIsDirty(true);
                    }}
                  >
                    Limpar
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Próximo Follow-up com Quick Pills */}
          <div className="detail-prop-row" style={{ alignItems: "flex-start" }}>
            <span className="detail-prop-key" style={{ paddingTop: "6px" }}>
              <CalendarIcon size={13} />
              <span>Follow-up</span>
            </span>
            <div className="detail-prop-val" style={{ flexDirection: "column", alignItems: "flex-end" }}>
              <input
                type="date"
                className="detail-prop-input"
                value={followupAt}
                onChange={(e) => {
                  setFollowupAt(e.target.value);
                  setIsDirty(true);
                }}
              />
              <div className="quick-pills">
                <span className="quick-pill" onClick={() => setRelativeDate(1, "followup")}>+1 dia</span>
                <span className="quick-pill" onClick={() => setRelativeDate(3, "followup")}>+3 dias</span>
                <span className="quick-pill" onClick={() => setRelativeDate(7, "followup")}>+1 sem</span>
                {followupAt && (
                  <span
                    className="quick-pill"
                    onClick={() => {
                      setFollowupAt("");
                      setIsDirty(true);
                    }}
                  >
                    Limpar
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Aguardando / Responsável */}
          <div className="detail-prop-row">
            <span className="detail-prop-key">
              <UserIcon size={13} />
              <span>Aguardando</span>
            </span>
            <div className="detail-prop-val">
              <input
                type="text"
                className="detail-prop-input"
                placeholder="Ex: Gustavo, Segurança..."
                value={waitingOn}
                onChange={(e) => {
                  setWaitingOn(e.target.value);
                  setIsDirty(true);
                }}
              />
            </div>
          </div>

          {/* Ticket / Referência */}
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
        </div>

        {/* Tags (#) */}
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
              style={{ width: "100%", maxWidth: "100%" }}
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

        {/* Seção de Subtarefas & Associação */}
        <div className="detail-section detail-subtasks-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label className="detail-label" style={{ margin: 0, fontWeight: 600 }}>
              Subtarefas {subtasks.length > 0 && `(${subtasksDoneCount}/${subtasks.length})`}
            </label>
            {subtasks.length > 0 && (
              <span className="badge badge-today" style={{ fontSize: "11px" }}>
                {Math.round((subtasksDoneCount / subtasks.length) * 100)}% concluído
              </span>
            )}
          </div>

          {/* Se este item for uma subtarefa de outro item */}
          {parentItem && (
            <div className="subtask-parent-banner">
              <span className="subtask-parent-label">Subtarefa de:</span>
              <button
                type="button"
                className="subtask-parent-title"
                onClick={() => onSelectItem?.(parentItem)}
                title="Abrir tarefa pai no painel"
              >
                {parentItem.title}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleUnlinkParent}
                title="Desvincular e tornar tarefa principal independente"
              >
                Desvincular
              </button>
            </div>
          )}

          {/* Lista de subtarefas pertencentes a este item */}
          {subtasks.length > 0 && (
            <div className="detail-subtasks-list">
              {subtasks.map((st) => (
                <div key={st.id} className="detail-subtask-row">
                  <input
                    type="checkbox"
                    className="item-checkbox"
                    checked={st.status === "done"}
                    onChange={() => handleToggleSubtask(st)}
                    title={st.status === "done" ? "Marcar como pendente" : "Marcar como concluída"}
                  />
                  <span
                    className={`detail-subtask-title ${st.status === "done" ? "done" : ""}`}
                    onClick={() => onSelectItem?.(st)}
                    title="Clique para abrir detalhes desta subtarefa"
                  >
                    {st.title}
                  </span>
                  <button
                    type="button"
                    className="btn-subtask-unlink"
                    onClick={() => handleUnlinkSubtask(st.id)}
                    title="Desvincular (tornar tarefa principal)"
                  >
                    Desvincular
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Adicionar nova subtarefa rapidamente */}
          {!parentId && (
            <form
              className="detail-add-subtask-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleAddSubtask();
              }}
            >
              <input
                type="text"
                className="detail-prop-input"
                style={{ flex: 1 }}
                placeholder="+ Adicionar subtarefa... (Enter)"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
              />
              {newSubtaskTitle.trim() && (
                <button type="submit" className="btn btn-primary btn-sm">
                  Adicionar
                </button>
              )}
            </form>
          )}

          {/* Seletor para transformar este item em subtarefa de outro item existente */}
          {!parentId && subtasks.length === 0 && candidateParents.length > 0 && (
            <div className="detail-nest-selector">
              <span className="detail-nest-label">
                Mover para dentro de outra tarefa:
              </span>
              <select
                className="detail-prop-select"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleLinkToParent(e.target.value);
                  }
                }}
              >
                <option value="">(Selecionar tarefa pai...)</option>
                {candidateParents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title.length > 36 ? p.title.substring(0, 33) + "..." : p.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Corpo / Anotações e Checklists */}
        <div className="detail-section" style={{ display: "flex", flexDirection: "column", position: "relative" }}>
          <label className="detail-label">Descrição & Anotações (@contexto, #tag)</label>
          <div style={{ position: "relative", display: "flex", flexDirection: "column" }}>
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
              placeholder="Adicione detalhes, checklists (@contexto, #tag) ou anotações..."
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

        {/* Anexos e Documentos com Upload, Paste e Lightbox */}
        <div className="detail-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <label className="detail-label" style={{ display: "flex", alignItems: "center", gap: "6px", margin: 0 }}>
              <PaperclipIcon size={12} />
              <span>Anexos e Documentos ({attachments.length})</span>
            </label>
            <label
              className="btn btn-secondary btn-sm"
              style={{
                cursor: "pointer",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                padding: "3px 8px",
              }}
            >
              <PaperclipIcon size={12} />
              <span>+ Anexar</span>
              <input
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={handleFileInput}
              />
            </label>
          </div>

          <div
            className={`attachment-dropzone ${isDragging ? "dragover" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDropFiles}
            style={{ minHeight: attachments.length === 0 ? "70px" : "auto", padding: "10px" }}
          >
            {attachments.length === 0 ? (
              <div className="attachment-hint">
                <div>Arraste arquivos aqui (PDF, Excel, imagens, etc.)</div>
                <div style={{ marginTop: "2px" }}>
                  ou cole prints com <span className="kbd-badge">Ctrl + V</span>
                </div>
              </div>
            ) : (
              <div className="attachment-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "8px" }}>
                {attachments.map((att) => {
                  const isImg = isImageAttachment(att);
                  const badge = getFileBadgeInfo(att.filename);
                  const sizeText = formatFileSize(att.data);

                  if (isImg) {
                    return (
                      <div key={att.id} className="attachment-card" style={{ height: "96px" }} title={att.filename || "Imagem"}>
                        <img
                          src={att.data}
                          alt={att.filename || "print"}
                          className="attachment-thumb"
                          style={{ height: "68px" }}
                          onClick={() => setLightboxImage(att.data)}
                        />
                        <div className="attachment-card-footer" style={{ height: "26px" }}>
                          <span className="attachment-card-size">{sizeText}</span>
                          <button
                            type="button"
                            className="attachment-download-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadAttachment(att);
                            }}
                            title="Baixar imagem"
                          >
                            <DownloadIcon size={11} />
                          </button>
                        </div>
                        <button
                          type="button"
                          className="attachment-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAttachment(att.id);
                          }}
                          title="Excluir anexo"
                        >
                          &times;
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={att.id}
                      className="attachment-file-card"
                      style={{ padding: "6px 8px", minHeight: "50px" }}
                      onClick={() => handleDownloadAttachment(att)}
                      title={`Clique para baixar/abrir: ${att.filename || "Arquivo"}`}
                    >
                      <div
                        className="file-badge-pill"
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          borderColor: badge.border,
                        }}
                      >
                        {badge.label}
                      </div>
                      <div className="file-card-info">
                        <span className="file-card-name" style={{ fontSize: "11px" }}>{att.filename || "Arquivo"}</span>
                        <span className="file-card-size" style={{ fontSize: "9.5px" }}>{sizeText}</span>
                      </div>
                      <button
                        type="button"
                        className="attachment-delete-btn inline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAttachment(att.id);
                        }}
                        title="Excluir anexo"
                      >
                        &times;
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rodapé do Painel com datas e botão de Salvar */}
      <div className="detail-pane-footer">
        <div className="detail-timestamps" style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {item.created_at && (
            <span>Criado: {new Date(item.created_at).toLocaleDateString("pt-BR")}</span>
          )}
          {item.updated_at && (
            <span>Atualizado: {new Date(item.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            className={`btn btn-sm ${savedSuccess ? "btn-secondary" : isDirty ? "btn-primary" : "btn-secondary"}`}
            onClick={handleSave}
            disabled={saving || (!isDirty && !savedSuccess)}
            title="Salvar alterações (Ctrl+Enter)"
            style={{ fontWeight: 600 }}
          >
            {saving
              ? "Salvando..."
              : savedSuccess
              ? "Salvo com sucesso!"
              : isDirty
              ? "Salvar Alterações (Ctrl+Enter)"
              : "Sem alterações pendentes"}
          </button>
        </div>
      </div>

      {/* Lightbox para visualização de imagem em tamanho real */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImage} alt="Anexo ampliado" className="lightbox-image" />
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={() => setLightboxImage(null)}
              title="Fechar (Esc)"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

export default DetailPane;
