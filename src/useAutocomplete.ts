import React, { useState, useCallback, useMemo } from "react";
import type { Context } from "./types";
import type { AutocompleteItem } from "./AutocompleteDropdown";

export function useAutocomplete(
  text: string,
  setText: (val: string) => void,
  inputRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>,
  contexts: Context[],
  tags: string[]
) {
  const [isOpen, setIsOpen] = useState(false);
  const [trigger, setTrigger] = useState<"@" | "#" | null>(null);
  const [query, setQuery] = useState("");
  const [tokenStart, setTokenStart] = useState(0);
  const [tokenEnd, setTokenEnd] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Check if cursor is right after an @... or #...
  const checkTrigger = useCallback((currentText: string, cursor: number) => {
    const textBeforeCursor = currentText.slice(0, cursor);
    const match = textBeforeCursor.match(/([@#])([a-zA-Z0-9_\-áàâãéèêíïóôõöúçñ]*)$/i);
    if (match && match.index !== undefined) {
      const trig = match[1] as "@" | "#";
      const q = match[2];
      setTrigger(trig);
      setQuery(q);
      setTokenStart(match.index);
      setTokenEnd(cursor);
      setIsOpen(true);
      setSelectedIndex(0);
    } else {
      setIsOpen(false);
      setTrigger(null);
      setQuery("");
    }
  }, []);

  // Filter items based on trigger and query
  const items: AutocompleteItem[] = useMemo(() => {
    if (!isOpen || !trigger) return [];
    const q = query.toLowerCase();
    if (trigger === "@") {
      return contexts
        .filter((c) => c.name.toLowerCase().includes(q))
        .map((c) => ({
          id: c.id,
          name: c.name,
          type: "context" as const,
          color: c.color,
        }));
    } else {
      return tags
        .filter((t) => t.toLowerCase().includes(q))
        .map((t) => ({
          id: t,
          name: t,
          type: "tag" as const,
        }));
    }
  }, [isOpen, trigger, query, contexts, tags]);

  const handleSelect = useCallback(
    (item: AutocompleteItem) => {
      const before = text.slice(0, tokenStart);
      const after = text.slice(tokenEnd);
      const prefix = item.type === "context" ? "@" : "#";
      const replacement = `${prefix}${item.name} `;
      const newText = before + replacement + after;
      const newCursor = (before + replacement).length;

      setText(newText);
      setIsOpen(false);
      setTrigger(null);

      // Restore focus and move cursor
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newCursor, newCursor);
        }
      }, 10);
    },
    [text, tokenStart, tokenEnd, setText, inputRef]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!isOpen || items.length === 0) return false;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((idx) => (idx + 1) % items.length);
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((idx) => (idx - 1 + items.length) % items.length);
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (items[selectedIndex]) {
          e.preventDefault();
          handleSelect(items[selectedIndex]);
          return true;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        return true;
      }
      return false;
    },
    [isOpen, items, selectedIndex, handleSelect]
  );

  return {
    isOpen: isOpen && items.length > 0,
    trigger,
    query,
    items,
    selectedIndex,
    checkTrigger,
    handleKeyDown,
    handleSelect,
    close: () => setIsOpen(false),
  };
}

export default useAutocomplete;
