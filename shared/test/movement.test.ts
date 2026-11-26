import { describe, expect, it } from 'vitest';
import { COMMANDER, MAP, SHIELD } from '../src/config.ts';
import { stepMatch } from '../src/match.ts';
import { neutralInput } from '../src/input.ts';
import { distanceToEdge } from '../src/physics.ts';
import type { CommanderInput, MatchState } from '../src/types.ts';
import { commanderOf, newMatch, place } from './helpers.ts';

const DT = 1 / 60;

function run(state: MatchState, input: CommanderInput, seconds: number, onStep?: () => void): void {
  const inputs = new Map([[0, input]]);
  for (let t = 0; t < seconds; t += DT) {
    stepMatch(state, inputs, DT);
    onStep?.();
  }
}

describe('commander movement', () => {
  it('runs at 6 m/s', () => {
    const state = newMatch();
    const me = place(commanderOf(state, 0), 0, -20);
    run(state, { ...neutralInput(), moveZ: 1 }, 0.5);
    const start = me.pos.z;
    run(state, { ...neutralInput(), moveZ: 1 }, 1);
    expect(me.pos.z - start).toBeCloseTo(COMMANDER.speed, 0);
  });

  it('is slowed to 60 % with the shield up', () => {
    const state = newMatch();
    const me = place(commanderOf(state, 0), 0, -20);
    const input = { ...neutralInput(), moveZ: 1, shield: true };
    run(state, input, 0.5);
    const start = me.pos.z;
    run(state, input, 1);
    expect(me.pos.z - start).toBeCloseTo(COMMANDER.speed * SHIELD.speedFactor, 0);
  });

  it('jumps about 1.2 m high', () => {
    const state = newMatch();
    const me = place(commanderOf(state, 0), 0, -20);
    const ground = me.pos.y;
    let peak = 0;
    run(state, { ...neutralInput(), jump: true }, DT * 2);
    run(state, neutralInput(), 1, () => {
      peak = Math.max(peak, me.pos.y - ground);
    });
    expect(peak).toBeCloseTo(COMMANDER.jumpHeight, 1);
    expect(me.onGround).toBe(true);
  });

  it('cannot leave the map and is told to go back', () => {
    const state = newMatch();
    const me = place(commanderOf(state, 0), MAP.halfSize - 3, 10);
    let pushed = false;
    run(state, { ...neutralInput(), moveX: 1 }, 6, () => {
      if (state.events.some((e) => e.type === 'edgePush' && e.unitId === me.id)) pushed = true;
      expect(distanceToEdge(me.pos.x, me.pos.z)).toBeGreaterThanOrEqual(-MAP.edgeHardOvershoot);
    });
    expect(pushed).toBe(true);
  });

  it('is pushed back inside when standing past the edge', () => {
    const state = newMatch();
    const me = place(commanderOf(state, 0), -(MAP.halfSize + 0.8), 0);
    run(state, neutralInput(), 0.5);
    expect(me.pos.x).toBeGreaterThan(-MAP.halfSize);
  });
});

describe('crowds', () => {
  it('make way for their own commander', async () => {
    const { firstOfKind, soldiersOf } = await import('./helpers.ts');
    const state = newMatch({ armies: [{ name: 'A', team: 0, isBot: false }, { name: 'B', team: 1, isBot: false }] });
    const me = place(commanderOf(state, 0), -70, 0, Math.PI / 2);
    // Pack the swordsmen tightly right in front of the commander.
    soldiersOf(state, 0).filter((u) => u.kind === 'swordsman').forEach((u, i) => place(u, -68 + (i % 2) * 0.9, (Math.floor(i / 2) - 1.5) * 0.9));
    void firstOfKind;
    run(state, { ...neutralInput(Math.PI / 2), moveX: 1 }, 1.5);
    expect(me.pos.x).toBeGreaterThan(-63);
  });
});
