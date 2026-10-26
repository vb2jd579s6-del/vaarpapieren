//! Export and import of all documents and settings, to move them to another computer (Mac or
//! Windows). An export is a zip: `manifest.json` (written and checked by src/lib/transfer.ts)
//! plus the stored files under `files/`, with "/" paths on every platform.

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde::Deserialize;
use tauri::{AppHandle, Manager};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use crate::files::{is_stored_path, FILES_DIR};

const MANIFEST: &str = "manifest.json";
/// Files of an import wait here until the database has been replaced.
const STAGING_DIR: &str = "import-staging";
const BACKUP_DIR: &str = "backups";

#[derive(Deserialize)]
struct ManifestFiles {
    files: Vec<FileEntry>,
}

#[derive(Deserialize)]
struct FileEntry {
    file_path: String,
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

fn stored_paths(manifest: &str) -> Result<Vec<String>, String> {
    let parsed: ManifestFiles = serde_json::from_str(manifest).map_err(|e| e.to_string())?;
    let paths: Vec<String> = parsed.files.into_iter().map(|f| f.file_path).collect();
    if let Some(bad) = paths.iter().find(|p| !is_stored_path(p)) {
        return Err(format!("Invalid file path in export: {bad}"));
    }
    Ok(paths)
}

/// Writes the export to `dest`: first to a temporary file next to it, then renamed, so an
/// interrupted export never leaves a half file under the chosen name.
fn write_export(data: &Path, dest: &Path, manifest: &str) -> Result<(), String> {
    let partial = dest.with_extension("partial");
    let result = (|| -> Result<(), String> {
        let mut zip = ZipWriter::new(File::create(&partial).map_err(|e| e.to_string())?);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        zip.start_file(MANIFEST, options).map_err(|e| e.to_string())?;
        zip.write_all(manifest.as_bytes()).map_err(|e| e.to_string())?;
        for path in stored_paths(manifest)? {
            // Scans are already compressed; storing them as is keeps exporting fast.
            zip.start_file(&path, SimpleFileOptions::default().compression_method(CompressionMethod::Stored))
                .map_err(|e| e.to_string())?;
            let bytes = fs::read(data.join(&path)).map_err(|e| format!("{path}: {e}"))?;
            zip.write_all(&bytes).map_err(|e| e.to_string())?;
        }
        zip.finish().map_err(|e| e.to_string())?;
        Ok(())
    })();
    if let Err(err) = result {
        let _ = fs::remove_file(&partial);
        return Err(err);
    }
    fs::rename(&partial, dest).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_data(app: AppHandle, dest: String, manifest: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || write_export(&data_dir(&app)?, Path::new(&dest), &manifest))
        .await
        .map_err(|e| e.to_string())?
}

/// Saves an export of the current data in the app's backups folder (before an import replaces
/// it) and returns its path.
#[tauri::command]
pub async fn backup_data(app: AppHandle, name: String, manifest: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if name.contains(['/', '\\']) || name.starts_with('.') {
            return Err("Invalid backup name".to_string());
        }
        let data = data_dir(&app)?;
        let dir = data.join(BACKUP_DIR);
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let dest = dir.join(name);
        write_export(&data, &dest, &manifest)?;
        Ok(dest.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Reads an export: unpacks its files into a staging folder and returns the manifest text for
/// the frontend to check. Nothing of the current data changes yet.
#[tauri::command]
pub async fn read_import(app: AppHandle, source: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || stage_import(&data_dir(&app)?, Path::new(&source)))
    .await
    .map_err(|e| e.to_string())?
}

/// After the database has been replaced: moves the staged files into place and removes the
/// stored files the imported data no longer refers to (they are in the backup).
#[tauri::command]
pub async fn finish_import(app: AppHandle, keep: Vec<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || apply_staged(&data_dir(&app)?, &keep))
        .await
        .map_err(|e| e.to_string())?
}

fn stage_import(data: &Path, source: &Path) -> Result<String, String> {
    let staging = data.join(STAGING_DIR);
    let _ = fs::remove_dir_all(&staging);
    let mut zip = ZipArchive::new(File::open(source).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let mut manifest = String::new();
    zip.by_name(MANIFEST)
        .map_err(|_| "Not a Vaarpapieren export".to_string())?
        .read_to_string(&mut manifest)
        .map_err(|e| e.to_string())?;
    for path in stored_paths(&manifest)? {
        let mut entry = zip.by_name(&path).map_err(|_| format!("Missing file in export: {path}"))?;
        let target = staging.join(&path);
        fs::create_dir_all(target.parent().expect("files/ parent")).map_err(|e| e.to_string())?;
        let mut out = File::create(&target).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
    }
    Ok(manifest)
}

fn apply_staged(data: &Path, keep: &[String]) -> Result<(), String> {
    {
        let staging = data.join(STAGING_DIR);
        let files = data.join(FILES_DIR);
        fs::create_dir_all(&files).map_err(|e| e.to_string())?;
        if let Ok(entries) = fs::read_dir(staging.join(FILES_DIR)) {
            for entry in entries.flatten() {
                let target = files.join(entry.file_name());
                let _ = fs::remove_file(&target);
                fs::rename(entry.path(), &target).map_err(|e| e.to_string())?;
            }
        }
        let keep: Vec<PathBuf> = keep.iter().filter(|p| is_stored_path(p)).map(|p| data.join(p)).collect();
        for entry in fs::read_dir(&files).map_err(|e| e.to_string())?.flatten() {
            if entry.path().is_file() && !keep.contains(&entry.path()) {
                let _ = fs::remove_file(entry.path());
            }
        }
        let _ = fs::remove_dir_all(&staging);
        Ok(())
    }
}

/// Writes a file the user chose to save (the certificate list PDF).
#[tauri::command]
pub async fn save_file(dest: String, bytes: Vec<u8>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || fs::write(&dest, bytes).map_err(|e| e.to_string()))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("vaarpapieren-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join(FILES_DIR)).unwrap();
        dir
    }

    const MANIFEST_TWO_FILES: &str = r#"{"format":"vaarpapieren-export","files":[{"file_path":"files/a.pdf"},{"file_path":"files/b.jpg"}]}"#;

    #[test]
    fn exports_and_imports_files_with_their_manifest() {
        let source = temp_dir("source");
        fs::write(source.join("files/a.pdf"), b"%PDF-1.3 scan").unwrap();
        fs::write(source.join("files/b.jpg"), [0xff_u8, 0xd8, 0xff, 0, 1, 2]).unwrap();
        fs::write(source.join("files/not-listed.png"), b"x").unwrap();
        let export = source.join("export.vaarpapieren");
        write_export(&source, &export, MANIFEST_TWO_FILES).unwrap();
        assert!(!export.with_extension("partial").exists());

        let target = temp_dir("target");
        fs::write(target.join("files/old.pdf"), b"old").unwrap();
        let manifest = stage_import(&target, &export).unwrap();
        assert_eq!(manifest, MANIFEST_TWO_FILES);
        // Nothing changes before the database has been replaced.
        assert!(target.join("files/old.pdf").exists());

        apply_staged(&target, &["files/a.pdf".into(), "files/b.jpg".into()]).unwrap();
        assert_eq!(fs::read(target.join("files/a.pdf")).unwrap(), b"%PDF-1.3 scan");
        assert_eq!(fs::read(target.join("files/b.jpg")).unwrap(), [0xff_u8, 0xd8, 0xff, 0, 1, 2]);
        assert!(!target.join("files/old.pdf").exists());
        assert!(!target.join("files/not-listed.png").exists());
        assert!(!target.join(STAGING_DIR).exists());
    }

    #[test]
    fn refuses_paths_outside_the_files_folder() {
        let source = temp_dir("evil");
        let bad = r#"{"files":[{"file_path":"files/../../escape.txt"}]}"#;
        assert!(write_export(&source, &source.join("x.vaarpapieren"), bad).is_err());
        assert!(stored_paths(r#"{"files":[{"file_path":"/etc/passwd"}]}"#).is_err());
    }

    #[test]
    fn refuses_an_export_with_a_missing_file() {
        let source = temp_dir("missing");
        let export = source.join("broken.vaarpapieren");
        {
            let mut zip = ZipWriter::new(File::create(&export).unwrap());
            zip.start_file(MANIFEST, SimpleFileOptions::default()).unwrap();
            zip.write_all(MANIFEST_TWO_FILES.as_bytes()).unwrap();
            zip.finish().unwrap();
        }
        let err = stage_import(&temp_dir("missing-target"), &export).unwrap_err();
        assert!(err.contains("Missing file"), "{err}");
    }
}
