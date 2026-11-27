import { CAPITAL } from '../../campaign/districts.ts';
import type { Actor } from '../actor.ts';
import { cast } from '../cast.ts';
import type { Horse } from '../horse.ts';
import { upright, woodenCross } from '../props.ts';
import type { Beat, Cutscene, StoryContext } from '../script.ts';
import { SET_COLORS } from '../sets.ts';
import { FOV, overShoulder, portrait } from '../shot.ts';
import type { Stage } from '../stage.ts';
import { campfire, seatLog, STORY_COLORS, tents } from '../storySets.ts';
import { infirmary } from './livia.ts';

/**
 * The war after the war: the feast in the north cut short, the capital taken by the Mongols
 * while the legion was away, the march back, Hrolf's last ride, and Livia.
 *
 * What the Mongols did to Livia is part of the story, but it is never shown: the scenes show the
 * city falling and the morning after, and she tells Cassian what she chooses to tell.
 */

const HALL = {
  floor: '#6A5A48',
  wall: '#7A7468',
  table: '#6A4A2A',
  banner: '#A8282A',
  wine: '#7A1A2A',
  bread: '#D8A860',
} as const;

function feastHall(stage: Stage): void {
  stage.box(HALL.floor, [22, 0.1, 18], [0, -0.05, 0], 0, { castShadow: false });
  stage.box(HALL.wall, [22, 7, 0.6], [0, 3.5, -8]);
  for (const side of [-1, 1]) stage.box(HALL.wall, [0.6, 7, 18], [side * 11, 3.5, 1]);
  for (let i = 0; i < 4; i++) {
    stage.box(HALL.banner, [1.4, 3.2, 0.08], [-7.5 + i * 5, 4.2, -7.65]);
    stage.box(STORY_COLORS.gold, [0.5, 0.5, 0.1], [-7.5 + i * 5, 4.8, -7.6], 0, { metal: true });
  }
  // Two long tables heaped with food and wine, a hearth at the head of the hall.
  for (const x of [-3.2, 3.2]) {
    stage.box(HALL.table, [1.6, 0.12, 12], [x, 0.85, 0]);
    for (const z of [-5.5, 5.5]) stage.box(HALL.table, [1.4, 0.85, 0.2], [x, 0.42, z]);
    seatLog(stage, x - 1.3, 0, Math.PI / 2, 11);
    seatLog(stage, x + 1.3, 0, Math.PI / 2, 11);
    for (let i = 0; i < 10; i++) {
      stage.shape('cylinder', i % 2 === 0 ? HALL.wine : STORY_COLORS.steel, [0.12, 0.26, 0.12], [x - 0.4 + (i % 3) * 0.4, 1.04, -5 + i * 1.1]);
      stage.box(HALL.bread, [0.34, 0.16, 0.24], [x + 0.3, 0.98, -4.6 + i * 1.1], i * 0.4);
    }
  }
  stage.box(STORY_COLORS.hearth, [3.4, 1.4, 1.2], [0, 0.7, -7.2]);
  stage.fire(0, -7.0, 1.1, 1.4);
  for (const x of [-9, 9]) for (const z of [-5, 3]) stage.fire(x, z, 0.3, 2.6);
}

