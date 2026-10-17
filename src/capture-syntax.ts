export interface ParsedCapture {
  raw: string;
  title: string;
  body: string | null;
  context: string | null;
  tags: string[];
  followup_at: string | null;
  waiting_on: string | null;
  ticket_ref: string | null;
  url: string | null;
}

const RE_CONTEXT = /@([a-zA-Z0-9_\-\u00C0-\u017F]+)/g;
const RE_TAG = /#([a-zA-Z0-9_\-\u00C0-\u017F]+)/g;
const RE_WAITING = /~([a-zA-Z0-9_\-\u00C0-\u017F]+)/g;
const RE_DATE = /!([a-zA-Z0-9_/\-\u00C0-\u017F]+)/g;
const RE_TICKET = /\b([A-Z]{2,6}\d{5,})\b/;
const RE_URL = /(https?:\/\/[^\s]+)/;

export function parseDateToken(token: string, referenceDate: Date = new Date()): string | null {
  const lower = token.toLowerCase().trim();
  const pad = (n: number) => n.toString().padStart(2, "0");

  if (lower === "hoje") {
    const y = referenceDate.getFullYear();
    const m = pad(referenceDate.getMonth() + 1);
    const d = pad(referenceDate.getDate());
    return `${y}-${m}-${d}`;
  }

  if (lower === "amanha" || lower === "amanhã") {
    const next = new Date(referenceDate);
    next.setDate(next.getDate() + 1);
    const y = next.getFullYear();
    const m = pad(next.getMonth() + 1);
    const d = pad(next.getDate());
    return `${y}-${m}-${d}`;
  }

  const parts = lower.split("/");
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && !isNaN(y)) {
      return `${y}-${pad(m)}-${pad(d)}`;
    }
  } else if (parts.length === 2) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      const y = referenceDate.getFullYear();
      return `${y}-${pad(m)}-${pad(d)}`;
    }
  }

  return null;
}

export function parseQuickCapture(rawInput: string, referenceDate: Date = new Date()): ParsedCapture {
  const raw = rawInput.trim();
  if (!raw) {
    return {
      raw: "",
      title: "",
      body: null,
      context: null,
      tags: [],
      followup_at: null,
      waiting_on: null,
      ticket_ref: null,
      url: null,
    };
  }

  const lines = raw.split("\n");
  const firstLine = lines[0].trim();
  const bodyText = lines.slice(1).join("\n").trim();
  const body = bodyText.length > 0 ? bodyText : null;

  // Context
  const contextMatches = [...firstLine.matchAll(RE_CONTEXT)];
  const context = contextMatches.length > 0 ? contextMatches[0][1] : null;

  // Tags
  const tagMatches = [...firstLine.matchAll(RE_TAG)];
  const tags: string[] = [];
  for (const match of tagMatches) {
    const tag = match[1].toLowerCase();
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }

  // Waiting on
  const waitingMatches = [...firstLine.matchAll(RE_WAITING)];
  const waiting_on = waitingMatches.length > 0 ? waitingMatches[0][1] : null;

  // Date
  const dateMatches = [...firstLine.matchAll(RE_DATE)];
  let followup_at: string | null = null;
  if (dateMatches.length > 0) {
    followup_at = parseDateToken(dateMatches[0][1], referenceDate);
  }

  // Ticket
  const ticketMatch = raw.match(RE_TICKET);
  const ticket_ref = ticketMatch ? ticketMatch[1] : null;

  // URL
  const urlMatch = raw.match(RE_URL);
  const url = urlMatch ? urlMatch[1] : null;

  // Title cleanup
  let cleanTitle = firstLine
    .replace(RE_CONTEXT, "")
    .replace(RE_TAG, "")
    .replace(RE_WAITING, "")
    .replace(RE_DATE, "")
    .replace(/\s+/g, " ")
    .trim();

  const title = cleanTitle.length > 0 ? cleanTitle : firstLine;

  return {
    raw,
    title,
    body,
    context,
    tags,
    followup_at,
    waiting_on,
    ticket_ref,
    url,
  };
}
