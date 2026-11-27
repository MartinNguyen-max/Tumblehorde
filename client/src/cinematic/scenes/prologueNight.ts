import { childNode } from '../../render/parts.ts';
import { cast } from '../cast.ts';
import { torch, upright, woodenCross } from '../props.ts';
import type { Beat, Cutscene } from '../script.ts';
import { SET_COLORS } from '../sets.ts';
import { FOV, overShoulder, portrait } from '../shot.ts';
import type { Stage } from '../stage.ts';
import { dragonBoat, prisonCell, STORY_COLORS } from '../storySets.ts';
import { buildMonastery } from './prologue.ts';

/**
 * The prologue, parts two to four: the night the river brought dragons, the long road in the
 * rain that ended in chains, and the years in a Roman cell.
 */

const RIVER_X = 20;
const HAIR_BLACK = '#2A1E18';
const TORCH_HEAD = 0.5;
/** Where the cross falls from his hand as he rides away, and when (share of the beat). */
const DROP = { x: -6, z: 11.7, at: 0.3 } as const;

function river(stage: Stage): void {
  stage.box(STORY_COLORS.water, [14, 0.08, 120], [RIVER_X + 2, 0.02, -20], 0, { castShadow: false });
  stage.box(SET_COLORS.dirt, [2, 0.1, 120], [RIVER_X - 6, 0.0, -20], 0, { castShadow: false });
}

