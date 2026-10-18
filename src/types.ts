export type ItemKind = "task" | "link" | "note" | "ticket";
export type ItemStatus = "inbox" | "open" | "waiting" | "done" | "dropped";

export interface Context {
  id: string;
  name: string;
  color: string;
  sync_enabled: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Item {
  id: string;
  context_id: string | null;
  context_name?: string | null;
  context_color?: string | null;
  kind: ItemKind;
  title: string;
  body: string | null;
  status: ItemStatus;
  waiting_on: string | null;
  followup_at: string | null;
  due_at: string | null;
  ticket_ref: string | null;
  url: string | null;
  done_at: string | null;
  source: string;
  origin_app: string | null;
  tags?: string[];
  attachment_count?: number;
  position?: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Attachment {
  id: string;
  item_id: string;
  filename: string | null;
  mime_type: string;
  data: string;
  created_at: string;
}

export interface ProposedItem {
  title: string;
  body?: string | null;
  context?: string | null;
  kind: string;
  status: string;
  waiting_on?: string | null;
  followup_at?: string | null;
  due_at?: string | null;
  ticket_ref?: string | null;
  url?: string | null;
  tags: string[];
  is_secret: boolean;
  force_import: boolean;
}

export interface TodayBlocks {
  executing: Item[];
  overdue: Item[];
  today: Item[];
  waiting: Record<string, Item[]>;
  inbox_count: number;
}

export interface ReviewData {
  today_entered: Item[];
  due_today: Item[];
  stale: Item[];
}

export interface FollowupAlerts {
  overdue: Item[];
  due_today: Item[];
  due_tomorrow: Item[];
}

export interface AppConfig {
  shortcut: string;
  autostart: boolean;
  start_in_tray: boolean;
  stale_days: number;
}
