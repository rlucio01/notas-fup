use chrono::{Datelike, Utc};
use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};

#[cfg(test)]
pub mod tests;

/// A proposed item from the parser, not yet saved to the database.
/// The user reviews these in the import preview before confirming.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
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

// ── Compiled Regular Expressions ─────────────────────────────────────

static RE_HEADER: Lazy<Regex> = Lazy::new(|| Regex::new(r"^\s*##\s*(.+)$").unwrap());
static RE_SEPARATOR: Lazy<Regex> = Lazy::new(|| Regex::new(r"^\s*-{2,}\s*$").unwrap());
static RE_CHECKBOX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^\s*(?:-\s*)?\[([xX\s]*)\]\s*(.*)$").unwrap());
static RE_DASH_ITEM: Lazy<Regex> = Lazy::new(|| Regex::new(r"^\s*-\s+(.*)$").unwrap());
static RE_URL: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^\s*(https?://[^\s]+)\s*$").unwrap());
static RE_TICKET: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\b([A-Z]{2,6}\d{5,})\b").unwrap());
static RE_SECRET: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(senha|password|token)\b\s*[:=]\s*\S+").unwrap()
});

// Dates: dd/mm/aaaa hh:mm:ss, dd/mm/aaaa, dd/mm
static RE_DATE_TIME: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\b").unwrap()
});
static RE_DATE_FULL: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b").unwrap()
});
static RE_DATE_SHORT: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?:\(|\b)(\d{1,2})/(\d{1,2})(?:\)|\b)").unwrap()
});

// Waiting patterns
static RE_WAITING_PAREN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\([Ee]sperar\s+([^)]+)\)").unwrap()
});
static RE_WAITING_VERB: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b[Ee]sperar\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)\b").unwrap()
});
static RE_COBRAR_EMAIL: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b[Cc]obrar\s+(?:resposta\s+)?(?:de\s+email\s+)?(?:do|da|de)\s+([A-ZÀ-Ú][a-zà-ú]+)\s+para\b").unwrap()
});
static RE_COBRAR_GENERAL: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b[Cc]obrar\s+resposta\s+(?:do|da|de)\s+([^()\n-]+?)(?:\s*\(\d|\s*-\s*|$)").unwrap()
});
static RE_VAI_PASSAR: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b([A-ZÀ-Ú][a-zà-ú]+)\s+vai\s+me\s+passar\b").unwrap()
});

// ── Helper Functions ──────────────────────────────────────────────────

/// Normalize context string:
/// - "EMPRESA" -> "Empresa"
/// - "RDSL" (<= 4 chars acronym) -> "RDSL"
/// - "Projeto X" -> "Projeto X"
pub fn normalize_context(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let is_all_uppercase = trimmed
        .chars()
        .filter(|c| c.is_alphabetic())
        .all(|c| c.is_uppercase());

    if is_all_uppercase {
        if trimmed.chars().count() <= 4 {
            // Keep acronyms like RDSL, POC, BI, FUP
            trimmed.to_string()
        } else {
            // Title case words, e.g. "EMPRESA" -> "Empresa"
            trimmed
                .split_whitespace()
                .map(|word| {
                    let mut chars = word.chars();
                    match chars.next() {
                        None => String::new(),
                        Some(first) => {
                            let rest: String = chars.as_str().to_lowercase();
                            format!("{}{}", first.to_uppercase(), rest)
                        }
                    }
                })
                .collect::<Vec<_>>()
                .join(" ")
        }
    } else {
        trimmed.to_string()
    }
}

/// Detect ticket ID matching [A-Z]{2,6}\d{5,}
pub fn detect_ticket(text: &str) -> Option<String> {
    RE_TICKET
        .captures(text)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
}

