import type { MatchView, SimEvent, UnitView } from '@tumblehorde/shared';
import { SOUND } from '../visualConfig.ts';
import { babble, type Babble, personal, SAY, viking } from './babble.ts';
import type { AudioEngine, Place } from './engine.ts';
import { bonk, burp, clang, clink, glug, kazoo, pop, slideWhistle, splash, swing, throwWhoosh, thunk, trample } from './sounds.ts';

/** Kazoo tunes: a "ta-daa" for orders, a fanfare for good news, a sad trombone for bad news. */
const ORDER_KAZOO = [392, 523.25];
const FANFARE = [392, 523.25, 659.25, 783.99];
const SAD_TROMBONE = [293.66, 277.18, 261.63, 246.94];
/** A blow this hard (horizontal speed) sends someone flying, slide whistle and all. */
const LAUNCH_SPEED = 9;

/** Turns what happens in the battle into sound: bonks, gibberish, splashes, slide whistles, kazoos. */
export class BattleAudio {
  private readonly engine: AudioEngine;
  private chatterTimer = 0;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  /** The people of the army each unit belongs to, refreshed with every view: Vikings sound different. */
  private vikingArmies = new Set<number>();

  /** Somebody says something, in their own voice when we know who (`speaker`). */
  private say(at: Place | null, what: Babble, key: string, delay = 0, gap: number = SOUND.voiceGap, speaker?: number): void {
    const v = this.engine.voice(at, 1, key, gap, SOUND.voiceLength);
    if (!v) return;
    const unit = speaker === undefined ? null : this.lastView?.units[speaker];
    const voice = unit && this.vikingArmies.has(unit.armyId) ? viking(what) : what;
    babble(this.engine, { ...v, t: v.t + delay }, speaker === undefined ? voice : personal(voice, speaker));
  }

  private lastView: MatchView | null = null;

  private noteFactions(view: MatchView): void {
    this.lastView = view;
    this.vikingArmies = new Set(view.armies.filter((a) => a.faction === 'viking').map((a) => a.id));
  }

  handle(events: readonly SimEvent[], view: MatchView | null, myArmyId: number | null): void {
    if (!view || !this.engine.enabled) return;
    this.noteFactions(view);
    const at = (id: number): UnitView | undefined => view.units[id];
    for (const event of events) {
      switch (event.type) {
        case 'swing': {
          const u = at(event.unitId);
          const v = this.engine.voice(u ?? null, 0.5, 'swing', SOUND.crowdGap);
          if (v) swing(this.engine, v);
          // Vikings roar as they swing; legionaries fight quieter.
          if (u && this.vikingArmies.has(u.armyId) && Math.random() < SOUND.vikingRoarChance) this.say(u, SAY.roar, 'roar', 0, SOUND.voiceGap, u.id);
          break;
        }
        case 'hit': {
          const u = at(event.targetId);
          if (!u) break;
          const v = this.engine.voice(u, event.blocked ? 0.6 : 0.8, event.blocked ? 'clang' : 'bonk', SOUND.crowdGap);
          if (v && event.blocked) clang(this.engine, v);
          else if (v) bonk(this.engine, v);
          if (!event.blocked && u.kind !== 'horse' && Math.random() < SOUND.oofChance) this.say(u, SAY.oof, 'oof', 0, SOUND.voiceGap, u.id);
          if (!event.blocked && Math.hypot(event.knockback.x, event.knockback.z) > LAUNCH_SPEED) this.whistle(u);
          break;
        }
        case 'death': {
          const u = at(event.unitId);
          if (!u || u.kind === 'horse') break;
          this.say(u, SAY.death, 'death', 0, SOUND.crowdGap, u.id);
          const v = this.engine.voice(u, 0.6, 'pop', SOUND.crowdGap);
          if (v) pop({ ...v, t: v.t + 0.05 });
          if (Math.hypot(event.knockback.x, event.knockback.z) > LAUNCH_SPEED) this.whistle(u);
          break;
        }
        case 'trample': {
          const u = at(event.targetId) ?? null;
          const v = this.engine.voice(u, 0.9, 'trample', SOUND.crowdGap);
          if (v) trample(this.engine, v);
          if (u) this.whistle(u);
          break;
        }
        case 'splash': {
          const v = this.engine.voice(at(event.unitId) ?? null, 0.8, 'splash', SOUND.crowdGap);
          if (v) splash(this.engine, v);
          break;
        }
        case 'arrowFired': {
          const v = this.engine.voice(at(event.shooterId) ?? null, 0.5, 'throw', SOUND.crowdGap);
          if (v) throwWhoosh(this.engine, v);
          break;
        }
        case 'arrowLanded': {
          const v = this.engine.voice(event.pos, 0.5, 'thunk', SOUND.crowdGap);
          if (v) thunk(v);
          break;
        }
        case 'stumble': {
          const u = at(event.unitId);
          // A drunk trips and giggles; anyone else slipped on the ice.
          if (u?.drunk) this.say(u, Math.random() < 0.5 ? SAY.hic : SAY.giggle, 'hic', 0, SOUND.crowdGap, u.id);
          else if (u) {
            this.say(u, SAY.oof, 'oof', 0, SOUND.crowdGap, u.id);
            this.whistle(u);
          }
          break;
        }
        case 'rally':
          this.rally(view, event.armyId, event.commanderId);
          break;
        case 'banquet':
          this.banquet(view, event.armyId);
          break;
        case 'drunk':
          this.soldiersOf(view, event.armyId)
            .slice(0, SOUND.cheerVoices)
            .forEach((u, i) => this.say(u, SAY.giggle, `giggle-${i}`, Math.random() * 1.2, 0, u.id));
          break;
        case 'order':
          if (event.armyId === myArmyId) this.orderCall(view, event.armyId, event.order === 'attack');
          break;
        case 'allyOffer':
          if (event.to === myArmyId || event.from === myArmyId) this.say(null, SAY.huh, 'huh');
          break;
        case 'alliance':
          if (event.a === myArmyId || event.b === myArmyId) {
            const v = this.engine.voice(null, 0.8, 'fanfare', 1);
            if (v) kazoo(v, FANFARE, 0.13, 3);
          }
          break;
        case 'matchOver': {
          const won = view.armies.some((a) => a.id === myArmyId && !a.eliminated);
          const v = this.engine.voice(null, 0.9, 'fanfare', 1);
          if (v && won) kazoo(v, FANFARE, 0.16, 4);
          else if (v) kazoo(v, SAD_TROMBONE, 0.42, 3.5);
          break;
        }
        default:
          break;
      }
    }
  }

