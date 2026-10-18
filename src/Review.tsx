import React, { useEffect, useState } from "react";
import { getReviewItems, updateItem } from "./commands";
import type { ReviewData, Item } from "./types";

export const Review: React.FC = () => {
  const [data, setData] = useState<ReviewData>({
    today_entered: [],
    due_today: [],
    stale: [],
  });
  const [loading, setLoading] = useState(true);
  const [staleDays] = useState(5);

  const loadData = async () => {
    try {
      const res = await getReviewItems(staleDays);
      setData(res);
    } catch (e) {
      console.error("Erro ao carregar revisão do dia:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [staleDays]);

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

  const renderItemRow = (item: Item) => {
    const isDone = item.status === "done";
    return (
      <div key={item.id} className="item-row">
        <input
          type="checkbox"
          className="item-checkbox"
          checked={isDone}
          onChange={() => handleToggleDone(item)}
        />
        <div className="item-main">
          <div className="item-title-line">
            <span className={`item-title ${isDone ? "done" : ""}`}>
              {item.title}
            </span>
            {item.context_name && (
              <span className="badge badge-context">@{item.context_name}</span>
            )}
            {item.ticket_ref && (
              <span className="badge badge-ticket">{item.ticket_ref}</span>
            )}
            {item.waiting_on && (
              <span className="badge badge-waiting">~{item.waiting_on}</span>
            )}
          </div>
          {item.body && <div className="item-body">{item.body}</div>}
        </div>
        <div className="item-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handlePostponeTomorrow(item)}
          >
            +1 dia
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="page-body">
        <div className="empty-state">Carregando revisão diária...</div>
      </div>
    );
  }

  return (
    <div className="page-body">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Revisão do Dia</span>
          <button className="btn btn-secondary btn-sm" onClick={loadData}>
            Atualizar
          </button>
        </div>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
          Feche seu expediente revisando o que foi capturado hoje, o que venceu e itens parados há mais de {staleDays} dias sem movimentação.
        </p>
      </div>

      {/* Itens que entraram hoje */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Entrou Hoje no Inbox</span>
          <span className="card-count">{data.today_entered.length}</span>
        </div>
        {data.today_entered.length === 0 ? (
          <div className="empty-state">Nenhum item novo entrou hoje.</div>
        ) : (
          <div className="item-list">
            {data.today_entered.map(renderItemRow)}
          </div>
        )}
      </div>

      {/* Itens com prazo hoje */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Com Prazo ou Follow-up Hoje</span>
          <span className="card-count">{data.due_today.length}</span>
        </div>
        {data.due_today.length === 0 ? (
          <div className="empty-state">Nenhum item com prazo hoje.</div>
        ) : (
          <div className="item-list">
            {data.due_today.map(renderItemRow)}
          </div>
        )}
      </div>

      {/* Itens sem movimento */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Sem Movimento há mais de {staleDays} dias</span>
          <span className="card-count">{data.stale.length}</span>
        </div>
        {data.stale.length === 0 ? (
          <div className="empty-state">Nenhum item parado ou esquecido. Excelente!</div>
        ) : (
          <div className="item-list">
            {data.stale.map(renderItemRow)}
          </div>
        )}
      </div>
    </div>
  );
};

export default Review;
