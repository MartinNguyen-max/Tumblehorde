import type { TransformNode } from '../../render/babylon.ts';
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

/** The fleet: a first wave beaching at once, a second rounding the bend behind it. */
const FLEET = {
  /** Every ship rows at the same speed (m/s); they only start at different times. */
  speed: 7,
  first: [
    { x: RIVER_X, from: -45, to: 9, delay: 0 },
    { x: RIVER_X + 4, from: -55, to: 14, delay: 0.6 },
    { x: RIVER_X - 1.5, from: -66, to: 4, delay: 1.2 },
  ],
  second: [
    { x: RIVER_X + 2, from: -95, to: -4, delay: 0 },
    { x: RIVER_X + 5.5, from: -104, to: -12, delay: 0.5 },
    { x: RIVER_X - 1, from: -112, to: -20, delay: 1 },
    { x: RIVER_X + 3, from: -122, to: -28, delay: 1.5 },
    { x: RIVER_X + 6, from: -130, to: -36, delay: 2 },
  ],
} as const;
/** Where the raiders come ashore (south of the houses), and the gap they run through into the yard. */
const LANDING = { x: RIVER_X - 4, z: 10 } as const;
const YARD_GATE = { x: 8.5, z: 10.5 } as const;
/** Where the brothers stand in the yard, and where the raider who reaches each one ends up. */
const BROTHERS = [
  { x: -5, z: -3 }, { x: 1.2, z: -4.2 }, { x: -2.5, z: -6 }, { x: 5.5, z: 0.5 }, { x: -7, z: 1.5 }, { x: 1, z: -1.5 },
] as const;
const BROTHER_NAMES = ['Brother Paul', 'Brother Tomas', 'Brother Ivo', 'Brother Benet', 'Brother Odo', 'Brother Simon'] as const;
const RAIDERS = 14;

