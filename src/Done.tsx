import React, { useEffect, useState } from "react";
import { getDoneItems, updateItem } from "./commands";
import type { Item } from "./types";

export const Done: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const data = await getDoneItems();
      setItems(data);
    } catch (e) {
      console.error("Erro ao carregar concluídos:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReopen = async (item: Item) => {
    await updateItem({ id: item.id, status: "open" });
    loadData();
  };

  const filteredItems = items.filter((item) => {
    if (!filter.trim()) return true;
    const term = filter.toLowerCase();
    return (
      item.title.toLowerCase().includes(term) ||
      (item.body && item.body.toLowerCase().includes(term)) ||
      (item.ticket_ref && item.ticket_ref.toLowerCase().includes(term))
    );
  });

  if (loading) {
    return (
      <div className="page-body">
        <div className="empty-state">Carregando arquivo de concluídos...</div>
      </div>
    );
  }

  return (
    <div className="page-body">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Arquivo de Concluídos</span>
          <span className="card-count">{items.length}</span>
        </div>

        <input
          type="text"
          className="capture-textarea"
          style={{ height: "38px", marginBottom: "8px" }}
          placeholder="Filtrar por texto, ticket ou tag..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {filteredItems.length === 0 ? (
        <div className="empty-state">
          Nenhum item concluído encontrado.
        </div>
      ) : (
        <div className="item-list">
          {filteredItems.map((item) => (
            <div key={item.id} className="item-row">
              <input
                type="checkbox"
                className="item-checkbox"
                checked={true}
                onChange={() => handleReopen(item)}
                title="Desmarcar para reabrir"
              />

              <div className="item-main">
                <div className="item-title-line">
                  <span className="item-title done">{item.title}</span>

                  {item.context_name && (
                    <span className="badge badge-context">
                      @{item.context_name}
                    </span>
                  )}

                  {item.ticket_ref && (
                    <span className="badge badge-ticket">
                      {item.ticket_ref}
                    </span>
                  )}

                  {item.done_at && (
                    <span className="badge badge-today">
                      Concluído em: {item.done_at.substring(0, 10)}
                    </span>
                  )}
                </div>

                {item.body && <div className="item-body">{item.body}</div>}
              </div>

              <div className="item-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleReopen(item)}
                >
                  Reabrir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Done;