export const victoryFeast: Cutscene = {
  id: 'victory-feast',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('interior');
    feastHall(stage);
    const cassian = cast(stage, 'cassianCommander', 'Cassian').place(0, -4.2, 0).setStance('pose');
    const felix = cast(stage, 'felixLegion', 'Felix').place(-1.9, -2, Math.PI / 2).setStance('sit', true);
    const rufus = cast(stage, 'rufusLegion', 'Rufus').place(1.9, -1, -Math.PI / 2).setStance('sit', true);
    const galba = cast(stage, 'galba', 'Galba').place(-1.9, 1.5, Math.PI / 2).setStance('sit', true);
    const eirik = cast(stage, 'eirik', 'Eirik').place(1.9, 2.2, -Math.PI / 2).setStance('sit', true);
    if (story.save.choices.eirikSpared !== true) eirik.root.setEnabled(false);
    const revellers = Array.from({ length: 16 }, (_, i) => {
      const left = i % 2 === 0;
      return cast(stage, 'legionary', `Reveller ${i}`, { helmet: false, hair: i % 3 === 0 ? '#2A1E18' : '#5A3A22' })
        .place((left ? -4.5 : 4.5) + (i % 4 < 2 ? 0 : left ? 2.6 : -2.6), -4.5 + Math.floor(i / 4) * 2.6, left ? Math.PI / 2 : -Math.PI / 2)
        .setStance('sit', true)
        .setPose('cheer', true)
        .setMood('happy', true);
    });
    stage.animate((_dt, t) => revellers.forEach((r, i) => r.setPose(Math.sin(t * 3 + i) > 0.3 ? 'cheer' : 'offer')));
    const messenger = cast(stage, 'messenger', 'Messenger').place(0, 9, Math.PI);
    messenger.root.setEnabled(false);

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 2 },
        music: 'warm',
        sound: 'crowd',
        shot: { from: [0, 4.5, 9], at: [0, 1.2, -3], to: [0, 3.6, 6], fov: FOV.wide },
        narrate: 'That night the fortress drank to the end of the war. Every cup, every barrel, every song we knew.',
      },
      {
        shot: { from: [0.1, 1.5, -2.6], at: rufus, fov: FOV.normal },
        run: () => rufus.setPose('cheer').setMood('happy'),
        say: { who: 'Rufus', text: 'A toast! To Cassian, who walks into fire! And to me, who walks in after him and complains!', mood: 'happy' },
      },
      {
        duration: 3,
        shot: { from: [-0.1, 1.5, -3.4], at: felix, fov: FOV.normal },
        run: () => felix.setMood('happy'),
        say: { who: 'Felix', text: 'He complained the whole way. In the snow. Uphill. Both ways.', mood: 'happy' },
      },
      {
        shot: () => portrait(cassian, { angle: 0.3, distance: 2.4 }),
        run: () => cassian.setPose('offer').setMood('warm'),
        say: { who: 'Cassian', text: 'To Varro. And to everyone who is not at this table tonight.', mood: 'warm' },
      },
      {
        duration: 3,
        shot: { from: [0, 3, 6], at: [0, 1.2, -2], fov: FOV.wide },
        run: () => {
          for (const r of revellers) r.setPose('cheer');
          cassian.setPose('stand');
        },
        narrate: 'And in the morning, I would ride south. To a garden that needed a fence.',
      },
      {
        duration: 3,
        sound: 'door',
        music: 'dread',
        shot: { from: [1.5, 2.2, 4], at: [0, 1.4, 9], fov: FOV.normal },
        run: () => {
          messenger.root.setEnabled(true);
          messenger.setPose('reach').setMood('afraid');
          messenger.walkTo(0, 3, 2.2);
          for (const r of revellers) r.setPose('stand').setMood('surprised');
        },
        narrate: 'The doors banged open. A rider, covered in dust and blood, nine days in the saddle.',
      },
      {
        shot: () => portrait(messenger, { angle: 0.2, distance: 2.4 }),
        run: () => {
          messenger.finishWalk();
          messenger.setPose('kneel').setMood('crying');
        },
        say: { who: 'Messenger', as: 'The rider', text: 'Legate... the capital. Riders from the east, thousands of them, on small fast horses. They came while you were here.', mood: 'crying' },
      },
      {
        shot: () => portrait(messenger, { angle: 0.1, distance: 2.0, push: 0.2 }),
        say: { who: 'Messenger', as: 'The rider', text: 'The walls held one day. The Emperor is dead. The city is burning. They call them Mongols.', mood: 'crying' },
      },
      {
        duration: 4,
        sound: 'heartbeat',
        shot: () => portrait(cassian, { angle: -0.2, distance: 1.8, fov: FOV.extreme, push: 0.2 }),
        run: () => cassian.setMood('afraid'),
        narrate: 'I did not think of the Emperor. I did not think of the Empire. I thought of one house, behind the infirmary, with a garden.',
      },
      {
        duration: 3.5,
        shot: () => portrait(cassian, { angle: 0.3, distance: 2.2 }),
        run: () => cassian.setPose('raiseSword').setMood('shout'),
        say: { who: 'Cassian', text: 'Saddle the horses. All of them. We ride tonight.', mood: 'shout' },
        fade: { to: 1, time: 3 },
      },
    ];
  },
};

/** Riders and the garrison in the burning capital. */
const ATTACK = { riders: 18, defenders: 14, people: 16, bodies: 18 } as const;

function mountedRider(stage: Stage, role: 'mongol' | 'khan', name: string, x: number, z: number, yaw: number): { rider: Actor; horse: Horse } {
  const horse = stage.horse(role === 'khan' ? '#E8E0CC' : undefined);
  horse.place(x, z, yaw);
  const rider = cast(stage, role, name);
  stage.mount(rider, horse);
  rider.setPose('raiseSword').setMood('shout');
  return { rider, horse };
}

