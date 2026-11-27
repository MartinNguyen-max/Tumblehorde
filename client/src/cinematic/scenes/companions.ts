import { cast } from '../cast.ts';
import { hammer, upright, woodenCross } from '../props.ts';
import type { Beat, Cutscene, StoryContext } from '../script.ts';
import { SET_COLORS } from '../sets.ts';
import { FOV, overShoulder, portrait } from '../shot.ts';
import type { Stage } from '../stage.ts';
import { campfire, forestRing, forgeInterior, seatLog } from '../storySets.ts';

/**
 * The friends Cassian makes: the night he tells Varro his story, Felix and Rufus on the forest
 * road, the campfire before the burning village, and the roll call of the fallen.
 */

export const forgeNight: Cutscene = {
  id: 'forge-night',
  create(stage: Stage): Beat[] {
    stage.light('interior');
    forgeInterior(stage);
    const cassian = cast(stage, 'cassianSmith', 'Cassian').place(1.6, 1.6, Math.atan2(-2.2, -1.0)).setStance('sit', true).setPose('hunch', true);
    const varro = cast(stage, 'varro', 'Varro').place(-0.6, 0.6, Math.atan2(2.2, 1.0));
    upright(hammer(stage.world.parts, varro.grips[0]));
    varro.setPose('carve', true).setMood('neutral', true);
    stage.weather('embers');

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 2.5 },
        music: 'warm',
        sound: 'chisel',
        shot: { from: [3.5, 2.2, 4], at: [0, 1.0, -0.5], to: [2.8, 1.8, 3.2], fov: FOV.normal },
        narrate: 'Late at night, when the forge was only embers, Varro asked me where I came from.',
      },
      {
        shot: () => overShoulder(varro, cassian),
        run: () => varro.setPose('stand').lookAt(cassian.headPosition()),
        say: { who: 'Varro', text: 'You fight like a man with somewhere to be. Where is it, boy?', mood: 'neutral' },
      },
      {
        shot: () => portrait(cassian, { angle: 0.5, distance: 2.4 }),
        run: () => cassian.setMood('sad').lookAt(null),
        say: { who: 'Cassian', text: 'There was a monastery by a river. The monks raised me. One night the Northmen came with fire.', mood: 'sad' },
      },
      {
        shot: () => portrait(cassian, { angle: 0.3, distance: 2.0, push: 0.3 }),
        run: () => cassian.setMood('crying'),
        say: { who: 'Cassian', text: 'Abbot Anselm told me to run. So I ran. I never even looked back.', mood: 'crying' },
      },
      {
        duration: 3.2,
        sound: 'heartbeat',
        shot: () => portrait(varro, { angle: -0.4, distance: 2.4 }),
        run: () => varro.setMood('sad').setPose('clutch'),
      },
      {
        shot: () => overShoulder(varro, cassian, { push: 0.3 }),
        say: { who: 'Varro', text: 'I lost someone too. Another night, another fire. I know what it does to a man.', mood: 'sad' },
      },
      {
        duration: 4,
        shot: { from: [2.2, 1.6, -1.2], at: [3.6, 1.6, -3.4], fov: FOV.close },
        run: () => {
          varro.walkTo(3.0, -2.6, 1.0);
          cassian.lookAt({ x: 3.6, y: 1.6, z: -3.4 });
        },
      },
      {
        shot: () => portrait(varro, { angle: 0.5, distance: 2.6 }),
        run: () => {
          varro.place(3.0, -2.6, Math.atan2(1.6 - 3.0, 1.6 + 2.6)).setPose('offer').setMood('warm');
        },
        say: { who: 'Varro', text: 'If you go after them, you do not go alone. This old armor still fits. Mostly.', mood: 'warm' },
      },
      {
        shot: () => portrait(cassian, { angle: 0.4, distance: 2.3 }),
        run: () => cassian.setStance('pose').setPose('stand').setMood('warm').lookAt(varro.headPosition()),
        say: { who: 'Cassian', text: 'Then we go together.', mood: 'warm' },
      },
      {
        duration: 4,
        shot: { from: [-2, 3, 5], at: [1.8, 1.2, -1], to: [-3, 4, 7], fov: FOV.normal },
        narrate: 'He never asked me for anything. He just went.',
        fade: { to: 1, time: 3.5 },
      },
    ];
  },
};

