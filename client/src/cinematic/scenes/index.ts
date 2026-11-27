import type { Cutscene } from '../script.ts';
import { arenaTunnel, arenaWon } from './arena.ts';
import { prologueMorning } from './prologue.ts';

/** Every cutscene by id. */
export const CUTSCENES: Readonly<Record<string, Cutscene>> = Object.fromEntries(
  [prologueMorning, arenaTunnel, arenaWon].map((scene) => [scene.id, scene]),
);
