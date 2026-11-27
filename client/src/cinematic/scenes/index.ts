import type { Cutscene } from '../script.ts';
import { arenaTunnel, arenaVictory, arenaWon } from './arena.ts';
import { campfireNight, forestRoadAfter, forgeNight, rollCall } from './companions.ts';
import { brothersEnd, cassianFalls, luciusPath, marcusPath, mourning, patrolRoad, rebuilding, theCrowning, theEnd, twoBoys } from './ending.ts';
import { campSouth, capitalFalls, gateArrive, hrolfFarewell, liviaFound, ridersCome, victoryFeast } from './mongols.ts';
import { emperor, emperorHall, ruins, villageAfter } from './legion.ts';
import { prologueMorning } from './prologue.ts';
import { prologuePrison, prologueRaid, prologueRoad } from './prologueNight.ts';
import { liviaEvening } from './livia.ts';
import { ambush, forestRoadWalk } from './roads.ts';
import { hrolfMirror, letterOne, letterTwo, rallySpeech, varroDeath } from './war.ts';

/** Every cutscene by id. */
export const CUTSCENES: Readonly<Record<string, Cutscene>> = Object.fromEntries(
  [
    prologueMorning, prologueRaid, prologueRoad, prologuePrison,
    arenaTunnel, arenaWon, arenaVictory,
    forgeNight, forestRoadWalk, forestRoadAfter, ambush, campfireNight, rollCall,
    villageAfter, emperor, emperorHall, liviaEvening, ruins,
    varroDeath, letterOne, letterTwo, rallySpeech, hrolfMirror,
    victoryFeast, capitalFalls, campSouth, ridersCome, hrolfFarewell, gateArrive, liviaFound,
    rebuilding, twoBoys, patrolRoad, cassianFalls, mourning, theCrowning, marcusPath, luciusPath, brothersEnd, theEnd,
  ].map((scene) => [scene.id, scene]),
);