export const capitalFalls: Cutscene = {
  id: 'capital-falls',
  create(stage: Stage): Beat[] {
    // Dusk and the city on fire: dark enough to frighten, light enough to see.
    stage.light('dusk');
    CAPITAL.build(stage);
    stage.weather('embers');
    const fires: readonly [number, number, number, number][] = [
      [-12, -24, 2.4, 8], [14, -26, 2.2, 7], [-30, 6, 2.6, 6], [28, -8, 2.0, 7], [-8, 28, 2.4, 6], [10, 30, 2.2, 7], [0, -50, 3, 9], [36, 20, 2.2, 6],
    ];
    for (const [x, z, size, y] of fires) stage.fire(x, z, size, y);
    const riders = Array.from({ length: ATTACK.riders }, (_, i) =>
      mountedRider(stage, i === 0 ? 'khan' : 'mongol', i === 0 ? 'Jorgai' : `Rider ${i}`, -2 + (i % 4) * 1.4, 44 - Math.floor(i / 4) * 3, Math.PI),
    );
    const defenders = Array.from({ length: ATTACK.defenders }, (_, i) =>
      cast(stage, 'legionary', `Defender ${i}`).place(-4 + (i % 5) * 2, -6 - Math.floor(i / 5) * 1.6, 0).setPose('raiseSword').setMood('afraid'),
    );
    const people = Array.from({ length: ATTACK.people }, (_, i) =>
      cast(stage, 'villager', `Citizen ${i}`, { color: ['#8A7A5A', '#6A8A9A', '#9A6A5A'][i % 3], age: i % 4 === 0 ? 'child' : 'adult' })
        .place(-14 + (i % 5) * 1.6, -8 - Math.floor(i / 5) * 2, Math.PI)
        .setMood('afraid'),
    );
    // What the square looks like when it is over.
    const bodies = Array.from({ length: ATTACK.bodies }, (_, i) =>
      cast(stage, i % 3 === 0 ? 'legionary' : 'villager', `Fallen ${i}`, i % 3 === 0 ? {} : { color: ['#8A7A5A', '#6A8A9A', '#9A6A5A', '#7A6A8A'][i % 4] })
        .place(-16 + ((i * 7) % 30), -12 + ((i * 11) % 24), i * 1.3)
        .setPose('lie', true),
    );
    for (const b of bodies) {
      b.eyesClosed = true;
      b.root.setEnabled(false);
    }
    const banner = stage.group('banner', 6, 0, -14);
    stage.world.parts.part('box', '#5E3E22', banner, [0.16, 6, 0.16], [0, 3, 0]);
    stage.world.parts.part('box', '#A8282A', banner, [1.6, 2.4, 0.06], [0.85, 4.6, 0]);
    stage.world.parts.part('box', '#E0B040', banner, [0.5, 0.5, 0.08], [0.85, 4.9, 0.02], { metal: true });
    const sacks = riders.slice(1, 6).map((r) => {
      const sack = stage.group('sack', 0, 0, 0);
      stage.world.parts.part('box', '#B89A6A', sack, [0.5, 0.6, 0.4], [0, 0, 0]);
      sack.parent = r.rider.grips[1];
      sack.setEnabled(false);
      return sack;
    });
    const livia = cast(stage, 'livia', 'Livia').place(-17, 10, -Math.PI / 2).setMood('afraid');

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'dread',
        sound: 'horn',
        shot: { from: [0, 26, 40], at: [0, 2, 10], to: [0, 20, 32], fov: FOV.wide },
        run: () => {
          for (const [i, r] of riders.entries()) r.horse.runTo(-2 + (i % 4) * 1.4, 18 - Math.floor(i / 4) * 3, 9);
        },
        narrate: 'Felix\'s cousin was in the city that night. This is what he told me, years later.',
      },
      {
        duration: 4,
        sound: 'screams',
        shot: { from: [3, 1.4, 20], at: [0, 2, 36], fov: FOV.wide },
        narrate: 'They came through the south gate like water through a broken dam. Small horses. Curved swords. No end to them.',
      },
      {
        duration: 5,
        sound: 'screams',
        shot: { from: [-9, 1.6, -16], at: [-12, 1.2, -6], fov: FOV.wide },
        run: () => {
          for (const [i, p] of people.entries()) p.setPose('cower').walkTo(-18 - (i % 4), -20 - (i % 3), 4);
          riders[3]?.horse.runTo(-14, -12, 6);
          riders[4]?.horse.runTo(-11, -14, 6);
        },
        during: (_s, p) => {
          people.forEach((person, i) => {
            if (i % 4 === 1 && p > 0.4 + i * 0.03) person.setPose('lie');
          });
        },
        narrate: 'They rode down whoever was in the street. Men, women, old people. It made no difference to them.',
      },
      {
        duration: 3,
        shot: () => portrait(riders[0]!.rider, { angle: 0.3, distance: 3, rise: -0.3 }),
        run: () => {
          for (const r of riders) r.horse.finishRun();
          riders[0]!.rider.setPose('point');
        },
        say: { who: 'Jorgai', as: 'Jorgai the Hawk', text: 'Their army is in the north, chasing Vikings. Take everything.', mood: 'shout' },
      },
      {
        duration: 5,
        sound: 'fire',
        shot: { from: [-10, 3.5, -12], at: [0, 1.4, 6], to: [-8, 4, -10], fov: FOV.wide },
        run: () => {
          for (const [i, r] of riders.entries()) r.horse.runTo(-3 + (i % 4) * 2, -3.5 - Math.floor(i / 4) * 1.2, 7);
          for (const d of defenders) d.setPose('raiseSword').setMood('shout');
        },
        narrate: 'The city guard stood in the square. Old men and boys, a hundred against thousands.',
      },
      {
        duration: 4,
        sound: 'clash',
        shot: { from: [8, 2.4, -6], at: [0, 1.2, -4], fov: FOV.normal },
        run: () => {
          for (const d of defenders) d.setPose('punch').setMood('shout');
          riders[6]!.horse.falling = true;
          riders[7]!.horse.falling = true;
          riders[6]!.rider.setPose('lie');
          riders[7]!.rider.setPose('lie');
        },
        narrate: 'The old men fought. They pulled riders from their saddles and brought horses down with their spears.',
      },
      {
        duration: 4,
        sound: 'clash',
        shot: { from: [-7, 2.2, -10], at: [0, 1.2, -5], fov: FOV.normal },
        during: (_s, p) => {
          defenders.forEach((d, i) => {
            if (p > 0.1 + i * 0.06) d.setPose('lie').setMood('afraid');
          });
        },
        narrate: 'It was not enough. Nothing would have been enough. But they did not run.',
      },
      {
        duration: 4,
        shot: { from: [-16, 2, -14], at: [-11, 1.2, -9], fov: FOV.normal },
        run: () => {
          for (const [i, p] of people.entries()) p.setPose('cower').walkTo(-20 - (i % 3), -16 - (i % 4), 3.5);
        },
        narrate: 'Whoever could run, ran.',
      },
      {
        duration: 4,
        shot: { from: [-13, 1.6, 15], at: livia, fov: FOV.normal },
        run: () => {
          livia.setPose('cower').walkTo(-20.5, 10, 2.4);
        },
        narrate: 'Livia did not run. She had a house full of wounded, and she would not leave them.',
      },
      {
        duration: 3,
        shot: () => portrait(livia, { angle: 0.4, distance: 2.0 }),
        run: () => {
          livia.finishWalk();
          livia.setPose('stand').setMood('afraid').lookAt({ x: 0, y: 2, z: 20 });
        },
        sound: 'heartbeat',
      },
      {
        duration: 4,
        fade: { to: 1, time: 1.2 },
        shot: { from: [-15, 1.8, 10], at: [-22.5, 1.6, 10], fov: FOV.normal },
        run: () => livia.walkTo(-23.8, 10, 1.2),
        narrate: 'She went back inside and barred the door.',
      },
      {
        duration: 6,
        sound: 'fire',
        fade: { to: 0, time: 1.5 },
        shot: { from: [10, 9, 14], at: [0, 0.5, -4], to: [8, 7, 11], fov: FOV.wide },
        run: () => {
          for (const b of bodies) b.root.setEnabled(true);
          for (const d of defenders) d.setPose('lie');
          for (const sack of sacks) sack.setEnabled(true);
          for (const [i, r] of riders.entries()) if (i > 0 && i < 6) r.horse.runTo(-6 + i * 2.5, 8, 2);
          livia.root.setEnabled(false);
        },
        during: (_s, p) => {
          banner.rotation.z = Math.min(1.45, p * p * 3);
        },
        narrate: 'By morning the square was full of the dead. They carried off everything that could be carried, and tore down the Emperor\'s eagle.',
      },
      {
        duration: 4,
        shot: () => portrait(riders[0]!.rider, { angle: 0.4, distance: 3.2, rise: -0.2 }),
        run: () => riders[0]!.rider.setPose('cheer').setMood('happy'),
        say: { who: 'Jorgai', as: 'Jorgai the Hawk', text: 'Rome. The great Rome. It burns like any village.', mood: 'happy' },
        fade: { to: 1, time: 3.5 },
      },
      {
        duration: 6,
        narrate: 'What happened behind Livia\'s door is hers to tell, not mine. I will only say this: the Mongols held the city for forty days.',
      },
    ];
  },
};

