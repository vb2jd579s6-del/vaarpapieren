import { flushSync } from "react-dom";

/** Shared name of the card and the enlarged panel, so the browser morphs one into the other. */
export const EXPAND_TRANSITION = "doc-expand";

type StartViewTransition = (update: () => void) => { finished: Promise<void> };

/**
 * Runs a React state change as a View Transition (an animated morph between before and after),
 * where the web engine supports it; otherwise just applies it.
 */
export function withViewTransition(update: () => void): Promise<void> {
  const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition;
  if (!start || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update();
    return Promise.resolve();
  }
  return start.call(document, () => flushSync(update)).finished.catch(() => {});
}