function forestClearing(stage: Stage, night: boolean): void {
  stage.ground(night ? '#2A3A24' : '#3E5A30', 120, 'forest');
  stage.box(SET_COLORS.dirt, [3.4, 0.05, 120], [0, 0, 0], 0, { castShadow: false });
  forestRing(stage, 11, 36);
}

export const forestRoadAfter: Cutscene = {
  id: 'forest-road-after',
  create(stage: Stage): Beat[] {
    stage.light('day');
    forestClearing(stage, false);
    const cassian = cast(stage, 'cassianTraveller', 'Cassian').place(-1, 1, Math.PI / 2);
    const varro = cast(stage, 'varroArmored', 'Varro').place(-2.2, -0.4, Math.PI / 2);
    const felix = cast(stage, 'felix', 'Felix').place(1.4, 1.2, -Math.PI / 2);
    const rufus = cast(stage, 'rufus', 'Rufus').place(1.8, -0.2, -Math.PI / 2);
    for (let i = 0; i < 4; i++) cast(stage, 'bandit', `Fallen bandit ${i}`).place(-4 + i * 2.6, 4 + (i % 2), i).setPose('lie', true).eyesClosed = true;

    return [
      {
        duration: 4,
        fade: { from: 1, to: 0, time: 1.5 },
        music: 'warm',
        shot: { from: [0, 3, 8], at: [0, 1, 0], to: [0.5, 2.4, 6], fov: FOV.normal },
      },
      {
        shot: () => overShoulder(felix, cassian),
        run: () => felix.setMood('happy').lookAt(cassian.headPosition()),
        say: { who: 'Felix', text: 'You came out of nowhere! Ten of them! I am Felix. That big lump is my brother Rufus.', mood: 'happy' },
      },
      {
        duration: 2.4,
        shot: () => portrait(rufus, { angle: 0.4 }),
        run: () => rufus.setMood('happy').setPose('wave'),
        say: { who: 'Rufus', text: 'Hehehe!', mood: 'happy' },
      },
      {
        shot: () => overShoulder(felix, cassian, { push: 0.3 }),
        run: () => rufus.setPose('stand'),
        say: { who: 'Felix', text: 'Our village is north of here. Wherever you are going, it is safer with four. Take us along?', mood: 'warm' },
      },
      {
        shot: () => portrait(varro, { angle: -0.4 }),
        run: () => varro.setMood('happy').lookAt(cassian.headPosition()),
        say: { who: 'Varro', text: 'They can carry the bandits\' swords. Free gear, free hands. I like them already.', mood: 'happy' },
      },
      {
        duration: 5,
        shot: { from: [4, 2, 6], at: [0, 1, -2], to: [2, 2.6, 9], fov: FOV.normal },
        run: () => {
          for (const [i, a] of [cassian, varro, felix, rufus].entries()) a.walkTo(-0.6 + (i % 2) * 1.2, -12 - Math.floor(i / 2) * 1.4, 1.4);
        },
        narrate: 'Two had become four.',
        fade: { to: 1, time: 4.5 },
      },
    ];
  },
};

