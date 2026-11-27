import { childNode } from '../../render/parts.ts';
import { cast } from '../cast.ts';
import { torch } from '../props.ts';
import type { Beat, Cutscene, StoryContext } from '../script.ts';
import { SET_COLORS } from '../sets.ts';
import { FOV, overShoulder, portrait } from '../shot.ts';
import type { Stage } from '../stage.ts';
import { campfire, forestRing, seatLog, STORY_COLORS, tents } from '../storySets.ts';
import { wagon } from './ending.ts';

/**
 * Why each fight in the north happens: the grain carts at the bridge, the outpost that holds
 * Hrolf's plans, and the camp that has to last until dawn.
 */

const TORCH_HEAD = 0.5;
const RIVER = { x: 0, width: 12 } as const;

/** A river across the road, a timber bridge over it, carts queued on the near bank. */
function riverCrossing(stage: Stage): void {
  stage.ground('#5A7A3A', 160, 'forest');
  stage.box(STORY_COLORS.water, [RIVER.width, 0.06, 160], [RIVER.x, 0.01, 0], 0, { castShadow: false });
  stage.box(SET_COLORS.dirt, [80, 0.04, 4], [0, 0.02, 0], 0, { castShadow: false });
  stage.box(SET_COLORS.wood, [RIVER.width + 4, 0.4, 4.4], [RIVER.x, 0.6, 0]);
  for (const z of [-2.1, 2.1]) {
    stage.box(SET_COLORS.darkWood, [RIVER.width + 4, 0.12, 0.12], [RIVER.x, 1.6, z]);
    for (let i = 0; i < 7; i++) stage.box(SET_COLORS.darkWood, [0.14, 1.2, 0.14], [RIVER.x - 7 + i * 2.3, 1.0, z]);
  }
  for (const x of [-4, 0, 4]) for (const z of [-2, 2]) stage.box(SET_COLORS.darkWood, [0.5, 2.4, 0.5], [RIVER.x + x, -0.6, z]);
  forestRing(stage, 24, 40);
}

export const bridgeOrders: Cutscene = {
  id: 'bridge-orders',
  create(stage: Stage): Beat[] {
    stage.light('day');
    riverCrossing(stage);
    for (let i = 0; i < 4; i++) wagon(stage, -12 - i * 4.5, 0);
    const stuck = stage.group('wheel', -11.1, 0.45, 1.6);
    stage.world.parts.part('disc', '#4A3424', stuck, [0.9, 0.12, 0.9], [0, 0, 0]).rotation.x = Math.PI / 2;
    const cassian = cast(stage, 'cassianHelmet', 'Cassian').place(-8, -3, Math.PI / 2);
    const felix = cast(stage, 'felixLegion', 'Felix').place(-9.5, -4.2, Math.PI / 2);
    const rufus = cast(stage, 'rufusLegion', 'Rufus').place(-12, 1.9, 0);
    const scout = cast(stage, 'messenger', 'Scout').place(-40, -2, Math.PI / 2);
    const legion = Array.from({ length: 12 }, (_, i) => cast(stage, 'legionary', `Legionary ${i}`).place(-14 - (i % 4) * 2.2, -3.4 - Math.floor(i / 4) * 1.3, Math.PI / 2));

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'warm',
        sound: 'wind',
        shot: { from: [6, 5, 12], at: [-10, 1, 0], to: [4, 4, 10], fov: FOV.wide },
        narrate: 'Four carts of grain for the northern fortress. Without them, the fortress would starve before Hrolf ever reached it.',
      },
      {
        duration: 3.5,
        shot: () => portrait(rufus, { angle: 0.6, distance: 2.6 }),
        run: () => rufus.setPose('offer').setMood('angry'),
        narrate: 'The first cart lost a wheel on the bridge ramp. Rufus decided to lift it himself.',
      },
      {
        duration: 2.5,
        shot: () => portrait(rufus, { angle: 0.4, distance: 2.0 }),
        run: () => rufus.setMood('afraid'),
        say: { who: 'Rufus', text: 'It is fine! I have it! I do NOT have it!', mood: 'afraid' },
      },
      {
        duration: 3.5,
        sound: 'horn',
        shot: { from: [-30, 2, 4], at: scout, fov: FOV.normal },
        run: () => scout.walkTo(-10, -2.6, 6),
        narrate: 'Then a scout came down the road at a gallop, white in the face.',
      },
      {
        shot: () => portrait(scout, { angle: 0.3, distance: 2.4 }),
        run: () => {
          scout.finishWalk();
          scout.setPose('point').setMood('afraid').lookAt(cassian.headPosition());
        },
        say: { who: 'Scout', as: 'The scout', text: 'Legate! Vikings, two war bands, an hour behind us. Maybe less. They want the grain!', mood: 'afraid' },
      },
      {
        shot: () => overShoulder(felix, cassian),
        run: () => felix.lookAt(cassian.headPosition()).setMood('afraid'),
        say: { who: 'Felix', text: 'We cannot outrun them with carts. Leave the grain?', mood: 'afraid' },
      },
      {
        shot: () => portrait(cassian, { angle: 0.3, distance: 2.2 }),
        run: () => cassian.setMood('angry').setPose('point'),
        say: { who: 'Cassian', text: 'And let the fortress starve? No. We hold the bridge until the last cart is over. Every man to the far bank!', mood: 'shout' },
      },
      {
        duration: 3.5,
        shot: { from: [8, 3, -8], at: [-8, 1.2, -3], fov: FOV.wide },
        run: () => {
          for (const [i, l] of legion.entries()) l.walkTo(4 + (i % 5) * 1.3, -3 + Math.floor(i / 5) * 2.2, 3.5);
        },
        narrate: 'They ran for the far bank in a mob. Nobody was where he should be.',
        fade: { to: 1, time: 3 },
      },
    ];
  },
};

