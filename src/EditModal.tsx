import React, { useState, useEffect } from "react";
import { updateItem, createContext, getItemAttachments, addAttachment, deleteAttachment } from "./commands";
import { PencilIcon, PaperclipIcon, DownloadIcon } from "./Icons";
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
      return { label: ext.slice(0, 4), bg: "rgba(99, 102, 241, 0.15)", color: "#818cf8", border: "rgba(99, 102, 241, 0.3)" };
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load existing attachments on mount
  useEffect(() => {
    getItemAttachments(item.id)
      .then(setAttachments)
      .catch((err) => console.error("Erro ao carregar anexos:", err));
  }, [item.id]);

  const processFiles = (files: FileList | File[]) => {
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
          } catch (err) {
            console.error("Erro ao salvar anexo:", err);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Listen for paste (Ctrl+V) anywhere in modal for images/prints or files
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
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
  }, [item.id]);

  // Close on Escape, save on Ctrl+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightboxImage) {
          setLightboxImage(null);
        } else {
          onClose();
        }
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [title, body, contextId, tags, status, waitingOn, dueAt, followupAt, ticketRef, url, newContextName, isCreatingContext, lightboxImage]);

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
    try {
      await deleteAttachment(attId, item.id);
      setAttachments((prev) => prev.filter((a) => a.id !== attId));
    } catch (err) {
      console.error("Erro ao excluir anexo:", err);
    }
  };

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
          <span className="modal-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <PencilIcon size={16} />
            <span>Editar e Reclassificar Nota</span>
          </span>
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

          {/* Anexos e Documentos */}
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <PaperclipIcon size={12} />
                Anexos e Documentos ({attachments.length})
              </label>
              <label
                className="btn btn-secondary btn-sm"
                style={{ cursor: "pointer", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}
              >
                <PaperclipIcon size={12} />
                <span>+ Anexar Arquivo</span>
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
            >
              {attachments.length === 0 ? (
                <div className="attachment-hint">
                  <div>Arraste qualquer arquivo aqui (PDF, Word, Excel, PowerPoint, imagens, etc.)</div>
                  <div style={{ marginTop: "4px" }}>
                    ou cole prints com <span className="kbd-badge">Ctrl + V</span>, ou use o botão <strong>+ Anexar Arquivo</strong>.
                  </div>
                </div>
              ) : (
                <div className="attachment-grid">
                  {attachments.map((att) => {
                    const isImg = isImageAttachment(att);
                    const badge = getFileBadgeInfo(att.filename);
                    const sizeText = formatFileSize(att.data);

                    if (isImg) {
                      return (
                        <div key={att.id} className="attachment-card" title={att.filename || "Imagem"}>
                          <img
                            src={att.data}
                            alt={att.filename || "print"}
                            className="attachment-thumb"
                            onClick={() => setLightboxImage(att.data)}
                          />
                          <div className="attachment-card-footer">
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
                          <span className="file-card-name">{att.filename || "documento"}</span>
                          <span className="file-card-size">{sizeText}</span>
                        </div>
                        <div className="file-card-actions">
                          <button
                            type="button"
                            className="attachment-download-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadAttachment(att);
                            }}
                            title="Baixar / Abrir arquivo"
                          >
                            <DownloadIcon size={12} />
                          </button>
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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

      {/* Lightbox / Zoom do Print */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImage} alt="Print ampliado" className="lightbox-image" />
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
    </div>
  );
};

export default EditModal;