export const campSouth: Cutscene = {
  id: 'camp-south',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('dusk');
    stage.ground('#5A6A3A', 140, 'hills');
    tents(stage, -12, -6, 6, 0);
    tents(stage, -12, 6, 6, 0);
    campfire(stage, 0, 0, 1.0);
    for (const [x, z, yaw] of [[-2, 0, Math.PI / 2], [2, 0, Math.PI / 2], [0, 2.1, 0]] as const) seatLog(stage, x, z, yaw);
    const spared = (): boolean => story.save.choices.hrolfSpared === true;
    const cassian = cast(stage, 'cassianCommander', 'Cassian').place(-1.9, -0.2, Math.PI / 2).setStance('sit', true).setMood('sad', true);
    const felix = cast(stage, 'felixLegion', 'Felix').place(1.9, 0.3, -Math.PI / 2).setStance('sit', true);
    const rufus = cast(stage, 'rufusLegion', 'Rufus').place(0, 2.1, Math.PI).setStance('sit', true);
    const legion = Array.from({ length: 10 }, (_, i) => cast(stage, 'legionary', `Legionary ${i}`).place(-14 + (i % 5) * 3, -2 + Math.floor(i / 5) * 4, Math.PI / 2).setPose('slump', true));
    const hrolf = cast(stage, 'hrolf', 'Hrolf').place(16, 2, -Math.PI / 2);
    const vikings = Array.from({ length: 12 }, (_, i) => cast(stage, 'viking', `Viking ${i}`).place(18 + (i % 4) * 1.4, -2 + Math.floor(i / 4) * 2, -Math.PI / 2));
    const galba = cast(stage, 'galba', 'Galba').place(-6, 3, Math.PI / 2);
    for (const a of [hrolf, ...vikings]) a.root.setEnabled(false);

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'sorrow',
        sound: 'wind',
        shot: { from: [10, 6, 16], at: [-4, 0.8, 0], to: [8, 5, 13], fov: FOV.wide },
        narrate: 'We rode south for eleven days. Men slept in the saddle. Horses died on the road.',
      },
      {
        shot: () => portrait(rufus, { angle: 0.3 }),
        run: () => rufus.setMood('sad'),
        say: { who: 'Rufus', text: 'I have not made a joke in four days, Felix. Four. I am frightened.', mood: 'sad' },
      },
      {
        shot: () => portrait(felix, { angle: -0.4 }),
        run: () => felix.lookAt(cassian.headPosition()),
        say: { who: 'Felix', text: 'He has not spoken since the fortress. Not one word.', mood: 'sad' },
      },
      {
        shot: () => portrait(cassian, { angle: 0.4, distance: 2.0 }),
        run: () => cassian.setMood('crying'),
        say: { who: 'Cassian', text: 'I left her there. I went north to kill one man, and I left her there.', mood: 'crying' },
      },
      {
        when: spared,
        duration: 4,
        sound: 'horn',
        shot: { from: [4, 2.2, 6], at: [16, 1.4, 0], fov: FOV.wide },
        run: () => {
          for (const a of [hrolf, ...vikings]) a.root.setEnabled(true);
          hrolf.walkTo(4, 0.6, 1.6);
          for (const v of vikings) v.walkTo(v.root.position.x - 8, v.root.position.z, 1.6);
          for (const l of legion) l.setPose('raiseSword').setMood('afraid');
        },
        narrate: 'At dusk, horns in the hills. Vikings. And at their head, a red beard I knew too well.',
      },
      {
        when: spared,
        shot: () => portrait(hrolf, { angle: 0.3 }),
        run: () => {
          hrolf.finishWalk();
          hrolf.lookAt(cassian.headPosition()).setMood('warm');
        },
        say: { who: 'Hrolf', text: 'You gave me my life, monk. I heard where you were riding. I bring you my best axes.', mood: 'warm' },
      },
      {
        when: spared,
        shot: () => overShoulder(cassian, hrolf, { side: -1 }),
        run: () => cassian.setStance('pose').setPose('stand').setMood('surprised'),
        say: { who: 'Cassian', text: 'Why?', mood: 'surprised' },
      },
      {
        when: spared,
        shot: () => portrait(hrolf, { angle: 0.2, distance: 2.2 }),
        say: { who: 'Hrolf', text: 'Because I told my sons a different story. And they asked me how it ends.', mood: 'warm' },
      },
      {
        when: () => !spared(),
        shot: () => portrait(galba, { angle: 0.4 }),
        run: () => galba.walkTo(-3.5, 0.4, 1.2).lookAt(cassian.headPosition()),
        say: { who: 'Galba', text: 'My cohort rides with you, Legate. Every man who can still hold a sword.', mood: 'neutral' },
      },
      {
        duration: 5,
        shot: { from: [-3, 1.4, 4], at: [0, 1, 0], to: [-4, 2, 6], fov: FOV.normal },
        run: () => {
          cassian.setStance('pose').setPose('fist').setMood('angry');
          upright(woodenCross(stage.world.parts, cassian.grips[0], 1.0));
        },
        narrate: 'Tomorrow the open plain. Their scouts had already seen us.',
        fade: { to: 1, time: 4.5 },
      },
    ];
  },
};

