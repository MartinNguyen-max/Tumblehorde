import { describe, expect, it } from 'vitest';
import { MATCH } from '../src/config.ts';
import { matchDuration, setArmyConnected, stepMatch } from '../src/match.ts';
import { createMatch, defaultSettings } from '../src/setup.ts';
import type { MatchSettings, MatchState } from '../src/types.ts';
import { commanderOf } from './helpers.ts';

const DT = 1 / 30;

function playOut(state: MatchState, maxSeconds: number): void {
  const none = new Map();
  for (let t = 0; t < maxSeconds && state.phase !== 'over'; t += DT) stepMatch(state, none, DT);
}

function bots(count: number, mode: MatchSettings['mode'], teams: number[] = []): MatchState {
  return createMatch(
    defaultSettings({
      mode,
      armySize: 10,
      armies: Array.from({ length: count }, (_, i) => ({ name: `Bot ${i}`, team: teams[i] ?? i, isBot: true })),
    }),
  );
}

describe('a full battle', () => {
  it('two bot armies fight until one side wins', () => {
    const state = bots(2, 'ffa');
    playOut(state, 400);
    expect(state.phase).toBe('over');
    const standing = state.armies.filter((a) => !a.eliminated);
    expect(standing.length).toBeLessThanOrEqual(1);
    const totalKills = state.armies.reduce((sum, a) => sum + a.stats.kills, 0);
    expect(totalKills).toBeGreaterThan(5);
  });

  it('a four-army free-for-all ends with one survivor', () => {
    const state = bots(4, 'ffa');
    playOut(state, 600);
    expect(state.phase).toBe('over');
    expect(state.armies.filter((a) => !a.eliminated).length).toBeLessThanOrEqual(1);
  });

  it('in team mode allies never fight each other and one team wins', () => {
    const state = bots(4, 'teams', [0, 1, 0, 1]);
    playOut(state, 600);
    expect(state.phase).toBe('over');
    const winners = new Set(state.armies.filter((a) => !a.eliminated).map((a) => a.team));
    expect(winners.size).toBeLessThanOrEqual(1);
    if (state.winnerTeam !== null) expect(winners.has(state.winnerTeam)).toBe(true);
  });

  it('bot commanders give orders at most every 5 seconds', () => {
    const state = bots(2, 'ffa');
    const orderTimes: number[] = [];
    const none = new Map();
    for (let t = 0; t < 60 && state.phase === 'playing'; t += DT) {
      stepMatch(state, none, DT);
      if (state.events.some((e) => (e.type === 'order' || e.type === 'split') && e.armyId === 0)) orderTimes.push(state.time);
    }
    const moments = orderTimes.filter((t, i) => i === 0 || t - (orderTimes[i - 1] ?? 0) > 0.001);
    for (let i = 1; i < moments.length; i++) expect(moments[i]! - moments[i - 1]!).toBeGreaterThanOrEqual(4.99);
    expect(moments.length).toBeGreaterThan(0);
  });

  it('freezes the duration once the battle is decided', () => {
    const state = bots(2, 'ffa');
    playOut(state, 400);
    const duration = matchDuration(state);
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThanOrEqual(state.time);
  });
});

describe('disconnects', () => {
  function humans(): MatchState {
    return createMatch(defaultSettings({ armies: [
      { name: 'A', team: 0, isBot: false },
      { name: 'B', team: 1, isBot: false },
    ] }));
  }

  it('kill the army after 30 seconds', () => {
    const state = humans();
    setArmyConnected(state, 1, false);
    const none = new Map();
    for (let t = 0; t < MATCH.disconnectTimeout - 1; t += DT) stepMatch(state, none, DT);
    expect(state.armies[1]?.eliminated).toBe(false);
    for (let t = 0; t < 2; t += DT) stepMatch(state, none, DT);
    expect(state.armies[1]?.eliminated).toBe(true);
    expect(commanderOf(state, 1).alive).toBe(false);
    expect(state.winnerTeam).toBe(0);
  });

  it('are forgiven when the player returns in time', () => {
    const state = humans();
    setArmyConnected(state, 1, false);
    const none = new Map();
    for (let t = 0; t < 10; t += DT) stepMatch(state, none, DT);
    setArmyConnected(state, 1, true);
    for (let t = 0; t < 30; t += DT) stepMatch(state, none, DT);
    expect(state.armies[1]?.eliminated).toBe(false);
  });
});
