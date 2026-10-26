//! Reads the text of a scan, photo or PDF on macOS, offline, so the frontend can suggest the dates
//! and document number. A PDF with a text layer is read as is; otherwise its first page, or the
//! image, goes through Vision's text recognition.

use objc2::rc::Retained;
use objc2::AllocAnyThread;
use objc2_app_kit::NSImage;
use objc2_foundation::{NSArray, NSDictionary, NSSize, NSString, NSURL};
use objc2_pdf_kit::{PDFDisplayBox, PDFDocument};
use objc2_vision::{VNImageRequestHandler, VNRecognizeTextRequest, VNRequest, VNRequestTextRecognitionLevel};

/// Below this many characters a PDF's text layer is taken to be empty (a scan without OCR).
const MIN_TEXT_LAYER: usize = 20;
/// Long side of the rendered first page of a scanned PDF; enough for small print.
const RENDER_SIZE: f64 = 2400.0;

/// The text lines of the file at `path`, top to bottom.
#[tauri::command]
pub async fn recognize_document_text(path: String) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || recognize(&path))
        .await
        .map_err(|e| e.to_string())?
}

fn recognize(path: &str) -> Result<Vec<String>, String> {
    let url = NSURL::fileURLWithPath(&NSString::from_str(path));
    let image: Retained<NSImage> = if path.to_ascii_lowercase().ends_with(".pdf") {
        let document = unsafe { PDFDocument::initWithURL(PDFDocument::alloc(), &url) }.ok_or("unreadable PDF")?;
        let page = unsafe { document.pageAtIndex(0) }.ok_or("PDF without pages")?;
        if let Some(text) = unsafe { page.string() }.map(|t| t.to_string()) {
            if text.trim().len() >= MIN_TEXT_LAYER {
                return Ok(text.lines().map(str::trim).filter(|l| !l.is_empty()).map(str::to_owned).collect());
            }
        }
        unsafe { page.thumbnailOfSize_forBox(NSSize::new(RENDER_SIZE, RENDER_SIZE), PDFDisplayBox::MediaBox) }
    } else {
        NSImage::initWithContentsOfURL(NSImage::alloc(), &url).ok_or("unreadable image")?
    };
    let cg_image = unsafe { image.CGImageForProposedRect_context_hints(std::ptr::null_mut(), None, None) }
        .ok_or("could not read the image")?;

    let request = VNRecognizeTextRequest::new();
    request.setRecognitionLevel(VNRequestTextRecognitionLevel::Accurate);
    request.setUsesLanguageCorrection(true);
    request.setAutomaticallyDetectsLanguage(true);
    let handler = unsafe { VNImageRequestHandler::initWithCGImage_options(VNImageRequestHandler::alloc(), &cg_image, &NSDictionary::new()) };
    let as_request: &VNRequest = &request;
    handler
        .performRequests_error(&NSArray::from_slice(&[as_request]))
        .map_err(|e| e.localizedDescription().to_string())?;

    // Vision's coordinates start bottom left: sort top to bottom, then left to right.
    let mut lines: Vec<(f64, f64, String)> = Vec::new();
    for observation in request.results().map(|r| r.to_vec()).unwrap_or_default() {
        let bounds = unsafe { observation.boundingBox() };
        if let Some(best) = observation.topCandidates(1).firstObject() {
            lines.push((bounds.origin.y + bounds.size.height, bounds.origin.x, best.string().to_string()));
        }
    }
    lines.sort_by(|a, b| b.0.total_cmp(&a.0).then(a.1.total_cmp(&b.1)));
    Ok(lines.into_iter().map(|(_, _, text)| text).collect())
}

#[cfg(test)]
mod tests {
    /// Manual check on a real file: `OCR_FILE=/path/scan.pdf cargo test --lib ocr -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn recognizes_a_file() {
        let path = std::env::var("OCR_FILE").expect("set OCR_FILE");
        let lines = super::recognize(&path).expect("recognition");
        println!("{}", lines.join("\n"));
        assert!(!lines.is_empty());
    }
}
