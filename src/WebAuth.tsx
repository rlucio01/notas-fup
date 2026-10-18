import React, { useState } from "react";
import { getCloudConfig, saveCloudConfig, DEFAULT_CLOUD_URL } from "./cloud-sync";

interface WebAuthProps {
  onAuthenticated: () => void;
}

export const WebAuth: React.FC<WebAuthProps> = ({ onAuthenticated }) => {
  const [secret, setSecret] = useState("");
  const [apiUrl, setApiUrl] = useState(DEFAULT_CLOUD_URL);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanUrl = apiUrl.replace(/\/+$/, "");

    try {
      const res = await fetch(`${cleanUrl}/api/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        const config = getCloudConfig();
        config.enabled = true;
        config.url = cleanUrl;
        config.secret = secret;
        saveCloudConfig(config);
        onAuthenticated();
      } else {
        setError(data.error || "Senha incorreta. Tente novamente.");
      }
    } catch (err: any) {
      setError("Não foi possível conectar ao servidor Cloudflare. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg-main)",
        padding: "20px",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "380px",
          padding: "28px",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
          border: "1px solid var(--border-color)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <img
            src="/favicon.png"
            width="52"
            height="52"
            alt="Notas FUP"
            style={{
              borderRadius: "12px",
              display: "block",
              margin: "0 auto 12px",
              boxShadow: "0 4px 16px rgba(6, 182, 212, 0.3)",
            }}
          />
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 6px" }}>
            Notas FUP
          </h2>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
            Digite a senha de acesso para desbloquear suas demandas no celular
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginBottom: "6px",
              }}
            >
              Senha de Acesso
            </label>
            <input
              type="password"
              className="capture-textarea"
              style={{ height: "40px", width: "100%", padding: "8px 12px", fontSize: "14px" }}
              placeholder="Digite a senha..."
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoFocus
              required
            />
          </div>

          {showConfig && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  marginBottom: "4px",
                }}
              >
                URL da API Cloudflare
              </label>
              <input
                type="text"
                className="capture-textarea"
                style={{ height: "34px", width: "100%", padding: "6px 10px", fontSize: "11px" }}
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "8px 12px",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid var(--danger)",
                borderRadius: "6px",
                color: "var(--danger)",
                fontSize: "12px",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", height: "40px", justifyContent: "center", fontSize: "14px", fontWeight: 600 }}
            disabled={loading || !secret.trim()}
          >
            {loading ? "Verificando..." : "Entrar"}
          </button>

          <button
            type="button"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              fontSize: "11px",
              cursor: "pointer",
              textAlign: "center",
              padding: "4px",
            }}
            onClick={() => setShowConfig(!showConfig)}
          >
            {showConfig ? "Ocultar configurações" : "Configurações de servidor"}
          </button>
        </form>
      </div>
    </div>
  );
};
