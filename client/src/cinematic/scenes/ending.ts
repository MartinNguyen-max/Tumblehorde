import { CAPITAL } from '../../campaign/districts.ts';
import { Crowd, type Seat } from '../../render/crowd.ts';
import { type TransformNode, Vector3 } from '../../render/babylon.ts';
import type { Actor } from '../actor.ts';
import { cast } from '../cast.ts';
import { sword, upright, woodenCross } from '../props.ts';
import type { Beat, Cutscene, StoryContext } from '../script.ts';
import { FOV, overShoulder, portrait } from '../shot.ts';
import type { Stage } from '../stage.ts';
import { grave, STORY_COLORS, throneRoom } from '../storySets.ts';
import { roadForest } from './prologueNight.ts';

/**
 * The years after: the city rebuilt, Cassian's two sons, his last patrol and his death, the
 * crowning that split his family, each son's road, and the end.
 *
 * After Cassian dies, Livia tells the story.
 */

const SET = {
  statue: '#B8B4AC',
  baby: '#F0E6D8',
  scaffold: '#8A6A42',
  wedding: '#F4F0E6',
  candle: '#FFD27A',
  pyre: '#6A4A2A',
  grain: '#D8B860',
  wagon: '#7A5A32',
  mist: '#8EA8A0',
} as const;

const isMarcus = (story: StoryContext) => (): boolean => story.save.choices.son === 'marcus';
const isLucius = (story: StoryContext) => (): boolean => story.save.choices.son !== 'marcus';

/** The two babies: Marcus with the face of the east, Lucius with his father's. */
const BABY = {
  marcus: { skin: '#C98E66', hair: '#2A1E18', eyeHeight: 0.022 },
  lucius: { skin: '#E8B894', hair: '#5A3A22', eyeHeight: 0.04 },
} as const;

/** A baby wrapped in linen, its face looking out of the end of the bundle (+z). */
function swaddledBaby(stage: Stage, look: (typeof BABY)[keyof typeof BABY]): TransformNode {
  const g = stage.group('baby', 0, -10, 0);
  const p = stage.world.parts;
  const soft = { gloss: true, castShadow: false };
  p.part('box', SET.baby, g, [0.32, 0.24, 0.46], [0, 0, -0.04], soft);
  p.part('box', '#E0D4C0', g, [0.34, 0.06, 0.2], [0, 0.1, 0.02], soft);
  const head = 0.22;
  p.part('box', look.skin, g, [head, head, head], [0, 0.06, 0.24], soft);
  p.part('box', look.hair, g, [head + 0.01, 0.06, head * 0.8], [0, 0.18, 0.22], soft);
  p.part('box', look.hair, g, [0.05, 0.05, 0.05], [0, 0.22, 0.28], soft);
  for (const side of [-1, 1]) {
    p.part('box', '#1B1B22', g, [0.05, look.eyeHeight, 0.01], [side * 0.05, 0.08, 0.351], soft);
    p.part('box', '#F08A8A', g, [0.04, 0.025, 0.01], [side * 0.075, 0.03, 0.351], soft);
  }
  p.part('box', '#B85A5A', g, [0.04, 0.015, 0.01], [0, 0.015, 0.351], soft);
  return g;
}

/** People standing round a spot in the capital square, facing it. */
function ringOfPeople(stage: Stage, cx: number, cz: number, inner: number, rows: number, excitement: number): Crowd {
  const scale = 1.5;
  const seats: Seat[] = [];
  for (let r = 0; r < rows; r++) {
    const radius = inner + r * 1.2;
    const count = Math.floor((2 * Math.PI * radius) / 1.1);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + r * 0.3;
      seats.push({ x: (cx + Math.sin(a) * radius) / scale, y: 0, z: (cz + Math.cos(a) * radius) / scale, yaw: a + Math.PI });
    }
  }
  const root = stage.group('people');
  root.scaling.setAll(scale);
  const crowd = new Crowd(stage.world.parts, root, seats);
  crowd.excitement = excitement;
  stage.animate((_dt, t) => crowd.update(t));
  return crowd;
}

/** Scaffolding against a house front: poles, planks, a ladder. */
function scaffold(stage: Stage, x: number, z: number, yaw: number): void {
  const g = stage.group('scaffold', x, 0, z);
  g.rotation.y = yaw;
  const p = stage.world.parts;
  for (const px of [-2, 0, 2]) p.part('box', SET.scaffold, g, [0.14, 7, 0.14], [px, 3.5, 0]);
  for (const y of [2.5, 5]) p.part('box', SET.scaffold, g, [4.6, 0.12, 0.8], [0, y, 0.2]);
  p.part('box', SET.scaffold, g, [0.5, 5, 0.08], [2.6, 2.4, 0.5]).rotation.z = 0.15;
}

