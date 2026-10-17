use serde::{Deserialize, Serialize};

/// A proposed item from the parser, not yet saved to the database.
/// The user reviews these in the import preview before confirming.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposedItem {
    pub title: String,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub context: Option<String>,
    #[serde(default = "default_kind")]
    pub kind: String,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default)]
    pub waiting_on: Option<String>,
    #[serde(default)]
    pub followup_at: Option<String>,
    #[serde(default)]
    pub due_at: Option<String>,
    #[serde(default)]
    pub ticket_ref: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    /// If true, this item contains a possible secret and should NOT be
    /// imported by default. The user can override.
    #[serde(default)]
    pub is_secret: bool,
    /// User override to force-import a secret item.
    #[serde(default)]
    pub force_import: bool,
}

fn default_kind() -> String {
    "note".to_string()
}
fn default_status() -> String {
    "inbox".to_string()
}

/// Parse text from the Notepad into a list of proposed items.
/// Full implementation in Etapa 2.
pub fn parse(_text: &str) -> Vec<ProposedItem> {
    // Stub: will be fully implemented in Etapa 2
    vec![]
}
