#[cfg(target_os = "macos")]
mod continuity;
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
    vec![
        Migration {
            version: 1,
            description: "init",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "document_files",
            sql: include_str!("../migrations/0002_document_files.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

/// Event the frontend listens for to run the expiry check (tray menu "Nu controleren" and the timer).
const EVENT_CHECK_NOW: &str = "check-now";

/// Event: the Settings item of the app menu (⌘,) was chosen.
const EVENT_OPEN_SETTINGS: &str = "open-settings";
const MENU_SETTINGS: &str = "settings";

/// Event with a version id: a notification about that version was clicked.
const EVENT_OPEN_DOCUMENT: &str = "open-document";

/// The periodic check runs on a Rust thread, so it keeps its pace while the window is hidden.
const CHECK_INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);

const TRAY_ID: &str = "main";

/// Tray menu texts, set from the frontend (src/i18n) so they follow the chosen language, plus the
/// next documents to expire.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TrayTexts {
    open: String,
    check: String,
    quit: String,
    tooltip: String,
    #[serde(default)]
    upcoming_title: String,
    #[serde(default)]
    upcoming: Vec<TrayDocument>,
}

/// "Basic Safety Training — nog 21 dagen geldig"; choosing it opens the app at that document.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TrayDocument {
    label: String,
    version_id: i32,
}

const TRAY_DOCUMENT_PREFIX: &str = "doc:";

/// Placeholder texts until the frontend has loaded the saved language.
fn default_tray_texts() -> TrayTexts {
    TrayTexts {
        open: "Openen".into(),
        check: "Nu controleren".into(),
        quit: "Afsluiten".into(),
        tooltip: "Vaarpapieren".into(),
        upcoming_title: String::new(),
        upcoming: Vec::new(),
    }
}

fn tray_menu(app: &AppHandle, texts: &TrayTexts) -> tauri::Result<Menu<Wry>> {
    use tauri::menu::PredefinedMenuItem;
    let menu = Menu::new(app)?;
    if !texts.upcoming.is_empty() {
        menu.append(&MenuItem::with_id(app, "upcoming", &texts.upcoming_title, false, None::<&str>)?)?;
        for doc in &texts.upcoming {
            let id = format!("{TRAY_DOCUMENT_PREFIX}{}", doc.version_id);
            menu.append(&MenuItem::with_id(app, id, &doc.label, true, None::<&str>)?)?;
        }
        menu.append(&PredefinedMenuItem::separator(app)?)?;
    }
    menu.append(&MenuItem::with_id(app, "open", &texts.open, true, None::<&str>)?)?;
    menu.append(&MenuItem::with_id(app, "check", &texts.check, true, None::<&str>)?)?;
    menu.append(&MenuItem::with_id(app, "quit", &texts.quit, true, None::<&str>)?)?;
    Ok(menu)
}

/// Replaces the whole tray menu: renaming the existing items does not show on macOS.
fn set_tray_menu(app: &AppHandle, texts: TrayTexts) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_menu(Some(tray_menu(app, &texts)?))?;
        tray.set_tooltip(Some(texts.tooltip))?;
    }
    Ok(())
}

/// Texts of the macOS app menu at the top of the screen (src/i18n, `appMenu`).
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppMenuTexts {
    about: String,
    settings: String,
    hide: String,
    hide_others: String,
    show_all: String,
    quit: String,
    edit: String,
    undo: String,
    redo: String,
    cut: String,
    copy: String,
    paste: String,
    select_all: String,
    import_from_iphone: String,
    window: String,
    minimize: String,
    zoom: String,
    close: String,
}

/// Placeholder texts until the frontend has loaded the saved language.
fn default_app_menu_texts() -> AppMenuTexts {
    AppMenuTexts {
        about: "Over Vaarpapieren".into(),
        settings: "Instellingen…".into(),
        hide: "Verberg Vaarpapieren".into(),
        hide_others: "Verberg andere".into(),
        show_all: "Toon alles".into(),
        quit: "Stop Vaarpapieren".into(),
        edit: "Wijzig".into(),
        undo: "Herstel".into(),
        redo: "Opnieuw".into(),
        cut: "Knip".into(),
        copy: "Kopieer".into(),
        paste: "Plak".into(),
        select_all: "Selecteer alles".into(),
        import_from_iphone: "Importeer vanaf iPhone".into(),
        window: "Venster".into(),
        minimize: "Minimaliseer".into(),
        zoom: "Zoom".into(),
        close: "Sluit venster".into(),
    }
}

