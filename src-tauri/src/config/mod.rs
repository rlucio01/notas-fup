use std::path::Path;
use anyhow::Result;
use serde::{Deserialize, Serialize};

/// Application configuration, persisted as JSON in the app data directory.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AppConfig {
    /// Global shortcut for quick capture (default: "Ctrl+Alt+N")
    #[serde(default = "default_capture_shortcut")]
    pub capture_shortcut: String,

    /// Start the app when the system boots
    #[serde(default)]
    pub start_with_system: bool,

    /// Start minimized to tray (no window on boot)
    #[serde(default = "default_true")]
    pub start_minimized: bool,

    /// Days without activity before showing "stale" warning in Review
    #[serde(default = "default_stale_days")]
    pub stale_days: i64,
}

fn default_capture_shortcut() -> String {
    "Ctrl+Alt+N".to_string()
}

fn default_true() -> bool {
    true
}

fn default_stale_days() -> i64 {
    5
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            capture_shortcut: default_capture_shortcut(),
            start_with_system: false,
            start_minimized: true,
            stale_days: default_stale_days(),
        }
    }
}

impl AppConfig {
    /// Load config from file, or return default if missing or invalid.
    pub fn load(path: &Path) -> Self {
        if let Ok(data) = std::fs::read_to_string(path) {
            if let Ok(cfg) = serde_json::from_str(&data) {
                return cfg;
            }
        }
        Self::default()
    }

    /// Save config as formatted JSON.
    pub fn save(&self, path: &Path) -> Result<()> {
        let json = serde_json::to_string_pretty(self)?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, json)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_default_and_serialization() {
        let cfg = AppConfig::default();
        assert_eq!(cfg.capture_shortcut, "Ctrl+Alt+N");
        assert_eq!(cfg.stale_days, 5);
        assert!(cfg.start_minimized);
        assert!(!cfg.start_with_system);

        let json = serde_json::to_string(&cfg).unwrap();
        let deserialized: AppConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(cfg, deserialized);
    }

    #[test]
    fn test_config_load_and_save() {
        let temp_dir = std::env::temp_dir().join("notas_fup_test_cfg");
        let cfg_path = temp_dir.join("config.json");

        let cfg = AppConfig {
            capture_shortcut: "Ctrl+Shift+Space".to_string(),
            stale_days: 10,
            ..Default::default()
        };
        cfg.save(&cfg_path).unwrap();

        let loaded = AppConfig::load(&cfg_path);
        assert_eq!(loaded.capture_shortcut, "Ctrl+Shift+Space");
        assert_eq!(loaded.stale_days, 10);

        let _ = std::fs::remove_dir_all(temp_dir);
    }
}
