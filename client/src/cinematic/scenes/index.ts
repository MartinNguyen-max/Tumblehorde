import type { Cutscene } from '../script.ts';
import { arenaTunnel, arenaWon } from './arena.ts';
import { campfireNight, forestRoadAfter, forgeNight, rollCall } from './companions.ts';
import { emperor, emperorHall, ruins, villageAfter } from './legion.ts';
import { prologueMorning } from './prologue.ts';
import { prologuePrison, prologueRaid, prologueRoad } from './prologueNight.ts';

/** Every cutscene by id. */
export const CUTSCENES: Readonly<Record<string, Cutscene>> = Object.fromEntries(
  [
    prologueMorning, prologueRaid, prologueRoad, prologuePrison,
    arenaTunnel, arenaWon,
    forgeNight, forestRoadAfter, campfireNight, rollCall,
    villageAfter, emperor, emperorHall, ruins,
  ].map((scene) => [scene.id, scene]),
);
