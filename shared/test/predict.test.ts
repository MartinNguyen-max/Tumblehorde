import { describe, expect, it } from 'vitest';
import { neutralInput } from '../src/input.ts';
import { stepMatch } from '../src/match.ts';
import { predictCommanderStep } from '../src/predict.ts';
import { commanderOf, newMatch, place } from './helpers.ts';

const DT = 1 / 20;

describe('client prediction', () => {
  it('moves the commander exactly like the server when nothing is in the way', () => {
    const server = newMatch({ armies: [{ name: 'A', team: 0, isBot: false }, { name: 'B', team: 1, isBot: false }] });
    const serverMe = place(commanderOf(server, 0), 0, -30, 0);
    const predicted = { ...serverMe, pos: { ...serverMe.pos }, vel: { ...serverMe.vel }, intent: { ...serverMe.intent }, ai: { ...serverMe.ai } };
    const inputs = [
      { ...neutralInput(), moveZ: 1 },
      { ...neutralInput(), moveZ: 1, jump: true },
      { ...neutralInput(), moveX: 1, faceYaw: 1 },
      { ...neutralInput(), moveX: -0.5, moveZ: 0.5, shield: true },
    ];
    for (let i = 0; i < 60; i++) {
      const input = inputs[Math.floor(i / 15)] ?? neutralInput();
      stepMatch(server, new Map([[0, input]]), DT);
      predictCommanderStep(predicted, input, DT, 'meadow');
    }
    expect(predicted.pos.x).toBeCloseTo(serverMe.pos.x, 5);
    expect(predicted.pos.y).toBeCloseTo(serverMe.pos.y, 5);
    expect(predicted.pos.z).toBeCloseTo(serverMe.pos.z, 5);
    expect(predicted.yaw).toBeCloseTo(serverMe.yaw, 5);
  });

  it('does nothing for a dead commander', () => {
    const state = newMatch();
    const me = commanderOf(state, 0);
    me.alive = false;
    const before = { ...me.pos };
    predictCommanderStep(me, { ...neutralInput(), moveX: 1 }, DT, 'meadow');
    expect(me.pos).toEqual(before);
  });
});