export const rebuilding: Cutscene = {
  id: 'rebuilding',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('goldenMorning');
    CAPITAL.build(stage);
    for (const [x, z, yaw] of [[-12, -17.2, 0], [12, -17.2, 0], [-23, 8, Math.PI / 2], [23, -10, -Math.PI / 2]] as const) scaffold(stage, x, z, yaw);
    const cassian = cast(stage, 'cassianCommander', 'Cassian').place(-0.8, 6, Math.PI);
    const livia = cast(stage, 'livia', 'Livia', { color: SET.wedding }).place(0.8, 6, Math.PI);
    const felix = cast(stage, 'felixLegion', 'Felix', { helmet: false }).place(-3, 9, Math.PI);
    const rufus = cast(stage, 'rufusLegion', 'Rufus', { helmet: false }).place(3, 9, Math.PI);
    const eirik = cast(stage, 'eirik', 'Eirik').place(4.4, 9.6, Math.PI);
    if (story.save.choices.eirikSpared !== true) eirik.root.setEnabled(false);
    const beam = stage.group('beam', 3.6, 1.3, 9.6);
    stage.world.parts.part('box', SET.scaffold, beam, [0.3, 0.3, 4], [0, 0, 0]);
    beam.parent = rufus.grips[0];
    beam.position.set(0, 0, 0);
    const crowd = ringOfPeople(stage, 0, 4, 7, 3, 0.8);
    const statue = cast(stage, 'varro', 'Statue', { skin: SET.statue, hair: SET.statue, beardColor: SET.statue, color: SET.statue, scar: false });
    statue.place(-14, -6, Math.PI / 2).setPose('fist', true).setMood('angry', true);
    statue.root.scaling.setAll(2.2);
    statue.root.position.y = 1.2;
    stage.box(SET.statue, [3, 1.2, 3], [-14, 0.6, -6]);
    const baby = swaddledBaby(stage, BABY.marcus);
    const secondBaby = swaddledBaby(stage, BABY.lucius);
    const whisperers = Array.from({ length: 4 }, (_, i) => cast(stage, 'villager', `Townswoman ${i}`, { outfit: i % 2 === 0 ? 'healer' : 'villager', color: ['#8A6A9A', '#6A8A5A'][i % 2], hairStyle: 'long' }).place(6 + i * 1.1, 1 + (i % 2), -Math.PI / 2));

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2.5 },
        music: 'hope',
        shot: { from: [0, 14, 26], at: [0, 2, -4], to: [0, 10, 20], fov: FOV.wide },
        run: () => {
          crowd.excitement = 0.3;
          for (const a of [cassian, livia]) a.root.setEnabled(false);
        },
        narrate: 'We rebuilt the city stone by stone. Roofs, walls, the fountain. Livia\'s garden. Her fence.',
      },
      {
        duration: 3.5,
        shot: () => portrait(rufus, { angle: 0.6, distance: 3 }),
        run: () => rufus.setPose('offer').setMood('happy'),
        during: (_s, p) => {
          if (p > 0.5) {
            rufus.setPose('lie').setMood('surprised');
            beam.parent = stage.root;
            beam.position.set(3.4, 0.2, 9.2);
          }
        },
        say: { who: 'Rufus', text: 'Leave it to me! I carried a whole legion once! Well. Their luggage.', mood: 'happy' },
      },
      {
        duration: 2.4,
        shot: () => portrait(rufus, { angle: 1.2, distance: 2.2, rise: 0.4 }),
        say: { who: 'Rufus', text: 'I am FINE!', mood: 'surprised' },
      },
      {
        duration: 5,
        sound: 'crowd',
        shot: { from: [0, 3, -6], at: [0, 1.8, 6], to: [0, 3.4, -8], fov: FOV.wide },
        run: () => {
          for (const a of [cassian, livia]) a.root.setEnabled(true);
          rufus.setPose('stand').setMood('happy');
          crowd.excitement = 1;
          stage.weather('petals');
        },
        narrate: 'The Emperor was dead, and the Senate needed someone. The people shouted one name until the Senate gave in.',
      },
      {
        shot: () => overShoulder(livia, cassian),
        run: () => {
          livia.setMood('happy').lookAt(cassian.headPosition());
          cassian.lookAt(livia.headPosition());
        },
        say: { who: 'Cassian', text: 'I asked for a fence. Not a crown.', mood: 'warm' },
      },
      {
        shot: () => overShoulder(cassian, livia, { side: -1 }),
        say: { who: 'Livia', text: 'Then you will have both. And a wife who reminds you which one matters.', mood: 'happy' },
      },
      {
        duration: 3,
        shot: () => portrait(felix, { angle: 0.4 }),
        run: () => felix.setMood('crying'),
        say: { who: 'Rufus', text: 'Felix is crying.', mood: 'happy' },
      },
      {
        duration: 3,
        shot: () => portrait(rufus, { angle: -0.4 }),
        run: () => rufus.setMood('crying'),
        say: { who: 'Felix', text: 'So are you!', mood: 'happy' },
      },
      {
        duration: 5,
        shot: { from: [-9, 2, -2], at: [-14, 4.5, -6], to: [-10, 1.6, -1], fov: FOV.normal },
        narrate: 'In the square, they raised a statue of Varro. Hammer in hand, scowling at the pigeons.',
      },
      {
        duration: 5,
        music: 'warm',
        shot: () => portrait(livia, { angle: -0.4, distance: 2.4 }),
        run: () => {
          stage.weather('none');
          crowd.excitement = 0.2;
          livia.setPose('cradle').setMood('warm');
          baby.parent = livia.grips[1];
          baby.position.set(0.2, -0.05, 0.1);
        },
        narrate: 'In the spring, a son was born.',
      },
      {
        duration: 5,
        run: () => {
          // Held up in her arms, face to us.
          const h = livia.headPosition();
          baby.parent = stage.root;
          baby.rotation.set(-0.5, livia.yaw, 0);
          baby.position.set(h.x + Math.sin(livia.yaw) * 0.42, h.y - 0.55, h.z + Math.cos(livia.yaw) * 0.42);
        },
        shot: () => {
          baby.computeWorldMatrix(true);
          const p = baby.getAbsolutePosition();
          const f = baby.getDirection(Vector3.Forward());
          return { from: [p.x + f.x * 0.9, p.y + f.y * 0.9 + 0.25, p.z + f.z * 0.9], at: [p.x + f.x * 0.25, p.y + 0.08, p.z + f.z * 0.25], fov: FOV.close };
        },
        narrate: 'He had black hair, a round little face, and the eyes of the far east. Everyone who looked at him knew.',
      },
      {
        shot: () => portrait(whisperers[1]!, { angle: 0.3 }),
        run: () => {
          for (const w of whisperers) w.setMood('angry').lookAt(livia.headPosition());
        },
        say: { who: 'Townswoman 1', as: 'A woman in the crowd', text: 'Look at him. The Mongol\'s child. In the palace.', mood: 'angry' },
      },
      {
        duration: 3,
        shot: () => portrait(livia, { angle: -0.3, distance: 2 }),
        run: () => livia.setMood('crying'),
        sound: 'heartbeat',
      },
      {
        shot: () => portrait(cassian, { angle: 0.5, distance: 3.6, rise: 0.4, fov: FOV.normal }),
        run: () => {
          baby.parent = cassian.grips[0];
          baby.position.set(0, 0.2, 0.1);
          cassian.setPose('cheer').setMood('angry');
        },
        say: { who: 'Cassian', text: 'This is my son. His name is Marcus. Whoever calls him anything else will answer to me.', mood: 'shout' },
      },
      {
        duration: 4,
        shot: { from: [5, 2, 0], at: [0, 2.6, 6], fov: FOV.normal },
        run: () => {
          for (const w of whisperers) w.setMood('afraid').lookAt(null);
          crowd.excitement = 0.6;
        },
        narrate: 'Nobody said it to his face again. Not while Cassian lived.',
      },
      {
        duration: 5,
        shot: () => portrait(livia, { angle: 0.5, distance: 2.6 }),
        run: () => {
          baby.setEnabled(false);
          secondBaby.parent = livia.grips[1];
          secondBaby.position.set(0.2, -0.05, 0.1);
          livia.setMood('happy');
          cassian.setPose('embrace').setMood('warm');
        },
        narrate: 'Two years later, another boy. We named him Lucius, after the son Varro lost. Brown hair, and his father\'s stubborn chin.',
        fade: { to: 1, time: 4 },
      },
    ];
  },
};

export const twoBoys: Cutscene = {
  id: 'two-boys',
  create(stage: Stage): Beat[] {
    stage.light('day');
    CAPITAL.build(stage);
    const marcusBoy = cast(stage, 'marcusBoy', 'Marcus').place(16, 10, Math.PI);
    const luciusBoy = cast(stage, 'luciusBoy', 'Lucius').place(13.5, 12, Math.PI * 0.8);
    const bullies = Array.from({ length: 3 }, (_, i) => cast(stage, 'villager', `Boy ${i}`, { age: 'child', color: ['#8A7A5A', '#5A7A9A', '#9A5A4A'][i] }).place(14 + i * 1.2, 7.2, 0).setMood('angry'));
    const cassian = cast(stage, 'cassianGrey', 'Cassian').place(6, 6, Math.PI / 2);
    const marcus = cast(stage, 'marcusRoman', 'Marcus ').place(16, 10, -Math.PI / 2);
    const lucius = cast(stage, 'luciusBare', 'Lucius ').place(13, 13, -Math.PI / 2);
    for (const a of [marcus, lucius]) a.root.setEnabled(false);
    const senators = Array.from({ length: 3 }, (_, i) => cast(stage, 'emperor', `Senator ${i}`, { hair: '#9A9690', beard: i === 1 ? 'long' : 'short', beardColor: '#9A9690' }).place(4 + i * 1.2, 16, Math.PI * 0.7));
    for (const s of senators) s.root.setEnabled(false);

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 2 },
        music: 'warm',
        shot: { from: [18, 3, 1], at: [15, 1, 9], to: [17, 2.6, 3], fov: FOV.normal },
        narrate: 'The boys grew up in the training yard, the way their father had grown up in a cell: fighting.',
      },
      {
        shot: () => portrait(bullies[1]!, { angle: 0.3, distance: 2.2 }),
        run: () => {
          for (const b of bullies) b.setPose('point');
          marcusBoy.setMood('angry').lookAt(bullies[1]!.headPosition());
        },
        say: { who: 'Boy 1', as: 'A boy', text: 'Go back east, Mongol! Go back to your real father!', mood: 'angry' },
      },
      {
        duration: 2.6,
        shot: () => portrait(marcusBoy, { angle: -0.3, distance: 1.8 }),
        run: () => {
          marcusBoy.setPose('punch').setMood('shout');
          bullies[1]!.setPose('lie').setMood('surprised');
        },
        sound: 'thunder',
      },
      {
        duration: 3,
        shot: () => portrait(luciusBoy, { angle: 0.3, distance: 1.8 }),
        run: () => luciusBoy.setPose('cheer').setMood('happy'),
        say: { who: 'Lucius', text: 'Again! Hit him again, Marcus!', mood: 'happy' },
      },
      {
        shot: () => overShoulder(cassian, marcusBoy),
        run: () => {
          for (const b of bullies) b.walkTo(b.root.position.x + 8, 0, 4);
          cassian.place(15, 8.6, 0).setPose('kneel');
          marcusBoy.setPose('stand').setMood('crying').lookAt(cassian.headPosition());
        },
        say: { who: 'Marcus', text: 'Is it true, father? That I am not yours?', mood: 'crying' },
      },
      {
        shot: () => portrait(cassian, { angle: 0.3, distance: 2.0, rise: 0.2 }),
        run: () => cassian.setMood('warm').lookAt(marcusBoy.headPosition()),
        say: { who: 'Cassian', text: 'I was raised by monks who were not my blood. They were my fathers anyway. Blood is not a story, Marcus. What you do is the story.', mood: 'warm' },
      },
      {
        duration: 5,
        music: 'hope',
        shot: { from: [19, 2.2, 4], at: [15, 1.4, 10], to: [18, 2.4, 6], fov: FOV.normal },
        run: () => {
          for (const a of [marcusBoy, luciusBoy]) a.root.setEnabled(false);
          for (const a of [marcus, lucius]) a.root.setEnabled(true);
          cassian.setPose('raiseSword').setMood('happy').place(13, 10, Math.PI / 2);
          upright(sword(stage.world.parts, cassian.grips[0]));
          upright(sword(stage.world.parts, marcus.grips[0]));
          marcus.setPose('raiseSword').setMood('angry');
          lucius.setPose('cheer').setMood('happy');
        },
        narrate: 'Years. Marcus grew tall and fast and angry. Lucius grew up watching him, and wanting to be him.',
      },
      {
        shot: () => overShoulder(marcus, cassian),
        run: () => {
          cassian.setPose('stand').setMood('warm').lookAt(marcus.headPosition());
          marcus.setPose('stand').setMood('neutral').lookAt(cassian.headPosition());
        },
        say: { who: 'Cassian', text: 'One day this city will be yours, Marcus. Not because you are my eldest. Because you are ready.', mood: 'warm' },
      },
      {
        duration: 4,
        shot: { from: [6, 2, 20], at: [5.2, 1.6, 16], fov: FOV.normal },
        run: () => {
          for (const s of senators) {
            s.root.setEnabled(true);
            s.setMood('angry').lookAt(marcus.headPosition());
          }
        },
        narrate: 'Not everyone in the city agreed with him. They only said so behind closed doors.',
        fade: { to: 1, time: 3.5 },
      },
    ];
  },
};