/** Rufus's terrible joke, the smoke on the horizon, and the decision to go. */
export const campfireNight: Cutscene = {
  id: 'campfire',
  create(stage: Stage): Beat[] {
    stage.light('night');
    forestClearing(stage, true);
    campfire(stage, 0, 0);
    seatLog(stage, -1.6, 0, Math.PI / 2);
    seatLog(stage, 1.6, 0, Math.PI / 2);
    const cassian = cast(stage, 'cassianTraveller', 'Cassian').place(-1.6, 0.6, Math.PI / 2).setStance('sit', true).setPose('hunch', true);
    const varro = cast(stage, 'varroArmored', 'Varro').place(-1.6, -0.7, Math.PI / 2).setStance('sit', true).setPose('sit', true);
    const felix = cast(stage, 'felix', 'Felix').place(1.6, 0.6, -Math.PI / 2).setStance('sit', true).setPose('sit', true);
    const rufus = cast(stage, 'rufus', 'Rufus').place(1.6, -0.7, -Math.PI / 2).setStance('sit', true).setPose('sit', true);
    const smoke = stage.group('smoke', 0, 0, -40);
    for (let i = 0; i < 6; i++) stage.world.parts.part('box', '#5A4A48', smoke, [3 + i, 4, 3 + i], [Math.sin(i) * 3, 3 + i * 4, 0], { castShadow: false });
    const glow = stage.box('#FF7A2A', [20, 2, 1], [0, 1, -38], 0, { castShadow: false });
    smoke.setEnabled(false);
    glow.setEnabled(false);
    stage.weather('embers');

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 2 },
        music: 'warm',
        sound: 'fire',
        shot: { from: [0, 2.2, 4.5], at: [0, 0.8, 0], to: [0, 1.8, 3.6], fov: FOV.normal },
        narrate: 'That night there was wine, and for the first time in years, there was laughter.',
      },
      {
        shot: () => portrait(rufus, { angle: 0.6 }),
        run: () => rufus.setMood('happy').setPose('wave'),
        say: { who: 'Rufus', text: 'Why did the legionary bring a ladder to the battle? Because he heard the enemy was in high spirits!', mood: 'happy' },
      },
      {
        duration: 2.6,
        shot: () => portrait(felix, { angle: -0.4 }),
        run: () => felix.setMood('sad').setPose('slump'),
        say: { who: 'Felix', text: 'Every. Single. Time.', mood: 'sad' },
      },
      {
        duration: 3.2,
        shot: { from: [-3.4, 1.4, 1.6], at: [-1.6, 1.0, 0], fov: FOV.normal },
        run: () => {
          varro.setMood('happy').setPose('cheer');
          cassian.setMood('happy').setStance('sit').setPose('sit');
          rufus.setPose('cheer');
        },
        say: { who: 'Varro', text: 'Ha! Hahaha! Terrible! Tell another one!', mood: 'happy' },
      },
      {
        shot: () => portrait(rufus, { angle: 0.6 }),
        run: () => rufus.setPose('offer').setMood('happy'),
        say: { who: 'Rufus', text: 'What do you call a Viking who lost his ship? ... WALKING! Hehehe!', mood: 'happy' },
      },
      {
        duration: 3.5,
        shot: { from: [-3.6, 1.2, 2.2], at: [-2.2, 0.6, -0.4], fov: FOV.normal },
        run: () => {
          varro.setStance('pose').place(-2.6, -0.7, Math.PI / 2).setPose('lie').setMood('happy');
          cassian.setPose('cheer').setMood('happy');
          felix.setMood('surprised');
        },
        narrate: 'Varro laughed so hard he fell backwards off the log. And I laughed too. For the first time since the bells.',
      },
      {
        duration: 2.6,
        shot: () => portrait(felix, { angle: -0.4 }),
        run: () => felix.setMood('happy'),
        say: { who: 'Felix', text: 'Do not encourage him. He has forty more.', mood: 'happy' },
      },
      {
        duration: 3.5,
        music: 'dread',
        sound: 'wind',
        shot: () => portrait(cassian, { angle: 0.4 }),
        run: () => {
          smoke.setEnabled(true);
          glow.setEnabled(true);
          varro.place(-1.6, -0.7, Math.PI / 2).setStance('sit').setPose('sit');
          rufus.setPose('sit');
          cassian.setMood('surprised').lookAt({ x: 0, y: 6, z: -40 });
        },
      },
      {
        duration: 5,
        shot: { from: [0.4, 1.4, 2.5], at: [0, 6, -40], fov: FOV.normal },
        narrate: 'Smoke, against the stars. Then, very far away, the screaming.',
      },
      {
        duration: 3,
        sound: 'heartbeat',
        shot: () => portrait(cassian, { angle: 0.2, distance: 1.9, fov: FOV.extreme }),
        run: () => cassian.setMood('afraid'),
        narrate: 'The river. The bells. The red-haired man.',
      },
      {
        shot: () => portrait(cassian, { angle: 0.3, distance: 2.2 }),
        run: () => cassian.setStance('pose').setPose('fist').setMood('angry'),
        say: { who: 'Cassian', text: 'We go. Now.', mood: 'angry' },
      },
      {
        duration: 3.5,
        shot: { from: [3, 2, 3], at: [0, 1.2, 0], fov: FOV.normal },
        run: () => {
          for (const a of [varro, felix, rufus]) a.setStance('pose').setPose('stand').setMood('angry');
        },
        fade: { to: 1, time: 3 },
      },
    ];
  },
};

