import React, { useEffect, useState, useRef } from "react";
import { parseQuickCapture } from "./capture-syntax";
import { saveCapture, closeCaptureWindow, getActiveApp, getContexts, getTags } from "./commands";
import { useAutocomplete } from "./useAutocomplete";
import { AutocompleteDropdown } from "./AutocompleteDropdown";
import type { Context } from "./types";
import "./Capture.css";

export const Capture: React.FC = () => {
  const [text, setText] = useState("");
  const [originApp, setOriginApp] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Sync theme with main app preferences
    const savedTheme = localStorage.getItem("notas_fup_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);

    // Focus textarea immediately on mount
    textareaRef.current?.focus();

    // Detect active application title before capture window opened
    getActiveApp().then((app) => {
      if (app) setOriginApp(app);
    });

    // Load available contexts and tags for autocomplete
    getContexts().then(setContexts).catch(console.error);
    getTags().then(setTags).catch(console.error);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeCaptureWindow();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const autocomplete = useAutocomplete(text, setText, textareaRef, contexts, tags);
  const parsed = parseQuickCapture(text);

  const handleSubmit = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveCapture(text, originApp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (autocomplete.isOpen) {
      const handled = autocomplete.handleKeyDown(e);
      if (handled) return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="capture-container">
      <div className="capture-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, overflow: "hidden" }}>
          <span>Captura Rápida</span>
          {originApp && (
            <span className="origin-badge" title={originApp}>
              {originApp}
            </span>
          )}
        </div>
        <button
          type="button"
          className="capture-close-btn"
          onClick={() => closeCaptureWindow()}
          title="Fechar (Esc)"
        >
          &times;
        </button>
      </div>

      <div style={{ position: "relative", width: "100%" }}>
        <textarea
          ref={textareaRef}
          className="capture-textarea"
          placeholder="O que precisa ser feito? @contexto #tag !data ~pessoa"
          value={text}
          onChange={(e) => {
            const val = e.target.value;
            setText(val);
            autocomplete.checkTrigger(val, e.target.selectionStart || val.length);
          }}
          onKeyUp={(e) => {
            autocomplete.checkTrigger(text, e.currentTarget.selectionStart || text.length);
          }}
          onClick={(e) => {
            autocomplete.checkTrigger(text, e.currentTarget.selectionStart || text.length);
          }}
          onKeyDown={handleKeyDown}
          disabled={saving}
          rows={2}
        />

        {autocomplete.isOpen && (
          <AutocompleteDropdown
            items={autocomplete.items}
            selectedIndex={autocomplete.selectedIndex}
            onSelect={autocomplete.handleSelect}
            title={autocomplete.trigger === "@" ? "Contextos (@)" : "Tags (#)"}
            style={{ top: "100%", left: 0, width: "100%", marginTop: "4px" }}
          />
        )}
      </div>

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