export const ridersCome: Cutscene = {
  id: 'riders-come',
  create(stage: Stage): Beat[] {
    stage.light('day');
    stage.ground('#6E9A48', 160, 'hills');
    const cassian = cast(stage, 'cassianHelmet', 'Cassian').place(0, 0, 0);
    const legion = Array.from({ length: 16 }, (_, i) => cast(stage, 'legionary', `Legionary ${i}`).place(-6 + (i % 8) * 1.7, -2 - Math.floor(i / 8) * 1.6, 0));
    const riders = Array.from({ length: 18 }, (_, i) => mountedRider(stage, i === 0 ? 'khan' : 'mongol', i === 0 ? 'Jorgai' : `Rider ${i}`, -16 + (i % 9) * 4, 60 + Math.floor(i / 9) * 4, Math.PI));

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 1.5 },
        music: 'dread',
        sound: 'horn',
        shot: { from: [2, 2.2, -6], at: [0, 1.5, 40], fov: FOV.wide },
        run: () => {
          for (const [i, r] of riders.entries()) r.horse.runTo(-16 + (i % 9) * 4, 30 + Math.floor(i / 9) * 4, 5);
        },
        narrate: 'They came over the hill like a dark wave. Not in lines like us. In a great loose cloud, fast as wind.',
      },
      {
        shot: () => portrait(cassian, { angle: 0.4, distance: 2.4 }),
        run: () => {
          cassian.setPose('raiseSword').setMood('shout');
          for (const l of legion) l.setPose('raiseSword');
        },
        say: { who: 'Cassian', text: 'Shields! Square! A horse will not run onto a hedge of spears!', mood: 'shout' },
      },
      {
        duration: 3,
        shot: () => portrait(riders[0]!.rider, { angle: 0.2, distance: 3.2, rise: -0.3 }),
        run: () => {
          for (const r of riders) r.horse.finishRun();
        },
        say: { who: 'Jorgai', as: 'Jorgai the Hawk', text: 'The little Roman army came home. Good. Saves us the ride.', mood: 'happy' },
      },
      {
        duration: 2,
        shot: { from: [0, 8, -10], at: [0, 1, 20], fov: FOV.wide },
        fade: { to: 1, time: 1.8 },
      },
    ];
  },
};

