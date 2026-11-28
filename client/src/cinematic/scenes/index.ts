import type { Cutscene } from '../script.ts';
import { arenaTunnel, arenaVictory, arenaWon } from './arena.ts';
import { campfireNight, forestRoadAfter, forgeNight, rollCall } from './companions.ts';
import { brothersEnd, cassianFalls, heaven, luciusPath, marcusPath, mourning, patrolRoad, rebuilding, spring, theCrowning, twoBoys } from './ending.ts';
import { fortSiege, greekFeastScene, homeInChains, intoGreece, theSewers, theSpy, wizardReturns } from './greece.ts';
import { campSouth, capitalFalls, gateArrive, hrolfFarewell, liviaFound, ridersCome, victoryFeast } from './mongols.ts';
import { emperor, emperorHall, ruins, villageAfter, villageApproach } from './legion.ts';
import { prologueMorning } from './prologue.ts';
import { prologuePrison, prologueRaid, prologueRoad } from './prologueNight.ts';
import { liviaEvening } from './livia.ts';
import { bridgeAfter, bridgeOrders, campNight, dawnRelief, outpostScout } from './north.ts';
import { ambush, forestRoadWalk } from './roads.ts';
import { hrolfAlone, hrolfMirror, letterOne, letterTwo, rallySpeech, varroDeath, varroMemory } from './war.ts';

/** Every cutscene by id. */
export const CUTSCENES: Readonly<Record<string, Cutscene>> = Object.fromEntries(
  [
    prologueMorning, prologueRaid, prologueRoad, prologuePrison,
    arenaTunnel, arenaWon, arenaVictory,
    forgeNight, forestRoadWalk, forestRoadAfter, ambush, campfireNight, rollCall,
    bridgeOrders, bridgeAfter, outpostScout, campNight, dawnRelief,
    villageApproach, villageAfter, emperor, emperorHall, liviaEvening, ruins,
    varroDeath, varroMemory, letterOne, letterTwo, rallySpeech, hrolfAlone, hrolfMirror,
    victoryFeast, capitalFalls, campSouth, ridersCome, hrolfFarewell, gateArrive, liviaFound,
    rebuilding, twoBoys, patrolRoad, cassianFalls, heaven, mourning, theCrowning, marcusPath, luciusPath, brothersEnd, spring,
    theSpy, fortSiege, intoGreece, theSewers, greekFeastScene, wizardReturns, homeInChains,
  ].map((scene) => [scene.id, scene]),
);
