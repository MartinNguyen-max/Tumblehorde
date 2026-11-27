import { describe, expect, it } from 'vitest';
import { enemyArmyToFight } from '../src/bot.ts';
import { applyHit, resolveMelee, startMelee } from '../src/combat.ts';
import { DUEL, MAP, MATCH, RALLY, SWORDSMAN } from '../src/config.ts';
import { pickTarget } from '../src/duel.ts';
import { neutralInput } from '../src/input.ts';
import { stepMatch } from '../src/match.ts';
import { distanceXZ, dirToYaw, yawToDir } from '../src/math.ts';
import { applyCommand, roomToAdvance } from '../src/orders.ts';
import { armySpawn } from '../src/spawn.ts';
import { terrainHeightAt } from '../src/terrain.ts';
import type { MatchState, Unit } from '../src/types.ts';
import { commanderOf, killAllBut, newMatch, place, soldiersOf } from './helpers.ts';

const DT = 1 / 30;

function run(state: MatchState, seconds: number, onStep?: () => void): void {
  const inputs = new Map([[0, neutralInput()]]);
  for (let t = 0; t < seconds; t += DT) {
    stepMatch(state, inputs, DT);
    onStep?.();
  }
}

function twoPlayers(): MatchState {
  return newMatch({ armySize: 15, armies: [{ name: 'You', team: 0, isBot: false }, { name: 'Them', team: 1, isBot: false }] });
}

function hit(state: MatchState, target: Unit, attacker: Unit, damage = 10): void {
  const dir = { x: target.pos.x - attacker.pos.x, z: target.pos.z - attacker.pos.z };
  const len = Math.hypot(dir.x, dir.z) || 1;
  applyHit(state, target, { attacker, armyId: attacker.armyId, from: attacker.pos, pushDir: { x: dir.x / len, z: dir.z / len } }, damage, { strength: 0, stun: 0 });
}

describe('soldiers defend themselves', () => {
  it('a soldier in a held line turns round on an enemy at its back and fights back', () => {
    const state = twoPlayers();
    const me = place(commanderOf(state, 0), -40, 0, Math.PI / 2);
    const soldier = soldiersOf(state, 0)[0]!;
    const enemy = soldiersOf(state, 1)[0]!;
    killAllBut(state, [me, soldier, enemy, commanderOf(state, 1)]);
    place(commanderOf(state, 1), 60, 60);
    applyCommand(state, 0, { type: 'order', order: 'hold', group: null });
    run(state, 3);
    // The enemy comes from behind the line.
    const back = yawToDir(soldier.yaw + Math.PI);
    place(enemy, soldier.pos.x + back.x * 1.8, soldier.pos.z + back.z * 1.8, dirToYaw(-back.x, -back.z));
    hit(state, soldier, enemy);
    const hpBefore = enemy.hp;
    run(state, 3, () => {
      enemy.intent.moveX = 0;
      enemy.intent.moveZ = 0;
    });
    expect(enemy.hp).toBeLessThan(hpBefore);
  });

  it('a following soldier goes for whoever hurt them, whatever the order', () => {
    const state = twoPlayers();
    const me = place(commanderOf(state, 0), -40, 0, Math.PI / 2);
    const soldier = place(soldiersOf(state, 0)[0]!, -44, 0, Math.PI / 2);
    const enemy = place(soldiersOf(state, 1)[0]!, -44, -5);
    killAllBut(state, [me, soldier, enemy, commanderOf(state, 1)]);
    place(commanderOf(state, 1), 60, 60);
    applyCommand(state, 0, { type: 'order', order: 'follow', group: null });
    hit(state, soldier, enemy);
    run(state, 0.5);
    expect(soldier.ai.targetId).toBe(enemy.id);
  });
});