/** The wagons of grain on the forest road, and the old legate's few men. */
export function wagon(stage: Stage, x: number, z: number): void {
  const g = stage.group('wagon', x, 0, z);
  const p = stage.world.parts;
  p.part('box', SET.wagon, g, [1.6, 0.5, 3], [0, 0.8, 0]);
  for (let i = 0; i < 4; i++) p.part('box', SET.grain, g, [0.6, 0.5, 0.6], [((i % 2) - 0.5) * 0.7, 1.3, -0.8 + Math.floor(i / 2) * 1.2]);
  for (const sx of [-0.9, 0.9]) for (const sz of [-1, 1]) p.part('disc', '#4A3424', g, [0.9, 0.12, 0.9], [sx, 0.45, sz]).rotation.z = Math.PI / 2;
}

export const patrolRoad: Cutscene = {
  id: 'patrol-road',
  create(stage: Stage): Beat[] {
    stage.light('day');
    stage.ground('#3E5A30', 160, 'forest');
    roadForest(stage);
    wagon(stage, 0, 4);
    wagon(stage, 0, 9);
    const cassian = cast(stage, 'cassianGrey', 'Cassian').place(0.4, 0, Math.PI);
    const men = Array.from({ length: 8 }, (_, i) => cast(stage, 'legionary', `Legionary ${i}`).place(i % 2 === 0 ? -1.4 : 1.4, 1 + i * 1.3, Math.PI));
    const greeks = Array.from({ length: 12 }, (_, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      return cast(stage, i === 0 ? 'strategos' : 'hoplite', i === 0 ? 'Strategos' : `Greek ${i}`).place(side * (6 + (i % 3)), -4 + Math.floor(i / 2) * 2, side > 0 ? -Math.PI / 2 : Math.PI / 2).setPose('raiseSword');
    });
    for (const g of greeks) g.root.setEnabled(false);

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'warm',
        sound: 'wind',
        shot: { from: [1.6, 2.2, -8], at: [0, 1.4, 3], to: [1.4, 2.6, -6], fov: FOV.normal },
        narrate: 'The hill towns were starving that winter. Cassian would not send the grain with strangers. He took it himself.',
      },
      {
        shot: () => portrait(men[0]!, { angle: 0.4 }),
        run: () => men[0]!.setMood('happy').lookAt(cassian.headPosition()),
        say: { who: 'Legionary 0', as: 'A legionary', text: 'An emperor driving wagons. My mother will never believe me.', mood: 'happy' },
      },
      {
        shot: () => portrait(cassian, { angle: 0.4, distance: 2.2 }),
        run: () => cassian.setMood('happy'),
        say: { who: 'Cassian', text: 'Tell her the emperor also sang. Badly. All the way.', mood: 'happy' },
      },
      {
        duration: 3,
        sound: 'horn',
        tags: [{ who: 'Strategos', text: 'Greeks' }],
        shot: { from: [0, 6, -9], at: [0, 0.5, 2], fov: FOV.wide },
        run: () => {
          for (const g of greeks) {
            g.root.setEnabled(true);
            g.walkTo(g.root.position.x * 0.4, g.root.position.z, 4.5);
          }
        },
        narrate: 'Greek raiders. They had followed the grain from the coast. Bronze shields, in the trees, on both sides.',
      },
      {
        duration: 3,
        shot: () => portrait(cassian, { angle: 0.2, distance: 2.0 }),
        run: () => {
          cassian.setPose('raiseSword').setMood('shout');
          upright(sword(stage.world.parts, cassian.grips[0]));
        },
        say: { who: 'Cassian', text: 'Around the wagons! Shields! Nobody touches the grain!', mood: 'shout' },
        fade: { to: 1, time: 2.6 },
      },
    ];
  },
};

export const cassianFalls: Cutscene = {
  id: 'cassian-falls',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('dusk');
    stage.ground('#3E5A30', 160, 'forest');
    roadForest(stage);
    wagon(stage, 0, 6);
    for (let i = 0; i < 6; i++) cast(stage, 'hoplite', `Fallen Greek ${i}`).place(-4 + (i % 3) * 3.5, -3 + Math.floor(i / 3) * 6, i).setPose('lie', true).eyesClosed = true;
    const cassian = cast(stage, 'cassianGrey', 'Cassian').place(0, 0, Math.PI / 2).setPose('lie', true).setMood('sad', true);
    cassian.setWounded(true);
    const felix = cast(stage, 'felixOld', 'Felix').place(1.2, 0.3, -Math.PI / 2).setPose('kneel', true).setMood('crying', true);
    const rufus = cast(stage, 'rufusOld', 'Rufus').place(0.3, 1.3, Math.PI).setPose('kneel', true).setMood('crying', true);
    const cross = upright(woodenCross(stage.world.parts, cassian.grips[0], 1.0));
    const eirik = cast(stage, 'eirik', 'Eirik').place(-2, 2.6, Math.PI * 0.8);
    if (story.save.choices.eirikSpared !== true) eirik.root.setEnabled(false);
    const legion = Array.from({ length: 6 }, (_, i) => cast(stage, 'legionary', `Rider ${i}`).place(-5 + i * 2, 6, Math.PI).setPose('pray', true));

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'sorrow',
        shot: { from: [4, 3, 6], at: [0, 0.6, 0], to: [3, 2, 4.5], fov: FOV.normal },
        narrate: 'Felix and Rufus rode all night when they heard. The Greeks were gone by the time they came. The grain was still there. So was he.',
      },
      {
        shot: () => portrait(rufus, { angle: 0.4 }),
        say: { who: 'Rufus', text: 'Hold on, old man. You hear me? You do not get to go first. I had a joke saved for this.', mood: 'crying' },
      },
      {
        shot: () => portrait(cassian, { angle: 1.3, distance: 1.9, rise: 0.6 }),
        run: () => cassian.lookAt(rufus.headPosition()),
        say: { who: 'Cassian', text: 'Tell it, Rufus. I never laughed at a single one. I always wanted to.', mood: 'warm' },
      },
      {
        shot: () => portrait(cassian, { angle: 1.2, distance: 1.8, rise: 0.6, push: 0.2 }),
        run: () => cassian.lookAt(felix.headPosition()).setPose('offer'),
        say: { who: 'Cassian', text: 'Felix. The cross goes to Marcus. He will need it more than Lucius. Tell Livia... tell her the road led home.', mood: 'sad' },
      },
      {
        duration: 4,
        sound: 'heartbeat',
        shot: { from: [0.8, 0.9, -1.2], at: [0, 0.3, 0.1], fov: FOV.close },
        run: () => {
          cross.parent = felix.grips[0];
          cross.position.set(0, 0, 0);
          felix.setPose('clutch');
        },
      },
      {
        duration: 5,
        music: 'monastery',
        shot: { from: [-1.6, 1.6, 1.8], at: [0, 0.3, 0], to: [-2.4, 3, 3], fov: FOV.normal },
        run: () => {
          cassian.eyesClosed = true;
          cassian.lookAt(null);
          cassian.setPose('lie');
          for (const l of legion) l.setPose('kneel');
        },
        narrate: 'Somewhere far away, a bell was ringing. That is what Rufus swore, for the rest of his life.',
      },
      {
        duration: 5,
        title: { text: 'Cassian', sub: 'Monk. Prisoner. Smith. Legate. Emperor. Father.' },
        shot: { from: [0, 12, 4], at: [0, 0, 0], to: [0, 20, 6], fov: FOV.wide },
        fade: { to: 1, time: 4.5 },
      },
    ];
  },
};

