use anyhow::Result;
use std::sync::Mutex;
use rusqlite::Connection;
use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;

use crate::db::queries::get_followup_alerts;

pub fn check_and_send_followup_notifications(app: &AppHandle) -> Result<usize> {
    let state = app.state::<Mutex<Connection>>();
    let alerts = {
        let conn = state.lock().map_err(|e| anyhow::anyhow!("{e}"))?;
        get_followup_alerts(&conn)?
    };

    let mut count_sent = 0;

    // 1. Alert for today's follow-ups (No dia do vencimento)
    for item in &alerts.due_today {
        let person = item.waiting_on.as_deref().unwrap_or("Sem responsável");
        let context = item
            .context_name
            .as_deref()
            .map(|c| format!(" [@{c}]"))
            .unwrap_or_default();

        let _ = app
            .notification()
            .builder()
            .title("Notas FUP • Follow-up para Hoje")
            .body(format!("Cobrar ~{person}{context}: {}", item.title))
            .show();
        count_sent += 1;
    }

    // 2. Alert for tomorrow's follow-ups (1 dia antes)
    for item in &alerts.due_tomorrow {
        let person = item.waiting_on.as_deref().unwrap_or("Sem responsável");
        let context = item
            .context_name
            .as_deref()
            .map(|c| format!(" [@{c}]"))
            .unwrap_or_default();

        let _ = app
            .notification()
            .builder()
            .title("Notas FUP • Follow-up Amanhã (1 dia antes)")
            .body(format!("Amanhã vence cobrança com ~{person}{context}: {}", item.title))
            .show();
        count_sent += 1;
    }

    // 3. Alert for overdue follow-ups (Atrasados)
    if !alerts.overdue.is_empty() {
        let count = alerts.overdue.len();
        let first = &alerts.overdue[0];
        let person = first.waiting_on.as_deref().unwrap_or("Sem responsável");
        let extra = if count > 1 {
            format!(" (+{} outro(s))", count - 1)
        } else {
            String::new()
        };

        let _ = app
            .notification()
            .builder()
            .title("Notas FUP • Follow-up Atrasado")
            .body(format!("Cobrança atrasada com ~{person}{extra}: {}", first.title))
            .show();
        count_sent += 1;
    }

    Ok(count_sent)
}

pub fn send_test_notification(app: &AppHandle) -> Result<()> {
    app.notification()
        .builder()
        .title("Notas FUP • Teste de Alerta")
        .body("As notificações de follow-up do Windows estão ativas e funcionando perfeitamente!")
        .show()?;
    Ok(())
}
