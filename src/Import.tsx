import React, { useState } from "react";
import { parseNotepadText, importItems } from "./commands";
import type { ProposedItem } from "./types";

interface ImportProps {
  onImportComplete: () => void;
}

export const Import: React.FC<ImportProps> = ({ onImportComplete }) => {
  const [text, setText] = useState("");
  const [proposed, setProposed] = useState<ProposedItem[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setAnalyzing(true);
    setMessage(null);
    try {
      const items = await parseNotepadText(text);
      setProposed(items);
    } catch (err) {
      setMessage(`Erro ao processar texto: ${err}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleToggleSecretForce = (index: number) => {
    if (!proposed) return;
    const next = [...proposed];
    next[index].force_import = !next[index].force_import;
    setProposed(next);
  };

  const handleRemoveItem = (index: number) => {
    if (!proposed) return;
    const next = proposed.filter((_, i) => i !== index);
    setProposed(next);
  };

  const handleConfirmImport = async () => {
    if (!proposed || proposed.length === 0) return;
    setImporting(true);
    try {
      // Exclude secret items unless user explicitly opted to force import them
      const itemsToImport = proposed.filter((item) => !item.is_secret || item.force_import);
      await importItems(itemsToImport);
      setMessage(`${itemsToImport.length} itens importados com sucesso.`);
      setProposed(null);
      setText("");
      setTimeout(() => onImportComplete(), 800);
    } catch (err) {
      setMessage(`Erro ao gravar importação: ${err}`);
    } finally {
      setImporting(false);
    }
  };

  // Group proposed items by context for clean preview
  const grouped: Record<string, { item: ProposedItem; originalIndex: number }[]> = {};
  if (proposed) {
    proposed.forEach((item, index) => {
      const ctx = item.context || "Sem contexto (Inbox)";
      if (!grouped[ctx]) grouped[ctx] = [];
      grouped[ctx].push({ item, originalIndex: index });
    });
  }

  const validImportCount = proposed
    ? proposed.filter((i) => !i.is_secret || i.force_import).length
    : 0;

  return (
    <div className="page-body">
      {proposed === null ? (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Importar do Notepad</span>
          </div>

          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>
            Cole suas anotações corridas do Notepad abaixo. O analisador reconhece seções (##), follow-ups (##FUP), checkboxes ([x], [ ]), tickets (ex: CHG0012345), datas e cobranças.
          </p>

          <textarea
            className="capture-textarea"
            rows={14}
            placeholder={`Cole aqui suas anotações...\n\nExemplo:\n##EMPRESA\n- [ ] Ajustar cotas da nuvem\n- Cobrar resposta do Fulano (25/10)\n\n---\n##PROJETO X\n[x] Reunião concluída`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Nenhum dado é gravado até você revisar e confirmar na tela seguinte.
            </span>
            <button
              className="btn btn-primary"
              onClick={handleAnalyze}
              disabled={!text.trim() || analyzing}
            >
              {analyzing ? "Analisando..." : "Analisar Anotações"}
            </button>
          </div>

          {message && (
            <div style={{ marginTop: "12px", fontSize: "13px", color: "var(--accent)" }}>
              {message}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Action Header */}
          <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span className="card-title">Prévia da Importação</span>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginLeft: "12px" }}>
                {validImportCount} {validImportCount === 1 ? "item pronto para importar" : "itens prontos para importar"}
              </span>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                className="btn btn-secondary"
                onClick={() => setProposed(null)}
                disabled={importing}
              >
                Voltar e editar texto
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmImport}
                disabled={validImportCount === 0 || importing}
              >
                {importing ? "Importando..." : `Confirmar (${validImportCount})`}
              </button>
            </div>
          </div>

          {/* Grouped Preview */}
          {Object.entries(grouped).map(([contextName, items]) => (
            <div key={contextName} className="card">
              <div className="card-header">
                <span className="card-title">
                  {contextName.startsWith("@") ? contextName : `@${contextName}`}
                </span>
                <span className="card-count">{items.length}</span>
              </div>

              <div className="item-list">
                {items.map(({ item, originalIndex }) => (
                  <div
                    key={originalIndex}
                    className="item-row"
                    style={{
                      borderLeft: item.is_secret
                        ? "3px solid var(--danger)"
                        : undefined,
                    }}
                  >
                    <div className="item-main">
                      <div className="item-title-line">
                        <span className="item-title">{item.title}</span>

                        <span className="badge badge-today">
                          {item.status.toUpperCase()}
                        </span>

                        {item.ticket_ref && (
                          <span className="badge badge-ticket">
                            {item.ticket_ref}
                          </span>
                        )}

                        {item.waiting_on && (
                          <span className="badge badge-waiting">
                            ~{item.waiting_on}
                          </span>
                        )}

                        {(item.due_at || item.followup_at) && (
                          <span className="badge badge-today">
                            {(item.due_at || item.followup_at)?.substring(0, 10)}
                          </span>
                        )}

                        {item.url && (
                          <span className="badge badge-tag" title={item.url}>
                            URL
                          </span>
                        )}
                      </div>

                      {item.body && (
                        <div className="item-body">{item.body}</div>
                      )}

                      {/* Rule 11: Secret detection warning */}
                      {item.is_secret && (
                        <div
                          style={{
                            marginTop: "6px",
                            padding: "6px 8px",
                            background: "var(--danger-light)",
                            color: "var(--danger-text)",
                            borderRadius: "4px",
                            fontSize: "11px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span>Possível segredo detectado (senha/token).</span>
                          <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={item.force_import}
                              onChange={() => handleToggleSecretForce(originalIndex)}
                            />
                            Importar como nota comum sem sincronização
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="item-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleRemoveItem(originalIndex)}
                        title="Remover da importação"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Import;
