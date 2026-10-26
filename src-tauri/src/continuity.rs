//! macOS Continuity Camera: "Import from iPhone" → Scan Documents / Take Photo, as in Finder.
//!
//! Follows Apple's "Supporting Continuity Camera in Your Mac App":
//! - A responder accepts image data (`validRequestorForSendType:returnType:` for `NSImage.imageTypes`)
//!   and receives it through `readSelectionFromPasteboard:`. It sits in the responder chain between
//!   the window's content view and the window, because NSWindow itself does not ask its nextResponder.
//! - Contextual menus get the Continuity Camera item from AppKit when shown with
//!   `popUpContextMenu:withEvent:forView:`; menu bar menus carry an item with
//!   `NSMenuItemImportFromDeviceIdentifier`, which AppKit fills in.
//!
//! What arrives is written to a temporary file and handed to the frontend, which treats it like a
//! file picked from disk.

use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2::{define_class, msg_send, DefinedClass, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{
    NSApplication, NSBitmapImageFileType, NSBitmapImageRep, NSEvent, NSEventModifierFlags, NSEventType, NSImage,
    NSMenu, NSMenuItem, NSMenuItemImportFromDeviceIdentifier, NSPasteboard, NSPasteboardType, NSPasteboardTypePDF,
    NSPasteboardTypePNG, NSResponder, NSUserInterfaceItemIdentification, NSView, NSWindow,
};
use objc2_foundation::{NSArray, NSDictionary, NSPoint, NSString};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

/// Event with the path of the received file; see src/lib/files/index.ts.
const EVENT_CONTINUITY_IMPORT: &str = "continuity-import";
const TEMP_DIR: &str = "continuity";
const JPEG_TYPE: &str = "public.jpeg";

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
        /// Accept any image (PDF included) coming in; nothing goes out, so `send_type` is nil.
        #[unsafe(method(validRequestorForSendType:returnType:))]
        fn valid_requestor(
            &self,
            send_type: Option<&NSPasteboardType>,
            return_type: Option<&NSPasteboardType>,
        ) -> *mut AnyObject {
            let is_image = send_type.is_none()
                && return_type.is_some_and(|t| NSImage::imageTypes().iter().any(|image_type| &*image_type == t));
            if is_image {
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

/// A scan is kept as PDF and a JPEG/PNG photo as is; any other image (TIFF, HEIC, …) becomes PNG,
/// since the app stores PDF, JPG and PNG only.
fn save_pasteboard(app: &AppHandle, pasteboard: &NSPasteboard) -> Result<String, String> {
    let pdf = unsafe { NSPasteboardTypePDF };
    let png = unsafe { NSPasteboardTypePNG };
    let jpeg = NSString::from_str(JPEG_TYPE);
    let available = pasteboard
        .availableTypeFromArray(&NSArray::from_slice(&[pdf, &*jpeg, png]))
        .or_else(|| pasteboard.availableTypeFromArray(&NSImage::imageTypes()))
        .ok_or("no image or PDF on the pasteboard")?;
    let data = pasteboard.dataForType(&available).ok_or("no data for the pasteboard type")?;

    let (bytes, name) = if &*available == pdf {
        (data.to_vec(), "iPhone-scan.pdf")
    } else if *available == *jpeg {
        (data.to_vec(), "iPhone-photo.jpg")
    } else if &*available == png {
        (data.to_vec(), "iPhone-photo.png")
    } else {
        let rep = NSBitmapImageRep::imageRepWithData(&data).ok_or("unreadable image")?;
        let converted = unsafe { rep.representationUsingType_properties(NSBitmapImageFileType::PNG, &NSDictionary::new()) }
            .ok_or("could not convert the image to PNG")?;
        (converted.to_vec(), "iPhone-photo.png")
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

/// Appends "Import from iPhone" to the menu bar's Edit menu (the second menu). Call on the main
/// thread after the app menu has been (re)built.
pub fn add_to_edit_menu(title: &str) {
    let Some(mtm) = MainThreadMarker::new() else { return };
    let Some(edit) = NSApplication::sharedApplication(mtm)
        .mainMenu()
        .and_then(|menu| menu.itemAtIndex(1))
        .and_then(|item| item.submenu())
    else {
        return;
    };
    let item = NSMenuItem::new(mtm);
    item.setTitle(&NSString::from_str(title));
    item.setIdentifier(Some(unsafe { NSMenuItemImportFromDeviceIdentifier }));
    edit.addItem(&NSMenuItem::separatorItem(mtm));
    edit.addItem(&item);

    // macOS adds "Emoji & Symbols" again on every menu rebuild; keep only the first one.
    let mut seen = false;
    for i in (0..edit.numberOfItems()).rev() {
        let is_emoji = edit
            .itemAtIndex(i)
            .and_then(|it| it.action())
            .is_some_and(|sel| sel.name().to_bytes() == b"orderFrontCharacterPalette:");
        if is_emoji {
            if seen {
                edit.removeItemAtIndex(i);
            }
            seen = true;
        }
    }
}

/// Shows a contextual menu at (x, y), in CSS pixels of the page (below the button that asked).
/// AppKit adds the Continuity Camera item ("Import from iPhone ›") itself.
#[tauri::command]
pub fn show_iphone_import_menu(window: WebviewWindow, x: f64, y: f64, title: String) -> Result<(), String> {
    let window_for_number = window.clone();
    window
        .with_webview(move |webview| {
            let Some(mtm) = MainThreadMarker::new() else { return };
            let Some(view) = (unsafe { (webview.inner() as *mut NSView).as_ref() }) else { return };
            let Some(ns_window) = window_for_number.ns_window().ok().and_then(|w| unsafe { (w as *mut NSWindow).as_ref() })
            else {
                return;
            };
            // A context menu needs the mouse event it belongs to; make one at the button.
            let location = view.convertPoint_toView(NSPoint::new(x, y), None);
            let Some(event) = NSEvent::mouseEventWithType_location_modifierFlags_timestamp_windowNumber_context_eventNumber_clickCount_pressure(
                NSEventType::RightMouseDown,
                location,
                NSEventModifierFlags::empty(),
                0.0,
                ns_window.windowNumber(),
                None,
                0,
                1,
                1.0,
            ) else {
                return;
            };
            // A disabled heading, so the menu is never empty; AppKit appends the iPhone item.
            let menu = NSMenu::new(mtm);
            let heading = NSMenuItem::new(mtm);
            heading.setTitle(&NSString::from_str(&title));
            heading.setEnabled(false);
            menu.setAutoenablesItems(false);
            menu.addItem(&heading);
            NSMenu::popUpContextMenu_withEvent_forView(&menu, &event, view);
        })
        .map_err(|e| e.to_string())
}

/// macOS adds "Start Dictation…" to the Edit menu on its own, again each time the menu is rebuilt
/// (on a language switch), so it piled up. Turn that off for this app; dictation stays available
/// through its keyboard shortcut.
pub fn suppress_automatic_edit_items() {
    use objc2_foundation::{NSNumber, NSUserDefaults};
    let yes = NSNumber::new_bool(true);
    let key = NSString::from_str("NSDisabledDictationMenuItem");
    let values: [&AnyObject; 1] = [&yes];
    let defaults = NSDictionary::<NSString, AnyObject>::from_slices(&[&*key], &values);
    // Registration domain only: nothing is written to the user's preferences.
    unsafe { NSUserDefaults::standardUserDefaults().registerDefaults(&defaults) };
}

/// macOS adds "Start Dictation…" to the Edit menu on its own, again each time the menu is rebuilt
/// (on a language switch), so it piled up. Turn that off for this app; dictation stays available
/// through its keyboard shortcut.
pub fn suppress_automatic_edit_items() {
    use objc2_foundation::{NSNumber, NSUserDefaults};
    let yes = NSNumber::new_bool(true);
    let key = NSString::from_str("NSDisabledDictationMenuItem");
    let values: [&AnyObject; 1] = [&yes];
    let defaults = NSDictionary::<NSString, AnyObject>::from_slices(&[&*key], &values);
    // Registration domain only: nothing is written to the user's preferences.
    unsafe { NSUserDefaults::standardUserDefaults().registerDefaults(&defaults) };
}

/// DEBUG-TEMP: with VP_DEBUG_CONTINUITY set, log the Edit menu after start.
pub fn debug_probe(window: WebviewWindow) {
    if std::env::var_os("VP_DEBUG_CONTINUITY").is_none() {
        return;
    }
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(6));
        let _ = window.run_on_main_thread(|| {
            let mtm = MainThreadMarker::new().unwrap();
            if let Some(edit) = NSApplication::sharedApplication(mtm).mainMenu().and_then(|m| m.itemAtIndex(1)).and_then(|i| i.submenu()) {
                let titles: Vec<String> = (0..edit.numberOfItems()).filter_map(|k| edit.itemAtIndex(k)).map(|x| format!("{}({})", x.title(), x.isEnabled())).collect();
                eprintln!("DEBUG edit: {titles:?}");
            }
        });
    });
}