  /** Soldiers mutter now and then, more so when drunk; after a win the winners cheer and laugh. */
  update(view: MatchView | null, dt: number): void {
    if (!view || !this.engine.enabled) return;
    this.chatterTimer -= dt;
    if (this.chatterTimer > 0) return;
    const celebrating = view.phase !== 'playing';
    this.chatterTimer = (celebrating ? SOUND.celebrateEvery : SOUND.chatterEvery) * (0.5 + Math.random());
    const people = view.units.filter((u) => u.alive && u.kind === 'swordsman');
    const speaker = people[Math.floor(Math.random() * people.length)];
    if (!speaker) return;
    if (celebrating) {
      this.say(speaker, Math.random() < 0.7 ? SAY.cheer : SAY.giggle, `party-${speaker.id % SOUND.cheerVoices}`, 0, 0, speaker.id);
      return;
    }
    const line = speaker.drunk ? (Math.random() < 0.5 ? SAY.giggle : SAY.drunk) : SAY.chatter;
    this.say(speaker, line, 'chatter', 0, 0, speaker.id);
  }

  /** A slide whistle for anyone sent flying. */
  private whistle(at: Place): void {
    const v = this.engine.voice(at, 0.8, 'whistle', SOUND.whistleGap);
    if (v) slideWhistle(v, true);
  }

  private armyCenter(view: MatchView, armyId: number): Place | null {
    const units = view.units.filter((u) => u.alive && u.armyId === armyId && u.kind !== 'horse');
    if (units.length === 0) return null;
    return { x: units.reduce((s, u) => s + u.x, 0) / units.length, z: units.reduce((s, u) => s + u.z, 0) / units.length };
  }

  private soldiersOf(view: MatchView, armyId: number): UnitView[] {
    return view.units.filter((u) => u.alive && u.armyId === armyId && u.kind === 'swordsman');
  }

  /** The commander's speech, then the army answers with cheers, one after another. */
  private rally(view: MatchView, armyId: number, commanderId: number): void {
    const commander = view.units[commanderId];
    const v = this.engine.voice(commander ?? null, 1.2, `speech-${armyId}`, 1, SOUND.speechLength);
    const length = v ? babble(this.engine, v, SAY.speech) : 0;
    this.soldiersOf(view, armyId)
      .slice(0, SOUND.cheerVoices)
      .forEach((u, i) => this.say(u, SAY.cheer, `cheer-${i}`, length * 0.6 + Math.random() * 0.8, 0, u.id));
  }

  private banquet(view: MatchView, armyId: number): void {
    const center = this.armyCenter(view, armyId);
    for (let i = 0; i < SOUND.glugs; i++) {
      const v = this.engine.voice(center, 0.7, `glug-${i}`, 0);
      if (v) glug({ ...v, t: v.t + i * 0.9 });
    }
    const v = this.engine.voice(center, 0.6, 'clink', 0);
    if (v) clink(v);
    const b = this.engine.voice(center, 0.9, 'burp', 0, SOUND.speechLength + 1);
    if (b) burp(this.engine, { ...b, t: b.t + SOUND.glugs * 0.9 + 0.3 });
  }

  /** Your orders: a kazoo "ta-daa", and a war cry from your soldiers when they attack. */
  private orderCall(view: MatchView, armyId: number, attack: boolean): void {
    const v = this.engine.voice(null, 0.45, 'order-kazoo', 0.3);
    if (v) kazoo(v, ORDER_KAZOO, 0.11, 1.6);
    if (!attack) return;
    this.soldiersOf(view, armyId)
      .slice(0, SOUND.cheerVoices)
      .forEach((u, i) => this.say(u, this.vikingArmies.has(armyId) ? SAY.roar : SAY.warCry, `cry-${i}`, Math.random() * 0.5, 0, u.id));
  }
}
