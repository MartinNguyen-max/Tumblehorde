import { childNode } from '../../render/parts.ts';
import { cast } from '../cast.ts';
import { torch } from '../props.ts';
import type { Beat, Cutscene } from '../script.ts';
import { FOV, overShoulder, portrait } from '../shot.ts';
import type { Stage } from '../stage.ts';
import { roadForest } from './prologueNight.ts';

/**
 * Two walks in the woods that end in a fight: the forest road north, where the bandits have
 * caught two villagers, and the night march through the dark forest, where the Vikings wait.
 */

const TORCH_HEAD = 0.5;

/** Where the villagers make their stand up the road, and where the bandits close in. */
const STAND = { x: 0, z: -26 } as const;

export const forestRoadWalk: Cutscene = {
  id: 'forest-road-walk',
  create(stage: Stage): Beat[] {
    stage.light('day');
    stage.ground('#3E5A30', 160, 'forest');
    roadForest(stage);
    stage.weather('motes');
    const cassian = cast(stage, 'cassianTraveller', 'Cassian').place(-0.6, 14, Math.PI);
    const varro = cast(stage, 'varroArmored', 'Varro').place(0.7, 15.2, Math.PI);
    const felix = cast(stage, 'felix', 'Felix').place(STAND.x - 0.6, STAND.z, Math.PI * 0.1);
    const rufus = cast(stage, 'rufus', 'Rufus').place(STAND.x + 0.7, STAND.z - 0.4, -Math.PI * 0.1);
    const bandits = Array.from({ length: 7 }, (_, i) => {
      const a = Math.PI * 0.75 + (i / 6) * Math.PI * 1.5;
      return cast(stage, 'bandit', i === 0 ? 'Bandit' : `Bandit ${i}`, i % 2 === 0 ? { hair: '#5A3A22' } : {})
        .place(STAND.x + Math.sin(a) * 3.4, STAND.z - 1 + Math.cos(a) * 3.4, a + Math.PI)
        .setPose('raiseSword')
        .setMood('happy');
    });

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'warm',
        sound: 'wind',
        shot: { from: [2.5, 2.4, 6], at: cassian, to: [2.0, 2.0, 2], fov: FOV.normal },
        run: () => {
          cassian.walkTo(-0.6, 4, 1.4);
          varro.walkTo(0.7, 5.2, 1.4);
        },
        narrate: 'The road north ran through the old forest. Varro said the bandits owned it. Varro said a lot of things.',
      },
      {
        shot: () => overShoulder(cassian, varro, { side: -1 }),
        run: () => {
          cassian.place(-0.6, 4, Math.PI);
          varro.place(0.7, 5.2, Math.PI).setMood('happy').lookAt(cassian.headPosition());
        },
        say: { who: 'Varro', text: 'If anybody asks, that armor is borrowed. It is. From me. Do not get holes in it.', mood: 'happy' },
      },
      {
        duration: 2.5,
        sound: 'horn',
        shot: () => portrait(cassian, { angle: 0.3, distance: 2.2 }),
        run: () => cassian.setMood('surprised').turnTo(Math.PI),
        say: { who: 'Felix', text: 'HELP! Somebody! HEEELP!', mood: 'shout', as: 'A voice up the road' },
      },
      {
        duration: 4.5,
        tags: [
          { who: 'Felix', text: 'Villagers' },
          { who: 'Bandit 3', text: 'Bandits' },
        ],
        shot: { from: [2.2, 2.6, STAND.z + 9], at: [STAND.x, 1.2, STAND.z], to: [1.6, 2.2, STAND.z + 7], fov: FOV.normal },
        run: () => {
          felix.setPose('cower').setMood('afraid');
          rufus.setPose('raiseSword').setMood('angry');
        },
        narrate: 'Two farmers with a pitchfork and a frying pan, and a whole gang of bandits round them.',
      },
      {
        duration: 3,
        shot: () => portrait(rufus, { angle: 0.4, distance: 2.4 }),
        run: () => {
          rufus.setPose('punch');
          bandits[0]?.setPose('lie').setMood('surprised');
        },
        say: { who: 'Rufus', text: 'BONK! Hehehe!', mood: 'happy' },
      },
      {
        shot: () => portrait(bandits[1]!, { angle: -0.3, rise: -0.2 }),
        run: () => bandits[1]?.setMood('angry').lookAt(rufus.headPosition()),
        say: { who: 'Bandit 1', as: 'Bandit', text: 'He hit Gnaeus with a pan! Cut them up, boys! Slowly!', mood: 'shout' },
      },
      {
        shot: () => overShoulder(varro, cassian),
        run: () => cassian.setPose('raiseSword').setMood('angry').lookAt(varro.headPosition()),
        say: { who: 'Cassian', text: 'Varro. With me.', mood: 'angry' },
      },
      {
        duration: 3,
        shot: () => portrait(varro, { angle: -0.4 }),
        run: () => varro.setPose('raiseSword').setMood('happy'),
        say: { who: 'Varro', text: 'Right behind you, boy. Well. A bit behind you. My knees.', mood: 'happy' },
      },
      {
        duration: 2.5,
        shot: { from: [0, 1.2, 10], at: [0, 1.2, STAND.z], fov: FOV.wide },
        run: () => {
          cassian.walkTo(-0.4, -10, 6);
          varro.walkTo(0.8, -8, 5);
        },
        fade: { to: 1, time: 2.2 },
      },
    ];
  },
};

