import type { MatchView, SimEvent, UnitView } from '@tumblehorde/shared';
import { SOUND } from '../visualConfig.ts';
import { babble, type Babble, SAY } from './babble.ts';
import type { AudioEngine, Place } from './engine.ts';
import { clang, clink, glug, horn, splash, swing, thud, throwWhoosh, thunk, trample } from './sounds.ts';

/** D major-ish horn notes for orders and good news, a sad fall for bad news. */
const ORDER_HORN = [293.66, 440];
const VICTORY_HORN = [293.66, 369.99, 440, 587.33];
const DEFEAT_HORN = [293.66, 261.63, 220];

/** Turns what happens in the battle into sound: blows, voices, splashes, horns. */
export class BattleAudio {
  private readonly engine: AudioEngine;
  private chatterTimer = 0;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  private say(at: Place | null, what: Babble, key: string, delay = 0, gap: number = SOUND.voiceGap): void {
    const v = this.engine.voice(at, 1, key, gap, SOUND.voiceLength);
    if (!v) return;
    babble(this.engine, { ...v, t: v.t + delay }, what);
  }

  handle(events: readonly SimEvent[], view: MatchView | null, myArmyId: number | null): void {
    if (!view || !this.engine.enabled) return;
    const at = (id: number): UnitView | undefined => view.units[id];
    for (const event of events) {
      switch (event.type) {
        case 'swing': {
          const u = at(event.unitId);
          const v = this.engine.voice(u ?? null, 0.5, 'swing', SOUND.crowdGap);
          if (v) swing(this.engine, v);
          break;
        }
        case 'hit': {
          const u = at(event.targetId);
          if (!u) break;
          const v = this.engine.voice(u, event.blocked ? 0.6 : 0.8, event.blocked ? 'clang' : 'thud', SOUND.crowdGap);
          if (v && event.blocked) clang(this.engine, v);
          else if (v) thud(this.engine, v);
          if (!event.blocked && u.kind !== 'horse' && Math.random() < SOUND.oofChance) this.say(u, SAY.oof, 'oof');
          break;
        }
        case 'death': {
          const u = at(event.unitId);
          if (u && u.kind !== 'horse') this.say(u, SAY.death, 'death', 0, SOUND.crowdGap);
          break;
        }
        case 'trample': {
          const v = this.engine.voice(at(event.targetId) ?? null, 0.9, 'trample', SOUND.crowdGap);
          if (v) trample(this.engine, v);
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
        case 'stumble':
          this.say(at(event.unitId) ?? null, SAY.hic, 'hic', 0, SOUND.crowdGap);
          break;
        case 'rally':
          this.rally(view, event.armyId, event.commanderId);
          break;
        case 'banquet':
          this.banquet(view, event.armyId);
          break;
        case 'drunk':
          this.say(this.armyCenter(view, event.armyId), SAY.drunk, 'drunk', 0, 0);
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
            if (v) horn(v, VICTORY_HORN, 0.14);
          }
          break;
        case 'matchOver': {
          const won = view.armies.some((a) => a.id === myArmyId && !a.eliminated);
          const v = this.engine.voice(null, 0.9, 'fanfare', 1);
          if (v) horn(v, won ? VICTORY_HORN : DEFEAT_HORN, won ? 0.18 : 0.3);
          break;
        }
        default:
          break;
      }
    }
  }

  /** Soldiers mutter now and then, more so when drunk. */
  update(view: MatchView | null, dt: number): void {
    if (!view || !this.engine.enabled) return;
    this.chatterTimer -= dt;
    if (this.chatterTimer > 0) return;
    this.chatterTimer = SOUND.chatterEvery * (0.5 + Math.random());
    const people = view.units.filter((u) => u.alive && u.kind === 'swordsman');
    const speaker = people[Math.floor(Math.random() * people.length)];
    if (speaker) this.say(speaker, speaker.drunk ? SAY.drunk : SAY.chatter, 'chatter', 0, 0);
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
      .forEach((u, i) => this.say(u, SAY.cheer, `cheer-${i}`, length * 0.6 + Math.random() * 0.8, 0));
  }

  private banquet(view: MatchView, armyId: number): void {
    const center = this.armyCenter(view, armyId);
    for (let i = 0; i < SOUND.glugs; i++) {
      const v = this.engine.voice(center, 0.7, `glug-${i}`, 0);
      if (v) glug({ ...v, t: v.t + i * 0.9 });
    }
    const v = this.engine.voice(center, 0.6, 'clink', 0);
    if (v) clink(v);
  }

  /** Your orders: a short horn, and a war cry from your soldiers when they attack. */
  private orderCall(view: MatchView, armyId: number, attack: boolean): void {
    const v = this.engine.voice(null, 0.45, 'order-horn', 0.3);
    if (v) horn(v, ORDER_HORN);
    if (!attack) return;
    this.soldiersOf(view, armyId)
      .slice(0, SOUND.cheerVoices)
      .forEach((u, i) => this.say(u, SAY.warCry, `cry-${i}`, Math.random() * 0.5, 0));
  }
}
