/** Keys that act once per press rather than while held. */
const PRESS_KEYS = new Set(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'KeyF', 'KeyR', 'KeyE', 'KeyV', 'KeyQ']);

/** Raw keyboard and mouse state for the game, with pointer lock for mouse look. */
export class InputState {
  private readonly held = new Set<string>();
  private readonly pressed: string[] = [];
  private readonly released: string[] = [];
  mouseLeft = false;
  mouseRight = false;
  private lookX = 0;
  private lookY = 0;
  private wheel = 0;
  private canvas: HTMLCanvasElement | null = null;
  onPointerLockChange: ((locked: boolean) => void) | null = null;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (isTyping(e)) return;
    // Ctrl is crouch: keep Ctrl+key browser shortcuts from firing mid-battle (Ctrl+W cannot be stopped).
    if (PRESS_KEYS.has(e.code) || e.code === 'Space' || (e.ctrlKey && this.isLocked())) e.preventDefault();
    if (!e.repeat && PRESS_KEYS.has(e.code)) this.pressed.push(e.code);
    this.held.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (PRESS_KEYS.has(e.code) && this.held.has(e.code)) this.released.push(e.code);
    this.held.delete(e.code);
  };
  private readonly onMouseDown = (e: MouseEvent): void => {
    if (!this.isLocked()) return;
    if (e.button === 0) this.mouseLeft = true;
    if (e.button === 2) this.mouseRight = true;
  };
  private readonly onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseLeft = false;
    if (e.button === 2) this.mouseRight = false;
  };
  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.isLocked()) return;
    this.lookX += e.movementX;
    this.lookY += e.movementY;
  };
  private readonly onWheel = (e: WheelEvent): void => {
    this.wheel += e.deltaY;
  };
  private readonly onContextMenu = (e: Event): void => e.preventDefault();
  private readonly onLockChange = (): void => {
    if (!this.isLocked()) this.releaseAll();
    this.onPointerLockChange?.(this.isLocked());
  };
  private readonly onBlur = (): void => this.releaseAll();

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('wheel', this.onWheel, { passive: true });
    canvas.addEventListener('contextmenu', this.onContextMenu);
    document.addEventListener('pointerlockchange', this.onLockChange);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('blur', this.onBlur);
    this.canvas?.removeEventListener('wheel', this.onWheel);
    this.canvas?.removeEventListener('contextmenu', this.onContextMenu);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    this.releaseAll();
  }

  requestLock(): void {
    if (!this.canvas || this.isLocked()) return;
    const request = this.canvas.requestPointerLock() as unknown;
    if (request instanceof Promise) request.catch(() => undefined);
  }

  exitLock(): void {
    if (this.isLocked()) document.exitPointerLock();
  }

  isLocked(): boolean {
    return this.canvas !== null && document.pointerLockElement === this.canvas;
  }

  isHeld(code: string): boolean {
    return this.held.has(code);
  }

  takePressed(): string[] {
    return this.pressed.splice(0, this.pressed.length);
  }

  takeReleased(): string[] {
    return this.released.splice(0, this.released.length);
  }

  takeLook(): { x: number; y: number } {
    const look = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return look;
  }

  takeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  private releaseAll(): void {
    this.held.clear();
    this.mouseLeft = false;
    this.mouseRight = false;
    this.pressed.length = 0;
    this.released.length = 0;
  }
}

function isTyping(e: KeyboardEvent): boolean {
  const target = e.target;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}