/** A field outside the walls at night: the pyre, a ring of mourners with candles, the city behind. */
function funeralField(stage: Stage): void {
  stage.ground('#2E3A28', 120, 'hills');
  for (let i = 0; i < 9; i++) stage.box('#8A8070', [12, 9, 3], [-48 + i * 12, 4.5, -34]);
  for (let i = 0; i < 5; i++) stage.box('#8A8070', [3.6, 13, 3.6], [-48 + i * 24, 6.5, -34]);
  stage.box('#6A6050', [8, 7, 3.4], [0, 3.5, -33.8]);
}

/** Clouds underfoot, a golden light ahead: where everyone Cassian lost is waiting. */
function heavenSet(stage: Stage): void {
  stage.box('#FFF8EC', [80, 0.1, 80], [0, -0.05, 0], 0, { castShadow: false });
  for (let i = 0; i < 70; i++) {
    const a = i * 2.399;
    const r = 2 + (i % 14) * 2.2;
    const size = 1.2 + (i % 4) * 0.5;
    stage.shape('bush', i % 3 === 0 ? '#FFFFFF' : '#F4EEE2', [size * 1.4, size * 0.5, size], [Math.cos(a) * r, 0.1, Math.sin(a) * r], { castShadow: false });
  }
  // A gate of light at the end of the clouds.
  for (const x of [-3, 3]) stage.box('#F8E8B0', [0.8, 7, 0.8], [x, 3.5, -16], 0, { glow: true });
  stage.box('#F8E8B0', [7.6, 0.8, 0.8], [0, 7.2, -16], 0, { glow: true });
  stage.box('#FFF4C8', [5.2, 6.6, 0.2], [0, 3.3, -16.3], 0, { glow: true });
}

export const heaven: Cutscene = {
  id: 'heaven',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('white');
    heavenSet(stage);
    stage.weather('motes');
    const cassian = cast(stage, 'cassianCommander', 'Cassian').place(0, 6, Math.PI);
    const varro = cast(stage, 'varro', 'Varro').place(1.6, -1, Math.PI * 0.1);
    const anselm = cast(stage, 'anselm', 'Anselm').place(-1.4, -4, 0);
    const brothers = ['Paul', 'Tomas', 'Ivo', 'Benet', 'Odo', 'Simon'].map((name, i) =>
      cast(stage, 'monk', `Brother ${name}`, i % 2 === 1 ? { hair: '#2A1E18' } : {}).place(-4 + i * 1.4, -6.5 - (i % 2) * 0.8, 0).setMood('happy', true),
    );
    const fallen = story.save.legion.filter((l) => !l.alive).slice(0, 6);
    const legionaries = fallen.map((l, i) => cast(stage, 'legionary', l.name).place(4 + (i % 3) * 1.3, -4 - Math.floor(i / 3) * 1.4, -0.4).setMood('happy', true));
    const hrolf = cast(stage, 'hrolf', 'Hrolf').place(-7, -9, 0.6).setMood('warm', true);
    const tags = [
      { who: 'Varro', text: 'Varro' },
      { who: 'Anselm', text: 'Anselm' },
      ...fallen.slice(0, 3).map((l) => ({ who: l.name, text: l.name })),
    ];

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, color: 'white', time: 3 },
        music: 'monastery',
        sound: 'bell',
        shot: { from: [0, 2.2, 13], at: cassian, to: [0, 2, 10], fov: FOV.normal },
        run: () => cassian.setMood('surprised').lookAt({ x: 0, y: 2, z: -10 }),
        narrate: 'Rufus swore he heard bells. I like to think he did.',
      },
      {
        duration: 4,
        shot: () => portrait(cassian, { angle: 0.3, distance: 2.4 }),
        run: () => cassian.walkTo(0.4, 1.4, 1.0),
        narrate: 'No more wounds. No more cold. Only the light, and someone walking towards him.',
      },
      {
        shot: () => portrait(varro, { angle: -0.3, distance: 2.4 }),
        run: () => {
          cassian.finishWalk();
          varro.lookAt(cassian.headPosition()).setMood('happy');
        },
        tags,
        say: { who: 'Varro', text: 'Took your time, son. I have been waiting forty years with nothing to hammer.', mood: 'happy' },
      },
      {
        shot: () => portrait(cassian, { angle: 0.3, distance: 2.0 }),
        run: () => cassian.setMood('crying').setPose('reach'),
        say: { who: 'Cassian', text: 'Varro... Varro!', mood: 'crying' },
      },
      {
        duration: 4,
        shot: { from: [3.4, 1.8, 3.6], at: [0.9, 1.4, 0.2], fov: FOV.normal },
        run: () => {
          varro.place(1.0, 0.4, Math.PI * 1.2).setPose('embrace');
          cassian.setPose('embrace').setMood('crying');
        },
      },
      {
        shot: () => portrait(varro, { angle: -0.4, distance: 2.2 }),
        run: () => varro.setPose('stand').setMood('happy'),
        say: { who: 'Varro', text: 'You let Rufus tell a joke on your deathbed? Bravest thing you ever did.', mood: 'happy' },
      },
      {
        shot: () => portrait(anselm, { angle: 0.3, distance: 2.4 }),
        run: () => {
          anselm.walkTo(-0.8, -0.8, 1.0);
          anselm.lookAt(cassian.headPosition()).setMood('warm');
          for (const b of brothers) b.setPose('wave');
        },
        say: { who: 'Anselm', text: 'Welcome home, little brother. You kept it close, I see.', mood: 'warm' },
      },
      {
        shot: () => portrait(cassian, { angle: -0.3, distance: 2.0 }),
        run: () => cassian.setMood('warm').lookAt(anselm.headPosition()),
        say: { who: 'Cassian', text: 'It knew the way home, Father. You said it would.', mood: 'warm' },
      },
      {
        duration: 4,
        shot: { from: [-4, 2, 0], at: [-7, 1.6, -9], fov: FOV.normal },
        run: () => hrolf.setPose('wave').lookAt(cassian.headPosition()),
        narrate: 'Further off, a big man with a red beard raised his hand. Cassian raised his.',
      },
      {
        duration: 4,
        sound: 'crowd',
        shot: { from: [6, 2.4, 3], at: [3, 1.4, -4], fov: FOV.wide },
        run: () => {
          for (const l of legionaries) l.setPose('cheer');
          for (const b of brothers) b.setPose('cheer');
          cassian.setPose('cheer').setMood('happy');
        },
        narrate: 'And all the men whose names he had read out by the fire were there too, cheering like fools.',
      },
      {
        duration: 6,
        shot: { from: [0, 3, 9], at: [0, 2, -16], to: [0, 2.6, 4], fov: FOV.normal },
        run: () => {
          for (const a of [cassian, varro, anselm]) a.setPose('stand');
          cassian.walkTo(0, -14, 1.2);
          varro.walkTo(1.2, -13.6, 1.2);
          anselm.walkTo(-1.2, -13.6, 1.2);
        },
        fade: { to: 1, color: 'white', time: 5.5 },
      },
    ];
  },
};

