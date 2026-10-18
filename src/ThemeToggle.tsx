import React from "react";
import { SunIcon, MoonIcon } from "./Icons";

interface ThemeToggleProps {
  theme: "dark" | "light";
  onToggle: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onToggle }) => {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={`theme-toggle-btn ${isDark ? "dark" : "light"}`}
      onClick={onToggle}
      title={isDark ? "Alternar para tema Claro" : "Alternar para tema Escuro"}
      aria-label="Alternar tema de cores"
    >
      <div className="theme-toggle-track">
        <div className="theme-toggle-thumb">
          <div className="theme-icon-wrapper sun-wrapper">
            <SunIcon size={14} />
          </div>
          <div className="theme-icon-wrapper moon-wrapper">
            <MoonIcon size={14} />
          </div>
        </div>
      </div>
      <span className="theme-toggle-label">{isDark ? "Escuro" : "Claro"}</span>
    </button>
  );
};

export default ThemeToggle;
