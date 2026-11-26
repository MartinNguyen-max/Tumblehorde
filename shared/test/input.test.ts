import { describe, expect, it } from 'vitest';
import { sanitizeCommand, sanitizeInput } from '../src/input.ts';

describe('sanitizeInput', () => {
  it('accepts well-formed input', () => {
    expect(sanitizeInput({ moveX: 0.5, moveZ: 0, faceYaw: 1, jump: true, attack: false, shield: false })).toEqual({
      moveX: 0.5, moveZ: 0, faceYaw: 1, jump: true, attack: false, shield: false,
    });
  });

  it('clamps over-long movement so nobody runs faster', () => {
    const input = sanitizeInput({ moveX: 30, moveZ: 40, faceYaw: 0 });
    expect(Math.hypot(input!.moveX, input!.moveZ)).toBeCloseTo(1);
  });

  it.each([null, 'x', 4, [], { moveX: 'a', moveZ: 0, faceYaw: 0 }, { moveX: NaN, moveZ: 0, faceYaw: 0 }, { moveX: 0, moveZ: Infinity, faceYaw: 0 }])(
    'rejects %j',
    (raw) => expect(sanitizeInput(raw)).toBeNull(),
  );

  it('treats non-true flags as false', () => {
    expect(sanitizeInput({ moveX: 0, moveZ: 0, faceYaw: 0, attack: 'yes' })?.attack).toBe(false);
  });
});

describe('sanitizeCommand', () => {
  it('accepts orders, splits and mount toggles', () => {
    expect(sanitizeCommand({ type: 'order', order: 'attack', group: null })).toEqual({ type: 'order', order: 'attack', group: null });
    expect(sanitizeCommand({ type: 'order', order: 'hold', group: 2 })).toEqual({ type: 'order', order: 'hold', group: 2 });
    expect(sanitizeCommand({ type: 'split', groupCount: 3 })).toEqual({ type: 'split', groupCount: 3 });
    expect(sanitizeCommand({ type: 'mount' })).toEqual({ type: 'mount' });
  });

  it.each([
    { type: 'order', order: 'dance', group: null },
    { type: 'order', order: 'attack', group: 7 },
    { type: 'order', order: 'attack', group: 1.5 },
    { type: 'split', groupCount: 0 },
    { type: 'split', groupCount: 4 },
    { type: 'nuke' },
    null,
  ])('rejects %j', (raw) => expect(sanitizeCommand(raw)).toBeNull());
});
