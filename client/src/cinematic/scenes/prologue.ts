import type { TransformNode } from '../../render/babylon.ts';
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

const MONASTERY = {
  soil: '#6A4E34',
  sprout: '#5E9A3A',
  flower: ['#E8C84A', '#D86A8A', '#F4F0E6', '#8A6AC8'],
  hive: '#D8A040',
  wool: '#F0ECE0',
  face: '#2A2420',
  chapel: '#C8BCA6',
} as const;

/** A sheep: a woolly box on four legs. */
function sheep(stage: Stage, x: number, z: number, yaw: number): void {
  const g = stage.group('sheep', x, 0, z);
  g.rotation.y = yaw;
  const p = stage.world.parts;
  p.part('box', MONASTERY.wool, g, [0.6, 0.45, 0.9], [0, 0.55, 0]);
  p.part('box', MONASTERY.face, g, [0.28, 0.3, 0.3], [0, 0.7, 0.55]);
  for (const sx of [-0.2, 0.2]) for (const sz of [-0.3, 0.3]) p.part('box', MONASTERY.face, g, [0.1, 0.35, 0.1], [sx, 0.17, sz]);
}

/** The monastery; returns its bell tower, which the raiders bring down. */
export function buildMonastery(stage: Stage): TransformNode {
  stage.ground(SET_COLORS.grass);
  stage.box(SET_COLORS.flagstone, [9, 0.04, 7], [0, 0.0, -1.5], 0, { castShadow: false });
  house(stage, -5, -9, 9, 5, 4.2, 0);
  house(stage, 7, -5, 5, 8, 3.6, Math.PI / 2);
  const tower = bellTower(stage, 2.5, -9.5);
  // The chapel: long and tall, a round window, a cross on the gable.
  const chapel = house(stage, -14, -13, 6, 11, 5.6, Math.PI / 2, MONASTERY.chapel);
  stage.world.parts.part('cylinder', SET_COLORS.window, chapel, [0.5, 0.08, 0.5], [0, 4.4, 5.55]).rotation.x = Math.PI / 2;
  stage.world.parts.part('box', SET_COLORS.darkWood, chapel, [0.16, 1.4, 0.16], [0, 8.4, 5.4]);
  stage.world.parts.part('box', SET_COLORS.darkWood, chapel, [0.8, 0.16, 0.16], [0, 8.6, 5.4]);
  wall(stage, -11, 2, 10, Math.PI / 2);
  wall(stage, 11, 4, 8, Math.PI / 2);
  wall(stage, -6, 9.5, 9, 0, 1.2);
  tree(stage, -6.5, -2.5, 1.1);
  tree(stage, 8, 6, 1.3);
  tree(stage, -14, -1, 1.5);
  tree(stage, -18, 6, 1.2);
  bench(stage, 0, BENCH_Z);
  // The garden: rows of vegetables, beehives, a well with a little roof.
  stage.box(MONASTERY.soil, [6, 0.06, 4], [-7, 0.02, 6], 0, { castShadow: false });
  for (let row = 0; row < 4; row++) for (let i = 0; i < 8; i++) stage.shape('bush', MONASTERY.sprout, [0.3, 0.22, 0.3], [-9.6 + i * 0.75, 0.12, 4.5 + row * 1]);
  for (let i = 0; i < 3; i++) {
    stage.box(MONASTERY.hive, [0.6, 0.7, 0.6], [-1.5 + i * 1.1, 0.35, 7.5]);
    stage.box(SET_COLORS.roof, [0.7, 0.1, 0.7], [-1.5 + i * 1.1, 0.75, 7.5]);
  }
  stage.shape('cylinder', SET_COLORS.stone, [0.8, 0.8, 0.8], [-3, 0.4, 3.6]);
  for (const x of [-3.6, -2.4]) stage.box(SET_COLORS.darkWood, [0.12, 1.8, 0.12], [x, 0.9, 3.6]);
  const well = stage.box(SET_COLORS.roof, [1.6, 0.1, 1.2], [-3, 1.85, 3.6]);
  well.rotation.z = 0.2;
  // A path down to the river, flowers along it, sheep grazing.
  stage.box(SET_COLORS.dirt, [10, 0.03, 1.6], [9, 0.01, 11], 0, { castShadow: false });
  for (let i = 0; i < 24; i++) stage.shape('bush', MONASTERY.flower[i % MONASTERY.flower.length] ?? SET_COLORS.leaves, [0.18, 0.14, 0.18], [4 + (i % 12) * 0.9, 0.08, 10 + Math.floor(i / 12) * 2]);
  sheep(stage, 5, 15, 0.6);
  sheep(stage, 7.4, 16.5, -0.4);
  sheep(stage, 3.6, 17.2, 2.2);
  scatter(stage, 0, 4, 12, 40);
  return tower;
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
    // The brothers at their morning work.
    stage.actor('Brother Paul', { outfit: 'monk', hair: HAIR.brown, hairStyle: 'tonsure', beard: 'short' }).place(-7, 5, 0.3).setPose('carve', true);
    stage.actor('Brother Tomas', { outfit: 'monk', hair: HAIR.black, hairStyle: 'tonsure', beard: 'short' }).place(-3, 2.6, Math.PI).setPose('offer', true);
    stage.actor('Brother Ivo', { outfit: 'monk', hair: HAIR.grey, hairStyle: 'tonsure', beard: 'long', age: 'old' }).place(2.5, -7.6, Math.PI).setPose('pray', true);
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