/** The column on the path through the dark forest, and where the Vikings burst out. */
const COLUMN = 10;

export const ambush: Cutscene = {
  id: 'ambush',
  create(stage: Stage): Beat[] {
    stage.light('night');
    stage.ground('#22301E', 160, 'forest');
    roadForest(stage);
    stage.weather('motes');
    const cassian = cast(stage, 'cassianHelmet', 'Cassian').place(0, 6, Math.PI);
    const felix = cast(stage, 'felixLegion', 'Felix').place(-0.7, 8, Math.PI);
    const rufus = cast(stage, 'rufusLegion', 'Rufus').place(0.7, 8.2, Math.PI);
    const varro = cast(stage, 'varroArmored', 'Varro').place(0.8, 4.6, Math.PI);
    const scout = cast(stage, 'legionary', 'Scout').place(0.3, 1, Math.PI);
    const legion = Array.from({ length: COLUMN }, (_, i) => cast(stage, 'legionary', `Legionary ${i}`).place((i % 2 === 0 ? -0.7 : 0.7), 10 + Math.floor(i / 2) * 1.6, Math.PI));
    for (const [i, man] of [scout, ...legion].entries()) {
      if (i % 3 !== 0) continue;
      const t = torch(stage.world.parts, man.grips[0]);
      t.rotation.x = Math.PI;
      stage.flame(childNode('torch-head', t, 0, TORCH_HEAD, 0));
    }
    const vikings = Array.from({ length: 14 }, (_, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      return cast(stage, 'viking', i === 0 ? 'Viking' : `Viking ${i}`)
        .place(side * (5 + (i % 3) * 1.5), -2 + Math.floor(i / 2) * 2.2, side > 0 ? -Math.PI / 2 : Math.PI / 2)
        .setPose('raiseSword')
        .setMood('shout');
    });
    for (const v of vikings) v.root.setEnabled(false);
    const everyone = [cassian, felix, rufus, varro, scout, ...legion];

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2.5 },
        music: 'dread',
        sound: 'wind',
        shot: { from: [2.2, 3.5, -6], at: [0, 1.2, 6], to: [1.6, 2.6, -2], fov: FOV.wide },
        run: () => {
          for (const a of everyone) a.walkTo(a.root.position.x, a.root.position.z - 6, 1.1);
        },
        narrate: 'No moon. The path through the dark forest was the short way north. The short way is never the safe way.',
      },
      {
        shot: { from: [2.0, 1.7, 0.2], at: [0.2, 1.45, 2.1], fov: FOV.normal },
        run: () => {
          for (const a of everyone) a.finishWalk();
          rufus.setMood('afraid').lookAt({ x: -6, y: 2, z: 2 });
        },
        say: { who: 'Rufus', text: 'Felix. Felix! I think that tree just looked at me.', mood: 'afraid' },
      },
      {
        shot: { from: [-1.8, 1.7, 0.2], at: [-0.3, 1.45, 2.1], fov: FOV.normal },
        run: () => felix.setMood('neutral').lookAt(rufus.headPosition()),
        say: { who: 'Felix', text: 'Trees do not look at people, Rufus.', mood: 'neutral' },
      },
      {
        duration: 3,
        shot: () => portrait(rufus, { angle: 0.3, distance: 1.8 }),
        run: () => rufus.setMood('afraid'),
        say: { who: 'Rufus', text: 'This one did. It had a beard.', mood: 'afraid' },
      },
      {
        shot: { from: [-2.4, 1.8, -7.2], at: [0.3, 1.5, -5], fov: FOV.normal },
        run: () => {
          scout.setPose('point').setMood('afraid').turnTo(-Math.PI / 2);
          cassian.lookAt(scout.headPosition());
        },
        say: { who: 'Scout', as: 'A legionary', text: 'Legate! Legate Cassian! In the trees! THERE!', mood: 'shout' },
      },
      {
        duration: 3,
        sound: 'horn',
        tags: [
          { who: 'Viking 2', text: 'Vikings' },
          { who: 'Viking 3', text: 'Vikings' },
        ],
        shot: { from: [0, 7, -7], at: [0, 0.5, 2], to: [0, 5, -5], fov: FOV.wide },
        run: () => {
          for (const v of vikings) {
            v.root.setEnabled(true);
            const side = v.root.position.x > 0 ? 1 : -1;
            v.walkTo(side * 1.8, v.root.position.z, 5);
          }
        },
        narrate: 'They came out of the bushes, out of the trees, out of the ground itself.',
      },
      {
        duration: 3,
        shot: () => portrait(cassian, { angle: 0.2, distance: 2.0, push: 0.4 }),
        run: () => cassian.setPose('raiseSword').setMood('shout'),
        say: { who: 'Cassian', text: 'AMBUSH! Shields up! Circle around me!', mood: 'shout' },
      },
      {
        duration: 2,
        shot: { from: [0, 9, 3], at: [0, 0, 1], fov: FOV.wide },
        fade: { to: 1, time: 1.8 },
      },
    ];
  },
};