/**
 * A campfire after a battle: the names of the fallen read out one by one. When nobody fell,
 * the legion counts off and laughs.
 */
export const rollCall: Cutscene = {
  id: 'roll-call',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('night');
    forestClearing(stage, true);
    campfire(stage, 0, 0, 1.1);
    const cassian = cast(stage, 'cassianCommander', 'Cassian').place(0, 2.2, Math.PI);
    const men = Array.from({ length: 8 }, (_, i) => {
      const a = Math.PI * 0.2 + (i / 7) * Math.PI * 1.6;
      const man = cast(stage, 'legionary', `Legionary ${i}`, { helmet: i % 3 !== 0 });
      man.place(Math.sin(a) * 2.8, Math.cos(a) * 2.8 - 0.3, a + Math.PI).setStance(i % 2 === 0 ? 'sit' : 'pose', true);
      return man;
    });
    const cross = upright(woodenCross(stage.world.parts, cassian.grips[0], 1.3));
    cross.setEnabled(false);
    const fallen = story.fallen;
    const beats: Beat[] = [
      {
        duration: 4,
        fade: { from: 1, to: 0, time: 2 },
        music: fallen.length > 0 ? 'sorrow' : 'warm',
        sound: 'fire',
        shot: { from: [0, 3.5, 6], at: [0, 0.8, 0], to: [0, 2.6, 5], fov: FOV.normal },
        narrate: fallen.length > 0 ? 'That night we called the roll.' : 'That night we called the roll, and every man answered.',
      },
    ];
    if (fallen.length === 0) {
      beats.push(
        {
          shot: () => portrait(cassian, { angle: 0.3 }),
          run: () => cassian.setMood('happy'),
          say: { who: 'Cassian', text: 'All of you. Every last one. Drink, you fools.', mood: 'happy' },
        },
        {
          duration: 3.5,
          shot: { from: [3, 1.8, 3], at: [0, 1.0, 0], fov: FOV.normal },
          run: () => {
            for (const m of men) m.setStance('pose').setPose('cheer').setMood('happy');
          },
          fade: { to: 1, time: 3 },
        },
      );
      return beats;
    }
    beats.push({
      duration: 3,
      shot: () => portrait(cassian, { angle: 0.2, distance: 2.4 }),
      run: () => cassian.setPose('clutch').setMood('sad'),
    });
    for (const name of fallen) {
      beats.push({
        duration: 2.2,
        shot: () => portrait(cassian, { angle: 0.25, distance: 2.3 }),
        say: { who: 'Cassian', text: `${name}.`, mood: 'sad' },
      });
    }
    beats.push(
      {
        duration: 3,
        shot: { from: [0.8, 0.9, 1.4], at: [0, 0.4, 0], fov: FOV.close },
        narrate: 'No one answered.',
      },
      {
        shot: () => portrait(cassian, { angle: 0.3, distance: 2.0, push: 0.3 }),
        run: () => {
          cross.setEnabled(true);
          cassian.setMood('crying');
        },
        say: { who: 'Cassian', text: 'They followed me here. I will carry their names home.', mood: 'crying' },
      },
      {
        duration: 4,
        shot: { from: [0, 6, 7], at: [0, 0.6, 0], to: [0, 9, 10], fov: FOV.normal },
        fade: { to: 1, time: 3.5 },
      },
    );
    return beats;
  },
};

