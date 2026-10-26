import { useEffect, useState } from "react";
import { t } from "../i18n";
import type { DocumentFile } from "../lib/domain/types";
import { previewKind, previewUrl } from "../lib/files";

interface DocumentPreviewProps {
  file: DocumentFile | null;
  size: "thumb" | "large";
  /** Thumbnails only: how many more files the version has ("+2"). */
  more?: number;
  /** Large previews open the document when clicked, like the Open button. */
  onOpen?: () => void;
}

/**
 * The stored scan, photo or PDF. Images show as is; a PDF shows its first page where the web
 * engine can draw PDFs as images (WebKit on macOS), else a PDF placeholder.
 */
export function DocumentPreview({ file, size, more = 0, onOpen }: DocumentPreviewProps) {
  const path = file?.file_path ?? null;
  const kind = previewKind(path);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    if (path && kind) {
      previewUrl(path)
        .then((url) => !cancelled && setSrc(url))
        .catch(() => !cancelled && setFailed(true));
    }
    return () => {
      cancelled = true;
    };
  }, [path, kind]);

  const content =
    src && !failed ? (
      <img src={src} alt="" draggable={false} onError={() => setFailed(true)} />
    ) : (
      <span className="preview-placeholder">
        <FileIcon label={kind === "pdf" ? "PDF" : undefined} />
        {size === "large" && <span>{path ? t.preview.noPreview : t.preview.noFile}</span>}
      </span>
    );

  if (size === "large" && path && onOpen) {
    return (
      <button type="button" className={`preview preview-${size}`} onClick={onOpen} title={t.preview.clickToOpen}>
        {content}
        <span className="preview-hint">{t.preview.clickToOpen}</span>
      </button>
    );
  }
  return (
    <div className={`preview preview-${size}${path ? "" : " preview-empty"}`}>
      {content}
      {more > 0 && <span className="preview-more">+{more}</span>}
    </div>
  );
}

function FileIcon({ label }: { label?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      {label && (
        <text x="12" y="17" textAnchor="middle" fontSize="5" fontWeight="700" fill="currentColor" stroke="none">
          {label}
        </text>
      )}
    </svg>
  );
}