export const hrolfFarewell: Cutscene = {
  id: 'hrolf-farewell',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('dusk');
    stage.ground('#5A7A3A', 140, 'hills');
    const spared = (): boolean => story.save.choices.hrolfSpared === true;
    for (let i = 0; i < 8; i++) cast(stage, 'mongol', `Fallen rider ${i}`).place(-8 + (i % 4) * 4, 6 + Math.floor(i / 4) * 5, i).setPose('lie', true).eyesClosed = true;
    const cassian = cast(stage, 'cassianHelmet', 'Cassian').place(0.9, 0.2, -Math.PI / 2).setPose('kneel', true);
    const hrolf = cast(stage, 'hrolf', 'Hrolf').place(-0.4, 0, Math.PI / 2).setPose('lie', true).setMood('sad', true);
    hrolf.setWounded(true);
    const sons = [cast(stage, 'viking', 'Sigurd', { helmet: false, hair: SET_COLORS.straw, beard: 'short' }), cast(stage, 'viking', 'Bjorn', { helmet: false, hair: '#B4471E', beard: 'stubble' })];
    sons.forEach((s, i) => s.place(-1 + i * 1.6, -2.2, 0).setMood('sad', true));
    const vikings = Array.from({ length: 8 }, (_, i) => cast(stage, 'viking', `Viking ${i}`).place(-6 + i * 1.6, -5, 0).setPose('pray', true));
    const felix = cast(stage, 'felixLegion', 'Felix').place(3.2, -1.8, -0.6);
    if (!spared()) for (const a of [hrolf, ...sons, ...vikings]) a.root.setEnabled(false);
    const galba = cast(stage, 'galba', 'Galba').place(-0.8, 1.6, Math.PI * 0.8);
    if (spared()) galba.root.setEnabled(false);

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 2 },
        music: 'sorrow',
        shot: { from: [6, 4, 10], at: [0, 0.6, 0], to: [5, 3, 8], fov: FOV.wide },
        narrate: 'We broke them on the open field. Their Hawk fell, and the rest scattered east like birds.',
      },
      {
        when: spared,
        shot: () => portrait(hrolf, { angle: 1.3, distance: 2.0, rise: 0.6 }),
        run: () => hrolf.lookAt(cassian.headPosition()),
        say: { who: 'Hrolf', text: 'Ha. A Mongol arrow. After all these years of Roman swords. Funny.', mood: 'sad' },
      },
      {
        when: spared,
        shot: () => overShoulder(cassian, hrolf),
        run: () => cassian.setMood('sad').lookAt(hrolf.headPosition()),
        say: { who: 'Cassian', text: 'Stay with me, Hrolf. You still have a story to finish.', mood: 'sad' },
      },
      {
        when: spared,
        shot: () => portrait(hrolf, { angle: 1.2, distance: 1.8, rise: 0.6, push: 0.2 }),
        say: { who: 'Hrolf', text: 'Promise me. No more fire between your people and mine. Not for my sons. Not for yours.', mood: 'crying' },
      },
      {
        when: spared,
        shot: () => portrait(cassian, { angle: -0.3, distance: 1.8 }),
        run: () => cassian.setMood('crying'),
        say: { who: 'Cassian', text: 'I promise. Peace. For as long as I live.', mood: 'crying' },
      },
      {
        when: spared,
        duration: 4,
        sound: 'heartbeat',
        shot: { from: [-1, 2.2, 2.6], at: [-0.4, 0.3, 0], fov: FOV.normal },
        run: () => {
          hrolf.eyesClosed = true;
          hrolf.lookAt(null);
          for (const s of sons) s.setPose('kneel').setMood('crying');
        },
        narrate: 'The man who burned my home died with my hand in his. I never thought I would weep for him. I did.',
      },
      {
        when: spared,
        shot: () => portrait(sons[0]!, { angle: 0.3 }),
        run: () => sons[0]!.setPose('stand').lookAt(cassian.headPosition()),
        say: { who: 'Sigurd', text: 'He talked about you every night, Roman. The monk who let him go. We will take him home to the sea.', mood: 'sad' },
      },
      {
        when: spared,
        shot: () => portrait(sons[1]!, { angle: -0.3 }),
        say: { who: 'Bjorn', text: 'Some of our men want to stay with you. They say you fight like a Viking. It is the best thing they know how to say.', mood: 'warm' },
      },
      {
        when: () => !spared(),
        shot: () => portrait(galba, { angle: 0.3 }),
        run: () => galba.lookAt(cassian.headPosition()),
        say: { who: 'Galba', text: 'It is done, Legate. The road to the capital is open.', mood: 'neutral' },
      },
      {
        shot: () => portrait(felix, { angle: 0.4 }),
        run: () => felix.lookAt(cassian.headPosition()),
        say: { who: 'Felix', text: 'Go, Cassian. We will bring the legion. Go and find her.', mood: 'warm' },
        fade: { to: 1, time: 3 },
      },
    ];
  },
};