export const prologueRaid: Cutscene = {
  id: 'prologue-raid',
  create(stage: Stage): Beat[] {
    buildMonastery(stage);
    river(stage);
    stage.light('night');
    const boats = [dragonBoat(stage, RIVER_X, -45, 0), dragonBoat(stage, RIVER_X + 4, -55, 0)];
    const cassian = cast(stage, 'cassianYoung', 'Cassian').place(0.5, 2, Math.PI / 2);
    const cross = upright(woodenCross(stage.world.parts, cassian.grips[0], 1.3));
    const anselm = cast(stage, 'anselm', 'Anselm').place(-3, -5, 0.4);
    const monks = [cast(stage, 'monk', 'Brother Paul').place(-5, -3, 0.2), cast(stage, 'monk', 'Brother Tomas', { hair: HAIR_BLACK }).place(3, -4, -0.4)];
    const hrolf = cast(stage, 'hrolf', 'Hrolf').place(RIVER_X - 4, -8, -Math.PI / 2);
    const raiders = [-2, 2, 4].map((dz, i) => cast(stage, 'viking', `Raider ${i}`).place(RIVER_X - 3 + i, -8 + dz, -Math.PI / 2));
    for (const raider of [hrolf, ...raiders]) {
      const t = torch(stage.world.parts, raider.grips[0]);
      t.rotation.x = Math.PI;
      const head = childNode('torch-head', t, 0, TORCH_HEAD, 0);
      stage.flame(head);
      raider.root.setEnabled(false);
      raider.setPose('raiseSword');
    }
    const burn = (): void => {
      stage.light('fireNight');
      stage.weather('embers');
      stage.fire(-5, -9, 2.2, 4.6);
      stage.fire(7, -5, 1.8, 4.0);
      stage.fire(2.5, -9.5, 1.4, 9.5);
      stage.fire(-6.5, -2.5, 1.2, 3.5);
    };
    let burning = false;
    const dropCross = (): void => {
      if (cross.parent === stage.root) return;
      cross.parent = stage.root;
      cross.position.set(DROP.x, 0.05, DROP.z);
      cross.rotation.set(Math.PI / 2, 0.6, 0);
    };
    const horse = stage.horse();
    horse.place(-2, 6, Math.PI / 2);

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 3 },
        music: 'silence',
        sound: 'wind',
        shot: { from: [RIVER_X - 10, 3, -12], at: [RIVER_X, 1.5, -35], to: [RIVER_X - 9, 2.5, -10], fov: FOV.normal },
        during: (_s, p) => {
          boats[0]!.position.z = -45 + p * 34;
          boats[1]!.position.z = -55 + p * 38;
        },
        narrate: 'Then, one autumn night, the river brought dragons.',
      },
      {
        shot: () => portrait(cassian, { angle: 0.3 }),
        run: () => {
          boats[0]!.position.z = -11;
          boats[1]!.position.z = -17;
          cassian.setMood('surprised').lookAt({ x: RIVER_X, y: 2, z: -10 });
        },
        sound: 'horn',
        say: { who: 'Cassian', text: 'Brothers? Brothers! There are ships on the river!', mood: 'afraid' },
      },
      {
        duration: 4,
        music: 'dread',
        shot: () => portrait(hrolf, { angle: 0.2, distance: 3.2, rise: -0.45 }),
        run: () => {
          for (const raider of [hrolf, ...raiders]) raider.root.setEnabled(true);
          hrolf.setMood('angry');
        },
      },
      {
        shot: () => portrait(hrolf, { angle: 0.1, distance: 2.6, rise: -0.3, push: 0.4 }),
        say: { who: 'Hrolf', text: 'Burn it. All of it.', mood: 'shout', as: 'The red-haired man' },
      },
      {
        duration: 5,
        sound: 'fire',
        shot: { from: [-8, 6, 14], at: [0, 3, -6], to: [-6, 4, 11], fov: FOV.wide },
        run: () => {
          if (!burning) burn();
          burning = true;
          for (const [i, raider] of raiders.entries()) raider.walkTo(4 - i * 3, -6 + i, 2.4);
          hrolf.walkTo(6, -2, 1.6);
          for (const monk of monks) monk.setPose('cower').setMood('afraid');
        },
      },
      {
        shot: () => overShoulder(anselm, cassian),
        run: () => {
          anselm.place(-1.0, 1.2, Math.atan2(1.8, 0.9));
          cassian.place(0.8, 2.1, Math.atan2(-1.8, -0.9));
          anselm.lookAt(cassian.headPosition()).setPose('reach');
        },
        say: { who: 'Anselm', text: 'Run! Cassian, run! Take the horse and do not look back!', mood: 'shout' },
      },
      {
        shot: () => overShoulder(cassian, anselm, { side: -1 }),
        run: () => cassian.setMood('crying').lookAt(anselm.headPosition()),
        say: { who: 'Cassian', text: 'Father, come with me! Please!', mood: 'crying' },
      },
      {
        shot: () => overShoulder(anselm, cassian, { push: 0.4 }),
        run: () => anselm.setPose('embrace').setMood('warm'),
        say: { who: 'Anselm', text: 'Keep it close, little brother. It will always know the way home.', mood: 'warm' },
      },
      {
        duration: 3.5,
        shot: { from: [-3, 1.6, 5], at: [3, 1.5, -3], fov: FOV.normal },
        run: () => {
          anselm.setPose('shout').setMood('angry').turnTo(Math.PI * 0.75);
          anselm.walkTo(2.5, -2, 1.2);
          hrolf.lookAt(anselm.headPosition());
        },
        narrate: 'He walked towards them with nothing in his hands.',
      },
      {
        duration: 5,
        sound: 'horn',
        shot: { from: [-1, 2.4, 14], at: cassian, to: [-8, 2.6, 20], fov: FOV.normal },
        run: () => {
          stage.mount(cassian, horse);
          cassian.setPose('reach').setMood('crying');
          horse.runTo(-16, 26, 7);
        },
        during: (_s, p) => {
          if (p > DROP.at) dropCross();
        },
      },
      {
        duration: 5,
        shot: { from: [DROP.x + 0.9, 0.55, DROP.z - 1.6], at: [DROP.x, 0.05, DROP.z], fov: FOV.extreme },
        run: dropCross,
        narrate: 'I dropped the cross. I did not go back for it.',
        fade: { to: 1, time: 4.5 },
      },
    ];
  },
};