export const bridgeAfter: Cutscene = {
  id: 'bridge-after',
  create(stage: Stage): Beat[] {
    stage.light('dusk');
    riverCrossing(stage);
    for (let i = 0; i < 4; i++) wagon(stage, 12 + i * 4.5, 0);
    for (let i = 0; i < 8; i++) cast(stage, 'viking', `Fallen ${i}`).place(-6 - (i % 4) * 2, -3 + Math.floor(i / 4) * 6, i).setPose('lie', true).eyesClosed = true;
    const cassian = cast(stage, 'cassianHelmet', 'Cassian').place(4, -1, -Math.PI / 2);
    const felix = cast(stage, 'felixLegion', 'Felix').place(5.4, -2.2, -Math.PI / 2).setPose('slump', true);
    const rufus = cast(stage, 'rufusLegion', 'Rufus').place(5.4, 0.4, -Math.PI / 2).setStance('sit', true).setPose('hunch', true);

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 2 },
        music: 'hope',
        shot: { from: [-4, 4, 10], at: [10, 1, 0], to: [-2, 3, 8], fov: FOV.wide },
        narrate: 'The last cart rolled over the bridge as the sun went down. The Vikings did not.',
      },
      {
        shot: () => portrait(rufus, { angle: -0.5, distance: 2.4 }),
        run: () => rufus.setMood('sad'),
        say: { who: 'Rufus', text: 'I would like to lie down. Forever. Or until supper. Whichever comes first.', mood: 'sad' },
      },
      {
        shot: () => portrait(cassian, { angle: 0.3, distance: 2.4 }),
        run: () => cassian.setMood('neutral').lookAt({ x: 40, y: 2, z: 0 }),
        say: { who: 'Cassian', text: 'Rest tonight. Tomorrow we take the path through the dark forest. It is the short way to the fortress.', mood: 'neutral' },
      },
      {
        duration: 3,
        shot: () => portrait(felix, { angle: -0.4 }),
        run: () => felix.setMood('afraid'),
        say: { who: 'Felix', text: 'I hate the short way.', mood: 'afraid' },
        fade: { to: 1, time: 2.6 },
      },
    ];
  },
};

/** The Viking outpost far off on the frozen lake, seen from the treeline. */
function frozenShore(stage: Stage): void {
  stage.ground(STORY_COLORS.snow, 160, 'snow');
  stage.box(STORY_COLORS.ice, [70, 0.05, 40], [0, 0.02, -40], 0, { castShadow: false });
  forestRing(stage, 30, 40, '#2A4A34');
  for (const [x, z, w] of [[-6, -46, 6], [4, -50, 8], [12, -44, 5]] as const) {
    stage.box('#5A4030', [w, 2.6, 3], [x, 1.3, z]);
    stage.box('#3E2A20', [w + 0.4, 0.4, 3.6], [x, 2.8, z]);
  }
  for (let i = 0; i < 14; i++) stage.box(SET_COLORS.darkWood, [0.3, 2.4, 0.3], [-12 + i * 2, 1.2, -38]);
  stage.weather('snow');
}