describe('picking a target', () => {
  it('prefers an enemy who just hurt them, then one with its back turned', () => {
    const state = twoPlayers();
    const soldier = place(soldiersOf(state, 0)[0]!, 0, 0, 0);
    const [near, far, turned] = soldiersOf(state, 1);
    place(near!, 0, 3, Math.PI);
    place(far!, 0, 9, Math.PI);
    expect(pickTarget(state, soldier, 20)?.id).toBe(near!.id);
    hit(state, soldier, far!);
    expect(pickTarget(state, soldier, 20)?.id).toBe(far!.id);
    // A turned back a little further away beats a face right in front.
    const fresh = twoPlayers();
    const s = place(soldiersOf(fresh, 0)[0]!, 0, 0, 0);
    const [face, back] = soldiersOf(fresh, 1);
    place(face!, 0, 3, Math.PI);
    place(back!, 3, 4, 0);
    expect(pickTarget(fresh, s, 20)?.id).toBe(back!.id);
  });

  it('spreads out instead of piling everyone onto one enemy', () => {
    const state = twoPlayers();
    const mine = soldiersOf(state, 0).slice(0, 8);
    const foes = soldiersOf(state, 1).slice(0, 3);
    killAllBut(state, [...mine, ...foes, commanderOf(state, 0), commanderOf(state, 1)]);
    place(commanderOf(state, 0), -60, -60);
    place(commanderOf(state, 1), 60, 60);
    mine.forEach((s, i) => place(s, -6, -4 + i, Math.PI / 2));
    foes.forEach((f, i) => place(f, 6, -3 + i * 3, -Math.PI / 2));
    applyCommand(state, 0, { type: 'order', order: 'attack', group: null });
    run(state, 1);
    const counts = foes.map((f) => mine.filter((s) => s.ai.targetId === f.id).length);
    expect(Math.max(...counts)).toBeLessThanOrEqual(DUEL.crowdFree + 2);
    expect(counts.filter((c) => c > 0).length).toBeGreaterThanOrEqual(2);
  });
});

