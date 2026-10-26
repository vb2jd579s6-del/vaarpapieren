//! Document files are copied into the app data directory; the database stores the path relative to it.

use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

pub(crate) const FILES_DIR: &str = "files";
const ALLOWED_EXTENSIONS: [&str; 4] = ["pdf", "jpg", "jpeg", "png"];

#[derive(Serialize)]
pub struct ImportedFile {
    /// Relative to the app data directory, with forward slashes.
    file_path: String,
    original_filename: String,
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

/// A stored path must point inside the files directory: no absolute paths, no `..`.
pub(crate) fn is_stored_path(relative: &str) -> bool {
    let rel = Path::new(relative);
    rel.starts_with(FILES_DIR)
        && rel.components().count() > 1
        && rel.components().all(|c| matches!(c, Component::Normal(_)))
}

fn resolve_stored(app: &AppHandle, relative: &str) -> Result<PathBuf, String> {
    if !is_stored_path(relative) {
        return Err(format!("Invalid document path: {relative}"));
    }
    Ok(data_dir(app)?.join(relative))
}

/// Copies the chosen file into the app data directory; the original is left untouched.
#[tauri::command]
pub fn import_document_file(app: AppHandle, source: String) -> Result<ImportedFile, String> {
    let source = PathBuf::from(source);
    let original_filename = source
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid file name")?
        .to_string();
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .filter(|e| ALLOWED_EXTENSIONS.contains(&e.as_str()))
        .ok_or("Only PDF, JPG and PNG files are supported")?;

    let dir = data_dir(&app)?.join(FILES_DIR);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_millis();
    let mut n = 0;
    let name = loop {
        let candidate = if n == 0 { format!("{stamp}.{ext}") } else { format!("{stamp}-{n}.{ext}") };
        if !dir.join(&candidate).exists() {
            break candidate;
        }
        n += 1;
    };
    std::fs::copy(&source, dir.join(&name)).map_err(|e| e.to_string())?;

    Ok(ImportedFile { file_path: format!("{FILES_DIR}/{name}"), original_filename })
}

/// Error text the frontend recognises to show "file not found" instead of a raw error.
const FILE_NOT_FOUND: &str = "file-not-found";

/// Opens a stored document in the system's default viewer.
#[tauri::command]
pub fn open_document_file(app: AppHandle, file_path: String) -> Result<(), String> {
    let path = resolve_stored(&app, &file_path)?;
    if !path.is_file() {
        return Err(FILE_NOT_FOUND.into());
    }
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}

/// Removes a copied file. Only called after the user confirmed a delete, or to undo a copy
/// whose database record could not be saved.
#[tauri::command]
pub fn remove_document_file(app: AppHandle, file_path: String) -> Result<(), String> {
    let path = resolve_stored(&app, &file_path)?;
    match std::fs::remove_file(path) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::is_stored_path;

    #[test]
    fn accepts_only_paths_inside_the_files_directory() {
        assert!(is_stored_path("files/1761400000000.pdf"));
        assert!(!is_stored_path("files"));
        assert!(!is_stored_path("files/../vaarpapieren.db"));
        assert!(!is_stored_path("/etc/passwd"));
        assert!(!is_stored_path("vaarpapieren.db"));
        assert!(!is_stored_path("other/files/x.pdf"));
    }
}

/// Writes an .ics file to the app's cache folder and opens it in the default calendar app,
/// which then offers to add the events.
#[tauri::command]
pub fn open_calendar_file(app: AppHandle, name: String, content: String) -> Result<(), String> {
    let valid = name.ends_with(".ics") && !name.contains(['/', '\\']) && !name.starts_with('.');
    if !valid {
        return Err(format!("Invalid calendar file name: {name}"));
    }
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("calendar");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(name);
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}