export const prologueRaid: Cutscene = {
  id: 'prologue-raid',
  create(stage: Stage): Beat[] {
    const tower = buildMonastery(stage);
    river(stage);
    stage.light('night');
    const first = FLEET.first.map((b) => dragonBoat(stage, b.x, b.from, 0));
    const second = FLEET.second.map((b) => dragonBoat(stage, b.x, b.from, 0));
    const cassian = cast(stage, 'cassianYoung', 'Cassian').place(0.5, 2, Math.PI / 2);
    const cross = upright(woodenCross(stage.world.parts, cassian.grips[0], 1.3));
    const anselm = cast(stage, 'anselm', 'Anselm').place(-3, -5, 0.4);
    const monks = BROTHERS.map((at, i) => cast(stage, 'monk', BROTHER_NAMES[i] ?? 'Brother', i % 2 === 1 ? { hair: HAIR_BLACK } : {}).place(at.x, at.z, 0.2 + i * 0.7));
    const hrolf = cast(stage, 'hrolf', 'Hrolf').place(LANDING.x - 1.5, LANDING.z - 1.5, -Math.PI / 2);
    const raiders = Array.from({ length: RAIDERS }, (_, i) =>
      cast(stage, 'viking', `Raider ${i}`, i % 3 === 0 ? { hair: '#C8823A', beardColor: '#C8823A' } : {}).place(LANDING.x + (i % 4) * 1.2, LANDING.z + Math.floor(i / 4) * 1.6, -Math.PI / 2),
    );
    for (const [i, raider] of [hrolf, ...raiders].entries()) {
      if (i % 2 === 0) {
        const t = torch(stage.world.parts, raider.grips[0]);
        t.rotation.x = Math.PI;
        stage.flame(childNode('torch-head', t, 0, TORCH_HEAD, 0));
      }
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
      stage.fire(-9, -9, 1.6, 2.5);
      stage.fire(9, 3, 1.2, 1.5);
    };
    let burning = false;
    const fallen = new Set<number>();
    /** Brother `i` is cut down by the raider sent to him; no blood, he just falls. */
    const cutDown = (i: number): void => {
      if (fallen.has(i)) return;
      fallen.add(i);
      monks[i]?.setPose('lie').setMood('afraid');
      raiders[i]?.setPose('punch');
    };
    let toppled = false;
    const topple = (p: number): void => {
      // The tower leans, then goes over all at once, and burns where it lands.
      const fall = Math.min(1, p * p * 1.6);
      tower.rotation.z = -fall * 1.45;
      tower.position.x = 2.5 + fall * 1.2;
      if (fall >= 1 && !toppled) {
        toppled = true;
        stage.fire(9, -9.5, 2.4, 0.8);
        stage.fire(13, -9.5, 1.8, 0.6);
      }
    };
    const dropCross = (): void => {
      if (cross.parent === stage.root) return;
      cross.parent = stage.root;
      cross.position.set(DROP.x, 0.05, DROP.z);
      cross.rotation.set(Math.PI / 2, 0.6, 0);
    };
    /** Ships `seconds` into their row: all at one speed, each from its own start time. */
    const sail = (boats: readonly TransformNode[], plan: readonly { from: number; to: number; delay: number }[], seconds: number): void => {
      boats.forEach((boat, i) => {
        const b = plan[i];
        if (b) boat.position.z = Math.min(b.to, b.from + Math.max(0, seconds - b.delay) * FLEET.speed);
      });
    };
    const ARRIVED = 30;
    /** Where raider `i` stops: next to the brother he goes for, or by the houses. */
    const goalOf = (i: number): { x: number; z: number } => {
      const brother = BROTHERS[i];
      return brother ? { x: brother.x + 1.1, z: brother.z - 0.4 } : { x: -4 + (i % 5) * 2.4, z: 2 + (i % 3) * 1.5 };
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
        during: (_s, p) => sail(first, FLEET.first, p * 6),
        narrate: 'Then, one autumn night, the river brought dragons.',
      },
      {
        shot: () => portrait(cassian, { angle: 0.3 }),
        run: () => {
          sail(first, FLEET.first, 6);
          cassian.setMood('surprised').lookAt({ x: RIVER_X, y: 2, z: -10 });
        },
        sound: 'horn',
        say: { who: 'Cassian', text: 'Brothers? Brothers! There are ships on the river!', mood: 'afraid' },
      },
      {
        duration: 6,
        sound: 'horn',
        shot: { from: [RIVER_X - 12, 13, 14], at: [RIVER_X + 2, 0, -34], to: [RIVER_X - 10, 15, 18], fov: FOV.wide },
        during: (_s, p) => {
          sail(first, FLEET.first, 6 + p * 6);
          sail(second, FLEET.second, p * 8);
        },
        narrate: 'Not one ship. Not three. They kept coming round the bend, one dragon after another.',
      },
      {
        shot: () => portrait(cassian, { angle: -0.4, distance: 1.6 }),
        run: () => cassian.setMood('afraid'),
        say: { who: 'Cassian', text: 'Eight... nine... how many are there?!', mood: 'afraid' },
      },
      {
        duration: 4,
        music: 'dread',
        shot: () => portrait(hrolf, { angle: 0.2, distance: 3.2, rise: -0.45 }),
        run: () => {
          sail(first, FLEET.first, ARRIVED);
          sail(second, FLEET.second, ARRIVED);
          for (const raider of [hrolf, ...raiders]) raider.root.setEnabled(true);
          hrolf.setMood('angry');
        },
      },
      {
        shot: () => portrait(hrolf, { angle: 0.1, distance: 2.6, rise: -0.3, push: 0.4 }),
        say: { who: 'Hrolf', text: 'Burn it. All of it. Leave nothing standing.', mood: 'shout', as: 'The red-haired man' },
      },
      {
        duration: 5,
        sound: 'crowd',
        shot: { from: [RIVER_X - 3, 3.4, 0], at: [RIVER_X - 8, 1.2, 11], to: [RIVER_X - 6, 3.8, -1], fov: FOV.wide },
        run: () => {
          // Up from the boats, through the gap by the garden wall, then at the brothers.
          raiders.forEach((raider, i) => raider.setMood('shout').walkTo(YARD_GATE.x - (i % 3), YARD_GATE.z + (i % 2), 4.5 + (i % 3) * 0.6));
          hrolf.walkTo(YARD_GATE.x + 1, YARD_GATE.z + 2, 2.2);
        },
        during: (_s, p) => {
          if (p < 0.55) return;
          raiders.forEach((raider, i) => {
            const goal = goalOf(i);
            raider.walkTo(goal.x, goal.z, 4.5 + (i % 3) * 0.6);
          });
          hrolf.walkTo(5, 1.5, 2.2);
        },
        narrate: 'They came up from the river screaming, all of them at once.',
      },
      {
        duration: 6,
        sound: 'fire',
        shot: { from: [-8, 6, 14], at: [0, 3, -6], to: [-6, 4, 11], fov: FOV.wide },
        run: () => {
          if (!burning) burn();
          burning = true;
          raiders.forEach((raider, i) => {
            const goal = goalOf(i);
            raider.walkTo(goal.x, goal.z, 5);
          });
          for (const monk of monks) monk.setPose('cower').setMood('afraid');
        },
        during: (_s, p) => {
          monks.forEach((_m, i) => {
            if (p > 0.25 + i * 0.11) cutDown(i);
          });
        },
        narrate: 'The brothers had never held a sword. Not one of them ran.',
      },
      {
        duration: 4.5,
        sound: 'thunder',
        shot: { from: [-6, 2.5, 4], at: [4, 6, -9], fov: FOV.wide },
        during: (_s, p) => topple(p),
      },
      {
        shot: () => overShoulder(anselm, cassian),
        run: () => {
          topple(1);
          monks.forEach((_m, i) => cutDown(i));
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
          hrolf.setPose('punch');
          anselm.setPose('lie');
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

/** The road south: pines pressed close on both sides, dead trees, mud. */
const ROAD = { length: 150, step: 2.3, width: 4, rows: [4.8, 7.6, 10.8, 14.6] } as const;
const PINES = ['#24402C', '#2C4A32', '#1E3626'] as const;
/** A mushroom, eaten on the fourth day. */
const MUSHROOM = { cap: '#C8423A', stem: '#E8E0CC' } as const;

export function roadForest(stage: Stage): void {
  stage.box(SET_COLORS.dirt, [ROAD.width, 0.06, ROAD.length], [0, 0, 0], 0, { castShadow: false });
  let i = 0;
  for (let z = -ROAD.length / 2; z < ROAD.length / 2; z += ROAD.step) {
    for (const [row, x] of ROAD.rows.entries()) {
      for (const side of [-1, 1]) {
        i++;
        const jitter = Math.sin(i * 12.9898) * 0.8;
        const s = 1.1 + ((i * 7) % 5) * 0.18 + row * 0.15;
        const px = side * (x + jitter);
        const pz = z + Math.cos(i * 4.1) * 0.7;
        if (i % 11 === 0) {
          // A dead tree, bare and black.
          stage.box('#3A2E24', [0.3, 3 + (i % 3), 0.3], [px, 1.6, pz], 0, { castShadow: row === 0 });
          stage.box('#3A2E24', [1.4, 0.15, 0.15], [px + 0.4, 2.8, pz], 0.4, { castShadow: false });
          continue;
        }
        stage.box('#4A3424', [0.4 * s, 1.6 * s, 0.4 * s], [px, 0.8 * s, pz], 0, { castShadow: false });
        stage.shape('cone', PINES[i % PINES.length] ?? STORY_COLORS.pine, [1.5 * s, 3.4 * s, 1.5 * s], [px, 3.0 * s, pz], { castShadow: row === 0 });
        stage.shape('cone', PINES[(i + 1) % PINES.length] ?? STORY_COLORS.pine, [1.0 * s, 2.4 * s, 1.0 * s], [px, 4.6 * s, pz], { castShadow: false });
      }
    }
  }
  // Puddles on the road.
  for (let k = 0; k < 12; k++) stage.box('#3A4A5A', [1.2 + (k % 3) * 0.4, 0.07, 0.9], [((k % 3) - 1) * 0.6, 0.01, -60 + k * 11], k * 0.7, { castShadow: false });
}

export const prologueRoad: Cutscene = {
  id: 'prologue-road',
  create(stage: Stage): Beat[] {
    stage.light('night');
    stage.ground('#3A4A30', 160, 'forest');
    roadForest(stage);
    const cassian = cast(stage, 'cassianYoung', 'Cassian');
    const horse = stage.horse();
    horse.place(0, 62, Math.PI);
    stage.mount(cassian, horse);
    cassian.setPose('reach').setMood('crying');
    const mushroom = stage.group('mushroom', 2.6, 0, 14.6);
    stage.world.parts.part('box', MUSHROOM.stem, mushroom, [0.08, 0.14, 0.08], [0, 0.07, 0]);
    stage.world.parts.part('dome', MUSHROOM.cap, mushroom, [0.22, 0.14, 0.22], [0, 0.14, 0]);
    const bandits = [cast(stage, 'bandit', 'Bandit'), cast(stage, 'bandit', 'Bandit 2', { hair: '#5A3A22' }), cast(stage, 'bandit', 'Bandit 3')];
    bandits.forEach((b, i) => b.place(-6 + i * 6, -28 - (i % 2) * 2, (i - 1) * -0.6).root.setEnabled(false));
    const day = (light: 'rain' | 'dusk' | 'night', rain: boolean): void => {
      stage.light(light);
      stage.weather(rain ? 'rain' : 'none');
    };

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 1.5 },
        music: 'sorrow',
        sound: 'wind',
        shot: { from: [2.4, 2.2, 54], at: cassian, to: [2.2, 2.0, 34], fov: FOV.wide },
        run: () => horse.runTo(0, 32, 8),
        narrate: 'I rode into the forest and did not stop. The trees closed behind me like a door.',
      },
      {
        duration: 6,
        shot: { from: [4, 2, 30], at: cassian, to: [3, 2.2, 20], fov: FOV.normal },
        run: () => {
          day('rain', true);
          horse.place(0, 31, Math.PI);
          horse.runTo(0, 20, 1.4);
          cassian.setPose('slump').setMood('sad');
        },
        narrate: 'Then it rained. It rained for nine days.',
      },
      {
        duration: 4,
        shot: () => portrait(cassian, { angle: 0.8, distance: 2.6, rise: 0.2 }),
        run: () => {
          horse.place(0.4, 15.6, Math.PI);
          cassian.root.parent = stage.root;
          cassian.place(2.2, 15.2, Math.PI * 0.6).setStance('sit').setPose('hunch').setMood('sad');
          cassian.trembling = true;
        },
        narrate: 'The fourth day. Nothing to eat but what the forest gave.',
      },
      {
        duration: 3,
        shot: { from: [1.0, 1.0, 13.8], at: [2.4, 0.6, 14.9], fov: FOV.close },
        run: () => {
          cassian.trembling = false;
          mushroom.parent = cassian.grips[0];
          mushroom.position.set(0, 0.05, 0.05);
          cassian.setPose('offer').setMood('happy');
        },
      },
      {
        duration: 3.5,
        shot: () => portrait(cassian, { angle: 0.4, distance: 1.7 }),
        run: () => {
          mushroom.setEnabled(false);
          cassian.setPose('clutch').setMood('afraid');
          cassian.trembling = true;
        },
        narrate: 'The forest gave me a very bad mushroom.',
      },
      {
        duration: 4,
        shot: { from: [3, 1.2, 1], at: [0, 1.0, 4], fov: FOV.normal },
        run: () => {
          cassian.trembling = false;
          cassian.setStance('pose');
          day('dusk', true);
          stage.mount(cassian, horse);
          cassian.setPose('slump').setMood('sad');
          horse.place(0, 4, Math.PI);
          horse.falling = true;
        },
        narrate: 'The sixth day.',
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
          day('night', true);
          cassian.setStance('pose').setPose('slump').setMood('sad');
          cassian.walkTo(0, -14, 0.9);
        },
        narrate: 'I walked. I was hungry, and then I was something worse than hungry.',
      },
      {
        duration: 5,
        shot: { from: [2.2, 0.9, -11.5], at: [0, 0.3, -14.5], fov: FOV.normal },
        run: () => {
          cassian.place(0.3, -14.5, Math.PI / 2).setPose('lie').setMood('sad');
          cassian.eyesClosed = true;
        },
        narrate: 'The ninth night I lay down in the mud and did not care if I got up.',
      },
      {
        duration: 3.5,
        shot: { from: [1.2, 1.6, -17], at: [0, 1.2, -25], fov: FOV.normal },
        tags: [{ who: 'Bandit 2', text: 'Bandits' }],
        run: () => {
          day('rain', false);
          cassian.eyesClosed = false;
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


export const prologuePrison: Cutscene = {
  id: 'prologue-prison',
  create(stage: Stage): Beat[] {
    stage.light('prison');
    const cell = prisonCell(stage);
    const season = cell.season;
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
    // The daily bowl, and the rat that shares it.
    const bowl = stage.group('bowl', 1.9, 0, 1.2);
    stage.world.parts.part('cylinder', '#6A5A48', bowl, [0.22, 0.12, 0.22], [0, 0.06, 0]);
    stage.world.parts.part('cylinder', '#8E8A7A', bowl, [0.18, 0.02, 0.18], [0, 0.12, 0]);
    bowl.setEnabled(false);
    const rat = stage.group('rat', 1.2, 0, -1.8);
    stage.world.parts.part('box', '#6E6A66', rat, [0.16, 0.12, 0.3], [0, 0.06, 0]);
    stage.world.parts.part('box', '#6E6A66', rat, [0.1, 0.09, 0.12], [0, 0.08, 0.2]);
    stage.world.parts.part('box', '#C89A9A', rat, [0.03, 0.03, 0.34], [0, 0.04, -0.3]);
    rat.setEnabled(false);

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'sorrow',
        shot: { from: [1.8, 1.6, 2.2], at: young, fov: FOV.normal },
        narrate: 'A Roman cell. No trial. No name. Only a number painted on the door.',
      },
      {
        duration: 5,
        sound: 'door',
        shot: { from: [-0.2, 1.1, 2.8], at: [1.5, 0.2, 0.0], fov: FOV.normal },
        run: () => {
          bowl.setEnabled(true);
          rat.setEnabled(true);
        },
        during: (_s, p) => {
          // The rat gets there first.
          rat.position.set(1.2 + p * 0.55, 0, -1.8 + p * 2.8);
          rat.rotation.y = Math.atan2(0.55, 2.8);
        },
        narrate: 'Once a day, a bowl of something grey. I shared it with a rat. I named him Augustus.',
      },
      {
        duration: 3.5,
        shot: { from: [-1.0, 1.5, 2.4], at: [1.2, 0.6, 0.6], fov: FOV.normal },
        run: () => {
          young.setStance('pose').place(0.6, -0.2, 0.75).setPose('reach').setMood('angry');
          rat.position.set(1.75, 0, 1.0);
        },
        say: { who: 'Cassian', text: 'Augustus. That is MY half.', mood: 'angry' },
      },
      {
        duration: 4,
        sound: 'chisel',
        shot: { from: [0.4, 1.4, -1.0], at: [-1.6, 1.1, -2.2], fov: FOV.close },
        run: () => {
          bowl.setEnabled(false);
          rat.setEnabled(false);
          young.setStance('pose').place(-1.4, -1.6, Math.PI).setPose('reach').setMood('sad');
        },
        during: (_s, p) => cell.tally(Math.ceil(p * 5)),
      },
      {
        duration: 12,
        shot: { from: [0.5, 2.2, 0.4], at: [1.0, 2.6, -4], to: [0.8, 2.4, -1.2], fov: FOV.normal },
        during: (_s, p) => {
          season(Math.floor(p * 12));
          cell.tally(5 + Math.floor(p * 90));
        },
        narrate: 'Seasons came and went in a square of sky.',
      },
      {
        duration: 5,
        shot: () => portrait(young, { angle: -0.5, distance: 2.2, rise: 0.3 }),
        run: () => {
          season(2);
          young.place(-1.8, -0.2, Math.PI / 2).setStance('sit').setPose('hunch').setMood('crying');
          young.trembling = true;
        },
        during: (_s, p) => {
          if (p > 0.9) young.trembling = false;
        },
        narrate: 'Winters were the worst. The stone drank the warmth out of you. I stopped counting the days. The wall did not.',
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