/** The capital's south gate at night, burnt, and the street beyond. */
export const gateArrive: Cutscene = {
  id: 'gate-arrive',
  create(stage: Stage): Beat[] {
    stage.light('night');
    CAPITAL.build(stage);
    for (const [x, z, size, y] of [[-6, 34, 1.4, 4], [8, 40, 1.6, 5], [0, 20, 1.0, 0.4]] as const) stage.fire(x, z, size, y);
    stage.weather('ash');
    const cassian = cast(stage, 'cassianHelmet', 'Cassian').place(0, 46, Math.PI);
    const felix = cast(stage, 'felixLegion', 'Felix').place(-1.2, 47.4, Math.PI);
    const rufus = cast(stage, 'rufusLegion', 'Rufus').place(1.2, 47.4, Math.PI);

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 2 },
        music: 'dread',
        sound: 'wind',
        shot: { from: [0, 3, 38], at: [0, 1.8, 47], to: [0, 2.4, 40], fov: FOV.normal },
        narrate: 'The south gate hung open, black with smoke. The city I had walked out of a free man was silent.',
      },
      {
        shot: () => portrait(rufus, { angle: 0.4 }),
        run: () => rufus.setMood('afraid'),
        say: { who: 'Rufus', text: 'There are still some of them in the streets. Cassian, wait for the legion!', mood: 'afraid' },
      },
      {
        shot: () => portrait(cassian, { angle: -0.3, distance: 2.0 }),
        run: () => cassian.setMood('angry').setPose('raiseSword'),
        say: { who: 'Cassian', text: 'Hold the gate. Nobody gets in or out. I am going alone.', mood: 'angry' },
      },
      {
        duration: 3,
        shot: { from: [0, 1.6, 36], at: cassian, fov: FOV.normal },
        run: () => cassian.walkTo(0, 30, 4),
        fade: { to: 1, time: 2.6 },
      },
    ];
  },
};