/// Detect dates in Brazilian format:
/// 1) dd/mm/aaaa hh:mm:ss -> YYYY-MM-DDTHH:MM:SS
/// 2) dd/mm/aaaa -> YYYY-MM-DD
/// 3) dd/mm -> YYYY-MM-DD (current year)
pub fn detect_date(text: &str) -> Option<String> {
    if let Some(caps) = RE_DATE_TIME.captures(text) {
        let d: u32 = caps[1].parse().ok()?;
        let m: u32 = caps[2].parse().ok()?;
        let y: i32 = caps[3].parse().ok()?;
        let hh: u32 = caps[4].parse().ok()?;
        let mm: u32 = caps[5].parse().ok()?;
        let ss: u32 = caps[6].parse().ok()?;
        return Some(format!(
            "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}",
            y, m, d, hh, mm, ss
        ));
    }

    if let Some(caps) = RE_DATE_FULL.captures(text) {
        let d: u32 = caps[1].parse().ok()?;
        let m: u32 = caps[2].parse().ok()?;
        let y: i32 = caps[3].parse().ok()?;
        return Some(format!("{:04}-{:02}-{:02}", y, m, d));
    }

    if let Some(caps) = RE_DATE_SHORT.captures(text) {
        let d: u32 = caps[1].parse().ok()?;
        let m: u32 = caps[2].parse().ok()?;
        if (1..=31).contains(&d) && (1..=12).contains(&m) {
            let y = Utc::now().year();
            return Some(format!("{:04}-{:02}-{:02}", y, m, d));
        }
    }

    None
}

/// Detect "aguardando alguém" pattern:
/// - (Esperar Beltrano) / Esperar Beltrano
/// - Cobrar resposta de email do Fulano para Beltrano -> Fulano
/// - Cobrar resposta do time de contratos da POC -> time de contratos da POC
/// - Pedro vai me passar -> Pedro
pub fn detect_waiting_on(text: &str) -> Option<String> {
    if let Some(caps) = RE_WAITING_PAREN.captures(text) {
        let name = caps[1].trim();
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }

    if let Some(caps) = RE_WAITING_VERB.captures(text) {
        let name = caps[1].trim();
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }

    if let Some(caps) = RE_COBRAR_EMAIL.captures(text) {
        let name = caps[1].trim();
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }

    if let Some(caps) = RE_COBRAR_GENERAL.captures(text) {
        let name = caps[1].trim();
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }

    if let Some(caps) = RE_VAI_PASSAR.captures(text) {
        let name = caps[1].trim();
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }

    None
}

/// Detect if text contains a potential secret
pub fn detect_secret(text: &str) -> bool {
    RE_SECRET.is_match(text)
}