describe('a fight that looks like a fight', () => {
  it('two swordsmen keep a sword length apart, circle and trade blows', () => {
    const state = twoPlayers();
    const a = place(soldiersOf(state, 0)[0]!, -3, 0, Math.PI / 2);
    const b = place(soldiersOf(state, 1)[0]!, 3, 0, -Math.PI / 2);
    killAllBut(state, [a, b, commanderOf(state, 0), commanderOf(state, 1)]);
    place(commanderOf(state, 0), -60, -60);
    place(commanderOf(state, 1), 60, 60);
    applyCommand(state, 0, { type: 'order', order: 'attack', group: null });
    applyCommand(state, 1, { type: 'order', order: 'attack', group: null });
    const distances: number[] = [];
    let angle = 0;
    let lastBearing = dirToYaw(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
    let swings = 0;
    run(state, 8, () => {
      if (!a.alive || !b.alive) return;
      distances.push(distanceXZ(a.pos, b.pos));
      const bearing = dirToYaw(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
      angle += Math.abs(Math.atan2(Math.sin(bearing - lastBearing), Math.cos(bearing - lastBearing)));
      lastBearing = bearing;
      swings += state.events.filter((e) => e.type === 'swing').length;
    });
    const average = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    expect(average).toBeGreaterThan(1.3);
    expect(angle).toBeGreaterThan(Math.PI / 2);
    expect(swings).toBeGreaterThan(4);
  });

  it('dodges some blows by hopping out of the way', () => {
    const state = twoPlayers();
    const mine = soldiersOf(state, 0).slice(0, 6);
    const foes = soldiersOf(state, 1).slice(0, 6);
    killAllBut(state, [...mine, ...foes, commanderOf(state, 0), commanderOf(state, 1)]);
    place(commanderOf(state, 0), -60, -60);
    place(commanderOf(state, 1), 60, 60);
    mine.forEach((s, i) => place(s, -3, i * 2, Math.PI / 2));
    foes.forEach((f, i) => place(f, 3, i * 2, -Math.PI / 2));
    applyCommand(state, 0, { type: 'order', order: 'attack', group: null });
    applyCommand(state, 1, { type: 'order', order: 'attack', group: null });
    let dodges = 0;
    run(state, 10, () => {
      dodges += [...mine, ...foes].filter((u) => u.alive && u.ai.dodgeTimer >= DUEL.dodgeTime - 1e-6).length;
    });
    expect(dodges).toBeGreaterThan(0);
  });

  it('a blocked blow opens a quick counter', () => {
    const state = twoPlayers();
    const defender = place(soldiersOf(state, 0)[0]!, 0, 0, 0);
    const attacker = place(soldiersOf(state, 1)[0]!, 0, 1.5, Math.PI);
    defender.shieldUp = true;
    defender.cooldownTimer = SWORDSMAN.melee.cooldown;
    hit(state, defender, attacker);
    expect(defender.cooldownTimer).toBeLessThanOrEqual(DUEL.counterCooldown);
  });

  it('a shield bash knocks a raised shield aside', () => {
    const state = twoPlayers();
    const basher = place(soldiersOf(state, 0)[0]!, 0, 0, 0);
    const hider = place(soldiersOf(state, 1)[0]!, 0, 1.2, Math.PI);
    basher.weapon = 'sword';
    hider.shieldUp = true;
    hider.intent.shield = true;
    basher.ai.bashNext = true;
    expect(startMelee(state, basher)).toBe(true);
    expect(state.events.some((e) => e.type === 'swing' && e.bash === true)).toBe(true);
    resolveMelee(state, basher);
    expect(hider.stunTimer).toBeGreaterThan(0);
    expect(state.events.some((e) => e.type === 'hit' && e.targetId === hider.id && !e.blocked)).toBe(true);
  });
});

describe('rally', () => {
  it('gives courage for a while: harder blows and steadier feet', () => {
    const state = twoPlayers();
    const army = state.armies[0]!;
    const mine = place(soldiersOf(state, 0)[0]!, 0, 0, 0);
    const theirs = place(soldiersOf(state, 1)[0]!, 0, 1.5, Math.PI);
    hit(state, theirs, mine, 20);
    const plain = theirs.maxHp - theirs.hp;
    theirs.hp = theirs.maxHp;
    expect(applyCommand(state, 0, { type: 'rally' })).toBe(true);
    expect(army.courageTimer).toBe(RALLY.courageTime);
    hit(state, theirs, mine, 20);
    expect(theirs.maxHp - theirs.hp).toBeCloseTo(plain * RALLY.damageFactor);
    // Not overpowering, and not again straight away.
    expect(RALLY.damageFactor).toBeLessThan(1.3);
    expect(applyCommand(state, 0, { type: 'rally' })).toBe(false);
    expect(state.events.some((e) => e.type === 'refused' && e.reason === 'rallyResting')).toBe(true);
    run(state, RALLY.courageTime + 0.1);
    expect(army.courageTimer).toBe(0);
  });
});

describe('advance', () => {
  it('stops at the enemy line instead of marching through it', () => {
    const state = twoPlayers();
    const me = place(commanderOf(state, 0), 0, 0, Math.PI / 2);
    applyCommand(state, 0, { type: 'order', order: 'hold', group: null });
    const order = state.armies[0]!.groupOrders[0]!;
    soldiersOf(state, 1).forEach((f, i) => place(f, 6, -4 + i * 0.6, -Math.PI / 2));
    const room = roomToAdvance(state, state.armies[0]!, order, { x: 1, z: 0 });
    expect(room).toBeLessThan(2);
    const anchorBefore = { ...order.anchor };
    applyCommand(state, 0, { type: 'advance', group: null });
    applyCommand(state, 0, { type: 'advance', group: null });
    applyCommand(state, 0, { type: 'advance', group: null });
    expect(order.anchor.x - anchorBefore.x).toBeLessThan(2);
    expect(state.events.some((e) => e.type === 'refused' && e.reason === 'enemyAhead')).toBe(true);
    expect(me.alive).toBe(true);
  });
});

describe('bot armies', () => {
  it('turn on the army that hurts them, even when another is nearer', () => {
    const state = newMatch({
      armySize: 15,
      armies: [
        { name: 'You', team: 0, isBot: false },
        { name: 'Red', team: 1, isBot: true },
        { name: 'Green', team: 2, isBot: true },
      ],
    });
    const red = state.armies[1]!;
    soldiersOf(state, 1).forEach((s, i) => place(s, 0, i * 0.8));
    soldiersOf(state, 2).forEach((s, i) => place(s, 15, i * 0.8));
    soldiersOf(state, 0).forEach((s, i) => place(s, -40, i * 0.8));
    place(commanderOf(state, 0), -40, -3);
    expect(enemyArmyToFight(state, red, { x: 0, z: 5 })?.center.x).toBeGreaterThan(0);
    for (const victim of soldiersOf(state, 1).slice(0, 4)) hit(state, victim, commanderOf(state, 0), 100);
    expect(enemyArmyToFight(state, red, { x: 0, z: 5 })?.center.x).toBeLessThan(0);
  });
});

describe('team battles', () => {
  it('team mates start next to each other', () => {
    const armies = [
      { name: 'A', team: 0, isBot: false },
      { name: 'B', team: 1, isBot: true },
      { name: 'C', team: 0, isBot: true },
      { name: 'D', team: 1, isBot: true },
    ];
    const meadow = (i: number) => armySpawn({ map: 'meadow', mode: 'teams', armies }, i).position;
    expect(distanceXZ(meadow(0), meadow(2))).toBeLessThan(distanceXZ(meadow(0), meadow(1)));
    expect(distanceXZ(meadow(0), meadow(2))).toBeLessThan(distanceXZ(meadow(0), meadow(3)));
    expect(distanceXZ(meadow(1), meadow(3))).toBeLessThan(distanceXZ(meadow(1), meadow(2)));
    // The city has four avenue ends: team mates take two neighbouring ones, never opposite ends.
    const city = (i: number) => armySpawn({ map: 'city', mode: 'teams', armies }, i).position;
    expect(distanceXZ(city(0), city(2))).toBeLessThan(distanceXZ(city(0), city(1)));
    expect(distanceXZ(city(1), city(3))).toBeLessThan(distanceXZ(city(1), city(0)));
    expect(MAP.teamSpawnSpread).toBeGreaterThan(0);
  });

  it('three team mates in the city each get their own avenue end', () => {
    const three = [0, 0, 1, 0].map((team, i) => ({ name: `A${i}`, team, isBot: true }));
    const ends = three.map((_, i) => armySpawn({ map: 'city', mode: 'teams', armies: three }, i).position);
    const distinct = new Set(ends.map((p) => `${p.x},${p.z}`));
    expect(distinct.size).toBe(4);
  });
});

describe('after the battle', () => {
  it('the winners celebrate, jumping about, before the results', () => {
    const state = twoPlayers();
    const mine = soldiersOf(state, 0);
    place(commanderOf(state, 0), 0, 0);
    mine.forEach((s, i) => place(s, -4 + (i % 5) * 2, 3 + Math.floor(i / 5) * 2));
    for (const unit of [...soldiersOf(state, 1), commanderOf(state, 1)]) {
      unit.alive = false;
      unit.hp = 0;
    }
    let jumps = 0;
    let steps = 0;
    run(state, MATCH.endDelay + 0.5, () => {
      if (state.phase === 'ending') steps++;
      jumps += mine.filter((s) => s.pos.y > terrainHeightAt('meadow', s.pos.x, s.pos.z) + 0.3).length;
    });
    expect(state.phase).toBe('over');
    expect(steps * DT).toBeGreaterThan(5);
    expect(jumps).toBeGreaterThan(0);
  });
});