export const mourning: Cutscene = {
  id: 'mourning',
  create(stage: Stage): Beat[] {
    stage.light('night');
    funeralField(stage);
    ringOfPeople(stage, 0, 0, 8, 4, 0);
    const pyre = stage.group('pyre', 0, 0, -1);
    stage.world.parts.part('box', SET.pyre, pyre, [3, 1.4, 2], [0, 0.7, 0]);
    stage.world.parts.part('box', '#B8322A', pyre, [2.2, 0.3, 0.9], [0, 1.55, 0]);
    const livia = cast(stage, 'liviaOld', 'Livia').place(-1, 2.5, Math.PI);
    const marcus = cast(stage, 'marcusRoman', 'Marcus').place(-2.4, 2.6, Math.PI);
    const lucius = cast(stage, 'luciusBare', 'Lucius').place(1, 2.5, Math.PI);
    const felix = cast(stage, 'felixOld', 'Felix').place(3, 3.4, Math.PI);
    const rufus = cast(stage, 'rufusOld', 'Rufus').place(4.2, 3.8, Math.PI);
    upright(woodenCross(stage.world.parts, marcus.grips[0], 1.0));
    for (const [i, a] of [livia, marcus, lucius, felix, rufus].entries()) a.setMood(i === 1 ? 'angry' : 'sad');
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      stage.fire(Math.sin(a) * 7.4, Math.cos(a) * 7.4, 0.08, 0.9);
    }

    return [
      {
        duration: 7,
        fade: { from: 1, to: 0, time: 3 },
        music: 'sorrow',
        shot: { from: [0, 14, 20], at: [0, 1, 0], to: [0, 10, 15], fov: FOV.wide },
        narrate: 'My husband told the first part of this story. I am Livia. I will tell you the end.',
      },
      {
        duration: 6,
        shot: { from: [5, 2, 9], at: [0, 1.4, -1], fov: FOV.normal },
        narrate: 'The whole city came, with candles. The same city that once threw him a borrowed sword.',
      },
      {
        duration: 4,
        shot: () => portrait(marcus, { angle: 0.3, distance: 2 }),
        run: () => marcus.setPose('clutch'),
        narrate: 'Marcus held his father\'s cross all night. He would not let anyone else light the fire.',
      },
      {
        duration: 5,
        sound: 'fire',
        shot: { from: [-4, 2.4, 7], at: [0, 1.4, -1], to: [-5, 3.4, 9], fov: FOV.normal },
        run: () => {
          stage.fire(0, -1, 2.4, 1.4);
          stage.light('fireNight');
          marcus.setPose('pray');
        },
        narrate: 'He burned like a legion. Bright and fast and all at once.',
      },
      {
        duration: 4,
        shot: () => portrait(lucius, { angle: -0.4, distance: 2 }),
        run: () => lucius.setMood('crying').lookAt(marcus.headPosition()),
        narrate: 'Lucius cried. Marcus did not. Even then, I should have seen it coming.',
        fade: { to: 1, time: 3.5 },
      },
    ];
  },
};

export const theCrowning: Cutscene = {
  id: 'the-crowning',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('interior');
    throneRoom(stage);
    const senators = Array.from({ length: 8 }, (_, i) =>
      cast(stage, 'emperor', `Senator ${i}`, { hair: i % 3 === 0 ? '#E8E6E0' : '#9A9690', beard: i % 2 === 0 ? 'short' : 'none', beardColor: '#9A9690' })
        .place(i % 2 === 0 ? -3.2 : 3.2, -11 + Math.floor(i / 2) * 2, i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2)
        .setMood('neutral', true),
    );
    const livia = cast(stage, 'liviaOld', 'Livia').place(-1.4, -12.6, 0);
    const marcus = cast(stage, 'marcusRoman', 'Marcus').place(-0.6, -6, Math.PI);
    const lucius = cast(stage, 'luciusBare', 'Lucius').place(0.8, -6, Math.PI);
    const cross = upright(woodenCross(stage.world.parts, marcus.grips[0], 1.0));

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 2 },
        music: 'dread',
        sound: 'crowd',
        shot: { from: [0, 2.6, 2], at: [0, 1.6, -12], to: [0, 2.2, -3], fov: FOV.normal },
        narrate: 'Nine days later, the Senate met to name the new emperor. Outside, the crowd was chanting.',
      },
      {
        shot: () => portrait(senators[0]!, { angle: 0.4 }),
        run: () => senators[0]!.setMood('angry'),
        say: { who: 'Senator 0', as: 'Old senator', text: 'The law says the eldest. But listen to them out there. They will never kneel to the Mongol\'s son.', mood: 'angry' },
      },
      {
        shot: () => portrait(marcus, { angle: 0.3, distance: 2.0 }),
        run: () => marcus.setMood('shout').setPose('point'),
        say: { who: 'Marcus', text: 'I am Cassian\'s son! He called me his son in the square, in front of all of you!', mood: 'shout' },
      },
      {
        shot: () => portrait(senators[3]!, { angle: -0.3 }),
        say: { who: 'Senator 3', as: 'A senator', text: 'And Cassian is dead. Crown the eastern boy and there will be blood in the streets by morning. His blood, first.', mood: 'neutral' },
      },
      {
        duration: 4,
        sound: 'heartbeat',
        shot: () => portrait(livia, { angle: 0.2, distance: 2.2 }),
        run: () => livia.setMood('crying').lookAt(marcus.headPosition()),
        narrate: 'I looked at my son, and I saw them dragging him out into that crowd. I made the choice that kept him alive. I have never stopped paying for it.',
      },
      {
        shot: () => portrait(livia, { angle: 0.1, distance: 2.0, push: 0.2 }),
        run: () => livia.setPose('reach'),
        say: { who: 'Livia', text: 'Crown Lucius. For peace. For both of them.', mood: 'crying' },
      },
      {
        duration: 3,
        shot: () => portrait(lucius, { angle: -0.4, distance: 2.0 }),
        run: () => lucius.setMood('afraid').lookAt(marcus.headPosition()),
        say: { who: 'Lucius', text: 'Marcus... I never asked for this.', mood: 'afraid' },
      },
      {
        shot: () => portrait(marcus, { angle: 0.2, distance: 1.8, push: 0.2 }),
        run: () => marcus.setMood('crying').lookAt(livia.headPosition()),
        say: { who: 'Marcus', text: 'You too, mother? Even you?', mood: 'crying' },
      },
      {
        shot: () => portrait(marcus, { angle: 0.4, distance: 2.2, rise: -0.2 }),
        run: () => marcus.setMood('shout').setPose('raiseSword'),
        say: { who: 'Marcus', text: 'Keep your city. Keep your crown. One day I will come back for both, and this city will learn what the Mongol\'s son can do.', mood: 'shout' },
      },
      {
        duration: 3.5,
        sound: 'door',
        shot: { from: [2, 2.2, -12], at: [0, 1.4, -3], fov: FOV.normal },
        run: () => {
          marcus.setPose('stand');
          marcus.walkTo(0, 4, 3);
          for (const s of senators) s.setMood('afraid');
        },
        narrate: 'He walked out with his father\'s cross in his fist, and he did not look back.',
      },
      {
        duration: 1,
        shot: { from: [0, 3, -1], at: [0, 1.4, 6], fov: FOV.normal },
        run: () => cross.setEnabled(true),
        choice: {
          options: ['Follow Marcus, the elder. Into the dark.', 'Follow Lucius, the younger. Onto the throne.'],
          pick: (i) => story.choose({ son: i === 0 ? 'marcus' : 'lucius' }),
        },
      },
    ];
  },
};

/** The forgotten graveyard where the wizard waits: moonlight, mist, dead trees, ruins and green fire. */
const GRAVEYARD = {
  ground: '#26322A',
  moss: '#33442E',
  deadGrass: '#5A5A3A',
  stone: '#7A7A72',
  stoneDark: '#55554E',
  bark: '#1E1A16',
  iron: '#2A2A2E',
  witchFire: '#6AF0B0',
  witchCore: '#D8FFE8',
  moon: '#F4F0D8',
  candle: '#FFD27A',
} as const;

