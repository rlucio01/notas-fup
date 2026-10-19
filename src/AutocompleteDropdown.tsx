import React from "react";

export interface AutocompleteItem {
  id: string;
  name: string;
  type: "context" | "tag";
  color?: string | null;
}

interface AutocompleteDropdownProps {
  items: AutocompleteItem[];
  selectedIndex: number;
  onSelect: (item: AutocompleteItem) => void;
  title?: string;
  style?: React.CSSProperties;
}

export const AutocompleteDropdown: React.FC<AutocompleteDropdownProps> = ({
  items,
  selectedIndex,
  onSelect,
  title,
  style,
}) => {
  if (items.length === 0) return null;

  return (
    <div className="autocomplete-dropdown" style={style}>
      {title && <div className="autocomplete-header">{title}</div>}
      <div className="autocomplete-list">
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={`${item.type}-${item.name}`}
              type="button"
              className={`autocomplete-item ${isSelected ? "selected" : ""}`}
              onMouseDown={(e) => {
                // onMouseDown prevents losing focus from textarea before selection
                e.preventDefault();
                onSelect(item);
              }}
            >
              <div className="autocomplete-item-left">
                {item.type === "context" && (
                  <span
                    className="autocomplete-color-dot"
                    style={{ backgroundColor: item.color || "var(--accent)" }}
                  />
                )}
                <span className="autocomplete-item-prefix">
                  {item.type === "context" ? "@" : "#"}
                </span>
                <span className="autocomplete-item-name">{item.name}</span>
              </div>
              {isSelected && <span className="autocomplete-item-hint">Enter</span>}
            </button>
          );
        })}
      </div>
      <div className="autocomplete-footer">
        <span>↑↓ navegar</span>
        <span>Enter / Tab selecionar</span>
        <span>Esc fechar</span>
      </div>
    </div>
  );
};

export default AutocompleteDropdown;
