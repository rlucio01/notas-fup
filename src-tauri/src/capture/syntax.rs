use chrono::{Datelike, Duration, Utc};
use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ParsedCapture {
    pub raw: String,
    pub title: String,
    pub body: Option<String>,
    pub context: Option<String>,
    pub tags: Vec<String>,
    pub followup_at: Option<String>,
    pub waiting_on: Option<String>,
    pub ticket_ref: Option<String>,
    pub url: Option<String>,
}

static RE_CONTEXT: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"@([a-zA-Z0-9_\-\p{L}]+)").unwrap());
static RE_TAG: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"#([a-zA-Z0-9_\-\p{L}]+)").unwrap());
static RE_WAITING: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"~([a-zA-Z0-9_\-\p{L}]+)").unwrap());
static RE_DATE_TOKEN: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"!([a-zA-Z0-9_/\-\p{L}]+)").unwrap());
static RE_TICKET: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\b([A-Z]{2,6}\d{5,})\b").unwrap());
static RE_URL: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(https?://[^\s]+)").unwrap());

/// Parse quick capture line into structured data.
pub fn parse_quick_capture(raw_input: &str) -> ParsedCapture {
    let raw = raw_input.trim().to_string();
    if raw.is_empty() {
        return ParsedCapture {
            raw: String::new(),
            title: String::new(),
            body: None,
            context: None,
            tags: Vec::new(),
            followup_at: None,
            waiting_on: None,
            ticket_ref: None,
            url: None,
        };
    }

    // Split into first line (title source) and subsequent lines (body source)
    let mut lines = raw.lines();
    let first_line = lines.next().unwrap_or("").trim();
    let body_text = lines.collect::<Vec<_>>().join("\n").trim().to_string();
    let body = if body_text.is_empty() {
        None
    } else {
        Some(body_text)
    };

    let mut context: Option<String> = None;
    if let Some(caps) = RE_CONTEXT.captures(first_line) {
        context = Some(caps[1].to_string());
    }

    let mut tags: Vec<String> = Vec::new();
    for caps in RE_TAG.captures_iter(first_line) {
        let tag = caps[1].to_lowercase();
        if !tags.contains(&tag) {
            tags.push(tag);
        }
    }

    let mut waiting_on: Option<String> = None;
    if let Some(caps) = RE_WAITING.captures(first_line) {
        waiting_on = Some(caps[1].to_string());
    }

    let mut followup_at: Option<String> = None;
    if let Some(caps) = RE_DATE_TOKEN.captures(first_line) {
        let token = caps[1].to_lowercase();
        followup_at = parse_date_token(&token);
    }

    let ticket_ref = RE_TICKET
        .captures(&raw)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string());

    let url = RE_URL
        .captures(&raw)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string());

    // Clean title by stripping @context, #tag, !date, ~person tokens
    let mut clean_title = RE_CONTEXT.replace_all(first_line, "").to_string();
    clean_title = RE_TAG.replace_all(&clean_title, "").to_string();
    clean_title = RE_WAITING.replace_all(&clean_title, "").to_string();
    clean_title = RE_DATE_TOKEN.replace_all(&clean_title, "").to_string();

    // Collapse multiple spaces
    let clean_title = clean_title
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    let final_title = if clean_title.is_empty() {
        first_line.to_string()
    } else {
        clean_title
    };

    ParsedCapture {
        raw,
        title: final_title,
        body,
        context,
        tags,
        followup_at,
        waiting_on,
        ticket_ref,
        url,
    }
}

fn parse_date_token(token: &str) -> Option<String> {
    let now = Utc::now();
    if token == "hoje" {
        return Some(now.format("%Y-%m-%d").to_string());
    }
    if token == "amanha" || token == "amanhã" {
        let tomorrow = now + Duration::days(1);
        return Some(tomorrow.format("%Y-%m-%d").to_string());
    }

    // Try dd/mm/aaaa
    let parts: Vec<&str> = token.split('/').collect();
    if parts.len() == 3 {
        let d: u32 = parts[0].parse().ok()?;
        let m: u32 = parts[1].parse().ok()?;
        let y: i32 = parts[2].parse().ok()?;
        if (1..=31).contains(&d) && (1..=12).contains(&m) {
            return Some(format!("{:04}-{:02}-{:02}", y, m, d));
        }
    } else if parts.len() == 2 {
        let d: u32 = parts[0].parse().ok()?;
        let m: u32 = parts[1].parse().ok()?;
        if (1..=31).contains(&d) && (1..=12).contains(&m) {
            return Some(format!("{:04}-{:02}-{:02}", now.year(), m, d));
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quick_capture_full_syntax() {
        let input = "cobrar resposta da POC @empresa #finops !22/10 ~beltrano";
        let parsed = parse_quick_capture(input);

        assert_eq!(parsed.title, "cobrar resposta da POC");
        assert_eq!(parsed.context.as_deref(), Some("empresa"));
        assert_eq!(parsed.tags, vec!["finops"]);
        assert_eq!(parsed.waiting_on.as_deref(), Some("beltrano"));
        assert!(parsed.followup_at.is_some());
        assert!(parsed.followup_at.unwrap().ends_with("-10-22"));
    }

    #[test]
    fn test_quick_capture_amanha() {
        let input = "Enviar relatório financeiro !amanhã #urgente";
        let parsed = parse_quick_capture(input);

        assert_eq!(parsed.title, "Enviar relatório financeiro");
        assert_eq!(parsed.tags, vec!["urgente"]);
        assert!(parsed.followup_at.is_some());
    }

    #[test]
    fn test_quick_capture_with_ticket_and_url() {
        let input = "Análise do CHG0012345 https://service.empresa.com/ticket @trabalho";
        let parsed = parse_quick_capture(input);

        assert_eq!(parsed.context.as_deref(), Some("trabalho"));
        assert_eq!(parsed.ticket_ref.as_deref(), Some("CHG0012345"));
        assert_eq!(
            parsed.url.as_deref(),
            Some("https://service.empresa.com/ticket")
        );
    }

    #[test]
    fn test_quick_capture_multiline() {
        let input = "Título da tarefa @pessoal\nLinha detalhada de notas 1\nLinha 2";
        let parsed = parse_quick_capture(input);

        assert_eq!(parsed.title, "Título da tarefa");
        assert_eq!(parsed.context.as_deref(), Some("pessoal"));
        assert_eq!(
            parsed.body.as_deref(),
            Some("Linha detalhada de notas 1\nLinha 2")
        );
    }
}