export const outpostScout: Cutscene = {
  id: 'outpost-scout',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('snow');
    frozenShore(stage);
    const spared = story.save.choices.eirikSpared === true;
    const cassian = cast(stage, 'cassianHelmet', 'Cassian').place(-1, 2, Math.PI);
    const guide = spared ? cast(stage, 'eirik', 'Eirik').place(1, 1.6, Math.PI) : cast(stage, 'messenger', 'Scout').place(1, 1.6, Math.PI);
    const felix = cast(stage, 'felixLegion', 'Felix').place(-2.4, 3.4, Math.PI);
    const legion = Array.from({ length: 10 }, (_, i) => cast(stage, 'legionary', `Legionary ${i}`).place(-6 + (i % 5) * 2.4, 6 + Math.floor(i / 5) * 1.8, Math.PI));

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'dread',
        sound: 'wind',
        shot: { from: [2, 3, 8], at: [2, 1, -40], to: [1, 2.4, 5], fov: FOV.wide },
        narrate: 'The white north. A lake frozen hard as stone, and on it a Viking outpost.',
      },
      {
        shot: () => portrait(guide, { angle: -0.3, distance: 2.4 }),
        run: () => guide.setPose('point').lookAt({ x: 4, y: 2, z: -46 }),
        say: spared
          ? { who: 'Eirik', text: 'Hrolf keeps his war chiefs there. If anyone knows where he will strike, it is them.', mood: 'neutral' }
          : { who: 'Scout', as: 'A scout', text: 'Hrolf\'s war chiefs are in those huts, Legate. They know where he will strike.', mood: 'neutral' },
      },
      {
        shot: () => portrait(felix, { angle: 0.4 }),
        say: { who: 'Felix', text: 'Across open ice? They will see us coming a mile off.', mood: 'afraid' },
      },
      {
        shot: () => portrait(cassian, { angle: 0.3, distance: 2.2 }),
        run: () => cassian.setMood('angry').setPose('raiseSword'),
        say: { who: 'Cassian', text: 'Then let them see us. Take the outpost, and we will know where Hrolf is going before he does.', mood: 'shout' },
      },
      {
        duration: 3,
        shot: { from: [0, 6, 12], at: [0, 1, -10], fov: FOV.wide },
        run: () => {
          for (const l of legion) l.walkTo(l.root.position.x, -10, 2.5);
        },
        fade: { to: 1, time: 2.6 },
      },
    ];
  },
};