export const prologueRoad: Cutscene = {
  id: 'prologue-road',
  create(stage: Stage): Beat[] {
    stage.light('rain');
    stage.weather('rain');
    stage.ground('#4A5A3A', 160);
    stage.box(SET_COLORS.dirt, [3, 0.06, 160], [0, 0, 0], 0, { castShadow: false });
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = -60 + i * 9;
      stage.box('#3A2E24', [0.3, 3 + (i % 3), 0.3], [side * (5 + (i % 4)), 1.6, z]);
      stage.box('#3A2E24', [1.4, 0.15, 0.15], [side * (5 + (i % 4)) + 0.4, 2.8, z], 0.4);
    }
    const cassian = cast(stage, 'cassianYoung', 'Cassian');
    const horse = stage.horse();
    horse.place(0, 20, Math.PI);
    stage.mount(cassian, horse);
    cassian.setPose('slump').setMood('sad');
    const bandits = [cast(stage, 'bandit', 'Bandit'), cast(stage, 'bandit', 'Bandit 2', { hair: '#5A3A22' }), cast(stage, 'bandit', 'Bandit 3')];
    bandits.forEach((b, i) => b.place(-6 + i * 6, -28 - (i % 2) * 2, (i - 1) * -0.6).root.setEnabled(false));

    return [
      {
        duration: 7,
        fade: { from: 1, to: 0, time: 2.5 },
        music: 'sorrow',
        shot: { from: [4, 2, 8], at: cassian, to: [3, 2.2, -2], fov: FOV.normal },
        run: () => horse.runTo(0, 4, 1.6),
        narrate: 'It rained for nine days. I do not remember where I meant to go.',
      },
      {
        duration: 4,
        shot: { from: [3, 1.2, 1], at: [0, 1.0, 4], fov: FOV.normal },
        run: () => {
          horse.place(0, 4, Math.PI);
          horse.falling = true;
          cassian.setMood('afraid');
        },
      },
      {
        shot: () => portrait(cassian, { angle: 0.5, distance: 2.4 }),
        run: () => {
          cassian.root.parent = stage.root;
          cassian.place(1.3, 4, -Math.PI / 2).setStance('pose').setPose('kneel').setMood('crying');
        },
        say: { who: 'Cassian', text: 'No. No, no, please. Get up. Please get up.', mood: 'crying' },
      },
      {
        duration: 6,
        shot: { from: [-3, 9, 18], at: [0, 0.8, -6], to: [-2, 12, 24], fov: FOV.normal },
        run: () => {
          cassian.setStance('pose').setPose('slump').setMood('sad');
          cassian.walkTo(0, -22, 1.0);
        },
        narrate: 'I walked. I was hungry, and then I was something worse than hungry.',
      },
      {
        duration: 3.5,
        shot: { from: [5, 1.6, -18], at: [0, 1.2, -25], fov: FOV.normal },
        run: () => {
          cassian.place(0, -22, Math.PI);
          for (const b of bandits) {
            b.root.setEnabled(true);
            b.walkTo(b.root.position.x * 0.3, -24.5, 2.6);
          }
          cassian.setMood('afraid').setPose('cower');
        },
      },
      {
        shot: () => portrait(bandits[1]!, { angle: 0.3, rise: -0.2 }),
        run: () => {
          const b = bandits[1]!;
          b.place(0, -24.4, 0).setMood('happy');
        },
        say: { who: 'Bandit 2', as: 'Bandit', text: 'Look at this. A little monk, all alone. The Romans pay well for strong backs.', mood: 'happy' },
      },
      {
        duration: 4,
        fade: { to: 1, time: 1.2 },
        sound: 'thunder',
        shot: { from: [0, 2.2, -20], at: [0, 1.0, -23.5], fov: FOV.close },
      },
      {
        duration: 5,
        narrate: 'They sold me to the Romans for eleven silver coins.',
      },
    ];
  },
};

/** The window shows the season: summer, autumn, winter, spring. */
const SEASONS = ['#9FD0F0', '#E8A85A', '#F4F6F8', '#B8E0A8'] as const;

