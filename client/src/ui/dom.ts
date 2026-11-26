export function byId<T extends HTMLElement = HTMLElement>(id: string, type?: new () => T): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  if (type && !(element instanceof type)) throw new Error(`#${id} has the wrong element type`);
  return element as T;
}

export function show(element: HTMLElement, visible: boolean): void {
  element.hidden = !visible;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Wires a segmented button group; returns a getter for the selected value. */
export function segmented(container: HTMLElement, onChange?: (value: string) => void): { get(): string; set(value: string): void } {
  const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];
  const set = (value: string): void => {
    for (const b of buttons()) b.classList.toggle('on', b.dataset.value === value);
  };
  container.addEventListener('click', (e) => {
    const button = e.target instanceof HTMLElement ? e.target.closest('button') : null;
    if (!button || button.disabled || !button.dataset.value) return;
    set(button.dataset.value);
    onChange?.(button.dataset.value);
  });
  return {
    get: () => buttons().find((b) => b.classList.contains('on'))?.dataset.value ?? '',
    set,
  };
}