/// Only what the app uses: the app menu (with Settings, ⌘,), Edit (so ⌘C/⌘V work in text
/// fields, plus Import from iPhone) and Window. Windows has no app menu, so this is macOS only.
#[cfg(target_os = "macos")]
fn set_app_menu(app: &AppHandle, t: AppMenuTexts) -> tauri::Result<()> {
    use tauri::menu::{AboutMetadata, PredefinedMenuItem, Submenu};

    let pkg = app.package_info();
    let about = AboutMetadata {
        name: Some(pkg.name.clone()),
        version: Some(pkg.version.to_string()),
        ..Default::default()
    };
    let settings = MenuItem::with_id(app, MENU_SETTINGS, &t.settings, true, Some("CmdOrCtrl+,"))?;
    let app_menu = Submenu::with_items(
        app,
        &pkg.name,
        true,
        &[
            &PredefinedMenuItem::about(app, Some(&t.about), Some(about))?,
            &PredefinedMenuItem::separator(app)?,
            &settings,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, Some(&t.hide))?,
            &PredefinedMenuItem::hide_others(app, Some(&t.hide_others))?,
            &PredefinedMenuItem::show_all(app, Some(&t.show_all))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, Some(&t.quit))?,
        ],
    )?;
    let edit = Submenu::with_items(
        app,
        &t.edit,
        true,
        &[
            &PredefinedMenuItem::undo(app, Some(&t.undo))?,
            &PredefinedMenuItem::redo(app, Some(&t.redo))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some(&t.cut))?,
            &PredefinedMenuItem::copy(app, Some(&t.copy))?,
            &PredefinedMenuItem::paste(app, Some(&t.paste))?,
            &PredefinedMenuItem::select_all(app, Some(&t.select_all))?,
        ],
    )?;
    let window = Submenu::with_items(
        app,
        &t.window,
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some(&t.minimize))?,
            &PredefinedMenuItem::maximize(app, Some(&t.zoom))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, Some(&t.close))?,
        ],
    )?;
    app.set_menu(Menu::with_items(app, &[&app_menu, &edit, &window])?)?;
    // Continuity Camera needs a native item identifier that Tauri menus cannot set; added after
    // the menu is in place (queued behind it on the main thread).
    let title = t.import_from_iphone;
    app.run_on_main_thread(move || crate::continuity::add_to_edit_menu(&title))?;
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn set_app_menu(_app: &AppHandle, _texts: AppMenuTexts) -> tauri::Result<()> {
    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MenuTexts {
    tray: TrayTexts,
    app_menu: AppMenuTexts,
}

/// Sets the tray menu and the app menu in the language chosen in the frontend.
#[tauri::command]
fn set_menu_texts(app: AppHandle, texts: MenuTexts) -> Result<(), String> {
    set_tray_menu(&app, texts.tray).map_err(|e| e.to_string())?;
    set_app_menu(&app, texts.app_menu).map_err(|e| e.to_string())
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let texts = default_tray_texts();
    let menu = tray_menu(app, &texts)?;

    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip(&texts.tooltip)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "check" => {
                let _ = app.emit(EVENT_CHECK_NOW, ());
            }
            "quit" => app.exit(0),
            id => {
                if let Some(version_id) = id.strip_prefix(TRAY_DOCUMENT_PREFIX).and_then(|v| v.parse::<i32>().ok()) {
                    show_main_window(app);
                    let _ = app.emit(EVENT_OPEN_DOCUMENT, version_id);
                }
            }
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
    tray.build(app)?;
    Ok(())
}

/// Autostart registers the path of the app that switched it on. After an update, or when it was
/// switched on from a development build, that path can be stale; the installed app (in
/// /Applications) points it back at itself. Development builds leave it alone.
fn refresh_autostart(app: &AppHandle) {
    use tauri_plugin_autostart::ManagerExt;
    let installed = std::env::current_exe().is_ok_and(|exe| exe.starts_with("/Applications"));
    let autolaunch = app.autolaunch();
    if installed && autolaunch.is_enabled().unwrap_or(false) {
        let _ = autolaunch.enable();
    }
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .invoke_handler(tauri::generate_handler![
            files::import_document_file,
            files::open_document_file,
            files::remove_document_file,
            #[cfg(target_os = "macos")]
            continuity::show_iphone_import_menu,
            set_menu_texts
        ])
        .setup(|app| {
            setup_tray(app.handle())?;
            refresh_autostart(app.handle());
            #[cfg(target_os = "macos")]
            continuity::suppress_automatic_edit_items();
            set_app_menu(app.handle(), default_app_menu_texts())?;
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                continuity::install(app.handle(), &window)?;
            }
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
        .on_menu_event(|app, event| {
            if event.id.as_ref() == MENU_SETTINGS {
                show_main_window(app);
                let _ = app.emit(EVENT_OPEN_SETTINGS, ());
            }
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
