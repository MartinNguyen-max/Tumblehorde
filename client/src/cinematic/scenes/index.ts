import type { Cutscene } from '../script.ts';
import { arenaTunnel, arenaVictory, arenaWon } from './arena.ts';
import { campfireNight, forestRoadAfter, forgeNight, rollCall } from './companions.ts';
import { lastNight, peace, theEnd } from './ending.ts';
import { emperor, emperorHall, ruins, villageAfter } from './legion.ts';
import { prologueMorning } from './prologue.ts';
import { prologuePrison, prologueRaid, prologueRoad } from './prologueNight.ts';
import { hrolfMirror, letterOne, letterTwo, rallySpeech, varroDeath } from './war.ts';

/** Every cutscene by id. */
export const CUTSCENES: Readonly<Record<string, Cutscene>> = Object.fromEntries(
  [
    prologueMorning, prologueRaid, prologueRoad, prologuePrison,
    arenaTunnel, arenaWon, arenaVictory,
    forgeNight, forestRoadAfter, campfireNight, rollCall,
    villageAfter, emperor, emperorHall, ruins,
    varroDeath, letterOne, letterTwo, rallySpeech, hrolfMirror,
    peace, lastNight, theEnd,
  ].map((scene) => [scene.id, scene]),
);
