/** Third person (behind the commander) or first person (through their eyes). Remembered between visits. */
export type ViewMode = 'third' | 'first';

const VIEW_STORAGE_KEY = 'tumblehorde.view';

export function readViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'first' ? 'first' : 'third';
  } catch {
    return 'third';
  }
}

export function storeViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, mode);
  } catch {
    // Private mode: the choice is simply not remembered.
  }
}