/** A dead tree: a black trunk with crooked bare branches. */
function deadTree(stage: Stage, x: number, z: number, size: number, seed: number): void {
  const g = stage.group('dead-tree', x, 0, z);
  g.rotation.y = seed;
  const p = stage.world.parts;
  p.part('box', GRAVEYARD.bark, g, [0.35 * size, 3.2 * size, 0.35 * size], [0, 1.6 * size, 0]).rotation.z = 0.08;
  for (let i = 0; i < 4; i++) {
    const branch = p.part('box', GRAVEYARD.bark, g, [0.14 * size, 1.4 * size, 0.14 * size], [Math.sin(i * 1.7) * 0.4 * size, (2.0 + i * 0.4) * size, Math.cos(i * 1.7) * 0.4 * size]);
    branch.rotation.set(Math.cos(i * 2.1) * 0.9, i * 1.3, Math.sin(i * 2.1) * 0.9);
  }
}

/** A tombstone, one of three shapes, leaning a little. */
function tombstone(stage: Stage, x: number, z: number, i: number): void {
  const g = stage.group('tomb', x, 0, z);
  g.rotation.set(Math.sin(i * 3.1) * 0.12, Math.sin(i) * 0.3, Math.cos(i * 2.3) * 0.12);
  const p = stage.world.parts;
  const kind = i % 3;
  if (kind === 0) {
    p.part('box', GRAVEYARD.stone, g, [0.7, 0.9, 0.18], [0, 0.45, 0]);
    p.part('cylinder', GRAVEYARD.stone, g, [0.35, 0.18, 0.35], [0, 0.9, 0]).rotation.x = Math.PI / 2;
  } else if (kind === 1) {
    p.part('box', GRAVEYARD.stoneDark, g, [0.16, 1.2, 0.16], [0, 0.6, 0]);
    p.part('box', GRAVEYARD.stoneDark, g, [0.7, 0.16, 0.16], [0, 0.85, 0]);
  } else {
    p.part('box', GRAVEYARD.stone, g, [0.9, 0.5, 0.3], [0, 0.25, 0]);
  }
  p.part('box', GRAVEYARD.moss, g, [0.95, 0.2, 1.7], [0, 0.08, 0.95]);
}

function graveyard(stage: Stage): void {
  stage.ground(GRAVEYARD.ground, 150, 'forest');
  stage.weather('motes');
  // Patches of moss and dead grass.
  for (let i = 0; i < 40; i++) {
    const a = i * 2.399;
    const r = 3 + (i % 10) * 2;
    stage.box(i % 2 === 0 ? GRAVEYARD.moss : GRAVEYARD.deadGrass, [1.6 + (i % 3), 0.04, 1.2 + (i % 2)], [Math.cos(a) * r, 0.02, -2 + Math.sin(a) * r], a, { castShadow: false });
  }
  // Rows of graves, crooked with age, and old mounds.
  for (let i = 0; i < 24; i++) tombstone(stage, -10 + (i % 8) * 2.8, -4 + Math.floor(i / 8) * 3.6, i);
  for (let i = 0; i < 14; i++) grave(stage, -8 + (i % 7) * 2.6, -3 + Math.floor(i / 7) * 4.5, (i % 3) * 0.2, i % 2 === 0);
  // An iron fence round the graves, its gate hanging open.
  for (let i = 0; i < 22; i++) {
    const x = -13 + i * 1.3;
    if (i === 10 || i === 11) continue;
    stage.box(GRAVEYARD.iron, [0.08, 1.4, 0.08], [x, 0.7, 8.5], 0, { metal: true });
    stage.box(GRAVEYARD.iron, [0.04, 0.2, 0.04], [x, 1.5, 8.5], 0, { metal: true });
  }
  stage.box(GRAVEYARD.iron, [12.6, 0.06, 0.06], [-6.6, 1.2, 8.5], 0, { metal: true });
  stage.box(GRAVEYARD.iron, [11.4, 0.06, 0.06], [8.4, 1.2, 8.5], 0, { metal: true });
  const gate = stage.box(GRAVEYARD.iron, [1.3, 1.3, 0.06], [0.8, 0.7, 9.1], 1.1, { metal: true });
  gate.rotation.z = 0.05;
  // The ruined chapel behind the graves: broken walls, an arch, the roof fallen in.
  for (const [x, z, w, h, yaw] of [[-6, -12, 7, 4.5, 0], [-9.5, -9, 6, 3, Math.PI / 2], [-2.5, -9.5, 5, 2, Math.PI / 2]] as const) {
    stage.box(GRAVEYARD.stoneDark, [w, h, 0.6], [x, h / 2, z], yaw);
  }
  for (const x of [-7.4, -4.6]) stage.box(GRAVEYARD.stone, [0.7, 5.2, 0.7], [x, 2.6, -11.6]);
  stage.box(GRAVEYARD.stone, [3.4, 0.7, 0.8], [-6, 5.4, -11.6]);
  const beam = stage.box('#3A2A20', [6, 0.3, 0.3], [-6, 1.6, -10], 0.3);
  beam.rotation.z = 0.5;
  // The crypt: steps down into a doorway lit from below with green fire.
  stage.box(GRAVEYARD.stoneDark, [3.6, 2.6, 3], [6, 1.3, -10]);
  stage.box(GRAVEYARD.stone, [4, 0.4, 3.4], [6, 2.8, -10]);
  stage.box('#0E1A14', [1.4, 1.8, 0.1], [6, 0.9, -8.45], 0, { castShadow: false });
  stage.box(GRAVEYARD.witchFire, [1.2, 0.12, 0.1], [6, 0.08, -8.4], 0, { glow: true, castShadow: false });
  // A mausoleum with columns.
  stage.box(GRAVEYARD.stone, [4.4, 0.5, 3.4], [11, 0.25, -3]);
  for (const x of [9.4, 12.6]) for (const z of [-1.8, -4.2]) stage.shape('cylinder', GRAVEYARD.stone, [0.3, 3, 0.3], [x, 2, z]);
  stage.box(GRAVEYARD.stoneDark, [4.4, 0.6, 3.4], [11, 3.8, -3]);
  stage.box(GRAVEYARD.stoneDark, [2.4, 2.6, 2], [11, 1.8, -3.2]);
  // Dead trees all round, standing stones beyond them.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2;
    deadTree(stage, Math.sin(a) * (15 + (i % 3) * 2), -2 + Math.cos(a) * (15 + (i % 3) * 2), 1 + (i % 4) * 0.2, i);
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    stage.box('#5A5A56', [1, 3.2 + (i % 3) * 0.6, 0.8], [Math.sin(a) * 21, 1.6, -1 + Math.cos(a) * 21], a);
  }
  // Candles on some graves, a full moon low in the sky, mist along the ground.
  for (let i = 0; i < 10; i++) stage.box(GRAVEYARD.candle, [0.08, 0.2, 0.08], [-9.5 + i * 2.1, 0.32, -3.5 + (i % 3) * 3.6], 0, { glow: true, castShadow: false });
  stage.shape('disc', GRAVEYARD.moon, [9, 0.2, 9], [-30, 26, -60], { glow: true, castShadow: false }).rotation.x = Math.PI / 2.4;
  for (let i = 0; i < 26; i++) stage.shape('bush', SET.mist, [3.2, 0.35, 2], [-12 + (i % 6) * 5, 0.2, -8 + Math.floor(i / 6) * 4], { castShadow: false });
  // Braziers of green witch-fire, flickering.
  const flames = [[-3, 2], [3, 2], [0, -6]].map(([x, z]) => {
    stage.shape('cylinder', GRAVEYARD.iron, [0.35, 0.9, 0.35], [x ?? 0, 0.45, z ?? 0], { metal: true });
    const f = stage.group('witch-fire', x ?? 0, 1.0, z ?? 0);
    stage.world.parts.part('box', GRAVEYARD.witchFire, f, [0.5, 0.7, 0.5], [0, 0.35, 0], { glow: true, castShadow: false });
    stage.world.parts.part('box', GRAVEYARD.witchCore, f, [0.25, 0.4, 0.25], [0, 0.25, 0], { glow: true, castShadow: false });
    return f;
  });
  stage.animate((_dt, t) => flames.forEach((f, i) => f.scaling.set(1, 0.8 + Math.sin(t * 9 + i * 2) * 0.25, 1)));
}

