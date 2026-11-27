import type { Cutscene } from '../script.ts';
import { prologueMorning } from './prologue.ts';

/** Every cutscene by id. */
export const CUTSCENES: Readonly<Record<string, Cutscene>> = {
  [prologueMorning.id]: prologueMorning,
};