export const prologuePrison: Cutscene = {
  id: 'prologue-prison',
  create(stage: Stage): Beat[] {
    stage.light('prison');
    const cell = prisonCell(stage);
    const panes = SEASONS.map((color) => stage.world.parts.part('box', color, cell.window, [0.98, 0.68, 0.04], [0, 0, 0.005], { castShadow: false }));
    const season = (i: number): void => panes.forEach((p, k) => p.setEnabled(k === i % SEASONS.length));
    season(0);
    // Sunbeam from the window.
    stage.box('#FFF0C8', [0.9, 0.04, 2.6], [0.6, 0.02, -0.6], 0.2, { castShadow: false });
    const young = cast(stage, 'cassianYoung', 'Cassian', { outfit: 'rags', hairStyle: 'short', beard: 'stubble' });
    const middle = cast(stage, 'cassianPrisoner', 'Cassian ', { beard: 'short', hairStyle: 'short' });
    const old = cast(stage, 'cassianPrisoner', 'Cassian  ');
    const show = (which: typeof young): void => {
      for (const a of [young, middle, old]) a.root.setEnabled(a === which);
    };
    young.place(-1.8, -0.2, Math.PI / 2).setStance('sit', true).setPose('slump', true).setMood('sad', true);
    middle.place(0.2, -1.2, Math.PI).setPose('punch', true).setMood('angry', true);
    old.place(-1.8, -0.2, Math.PI / 2).setStance('sit', true).setPose('fist', true).setMood('angry', true);
    show(young);
    const door = stage.box('#FFF6E0', [0.1, 2.2, 1.2], [2.38, 1.1, 1.2], 0, { castShadow: false });
    door.setEnabled(false);

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'sorrow',
        shot: { from: [1.8, 1.6, 2.2], at: young, fov: FOV.normal },
        narrate: 'A Roman cell. No trial. No name. Only a number painted on the door.',
      },
      {
        duration: 4,
        sound: 'chisel',
        shot: { from: [0.4, 1.4, -1.0], at: [-1.6, 1.1, -2.2], fov: FOV.close },
        run: () => {
          young.setStance('pose').place(-1.4, -1.6, Math.PI).setPose('reach');
        },
        during: (_s, p) => cell.tally(Math.ceil(p * 5)),
      },
      {
        duration: 8,
        shot: { from: [0.2, 2.0, 0.9], at: [0.6, 2.2, -2.2], to: [0.3, 1.7, 0.2], fov: FOV.normal },
        during: (_s, p) => {
          season(Math.floor(p * 12));
          cell.tally(5 + Math.floor(p * 90));
        },
        narrate: 'Seasons came and went in a square of sky.',
      },
      {
        duration: 5,
        sound: 'chisel',
        shot: { from: [1.6, 1.4, 1.4], at: middle, fov: FOV.normal },
        run: () => {
          show(middle);
          cell.tally(140);
        },
        during: (_s, p) => middle.setPose(Math.floor(p * 10) % 2 === 0 ? 'punch' : 'fist'),
        narrate: 'I prayed. Then I stopped praying. Then I made myself strong.',
      },
      {
        duration: 5,
        sound: 'heartbeat',
        shot: () => portrait(old, { angle: -0.6, distance: 2.0, fov: FOV.extreme, push: 0.3 }),
        run: () => {
          show(old);
          cell.tally(220);
          old.trembling = true;
        },
        narrate: 'Every night I saw the red-haired man in the firelight.',
      },
      {
        duration: 3.5,
        sound: 'door',
        shot: () => portrait(old, { angle: -1.2, distance: 2.6 }),
        run: () => {
          old.trembling = false;
          door.setEnabled(true);
          old.setPose('stand').setMood('surprised').lookAt({ x: 2.4, y: 1.4, z: 1.2 });
        },
        say: { who: 'Guard', text: 'You. Up. Your debt is paid. Get out.', mood: 'neutral', as: 'A voice' },
      },
      {
        duration: 4.5,
        music: 'hope',
        shot: { from: [-1.8, 1.5, -1.6], at: [2.3, 1.3, 1.2], fov: FOV.normal },
        run: () => {
          old.setStance('pose').setPose('stand').setMood('neutral');
          old.walkTo(2.0, 1.2, 0.9);
        },
        fade: { to: 1, color: 'white', time: 4 },
      },
      {
        duration: 5,
        fade: { to: 1, color: 'black', time: 0.6 },
        title: { text: 'Tumblehorde', sub: 'The story of Cassian' },
      },
    ];
  },
};