export const marcusPath: Cutscene = {
  id: 'marcus-path',
  create(stage: Stage): Beat[] {
    stage.light('night');
    graveyard(stage);
    const marcus = cast(stage, 'marcusMongol', 'Marcus').place(0, 10, Math.PI);
    const wizard = cast(stage, 'wizard', 'The Wizard').place(0, -1, 0).setMood('happy', true);
    const staff = stage.group('staff', 0, 0, 0);
    stage.world.parts.part('box', '#3A2A1E', staff, [0.08, 2.2, 0.08], [0, 0.4, 0]);
    stage.world.parts.part('sphere', '#7AF0C8', staff, [0.3, 0.3, 0.3], [0, 1.55, 0], { glow: true });
    staff.parent = wizard.grips[0];
    staff.position.set(0, 0, 0);
    const exiles = Array.from({ length: 6 }, (_, i) => cast(stage, 'mongol', `Exile ${i}`).place(-4 + i * 1.6, 14, Math.PI));
    const dead: Actor[] = Array.from({ length: 14 }, (_, i) => {
      const d = cast(stage, 'dead', `Dead ${i}`).place(-8 + (i % 7) * 2.6, -3 + Math.floor(i / 7) * 4.5 + 0.4, 0);
      d.root.position.y = -2;
      d.setPose('reach', true);
      return d;
    });

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'dread',
        sound: 'wind',
        shot: { from: [4, 2.6, 22], at: [0, 1.4, 10], to: [3, 2.2, 16], fov: FOV.normal },
        run: () => marcus.walkTo(0, 4, 1.4),
        narrate: 'Marcus rode east, into the lands his blood came from. They did not want him either.',
      },
      {
        duration: 4,
        shot: { from: [-6, 2, 18], at: [0, 1.4, 14], fov: FOV.normal },
        narrate: 'A few Mongol outcasts followed him anyway. Men nobody wanted, behind a prince nobody wanted.',
      },
      {
        duration: 4,
        sound: 'thunder',
        shot: () => portrait(wizard, { angle: 0.3, distance: 3, rise: -0.3 }),
        run: () => {
          marcus.finishWalk();
          wizard.lookAt(marcus.headPosition());
        },
        narrate: 'In a field of old graves, someone was waiting for him.',
      },
      {
        shot: () => overShoulder(wizard, marcus),
        say: { who: 'The Wizard', text: 'Cassian\'s boy. The Mongol\'s boy. Nobody\'s boy. I know how it feels. Nobody wanted me either.', mood: 'happy' },
      },
      {
        shot: () => overShoulder(marcus, wizard, { side: -1 }),
        run: () => marcus.setMood('angry'),
        say: { who: 'Marcus', text: 'What are you?', mood: 'angry' },
      },
      {
        shot: () => portrait(wizard, { angle: 0.2, distance: 2.2 }),
        say: { who: 'The Wizard', text: 'A friend to the forgotten. The living chose your brother. But the dead... the dead do not care what your face looks like.', mood: 'happy' },
      },
      {
        shot: () => portrait(wizard, { angle: 0.1, distance: 2.0, push: 0.2 }),
        say: { who: 'The Wizard', text: 'Give me the thing your father loved most, and I will give you an army that never sleeps.', mood: 'neutral' },
      },
      {
        duration: 4,
        sound: 'heartbeat',
        shot: () => portrait(marcus, { angle: -0.3, distance: 1.8 }),
        run: () => marcus.setPose('clutch').setMood('crying'),
        narrate: 'He took out his father\'s cross. He held it a long time.',
      },
      {
        duration: 3,
        shot: () => portrait(marcus, { angle: 0.3, distance: 2.0 }),
        run: () => marcus.setPose('offer').setMood('angry'),
        say: { who: 'Marcus', text: 'Take it.', mood: 'angry' },
      },
      {
        duration: 6,
        music: 'dread',
        sound: 'thunder',
        shot: { from: [8, 3, 8], at: [-1, 0.6, -1], to: [6, 4, 10], fov: FOV.wide },
        run: () => {
          stage.light('fireNight');
          wizard.setPose('cheer');
          for (const e of exiles) e.setPose('cower').setMood('afraid');
        },
        during: (_s, p) => {
          dead.forEach((d, i) => {
            const rise = Math.min(1, Math.max(0, p * 1.6 - i * 0.04));
            d.root.position.y = -2 + rise * 2;
          });
        },
        narrate: 'And the graves opened.',
      },
      {
        duration: 4,
        shot: () => portrait(marcus, { angle: 0.4, distance: 2.2, rise: -0.2 }),
        run: () => marcus.setPose('raiseSword').setMood('shout'),
        say: { who: 'Marcus', text: 'Now, little brother. Now we talk.', mood: 'shout' },
        fade: { to: 1, time: 3.5 },
      },
    ];
  },
};

export const luciusPath: Cutscene = {
  id: 'lucius-path',
  create(stage: Stage): Beat[] {
    stage.light('dusk');
    stage.ground('#5A7A3A', 120, 'hills');
    grave(stage, 0, 0, 0, false);
    const lucius = cast(stage, 'lucius', 'Lucius').place(0.4, 2.4, Math.PI);
    const livia = cast(stage, 'liviaOld', 'Livia').place(-1.2, 2.6, Math.PI);
    const felix = cast(stage, 'felixOld', 'Felix').place(-3, 4.4, Math.PI);
    const rufus = cast(stage, 'rufusOld', 'Rufus').place(3, 4.4, Math.PI);
    const scout = cast(stage, 'messenger', 'Scout').place(0, 16, Math.PI);
    scout.root.setEnabled(false);

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'sorrow',
        shot: { from: [4, 2.4, 7], at: [0, 1, 0], to: [3, 2, 5], fov: FOV.normal },
        narrate: 'Lucius was crowned on a grey morning. The helmet was too big. He wore it anyway.',
      },
      {
        shot: () => portrait(lucius, { angle: 0.4, distance: 2.0 }),
        run: () => lucius.setMood('sad').lookAt({ x: 0, y: 0.4, z: -0.8 }),
        say: { who: 'Lucius', text: 'I do not know how to be you, father. I only know how to be the little brother.', mood: 'sad' },
      },
      {
        shot: () => portrait(livia, { angle: -0.3, distance: 2.0 }),
        run: () => livia.lookAt(lucius.headPosition()),
        say: { who: 'Livia', text: 'Your father did not know either. He was a monk who could not even cook. He learned.', mood: 'warm' },
      },
      {
        shot: () => portrait(rufus, { angle: -0.4 }),
        run: () => rufus.setPose('fist').setMood('happy'),
        say: { who: 'Rufus', text: 'And we are still here, boy. Old, slow, and very, very cranky. The best kind of soldier.', mood: 'happy' },
      },
      {
        duration: 3,
        shot: () => portrait(felix, { angle: 0.4 }),
        run: () => felix.setPose('fist').setMood('warm'),
        say: { who: 'Felix', text: 'Our swords are yours. As they were his.', mood: 'warm' },
      },
      {
        duration: 4,
        sound: 'horn',
        shot: { from: [2, 2, 8], at: [0, 1.4, 14], fov: FOV.normal },
        run: () => {
          scout.root.setEnabled(true);
          scout.walkTo(0, 7, 4);
          for (const a of [lucius, livia, felix, rufus]) a.turnTo(0);
        },
      },
      {
        shot: () => portrait(scout, { angle: 0.2, distance: 2.4 }),
        run: () => {
          scout.finishWalk();
          scout.setPose('point').setMood('afraid');
        },
        say: { who: 'Scout', as: 'A scout', text: 'Caesar! Your brother is coming from the east. Riders... and behind them... the dead. The dead are walking, Caesar!', mood: 'afraid' },
      },
      {
        shot: () => portrait(lucius, { angle: 0.3, distance: 2.0, push: 0.2 }),
        run: () => lucius.setMood('angry').setPose('raiseSword'),
        say: { who: 'Lucius', text: 'Ring every bell in the city. Man the walls. And nobody kills my brother but me.', mood: 'angry' },
        fade: { to: 1, time: 3.5 },
      },
    ];
  },
};

