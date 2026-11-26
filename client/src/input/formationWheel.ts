import type { Formation } from '@tumblehorde/shared';
import { FORMATION_WHEEL } from '../visualConfig.ts';

export interface WheelOption {
  formation: Formation;
  label: string;
  /** Screen direction of the option from the wheel's center (y grows downwards). */
  dirX: number;
  dirY: number;
}

const SIN_60 = Math.sqrt(3) / 2;

/** Six formations around the wheel, clockwise from the top left. */
export const WHEEL_OPTIONS: readonly WheelOption[] = [
  { formation: 'line', label: 'Long line', dirX: -SIN_60, dirY: -0.5 },
  { formation: 'double', label: 'Two lines', dirX: 0, dirY: -1 },
  { formation: 'wedge', label: 'Wedge', dirX: SIN_60, dirY: -0.5 },
  { formation: 'circle', label: 'Circle around me', dirX: SIN_60, dirY: 0.5 },
  { formation: 'square', label: 'Testudo block', dirX: 0, dirY: 1 },
  { formation: 'column', label: 'Column', dirX: -SIN_60, dirY: 0.5 },
];

export const FORMATION_LABEL: Record<Formation, string> = {
  line: 'Long line',
  double: 'Two lines',
  circle: 'Circle',
  wedge: 'Wedge',
  column: 'Column',
  square: 'Testudo',
};

/** The option the cursor points at, or null inside the dead zone or when pointing away from all of them. */
export function wheelChoice(x: number, y: number): Formation | null {
  const length = Math.hypot(x, y);
  if (length < FORMATION_WHEEL.deadzone) return null;
  let best: WheelOption | null = null;
  let bestDot: number = FORMATION_WHEEL.minAlignment;
  for (const option of WHEEL_OPTIONS) {
    const dot = (x * option.dirX + y * option.dirY) / length;
    if (dot > bestDot) {
      best = option;
      bestDot = dot;
    }
  }
  return best?.formation ?? null;
}

/**
 * Tap `2` to hold in the current formation; keep it down and the wheel opens, the mouse
 * points at a formation, and releasing `2` (or clicking) picks it.
 */
export class FormationWheel {
  private heldFor = 0;
  private active = false;
  x = 0;
  y = 0;

  get isOpen(): boolean {
    return this.active && this.heldFor >= FORMATION_WHEEL.openDelay;
  }

  get isPressed(): boolean {
    return this.active;
  }

  get choice(): Formation | null {
    return this.isOpen ? wheelChoice(this.x, this.y) : null;
  }

  press(): void {
    this.active = true;
    this.heldFor = 0;
    this.x = 0;
    this.y = 0;
  }

  tick(dt: number): void {
    if (this.active) this.heldFor += dt;
  }

  /** Mouse movement steers the cursor while the wheel is open; it stays inside the ring. */
  move(dx: number, dy: number): void {
    const x = this.x + dx;
    const y = this.y + dy;
    const length = Math.hypot(x, y);
    const scale = length > FORMATION_WHEEL.radius ? FORMATION_WHEEL.radius / length : 1;
    this.x = x * scale;
    this.y = y * scale;
  }

  /** Closes the wheel and returns what was picked (null: just hold in the current formation). */
  release(): Formation | null {
    const picked = this.choice;
    this.active = false;
    this.heldFor = 0;
    return picked;
  }

  cancel(): void {
    this.active = false;
    this.heldFor = 0;
  }
}
