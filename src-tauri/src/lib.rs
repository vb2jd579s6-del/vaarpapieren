mod files;

use std::time::Duration;

use serde::Deserialize;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, Wry, WindowEvent,
};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_sql::{Migration, MigrationKind};

const MAIN_WINDOW: &str = "main";

/// Must match DB_URL in src/lib/db/connection.ts.
const DB_URL: &str = "sqlite:vaarpapieren.db";

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "init",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }]
}

/// Event the frontend listens for to run the expiry check (tray menu "Nu controleren" and the timer).
const EVENT_CHECK_NOW: &str = "check-now";

/// Event with a version id: a notification about that version was clicked.
const EVENT_OPEN_DOCUMENT: &str = "open-document";

/// The periodic check runs on a Rust thread, so it keeps its pace while the window is hidden.
const CHECK_INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);

/// The tray menu items, kept so their texts can be set from the frontend (src/i18n).
struct TrayItems {
    open: MenuItem<Wry>,
    check: MenuItem<Wry>,
    quit: MenuItem<Wry>,
    tray: tauri::tray::TrayIcon<Wry>,
}

#[derive(Deserialize)]
struct TrayTexts {
    open: String,
    check: String,
    quit: String,
    tooltip: String,
}

#[tauri::command]
fn set_tray_texts(app: AppHandle, texts: TrayTexts) -> Result<(), String> {
    let items = app.state::<TrayItems>();
    items.open.set_text(texts.open).map_err(|e| e.to_string())?;
    items.check.set_text(texts.check).map_err(|e| e.to_string())?;
    items.quit.set_text(texts.quit).map_err(|e| e.to_string())?;
    items.tray.set_tooltip(Some(texts.tooltip)).map_err(|e| e.to_string())?;
    Ok(())
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    // Placeholder texts until the frontend sets them from src/i18n via set_tray_texts.
    let open = MenuItem::with_id(app, "open", "Openen", true, None::<&str>)?;
    let check = MenuItem::with_id(app, "check", "Nu controleren", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Afsluiten", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &check, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("Vaarpapieren")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "check" => {
                let _ = app.emit(EVENT_CHECK_NOW, ());
            }
            "quit" => app.exit(0),
            _ => {}
        });
    // macOS: a monochrome template image, which the menu bar tints for light and dark mode.
    // Windows: the coloured app icon, like other apps in the system tray.
    #[cfg(target_os = "macos")]
    {
        tray = tray
            .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/tray-template.png"))?)
            .icon_as_template(true);
    }
    #[cfg(not(target_os = "macos"))]
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    let tray = tray.build(app)?;
    app.manage(TrayItems { open, check, quit, tray });
    Ok(())
}

fn start_check_timer(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(CHECK_INTERVAL);
        let _ = app.emit(EVENT_CHECK_NOW, ());
    });
}

/// A click on a notification brings the window up and tells the frontend which version it was about.
fn handle_notification_clicks(app: &AppHandle) -> tauri::Result<()> {
    let handle = app.clone();
    app.notification()
        .on_action(move |performed| {
            if performed.action_id() != "tap" {
                return;
            }
            show_main_window(&handle);
            if let Some(id) = performed.notification().map(|n| n.id()).filter(|id| *id > 0) {
                let _ = handle.emit(EVENT_OPEN_DOCUMENT, id);
            }
        })
        .map_err(|e| tauri::Error::Anyhow(e.into()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // A second launch focuses the running instance instead of starting another one.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .invoke_handler(tauri::generate_handler![
            files::import_document_file,
            files::open_document_file,
            files::remove_document_file,
            set_tray_texts
        ])
        .setup(|app| {
            setup_tray(app.handle())?;
            handle_notification_clicks(app.handle())?;
            start_check_timer(app.handle().clone());
            // Started by autostart: stay in the tray without showing the window.
            if std::env::args().any(|a| a == "--hidden") {
                if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                    let _ = window.hide();
                }
            }
            Ok(())
        })
        // Closing the window hides it: the app (and the periodic check) keeps running in the tray.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app, _event| {
        // Clicking the Dock icon with the window hidden brings it back.
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen { .. } = _event {
            show_main_window(_app);
        }
    });
}
