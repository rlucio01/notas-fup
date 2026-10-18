import React, { useEffect, useState, useRef } from "react";
import { searchItems, getContexts, updateItem } from "./commands";
import { EditModal } from "./EditModal";
import type { Item, Context } from "./types";

export const Search: React.FC = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [selectedContext, setSelectedContext] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedKind, setSelectedKind] = useState<string>("all");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    getContexts().then(setContexts);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchItems(trimmed);
        setResults(res);
      } catch (err) {
        console.error("Erro na busca FTS5:", err);
      } finally {
        setSearching(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  // Apply in-memory client filters over the FTS results
  const filteredResults = results.filter((item) => {
    if (selectedContext !== "all" && item.context_name !== selectedContext) {
      return false;
    }
    if (selectedStatus !== "all" && item.status !== selectedStatus) {
      return false;
    }
    if (selectedKind !== "all" && item.kind !== selectedKind) {
      return false;
    }
    return true;
  });

  const handleToggleDone = async (item: Item) => {
    const newStatus = item.status === "done" ? "open" : "done";
    await updateItem({ id: item.id, status: newStatus });
    // Re-run search
    if (query.trim()) {
      const res = await searchItems(query.trim());
      setResults(res);
    }
  };

  return (
    <div className="page-body">
      {/* Search Input Box with Ctrl+K indicator */}
      <div className="card" style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            ref={inputRef}
            type="text"
            className="capture-textarea"
            style={{ height: "42px", padding: "8px 14px", fontSize: "15px" }}
            placeholder="Buscar em todas as notas, tickets, follow-ups (Ctrl+K)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="kbd-badge" style={{ padding: "6px 10px", fontSize: "12px" }}>
            Ctrl+K
          </span>
        </div>

        {/* Filter controls */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginTop: "12px",
            flexWrap: "wrap",
            alignItems: "center",
            fontSize: "12px",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ color: "var(--text-secondary)" }}>Contexto:</span>
            <select
              value={selectedContext}
              onChange={(e) => setSelectedContext(e.target.value)}
              className="btn btn-secondary btn-sm"
            >
              <option value="all">Todos</option>
              {contexts.map((ctx) => (
                <option key={ctx.id} value={ctx.name}>
                  {ctx.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ color: "var(--text-secondary)" }}>Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="btn btn-secondary btn-sm"
            >
              <option value="all">Todos</option>
              <option value="inbox">Inbox</option>
              <option value="open">Abertos</option>
              <option value="waiting">Aguardando</option>
              <option value="done">Concluídos</option>
            </select>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ color: "var(--text-secondary)" }}>Tipo:</span>
            <select
              value={selectedKind}
              onChange={(e) => setSelectedKind(e.target.value)}
              className="btn btn-secondary btn-sm"
            >
              <option value="all">Todos</option>
              <option value="task">Tarefa</option>
              <option value="ticket">Ticket</option>
              <option value="link">Link</option>
              <option value="note">Nota</option>
            </select>
          </label>

          {query && (
            <span style={{ marginLeft: "auto", color: "var(--text-muted)" }}>
              {searching
                ? "Buscando..."
                : `${filteredResults.length} ${
                    filteredResults.length === 1 ? "resultado" : "resultados"
                  }`}
            </span>
          )}
        </div>
      </div>

      {/* Results List */}
      {!query.trim() ? (
        <div className="empty-state">
          Digite qualquer termo, ticket (ex: CHG0012345), nome de pessoa ou palavra-chave para buscar.
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="empty-state">
          Nenhum resultado encontrado para &quot;{query}&quot;.
        </div>
      ) : (
        <div className="item-list">
          {filteredResults.map((item) => {
            const isDone = item.status === "done";
            return (
              <div key={item.id} className="item-row">
                <input
                  type="checkbox"
                  className="item-checkbox"
                  checked={isDone}
                  onChange={() => handleToggleDone(item)}
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

                    {item.context_name && (
                      <span className="badge badge-context">
                        @{item.context_name}
                      </span>
                    )}

                    {item.ticket_ref && (
                      <span className="badge badge-ticket">{item.ticket_ref}</span>
                    )}

                    {item.waiting_on && (
                      <span className="badge badge-waiting">~{item.waiting_on}</span>
                    )}

                    <span className="badge badge-today">
                      {item.status.toUpperCase()}
                    </span>

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
                        title={`${item.attachment_count} print(s) anexado(s)`}
                      >
                        Print ({item.attachment_count})
                      </span>
                    )}
                  </div>

                  {item.body && <div className="item-body">{item.body}</div>}
                </div>

                <div className="item-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setEditingItem(item)}
                    title="Editar e Reclassificar"
                  >
                    Editar
                  </button>

                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      Link
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingItem && (
        <EditModal
          item={editingItem}
          contexts={contexts}
          onClose={() => setEditingItem(null)}
          onSaved={async () => {
            if (query.trim()) {
              const res = await searchItems(query.trim());
              setResults(res);
            }
          }}
        />
      )}
    </div>
  );
};

export default Search;
