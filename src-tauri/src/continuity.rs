//! macOS Continuity Camera: "Import from iPhone" → Scan Documents / Take Photo, as in Finder.
//!
//! A menu item with AppKit's `NSMenuItemImportFromDeviceIdentifier` is filled in by macOS with
//! the nearby iPhones and iPads. macOS only offers it when the responder chain has an object that
//! accepts images or PDFs (`validRequestorForSendType:returnType:`); the scan is then delivered to
//! that object through `readSelectionFromPasteboard:`. This module installs such an object in the
//! responder chain between the window's content view and the window (NSWindow itself does not ask
//! its nextResponder), writes what it receives to a temporary file and tells the frontend, which
//! treats it like a file picked from disk.

use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2::{define_class, msg_send, DefinedClass, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{
    NSBitmapImageFileType, NSBitmapImageRep, NSMenu, NSMenuItem, NSMenuItemImportFromDeviceIdentifier,
    NSPasteboard, NSPasteboardType, NSPasteboardTypePDF, NSPasteboardTypePNG, NSPasteboardTypeTIFF,
    NSResponder, NSUserInterfaceItemIdentification, NSView, NSWindow,
};
use objc2_foundation::{NSArray, NSCopying, NSDictionary, NSPoint, NSString};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

/// Event with the path of the received file; the Add page listens for it.
const EVENT_CONTINUITY_IMPORT: &str = "continuity-import";
const TEMP_DIR: &str = "continuity";

pub struct Ivars {
    app: AppHandle,
}

define_class!(
    // SAFETY: NSResponder has no subclassing requirements; this class does not implement Drop.
    #[unsafe(super(NSResponder))]
    #[thread_kind = MainThreadOnly]
    #[name = "VaarpapierenContinuityResponder"]
    #[ivars = Ivars]
    struct ContinuityResponder;

    impl ContinuityResponder {
        /// Accept images and PDFs coming in (nothing goes out: `send_type` is nil).
        #[unsafe(method(validRequestorForSendType:returnType:))]
        fn valid_requestor(
            &self,
            send_type: Option<&NSPasteboardType>,
            return_type: Option<&NSPasteboardType>,
        ) -> *mut AnyObject {
            let accepted = send_type.is_none()
                && return_type.is_some_and(|t| accepted_types().iter().any(|a| &**a == t));
            if accepted {
                self as *const Self as *mut AnyObject
            } else {
                unsafe { msg_send![super(self), validRequestorForSendType: send_type, returnType: return_type] }
            }
        }

        #[unsafe(method(readSelectionFromPasteboard:))]
        fn read_selection(&self, pasteboard: &NSPasteboard) -> bool {
            match save_pasteboard(&self.ivars().app, pasteboard) {
                Ok(path) => self.ivars().app.emit(EVENT_CONTINUITY_IMPORT, path).is_ok(),
                Err(err) => {
                    eprintln!("Continuity Camera import failed: {err}");
                    false
                }
            }
        }
    }
);

/// In order of preference: a scan arrives as PDF, a photo as JPEG (or PNG/TIFF).
fn accepted_types() -> [Retained<NSString>; 4] {
    unsafe {
        [
            NSPasteboardTypePDF.copy(),
            NSString::from_str("public.jpeg"),
            NSPasteboardTypePNG.copy(),
            NSPasteboardTypeTIFF.copy(),
        ]
    }
}

fn save_pasteboard(app: &AppHandle, pasteboard: &NSPasteboard) -> Result<String, String> {
    let types = accepted_types();
    let refs: Vec<&NSString> = types.iter().map(|t| &**t).collect();
    let available = pasteboard
        .availableTypeFromArray(&NSArray::from_slice(&refs))
        .ok_or("no image or PDF on the pasteboard")?;
    let data = pasteboard.dataForType(&available).ok_or("no data for the pasteboard type")?;

    let (bytes, name) = if &*available == unsafe { NSPasteboardTypePDF } {
        (data.to_vec(), "iPhone-scan.pdf")
    } else if &*available == &*types[1] {
        (data.to_vec(), "iPhone-photo.jpg")
    } else {
        // PNG as is; TIFF converted, since the app stores PDF, JPG and PNG only.
        let png = if &*available == unsafe { NSPasteboardTypePNG } {
            data
        } else {
            let rep = NSBitmapImageRep::imageRepWithData(&data).ok_or("unreadable image")?;
            unsafe { rep.representationUsingType_properties(NSBitmapImageFileType::PNG, &NSDictionary::new()) }
                .ok_or("could not convert the image to PNG")?
        };
        (png.to_vec(), "iPhone-photo.png")
    };

    // One folder per import, so the stored original file name stays readable.
    let base = app.path().app_cache_dir().map_err(|e| e.to_string())?.join(TEMP_DIR);
    let _ = std::fs::remove_dir_all(&base); // earlier imports were already copied into the app
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_millis();
    let dir: PathBuf = base.join(stamp.to_string());
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(name);
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

/// Puts the responder between the content view and the window. Call once, on the main thread.
pub fn install(app: &AppHandle, window: &WebviewWindow) -> tauri::Result<()> {
    let mtm = MainThreadMarker::new().expect("setup runs on the main thread");
    let ns_window = window.ns_window()? as *mut NSWindow;
    let ns_window = unsafe { ns_window.as_ref() }.expect("main window has an NSWindow");
    let responder = ContinuityResponder::alloc(mtm).set_ivars(Ivars { app: app.clone() });
    let responder: Retained<ContinuityResponder> = unsafe { msg_send![super(responder), init] };
    let content = ns_window.contentView().expect("main window has a content view");
    unsafe {
        responder.setNextResponder(content.nextResponder().as_deref());
        content.setNextResponder(Some(&responder));
    }
    // nextResponder is not retained; the responder lives as long as the app.
    std::mem::forget(responder);
    Ok(())
}

/// Shows the "Import from iPhone" menu below the button at (x, y), in CSS pixels of the page.
#[tauri::command]
pub fn show_iphone_import_menu(window: WebviewWindow, x: f64, y: f64, title: String) -> Result<(), String> {
    window
        .with_webview(move |webview| {
            let Some(mtm) = MainThreadMarker::new() else { return };
            let Some(view) = (unsafe { (webview.inner() as *mut NSView).as_ref() }) else { return };
            let menu = NSMenu::new(mtm);
            let item = NSMenuItem::new(mtm);
            item.setTitle(&NSString::from_str(&title));
            item.setIdentifier(Some(unsafe { NSMenuItemImportFromDeviceIdentifier }));
            menu.addItem(&item);
            // WKWebView is flipped, so page coordinates map directly onto the view.
            menu.popUpMenuPositioningItem_atLocation_inView(None, NSPoint::new(x, y), Some(view));
        })
        .map_err(|e| e.to_string())
}