export const campNight: Cutscene = {
  id: 'camp-night',
  create(stage: Stage): Beat[] {
    stage.light('night');
    stage.ground(STORY_COLORS.snow, 160, 'snow');
    forestRing(stage, 22, 40, '#22402C');
    tents(stage, -10, -6, 5, 0.1);
    tents(stage, -9, 7, 4, -0.1);
    campfire(stage, 0, 0, 0.8);
    for (const [x, z, yaw] of [[-1.8, 0, Math.PI / 2], [1.8, 0, Math.PI / 2]] as const) seatLog(stage, x, z, yaw);
    stage.weather('snow');
    const cassian = cast(stage, 'cassianCommander', 'Cassian').place(-1.8, 0.4, Math.PI / 2).setStance('sit', true);
    const felix = cast(stage, 'felixLegion', 'Felix', { helmet: false }).place(1.8, 0.6, -Math.PI / 2).setStance('sit', true);
    const rufus = cast(stage, 'rufusLegion', 'Rufus', { helmet: false }).place(1.8, -0.7, -Math.PI / 2).setStance('sit', true).setPose('hunch', true);
    const sentry = cast(stage, 'legionary', 'Sentry').place(0, 14, Math.PI);
    const t = torch(stage.world.parts, sentry.grips[0]);
    t.rotation.x = Math.PI;
    stage.flame(childNode('torch-head', t, 0, TORCH_HEAD, 0));
    // Raiders' torches in the trees north of the camp.
    for (let i = 0; i < 12; i++) stage.fire(-16 + i * 3, 26 + (i % 3) * 2.5, 0.2, 1.6);

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'warm',
        sound: 'fire',
        shot: { from: [0, 4, 9], at: [0, 0.8, 0], to: [0, 3, 7], fov: FOV.normal },
        narrate: 'We reached the camp by the fortress at nightfall. Galba and the main army were still a day behind.',
      },
      {
        shot: () => portrait(rufus, { angle: -0.4 }),
        run: () => rufus.setMood('sad'),
        say: { who: 'Rufus', text: 'My feet have filed a complaint. They want to go home. The rest of me is thinking about it.', mood: 'sad' },
      },
      {
        shot: () => portrait(cassian, { angle: 0.4 }),
        run: () => cassian.setMood('warm'),
        say: { who: 'Cassian', text: 'One more day, Rufus. Then Galba is here, and we are an army again.', mood: 'warm' },
      },
      {
        duration: 4,
        sound: 'wind',
        music: 'dread',
        shot: { from: [1, 2, 18], at: sentry, fov: FOV.normal },
        run: () => sentry.setMood('afraid').lookAt({ x: 0, y: 2, z: 40 }),
        narrate: 'Then the sentry on the north side went very still.',
      },
      {
        duration: 4,
        shot: { from: [0, 2.4, 12], at: [0, 1.6, 34], fov: FOV.wide },
        narrate: 'Torches. In the trees. More of them every moment.',
      },
      {
        shot: () => portrait(sentry, { angle: 0.3, distance: 2.4 }),
        sound: 'horn',
        run: () => sentry.setPose('point').setMood('shout'),
        say: { who: 'Sentry', as: 'The sentry', text: 'RAID! Vikings in the trees! To arms! TO ARMS!', mood: 'shout' },
      },
      {
        shot: () => portrait(cassian, { angle: 0.3, distance: 2.2 }),
        run: () => cassian.setStance('pose').setPose('raiseSword').setMood('shout'),
        say: { who: 'Cassian', text: 'Up! Everyone up! We only have to last until dawn. Galba will see the fires!', mood: 'shout' },
        fade: { to: 1, time: 3 },
      },
    ];
  },
};

export const dawnRelief: Cutscene = {
  id: 'dawn-relief',
  create(stage: Stage): Beat[] {
    stage.light('goldenMorning');
    stage.ground(STORY_COLORS.snow, 160, 'snow');
    forestRing(stage, 22, 40, '#22402C');
    tents(stage, -10, -6, 5, 0.1);
    for (let i = 0; i < 10; i++) cast(stage, 'viking', `Fallen ${i}`).place(-8 + (i % 5) * 4, 8 + Math.floor(i / 5) * 4, i).setPose('lie', true).eyesClosed = true;
    const cassian = cast(stage, 'cassianHelmet', 'Cassian').place(0, 0, 0).setPose('slump', true);
    const galba = cast(stage, 'galba', 'Galba').place(0, 30, Math.PI);
    const army = Array.from({ length: 14 }, (_, i) => cast(stage, 'legionary', `Relief ${i}`).place(-6 + (i % 7) * 2, 32 + Math.floor(i / 7) * 1.6, Math.PI));

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'hope',
        sound: 'horn',
        shot: { from: [3, 2, -6], at: [0, 1.6, 30], fov: FOV.wide },
        run: () => {
          galba.walkTo(0, 3, 3);
          for (const a of army) a.walkTo(a.root.position.x, a.root.position.z - 22, 3);
        },
        narrate: 'At dawn, horns from the south. Galba had seen the fires and marched all night.',
      },
      {
        shot: () => overShoulder(galba, cassian),
        run: () => {
          galba.finishWalk();
          galba.lookAt(cassian.headPosition()).setMood('warm');
          cassian.setPose('stand').lookAt(galba.headPosition());
        },
        say: { who: 'Galba', text: 'You held. With what you had left, you held. Hrolf will hear of this, Legate.', mood: 'warm' },
      },
      {
        shot: () => portrait(cassian, { angle: 0.3, distance: 2.2 }),
        run: () => cassian.setMood('angry'),
        say: { who: 'Cassian', text: 'Good. Let him hear. Let him come.', mood: 'angry' },
        fade: { to: 1, time: 3 },
      },
    ];
  },
};
