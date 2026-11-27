import { HAIR, SKIN } from '../config.ts';
import { knife, upright, woodBlock, woodenCross } from '../props.ts';
import type { Beat, Cutscene } from '../script.ts';
import { bellTower, bench, house, scatter, SET_COLORS, tree, wall } from '../sets.ts';
import { FOV, portrait } from '../shot.ts';
import type { Stage } from '../stage.ts';

/**
 * The prologue, part one: a golden morning at the monastery. Abbot Anselm teaches young Cassian
 * to carve the small wooden cross he will carry to the end of his life.
 */

const BENCH_Z = 0;
const ANSELM_X = -0.5;
const CASSIAN_X = 0.5;

export function buildMonastery(stage: Stage): void {
  stage.ground(SET_COLORS.grass);
  stage.box(SET_COLORS.flagstone, [9, 0.04, 7], [0, 0.0, -1.5], 0, { castShadow: false });
  house(stage, -5, -9, 9, 5, 4.2, 0);
  house(stage, 7, -5, 5, 8, 3.6, Math.PI / 2);
  bellTower(stage, 2.5, -9.5);
  wall(stage, -11, 2, 10, Math.PI / 2);
  wall(stage, 11, 4, 8, Math.PI / 2);
  tree(stage, -6.5, -2.5, 1.1);
  tree(stage, 8, 6, 1.3);
  tree(stage, -14, -1, 1.5);
  bench(stage, 0, BENCH_Z);
  scatter(stage, 0, 4, 12, 40);
}

export const prologueMorning: Cutscene = {
  id: 'prologue-morning',
  create(stage: Stage): Beat[] {
    buildMonastery(stage);
    stage.light('goldenMorning');
    stage.weather('motes');

    const anselm = stage.actor('Anselm', { outfit: 'abbot', hair: HAIR.white, hairStyle: 'tonsure', beard: 'long', beardColor: HAIR.white, age: 'old', skin: SKIN.light });
    anselm.voice = { pitch: 150, rate: 0.15 };
    anselm.place(ANSELM_X, BENCH_Z, 0.25).setPose('carve', true).setMood('warm', true);
    upright(knife(stage.world.parts, anselm.grips[0]));

    const cassian = stage.actor('Cassian', { outfit: 'monk', hair: HAIR.brown, hairStyle: 'short', age: 'child', skin: SKIN.warm });
    cassian.voice = { pitch: 330, rate: 0.1 };
    cassian.place(CASSIAN_X, BENCH_Z, -0.25).setPose('carve', true).setMood('neutral', true);
    const block = woodBlock(stage.world.parts, cassian.grips[0]);
    const cross = upright(woodenCross(stage.world.parts, cassian.grips[0], 1.3));
    cross.setEnabled(false);
    anselm.setStance('sit', true);
    cassian.setStance('sit', true);
    anselm.settle();
    cassian.settle();

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 3 },
        music: 'monastery',
        sound: 'bell',
        run: (s) => s.weather('motes'),
        shot: { from: [-16, 7, 18], at: [1, 2.5, -5], to: [-11, 4.5, 13], fov: FOV.wide },
        narrate: 'Before the fire, there were bells.',
      },
      {
        shot: { from: [0.2, 1.4, 5], at: [0, 0.9, 0], to: [0.1, 1.2, 3.4] },
        narrate: 'I was raised by monks. Brother Cassian, they called me. The world was small, and it was golden.',
      },
      {
        shot: () => portrait(anselm, { angle: -0.5, push: 0.3 }),
        say: { who: 'Anselm', text: 'Slowly. The wood already knows its shape. You only help it out.', mood: 'warm' },
      },
      {
        duration: 3,
        sound: 'chisel',
        shot: () => portrait(cassian, { angle: 0.3, distance: 2.2, rise: 0.25, push: 0.4 }),
        run: () => cassian.setMood('angry'),
      },
      {
        shot: () => portrait(cassian, { angle: 0.5, distance: 2.6 }),
        run: () => {
          block.setEnabled(false);
          cross.setEnabled(true);
          cassian.setPose('offer');
        },
        say: { who: 'Cassian', text: 'Look! Is it good?', mood: 'happy' },
      },
      {
        shot: () => portrait(anselm, { angle: -0.6 }),
        run: () => anselm.lookAt(cassian.headPosition()),
        say: { who: 'Anselm', text: 'It is crooked.', mood: 'happy' },
      },
      {
        duration: 1.6,
        shot: () => portrait(cassian, { angle: 0.4, distance: 2.4, fov: FOV.extreme }),
        run: () => cassian.setMood('sad'),
      },
      {
        shot: () => portrait(anselm, { angle: -0.6, push: 0.5 }),
        say: { who: 'Anselm', text: 'And it is perfect. Keep it close, little brother. It will always know the way home.', mood: 'warm' },
      },
      {
        shot: { from: [0.3, 1.0, 2.6], at: [0.2, 0.75, 0], fov: FOV.normal },
        run: () => {
          cassian.setPose('clutch');
          cassian.setMood('warm');
        },
        duration: 3,
      },
      {
        duration: 7,
        shot: { from: [0, 1.3, 4], at: [0, 0.8, 0], to: [-3, 9, 14], atEnd: [1, 3, -4], fov: FOV.normal, fovEnd: FOV.wide },
        narrate: 'I kept it close. For a while.',
        fade: { to: 1, time: 6 },
      },
    ];
  },
};
