import { ALLIANCE } from './config.ts';
import { dirToYaw, distanceXZ, wrapAngle } from './math.ts';
import { nextRandom } from './random.ts';
import type { Army, MatchState, Unit } from './types.ts';
import { armiesHostile, getUnit } from './units.ts';

/**
 * Alliances, Minecraft style: crouch a few times while looking at another commander. If they
 * crouch back while you two stand close and face each other, your armies stop fighting each
 * other for the rest of the battle. You still only command your own soldiers.
 */

function commanderOf(state: MatchState, army: Army): Unit | null {
  const commander = getUnit(state, army.commanderId);
  return commander?.alive ? commander : null;
}

function looksAt(viewer: Unit, other: Unit): boolean {
  const toOther = dirToYaw(other.pos.x - viewer.pos.x, other.pos.z - viewer.pos.z);
  return Math.abs(wrapAngle(toOther - viewer.yaw)) <= ALLIANCE.lookAngle;
}

/** The hostile army whose commander this commander is looking at, close by. */
function lookedAtArmy(state: MatchState, army: Army, commander: Unit): Army | null {
  let best: Army | null = null;
  let bestDistance: number = ALLIANCE.range;
  for (const other of state.armies) {
    if (other.eliminated || !armiesHostile(state, army.id, other.id)) continue;
    const theirs = commanderOf(state, other);
    if (!theirs || !looksAt(commander, theirs)) continue;
    const d = distanceXZ(commander.pos, theirs.pos);
    if (d <= bestDistance) {
      best = other;
      bestDistance = d;
    }
  }
  return best;
}

export function faceToFace(state: MatchState, a: Army, b: Army): boolean {
  const ca = commanderOf(state, a);
  const cb = commanderOf(state, b);
  if (!ca || !cb) return false;
  return distanceXZ(ca.pos, cb.pos) <= ALLIANCE.range && looksAt(ca, cb) && looksAt(cb, ca);
}

function offerStands(state: MatchState, from: Army, to: Army): boolean {
  return from.allyOffer?.to === to.id && state.time - from.allyOffer.time <= ALLIANCE.offerTime;
}

function formAlliance(state: MatchState, a: Army, b: Army): void {
  state.alliances.push([a.id, b.id]);
  a.allyOffer = null;
  b.allyOffer = null;
  state.events.push({ type: 'alliance', a: a.id, b: b.id });
}

/** `from` offers an alliance to `to`. If `to` already offered one back, face to face, it is done. */
export function offerAlliance(state: MatchState, from: Army, to: Army): void {
  from.allyOffer = { to: to.id, time: state.time };
  state.events.push({ type: 'allyOffer', from: from.id, to: to.id });
  if (offerStands(state, to, from)) {
    if (faceToFace(state, from, to)) formAlliance(state, from, to);
    return;
  }
  if (!to.isBot || to.bot.allyAnswer) return;
  // Bots rarely trust anyone. One that agrees turns round and crouches back.
  if (nextRandom(state.rng) < ALLIANCE.botAcceptChance) to.bot.allyAnswer = { to: from.id, timer: ALLIANCE.botAnswerTime };
  else state.events.push({ type: 'allyRefused', from: from.id, to: to.id });
}

/** Counts crouch taps, turns enough of them at a commander into an offer, and runs bots' answers. */
export function updateAlliances(state: MatchState, dt: number): void {
  for (const army of state.armies) {
    if (army.eliminated) continue;
    const commander = commanderOf(state, army);
    if (army.allyOffer && state.time - army.allyOffer.time > ALLIANCE.offerTime) army.allyOffer = null;
    const answer = army.bot.allyAnswer;
    if (answer) {
      answer.timer -= dt;
      const to = state.armies[answer.to];
      if (answer.timer <= 0) {
        army.bot.allyAnswer = null;
        if (to && commander) offerAlliance(state, army, to);
      }
      continue;
    }
    if (!commander) continue;
    const gesture = army.gesture;
    const crouch = commander.intent.crouch;
    if (crouch && !gesture.wasCrouching) gesture.taps.push(state.time);
    gesture.wasCrouching = crouch;
    gesture.taps = gesture.taps.filter((t) => state.time - t <= ALLIANCE.tapWindow);
    if (gesture.taps.length < ALLIANCE.tapsNeeded) continue;
    gesture.taps = [];
    const target = lookedAtArmy(state, army, commander);
    if (target) offerAlliance(state, army, target);
  }
}

/** A bot commander answering yes: face the other commander, stand still, bob up and down. */
export function answerIntent(state: MatchState, army: Army, commander: Unit): boolean {
  const answer = army.bot.allyAnswer;
  if (!answer) return false;
  const other = state.armies[answer.to];
  const theirs = other ? commanderOf(state, other) : null;
  if (!theirs) return false;
  commander.intent.moveX = 0;
  commander.intent.moveZ = 0;
  commander.intent.attack = false;
  commander.intent.shield = false;
  commander.intent.faceYaw = dirToYaw(theirs.pos.x - commander.pos.x, theirs.pos.z - commander.pos.z);
  commander.intent.crouch = Math.sin(state.time * Math.PI * 2 * ALLIANCE.botCrouchRate) > 0;
  return true;
}