export const liviaFound: Cutscene = {
  id: 'livia-found',
  create(stage: Stage): Beat[] {
    stage.light('interior');
    infirmary(stage, true);
    const livia = cast(stage, 'livia', 'Livia').place(3.4, -1.6, -Math.PI / 2).setStance('sit', true).setPose('hunch', true).setMood('sad', true);
    const cassian = cast(stage, 'cassianHelmet', 'Cassian').place(-4, 1.5, Math.PI / 2);

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 2 },
        music: 'silence',
        sound: 'door',
        shot: { from: [-3, 2, 3.4], at: [3.2, 1, -1.4], fov: FOV.normal },
        run: () => cassian.walkTo(1.6, -0.6, 1.0),
        narrate: 'The jars were smashed. The herbs trampled. She was sitting on the cot, very still.',
      },
      {
        duration: 3,
        shot: () => portrait(livia, { angle: -0.3, distance: 2.0 }),
        run: () => {
          cassian.finishWalk();
          livia.lookAt(cassian.headPosition()).setMood('crying');
        },
        say: { who: 'Livia', text: 'You came back.', mood: 'crying' },
      },
      {
        shot: () => portrait(cassian, { angle: 0.4, distance: 1.9 }),
        run: () => cassian.setPose('kneel').setMood('crying').lookAt(livia.headPosition()),
        say: { who: 'Cassian', text: 'I am here. I am here now. I should never have gone.', mood: 'crying' },
      },
      {
        music: 'sorrow',
        shot: () => portrait(livia, { angle: -0.2, distance: 1.8 }),
        say: { who: 'Livia', text: 'They came through the door on the first night. Three of them. They hurt me, Cassian. For a long time.', mood: 'crying' },
      },
      {
        shot: () => portrait(livia, { angle: -0.1, distance: 1.7, push: 0.2 }),
        say: { who: 'Livia', text: 'I will not tell you the rest. Not tonight. Maybe not ever. Do not ask me.', mood: 'sad' },
      },
      {
        shot: () => overShoulder(cassian, livia, { side: -1 }),
        say: { who: 'Cassian', text: 'I will never ask. You are alive. That is all I need to know.', mood: 'sad' },
      },
      {
        duration: 4,
        shot: { from: [1.2, 1.6, 2.2], at: [2.8, 1, -1.4], fov: FOV.normal },
        run: () => {
          livia.setStance('pose').setPose('embrace').setMood('crying');
          cassian.setPose('embrace');
          cassian.place(2.6, -1.0, -Math.PI * 0.75);
        },
        narrate: 'I held her until the sun came up. Neither of us said another word.',
      },
      {
        duration: 5,
        shot: { from: [-2, 2.4, 3], at: [2.8, 1.2, -1.4], to: [-3, 2.8, 4], fov: FOV.normal },
        narrate: 'Outside, the legion came through the gate, and the city began to breathe again.',
        fade: { to: 1, time: 4 },
      },
    ];
  },
};
