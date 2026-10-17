//! Sync module (future): push/pull with Supabase.
//!
//! Strategy:
//! - Each record has `updated_at` and `deleted_at` (tombstone).
//! - Sync is per-device (`device_id` from `meta` table).
//! - Resolution: last-write-wins based on `updated_at`.
//! - Contexts with `sync_enabled = false` are never synced.
//!
//! This module is intentionally empty for the MVP. The trait below
//! defines the interface that the future implementation will fill.

use anyhow::Result;

/// Trait for the sync service. Not implemented in the MVP.
#[allow(dead_code)]
pub trait SyncService {
    /// Push local changes (since last sync) to the remote server.
    fn push(&self) -> Result<u64>;

    /// Pull remote changes and apply locally.
    fn pull(&self) -> Result<u64>;

    /// Full sync: push then pull.
    fn sync(&self) -> Result<(u64, u64)> {
        let pushed = self.push()?;
        let pulled = self.pull()?;
        Ok((pushed, pulled))
    }
}
