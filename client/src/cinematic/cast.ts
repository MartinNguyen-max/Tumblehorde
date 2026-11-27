import type { Actor, ActorLook } from './actor.ts';
import { CLOTH, HAIR, SKIN } from './config.ts';
import type { VoiceSpec } from './script.ts';
import type { Stage } from './stage.ts';

/** Everyone in the story, at every age they appear: how they look and how they sound. */

interface Role {
  look: ActorLook;
  voice: VoiceSpec;
}

const LEGION_RED = '#B8322A';

export const CAST = {
  cassianChild: { look: { outfit: 'monk', hair: HAIR.brown, hairStyle: 'short', age: 'child' }, voice: { pitch: 330, rate: 0.1 } },
  cassianYoung: { look: { outfit: 'monk', hair: HAIR.brown, hairStyle: 'tonsure', beard: 'stubble', beardColor: HAIR.brown }, voice: { pitch: 190, rate: 0.12 } },
  cassianPrisoner: { look: { outfit: 'rags', hair: HAIR.brown, hairStyle: 'long', beard: 'long', beardColor: HAIR.brown }, voice: { pitch: 175, rate: 0.12 } },
  cassianSmith: { look: { outfit: 'smith', color: CLOTH.tunic, hair: HAIR.brown, hairStyle: 'short', beard: 'short', beardColor: HAIR.brown }, voice: { pitch: 175, rate: 0.12 } },
  /** In the silver armor and helmet bought from the smith, from the second arena fight to the Emperor. */
  cassianTraveller: { look: { outfit: 'silver', helmet: true, hair: HAIR.brown, hairStyle: 'short', beard: 'short', beardColor: HAIR.brown }, voice: { pitch: 175, rate: 0.12 } },
  cassianCommander: { look: { outfit: 'commander', color: LEGION_RED, cape: LEGION_RED, hair: HAIR.brown, hairStyle: 'short', beard: 'short', beardColor: HAIR.brown }, voice: { pitch: 170, rate: 0.12 } },
  cassianHelmet: { look: { outfit: 'commander', color: LEGION_RED, cape: LEGION_RED, helmet: true, hair: HAIR.brown, beard: 'short', beardColor: HAIR.brown }, voice: { pitch: 170, rate: 0.12 } },
  cassianOld: { look: { outfit: 'commander', color: '#6A4A7A', cape: '#6A2A7A', hair: HAIR.white, hairStyle: 'short', beard: 'long', beardColor: HAIR.white, age: 'old' }, voice: { pitch: 140, rate: 0.15 } },
  anselm: { look: { outfit: 'abbot', hair: HAIR.white, hairStyle: 'tonsure', beard: 'long', beardColor: HAIR.white, age: 'old', skin: SKIN.light }, voice: { pitch: 150, rate: 0.15 } },
  monk: { look: { outfit: 'monk', hair: HAIR.brown, hairStyle: 'tonsure', beard: 'short' }, voice: { pitch: 160, rate: 0.13 } },
  varro: { look: { outfit: 'smith', skin: SKIN.tan, hair: HAIR.grey, hairStyle: 'short', beard: 'short', beardColor: HAIR.grey, scar: true }, voice: { pitch: 118, rate: 0.14 } },
  varroArmored: { look: { outfit: 'silver', skin: SKIN.tan, hair: HAIR.grey, hairStyle: 'short', beard: 'short', beardColor: HAIR.grey, scar: true }, voice: { pitch: 118, rate: 0.14 } },
  felix: { look: { outfit: 'villager', color: '#4E7A9A', hair: HAIR.auburn, hairStyle: 'short', beard: 'stubble', beardColor: HAIR.auburn }, voice: { pitch: 185, rate: 0.1 } },
  rufus: { look: { outfit: 'villager', color: '#9A6A3A', hair: HAIR.auburn, hairStyle: 'bald', beard: 'short', beardColor: HAIR.auburn }, voice: { pitch: 150, rate: 0.11 } },
  /** Felix and Rufus in the legion's red once the Emperor takes them in. */
  felixLegion: { look: { outfit: 'legion', color: LEGION_RED, helmet: true, hair: HAIR.auburn, hairStyle: 'short', beard: 'stubble', beardColor: HAIR.auburn }, voice: { pitch: 185, rate: 0.1 } },
  rufusLegion: { look: { outfit: 'legion', color: LEGION_RED, helmet: true, hair: HAIR.auburn, hairStyle: 'bald', beard: 'short', beardColor: HAIR.auburn }, voice: { pitch: 150, rate: 0.11 } },
  quintus: { look: { outfit: 'commander', color: LEGION_RED, cape: '#2A5A2A', helmet: true, hair: HAIR.brown, beard: 'short', beardColor: HAIR.brown }, voice: { pitch: 140, rate: 0.13 } },
  /** The arena: poor men in rags like Cassian, trained gladiators, and Draco the Undefeated. */
  poorFighter: { look: { outfit: 'rags', hair: HAIR.black, hairStyle: 'short', beard: 'stubble', beardColor: HAIR.black }, voice: { pitch: 160, rate: 0.12 } },
  gladiator: { look: { outfit: 'legion', color: '#6A4A2A', helmet: true, hair: HAIR.black, beard: 'short', beardColor: HAIR.black, skin: SKIN.tan }, voice: { pitch: 130, rate: 0.12 } },
  draco: { look: { outfit: 'commander', color: '#2A2A2E', cape: '#8A1A1A', helmet: true, hair: HAIR.black, beard: 'short', beardColor: HAIR.black, scar: true, skin: SKIN.tan }, voice: { pitch: 110, rate: 0.13 } },
  felixOld: { look: { outfit: 'commander', color: '#4E7A9A', cape: '#2E4A6A', hair: HAIR.white, hairStyle: 'short', beard: 'short', beardColor: HAIR.white, age: 'old' }, voice: { pitch: 160, rate: 0.13 } },
  rufusOld: { look: { outfit: 'commander', color: '#9A6A3A', cape: '#6A3A1A', hair: HAIR.white, hairStyle: 'bald', beard: 'long', beardColor: HAIR.white, age: 'old' }, voice: { pitch: 130, rate: 0.14 } },
  galba: { look: { outfit: 'commander', color: LEGION_RED, cape: '#2A2A6A', helmet: true, hair: HAIR.black, beard: 'none', skin: SKIN.tan }, voice: { pitch: 135, rate: 0.12 } },
  emperor: { look: { outfit: 'emperor', hair: HAIR.grey, hairStyle: 'short', beard: 'short', beardColor: HAIR.grey, skin: SKIN.light }, voice: { pitch: 125, rate: 0.15 } },
  livia: { look: { outfit: 'healer', color: '#7A9AB8', hair: HAIR.black, hairStyle: 'long', skin: SKIN.light }, voice: { pitch: 255, rate: 0.11 } },
  liviaOld: { look: { outfit: 'healer', color: '#6A2A7A', hair: HAIR.grey, hairStyle: 'long', skin: SKIN.light, age: 'old' }, voice: { pitch: 230, rate: 0.13 } },
  marcusChild: { look: { outfit: 'villager', color: '#B8322A', hair: HAIR.black, hairStyle: 'short', age: 'child' }, voice: { pitch: 360, rate: 0.09 } },
  marcusYoung: { look: { outfit: 'legion', color: LEGION_RED, hair: HAIR.black, hairStyle: 'short', beard: 'stubble', beardColor: HAIR.black }, voice: { pitch: 195, rate: 0.11 } },
  eirik: { look: { outfit: 'viking', hair: HAIR.blond, hairStyle: 'braids', beard: 'stubble', beardColor: HAIR.blond, skin: SKIN.pale }, voice: { pitch: 185, rate: 0.11 } },
  hrolf: { look: { outfit: 'warlord', color: '#6A2A22', hair: HAIR.red, hairStyle: 'braids', beard: 'long', beardColor: HAIR.red, scar: true, skin: SKIN.pale }, voice: { pitch: 105, rate: 0.14 } },
  hrolfOld: { look: { outfit: 'warlord', color: '#6A2A22', hair: HAIR.grey, hairStyle: 'braids', beard: 'long', beardColor: HAIR.grey, scar: true, skin: SKIN.pale }, voice: { pitch: 100, rate: 0.15 } },
  viking: { look: { outfit: 'viking', hair: HAIR.blond, hairStyle: 'long', beard: 'long', beardColor: HAIR.blond, helmet: true }, voice: { pitch: 120, rate: 0.12 } },
  bandit: { look: { outfit: 'bandit', hair: HAIR.black, beard: 'stubble', beardColor: HAIR.black }, voice: { pitch: 140, rate: 0.12 } },
  legionary: { look: { outfit: 'legion', color: LEGION_RED, helmet: true, hair: HAIR.brown }, voice: { pitch: 150, rate: 0.12 } },
  villager: { look: { outfit: 'villager', color: '#8A7A5A', hair: HAIR.brown }, voice: { pitch: 170, rate: 0.12 } },
  dead: { look: { outfit: 'rags', skin: SKIN.grey, hair: HAIR.grey, hairStyle: 'long' }, voice: { pitch: 90, rate: 0.2 } },
  // The Mongols, the Greeks, and the people of the years after the war.
  mongol: { look: { outfit: 'mongol', hair: HAIR.black, hairStyle: 'braids', beard: 'stubble', beardColor: HAIR.black, skin: SKIN.tan, helmet: true }, voice: { pitch: 130, rate: 0.11 } },
  khan: { look: { outfit: 'mongol', color: '#7A2A2A', hair: HAIR.black, hairStyle: 'braids', beard: 'long', beardColor: HAIR.black, skin: SKIN.tan, helmet: true, scar: true }, voice: { pitch: 100, rate: 0.15 } },
  hoplite: { look: { outfit: 'hoplite', hair: HAIR.black, beard: 'short', beardColor: HAIR.black, skin: SKIN.tan, helmet: true }, voice: { pitch: 140, rate: 0.12 } },
  strategos: { look: { outfit: 'hoplite', color: '#6A2A7A', cape: '#E8E0CC', hair: HAIR.grey, beard: 'long', beardColor: HAIR.grey, skin: SKIN.tan, helmet: true }, voice: { pitch: 115, rate: 0.14 } },
  cassianGrey: { look: { outfit: 'commander', color: LEGION_RED, cape: LEGION_RED, hair: HAIR.grey, hairStyle: 'short', beard: 'short', beardColor: HAIR.grey }, voice: { pitch: 155, rate: 0.13 } },
  marcusBaby: { look: { outfit: 'villager', color: '#E8E0CC', hair: HAIR.black, hairStyle: 'short', skin: SKIN.tan, age: 'child' }, voice: { pitch: 400, rate: 0.08 } },
  marcusBoy: { look: { outfit: 'villager', color: '#6A8A9A', hair: HAIR.black, hairStyle: 'long', skin: SKIN.tan, age: 'child' }, voice: { pitch: 350, rate: 0.09 } },
  marcusMongol: { look: { outfit: 'mongol', color: '#5A3A5A', hair: HAIR.black, hairStyle: 'long', beard: 'stubble', beardColor: HAIR.black, skin: SKIN.tan, helmet: true }, voice: { pitch: 175, rate: 0.12 } },
  marcusRoman: { look: { outfit: 'legion', color: LEGION_RED, hair: HAIR.black, hairStyle: 'long', beard: 'stubble', beardColor: HAIR.black, skin: SKIN.tan }, voice: { pitch: 175, rate: 0.12 } },
  luciusBoy: { look: { outfit: 'villager', color: '#B8322A', hair: HAIR.brown, hairStyle: 'short', age: 'child' }, voice: { pitch: 370, rate: 0.09 } },
  lucius: { look: { outfit: 'commander', color: LEGION_RED, cape: LEGION_RED, helmet: true, hair: HAIR.brown, hairStyle: 'short', beard: 'none' }, voice: { pitch: 190, rate: 0.11 } },
  luciusBare: { look: { outfit: 'commander', color: LEGION_RED, cape: LEGION_RED, hair: HAIR.brown, hairStyle: 'short', beard: 'none' }, voice: { pitch: 190, rate: 0.11 } },
  liviaMother: { look: { outfit: 'healer', color: '#6A4A7A', hair: HAIR.black, hairStyle: 'long', skin: SKIN.light }, voice: { pitch: 245, rate: 0.12 } },
  wizard: { look: { outfit: 'wizard', hair: HAIR.white, hairStyle: 'long', beard: 'long', beardColor: HAIR.white, skin: '#B8B4A8', age: 'old' }, voice: { pitch: 85, rate: 0.17 } },
  messenger: { look: { outfit: 'legion', color: LEGION_RED, hair: HAIR.brown, hairStyle: 'short', beard: 'stubble', beardColor: HAIR.brown }, voice: { pitch: 170, rate: 0.1 } },
} as const satisfies Record<string, Role>;

export type RoleName = keyof typeof CAST;

export function isRoleName(value: string): value is RoleName {
  return value in CAST;
}

/** Puts a member of the cast on stage under `name` (shown on their subtitles). */
export function cast(stage: Stage, role: RoleName, name: string, changes: Partial<ActorLook> = {}): Actor {
  const r: Role = CAST[role];
  const actor = stage.actor(name, { ...r.look, ...changes });
  actor.voice = r.voice;
  return actor;
}