export const brothersEnd: Cutscene = {
  id: 'brothers-end',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('dusk');
    CAPITAL.build(stage);
    stage.weather('ash');
    for (const [x, z] of [[-10, -10], [12, 8], [-16, 12]] as const) stage.fire(x, z, 1.2, 0.3);
    for (let i = 0; i < 10; i++) cast(stage, 'dead', `Dead ${i}`).place(-8 + (i % 5) * 4, -8 + Math.floor(i / 5) * 12, i).setPose('lie', true).eyesClosed = true;
    const marcusWon = isMarcus(story);
    const luciusWon = isLucius(story);
    const marcus = cast(stage, 'marcusMongol', 'Marcus').place(0, 3, Math.PI);
    const lucius = cast(stage, 'lucius', 'Lucius').place(0, 1.2, 0);
    const livia = cast(stage, 'liviaOld', 'Livia').place(-3, 2, Math.PI / 2);
    const cross = woodenCross(stage.world.parts, stage.root, 1.0);
    cross.position.set(0.4, 0.05, 2.2);
    cross.rotation.set(Math.PI / 2, 0.3, 0);

    return [
      // Lucius won: Marcus lies wounded in the square.
      {
        when: luciusWon,
        duration: 5,
        fade: { from: 1, to: 0, time: 2 },
        music: 'sorrow',
        shot: { from: [4, 3, 8], at: [0, 0.6, 2], to: [3, 2.2, 6], fov: FOV.normal },
        run: () => {
          marcus.place(0, 3, Math.PI / 2).setPose('lie').setMood('sad');
          marcus.setWounded(true);
          lucius.place(0.9, 2.6, -Math.PI / 2).setPose('kneel').setMood('crying');
        },
        narrate: 'When the Mongol\'s son fell, the dead fell with him, all at once, like puppets with their strings cut.',
      },
      {
        when: luciusWon,
        shot: () => portrait(marcus, { angle: 1.3, distance: 1.9, rise: 0.6 }),
        run: () => marcus.lookAt(lucius.headPosition()),
        say: { who: 'Marcus', text: 'Little brother. You got good. When did you get good?', mood: 'sad' },
      },
      {
        when: luciusWon,
        shot: () => portrait(lucius, { angle: -0.3, distance: 1.8 }),
        say: { who: 'Lucius', text: 'I learned from you. I always learned from you. Why, Marcus? Why the dead?', mood: 'crying' },
      },
      {
        when: luciusWon,
        shot: () => portrait(marcus, { angle: 1.2, distance: 1.8, rise: 0.6, push: 0.2 }),
        say: { who: 'Marcus', text: 'Because they were the only ones who did not look at my face. Tell mother... tell her I gave the cross away. I am sorry for that. Only that.', mood: 'crying' },
      },
      {
        when: luciusWon,
        duration: 5,
        sound: 'heartbeat',
        shot: { from: [-1.6, 1.4, 4.4], at: [0, 0.4, 3], fov: FOV.normal },
        run: () => {
          marcus.eyesClosed = true;
          lucius.setPose('cradle');
          livia.walkTo(-0.8, 3.6, 0.8);
        },
        narrate: 'Lucius held him until he was cold. I did not get there in time. I never got there in time, for Marcus.',
      },
      // Marcus won: the throne is his, and his brother is on his knees.
      {
        when: marcusWon,
        duration: 5,
        fade: { from: 1, to: 0, time: 2 },
        music: 'dread',
        shot: { from: [5, 3, -4], at: [0, 1.2, 2], to: [4, 2.4, -2], fov: FOV.normal },
        run: () => {
          lucius.setPose('kneel').setMood('afraid');
          marcus.setPose('raiseSword').setMood('angry');
          upright(sword(stage.world.parts, marcus.grips[0]));
        },
        narrate: 'The city fell to its own son. Lucius was brought to the square in chains, and Marcus raised his sword.',
      },
      {
        when: marcusWon,
        shot: () => overShoulder(livia, marcus),
        run: () => {
          livia.place(-0.8, 2.2, Math.PI * 0.2).setPose('reach').setMood('crying');
          livia.lookAt(marcus.headPosition());
        },
        say: { who: 'Livia', text: 'Your father had the man who burned his home at his feet once. He let him go. Do you know why?', mood: 'crying' },
      },
      {
        when: marcusWon,
        shot: () => portrait(marcus, { angle: 0.3, distance: 2.0 }),
        run: () => marcus.setMood('crying'),
        say: { who: 'Marcus', text: 'Because it had to end with someone.', mood: 'crying' },
      },
      {
        when: marcusWon,
        duration: 4,
        sound: 'thunder',
        shot: () => portrait(marcus, { angle: 0.2, distance: 2.4, rise: -0.2 }),
        run: () => {
          marcus.setPose('stand').setMood('sad');
          lucius.setPose('stand').setMood('surprised');
        },
        narrate: 'He let the sword fall. Behind him, the dead stopped, and lay down, and were only dead again. Whatever he had given away, he took back.',
      },
      {
        when: marcusWon,
        shot: () => overShoulder(lucius, marcus),
        run: () => lucius.lookAt(marcus.headPosition()),
        say: { who: 'Lucius', text: 'Two emperors, then. Like the old days. You take the east. You always wanted to see it.', mood: 'warm' },
      },
      {
        duration: 5,
        shot: { from: [0, 6, 12], at: [0, 1, 2], to: [0, 10, 16], fov: FOV.wide },
        run: () => cross.setEnabled(true),
        fade: { to: 1, time: 4.5 },
      },
    ];
  },
};

export const theEnd: Cutscene = {
  id: 'the-end',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('goldenMorning');
    stage.ground('#6E9A48', 120, 'hills');
    stage.weather('motes');
    const marcusLives = isMarcus(story);
    grave(stage, -1.2, 0, 0, false);
    const second = grave(stage, 1.2, 0, 0, false);
    second.setEnabled(!marcusLives());
    const livia = cast(stage, 'liviaOld', 'Livia').place(0, 3, Math.PI).setPose('kneel', true);
    const lucius = cast(stage, 'lucius', 'Lucius', { helmet: false }).place(-1.6, 4.4, Math.PI);
    const marcus = cast(stage, 'marcusMongol', 'Marcus', { helmet: false }).place(1.6, 4.4, Math.PI);
    marcus.root.setEnabled(marcusLives());
    const cross = upright(woodenCross(stage.world.parts, stage.root, 1.3));
    cross.position.set(-1.2, 0.9, -1.0);
    const ribbon = stage.box('#4A7AC8', [0.4, 0.04, 0.06], [-1.2, 1.1, -0.92], 0, { castShadow: false });
    ribbon.rotation.z = 0.3;

    return [
      {
        duration: 7,
        fade: { from: 1, to: 0, time: 3 },
        music: 'monastery',
        shot: { from: [0, 3, 10], at: [0, 1, 0], to: [0, 2.4, 7], fov: FOV.wide },
        narrate: 'I come here every spring. I bring a ribbon. The old one always blows away.',
      },
      {
        when: marcusLives,
        shot: () => portrait(marcus, { angle: 0.4 }),
        run: () => marcus.setMood('warm').lookAt(livia.headPosition()),
        narrate: 'Marcus rides in from the east every spring too. He never says much. He fixes my fence.',
      },
      {
        when: () => !marcusLives(),
        duration: 5,
        shot: { from: [2.6, 1.2, 1.6], at: [1.2, 0.5, -0.6], fov: FOV.normal },
        narrate: 'Beside his father. Where he always should have been.',
      },
      {
        shot: () => portrait(lucius, { angle: -0.3 }),
        run: () => lucius.setMood('warm').lookAt(livia.headPosition()),
        narrate: 'Lucius brings his children. They ask about the monk who became an emperor. I tell them about the bells first.',
      },
      {
        duration: 5,
        shot: { from: [-0.4, 1.2, 1.6], at: [-1.2, 1.0, -1], fov: FOV.close },
        narrate: 'Crooked. Perfect. It knew the way home after all.',
      },
      {
        duration: 6,
        shot: { from: [0, 6, 14], at: [0, 1, 0], to: [0, 14, 24], fov: FOV.wide },
        title: { text: 'Tumblehorde', sub: 'The story of Cassian, and his sons' },
        fade: { to: 1, time: 5.5 },
      },
    ];
  },
};
