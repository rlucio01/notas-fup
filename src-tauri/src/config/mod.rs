use serde::{Deserialize, Serialize};

/// Application configuration, persisted as JSON in the app data directory.
#[derive(Debug, Clone, Serialize, Deserialize)]
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