/// Parse text from Notepad into a list of proposed items.
/// Fully implements the 12 import rules.
pub fn parse(text: &str) -> Vec<ProposedItem> {
    let mut items: Vec<ProposedItem> = Vec::new();
    let mut current_context: Option<String> = None;
    let mut is_fup_context = false;

    // We process input in blocks delimited by separators `---`
    // or line-by-line where items are recognized.
    let lines: Vec<&str> = text.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i];
        let trimmed = line.trim();

        // Rule 3: Separators delimit blocks and reset context if no new header follows
        if RE_SEPARATOR.is_match(trimmed) {
            current_context = None;
            is_fup_context = false;
            i += 1;
            continue;
        }

        // Rule 3: Ignore empty lines
        if trimmed.is_empty() {
            i += 1;
            continue;
        }

        // Rule 1 & 2: Header lines starting with `##`
        if let Some(caps) = RE_HEADER.captures(trimmed) {
            let header_raw = caps[1].trim();
            if header_raw.to_uppercase().starts_with("FUP") {
                is_fup_context = true;
                let ctx_part = header_raw[3..].trim();
                current_context = if ctx_part.is_empty() {
                    None
                } else {
                    Some(normalize_context(ctx_part))
                };
            } else {
                is_fup_context = false;
                current_context = Some(normalize_context(header_raw));
            }
            i += 1;
            continue;
        }

        // Rule 7: Isolated URL below previous item
        if let Some(url_caps) = RE_URL.captures(trimmed) {
            let url = url_caps[1].to_string();
            if let Some(last) = items.last_mut() {
                if last.url.is_none() {
                    last.url = Some(url);
                    if last.kind == "note" || last.kind == "task" {
                        last.kind = "link".to_string();
                    }
                    i += 1;
                    continue;
                }
            }
        }

        // Rule 5: Checkbox items (with or without leading `-`)
        if let Some(caps) = RE_CHECKBOX.captures(trimmed) {
            let mark = caps[1].trim();
            let is_done = mark.eq_ignore_ascii_case("x");
            let item_text = caps[2].trim().to_string();

            let item = build_item(
                item_text,
                None,
                current_context.clone(),
                if is_done {
                    "done".to_string()
                } else {
                    "open".to_string()
                },
                is_fup_context,
            );
            items.push(item);
            i += 1;
            continue;
        }

        // Rule 4: Lines starting with `-`
        if let Some(caps) = RE_DASH_ITEM.captures(trimmed) {
            let item_text = caps[1].trim().to_string();

            let default_status = if is_fup_context {
                "waiting".to_string()
            } else if current_context.is_some() {
                "open".to_string()
            } else {
                "inbox".to_string()
            };

            let item = build_item(
                item_text,
                None,
                current_context.clone(),
                default_status,
                is_fup_context,
            );
            items.push(item);
            i += 1;
            continue;
        }

        // Rule 6 & 12: Loose lines without `-` and without checkbox
        // If we are outside a `##` context or inside, collect continuous loose block
        let title = trimmed.to_string();
        let mut body_lines: Vec<String> = Vec::new();
        let mut url: Option<String> = None;

        i += 1;
        while i < lines.len() {
            let next_line = lines[i];
            let next_trimmed = next_line.trim();

            if RE_SEPARATOR.is_match(next_trimmed) || RE_HEADER.is_match(next_trimmed) {
                break;
            }

            if next_trimmed.is_empty() {
                // If there are blank lines, inspect the following line
                let mut peek_idx = i + 1;
                while peek_idx < lines.len() && lines[peek_idx].trim().is_empty() {
                    peek_idx += 1;
                }
                if peek_idx < lines.len() {
                    let peek_trimmed = lines[peek_idx].trim();
                    if RE_SEPARATOR.is_match(peek_trimmed)
                        || RE_HEADER.is_match(peek_trimmed)
                        || RE_CHECKBOX.is_match(peek_trimmed)
                        || RE_DASH_ITEM.is_match(peek_trimmed)
                    {
                        i = peek_idx;
                        break;
                    }
                    if let Some(u_caps) = RE_URL.captures(peek_trimmed) {
                        url = Some(u_caps[1].to_string());
                        i = peek_idx + 1;
                        break;
                    }
                    // Non-empty line follows inside the same block
                    body_lines.push(peek_trimmed.to_string());
                    i = peek_idx + 1;
                    continue;
                } else {
                    i = peek_idx;
                    break;
                }
            }

            if let Some(u_caps) = RE_URL.captures(next_trimmed) {
                url = Some(u_caps[1].to_string());
                i += 1;
                break;
            }

            if RE_CHECKBOX.is_match(next_trimmed) || RE_DASH_ITEM.is_match(next_trimmed) {
                break;
            }

            body_lines.push(next_trimmed.to_string());
            i += 1;
        }

        let body = if body_lines.is_empty() {
            None
        } else {
            Some(body_lines.join("\n"))
        };

        let default_status = if is_fup_context {
            "waiting".to_string()
        } else if current_context.is_some() {
            "open".to_string()
        } else {
            "inbox".to_string()
        };

        let mut item = build_item(
            title,
            body,
            current_context.clone(),
            default_status,
            is_fup_context,
        );
        if url.is_some() {
            item.url = url;
            if item.kind == "note" || item.kind == "task" {
                item.kind = "link".to_string();
            }
        }

        items.push(item);
    }

    items
}

/// Construct a `ProposedItem` applying ticket, date, waiting_on, secret, and kind rules.
fn build_item(
    title: String,
    body: Option<String>,
    context: Option<String>,
    mut status: String,
    is_fup_context: bool,
) -> ProposedItem {
    let combined_text = match &body {
        Some(b) => format!("{}\n{}", title, b),
        None => title.clone(),
    };

    // Rule 8: Ticket detection
    let ticket_ref = detect_ticket(&combined_text);

    // Rule 10: Waiting on detection
    let waiting_on = detect_waiting_on(&combined_text);
    if (waiting_on.is_some() || is_fup_context) && status != "done" {
        status = "waiting".to_string();
    }

    // Rule 9: Date detection
    let date_str = detect_date(&combined_text);
    let (followup_at, due_at) = if let Some(d) = date_str {
        if status == "waiting" {
            (Some(d), None)
        } else {
            (None, Some(d))
        }
    } else {
        (None, None)
    };

    // Rule 11: Secret detection
    let is_secret = detect_secret(&combined_text);

    // Kind detection
    let kind = if ticket_ref.is_some() {
        "ticket".to_string()
    } else if status == "waiting" || title.starts_with('[') || status == "done" {
        "task".to_string()
    } else {
        "note".to_string()
    };

    ProposedItem {
        title,
        body,
        context,
        kind,
        status,
        waiting_on,
        followup_at,
        due_at,
        ticket_ref,
        url: None,
        tags: Vec::new(),
        is_secret,
        force_import: false,
    }
}
