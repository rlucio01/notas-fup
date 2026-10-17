import React, { useEffect, useState, useRef } from "react";
import { parseQuickCapture } from "./capture-syntax";
import { saveCapture, closeCaptureWindow, getActiveApp } from "./commands";
import "./Capture.css";

export const Capture: React.FC = () => {
  const [text, setText] = useState("");
  const [originApp, setOriginApp] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Focus textarea immediately on mount
    textareaRef.current?.focus();

    // Detect active application title before capture window opened
    getActiveApp().then((app) => {
      if (app) setOriginApp(app);
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeCaptureWindow();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const parsed = parseQuickCapture(text);

  const handleSubmit = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveCapture(text, originApp);
      // Window is closed by backend after save
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="capture-container">
      <div className="capture-header">
        <span>Captura Rápida</span>
        {originApp && (
          <span className="origin-badge" title={originApp}>
            {originApp}
          </span>
        )}
      </div>

      <textarea
        ref={textareaRef}
        className="capture-textarea"
        placeholder="O que precisa ser feito? @contexto #tag !data ~pessoa"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={saving}
        rows={2}
      />

      <div className="capture-chips">
        {parsed.context && (
          <span className="chip chip-context">
            @{parsed.context}
          </span>
        )}
        {parsed.tags.map((tag) => (
          <span key={tag} className="chip chip-tag">
            #{tag}
          </span>
        ))}
        {parsed.followup_at && (
          <span className="chip chip-date">
            !{parsed.followup_at}
          </span>
        )}
        {parsed.waiting_on && (
          <span className="chip chip-waiting">
            ~{parsed.waiting_on}
          </span>
        )}
        {parsed.ticket_ref && (
          <span className="chip chip-ticket">
            {parsed.ticket_ref}
          </span>
        )}
        {parsed.url && (
          <span className="chip chip-url">
            {parsed.url}
          </span>
        )}
      </div>

      <div className="capture-footer">
        <div className="capture-hints">
          <span><span className="kbd">Enter</span> salvar</span>
          <span><span className="kbd">Shift+Enter</span> nova linha</span>
          <span><span className="kbd">Esc</span> cancelar</span>
        </div>
        {error && <span style={{ color: "var(--danger-text)" }}>{error}</span>}
      </div>
    </div>
  );
};

export default Capture;
