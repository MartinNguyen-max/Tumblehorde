import { cast } from '../cast.ts';
import { sword, upright, woodenCross } from '../props.ts';
import type { Beat, Cutscene, StoryContext } from '../script.ts';
import { FOV, overShoulder, portrait } from '../shot.ts';
import type { Stage } from '../stage.ts';
import { campfire, castleYard, grave } from '../storySets.ts';

/** Peace, the last night, and the end. */

const STATUE = '#B8B4AC';
const BABY = '#F0E6D8';

export const peace: Cutscene = {
  id: 'peace',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('goldenMorning');
    castleYard(stage, '#C8BCA6');
    stage.weather('motes');
    const cassian = cast(stage, 'cassianCommander', 'Cassian').place(-0.8, 0, Math.PI / 2);
    const livia = cast(stage, 'livia', 'Livia', { color: '#E8E0CC' }).place(0.8, 0, -Math.PI / 2);
    const guests = [cast(stage, 'felix', 'Felix'), cast(stage, 'rufus', 'Rufus'), cast(stage, 'galba', 'Galba')];
    guests.forEach((g, i) => g.place(-3 + i * 3, 4, Math.PI));
    const eirik = cast(stage, 'eirik', 'Eirik').place(4.5, 4.5, Math.PI);
    if (story.save.choices.eirikSpared !== true) eirik.root.setEnabled(false);
    // Varro in stone, in the square where it began.
    const statue = cast(stage, 'varro', 'Statue', { skin: STATUE, hair: STATUE, beardColor: STATUE, color: STATUE, scar: false });
    statue.place(60, 0, Math.PI).setPose('fist', true).setMood('angry', true);
    statue.root.scaling.setAll(2.2);
    stage.box(STATUE, [3, 1.2, 3], [60, 0.6, 0]);
    statue.root.position.y = 1.2;
    const baby = stage.box(BABY, [0.35, 0.25, 0.5], [0, -10, 0], 0, { castShadow: false });
    const old = cast(stage, 'cassianOld', 'Old Cassian').place(120, 0, Math.PI);
    const oldLivia = cast(stage, 'liviaOld', 'Old Livia').place(121.2, 0.4, Math.PI);
    const marcus = cast(stage, 'marcusYoung', 'Marcus').place(118.6, 0.8, Math.PI);
    castleYardAt(stage, 120);

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2.5 },
        music: 'warm',
        shot: { from: [0, 4, 12], at: [0, 2, -8], to: [0, 3, 9], fov: FOV.wide },
        narrate: 'The Emperor made me a lord, and gave me a castle in the hills.',
      },
      {
        shot: () => overShoulder(livia, cassian),
        run: () => {
          livia.setMood('happy').lookAt(cassian.headPosition());
          for (const g of guests) g.setPose('cheer').setMood('happy');
        },
        say: { who: 'Livia', text: 'You came home. And you built the fence.', mood: 'happy' },
      },
      {
        shot: () => overShoulder(cassian, livia, { side: -1 }),
        run: () => cassian.setMood('happy').lookAt(livia.headPosition()),
        say: { who: 'Cassian', text: 'I built the fence.', mood: 'happy' },
      },
      {
        duration: 5,
        shot: { from: [64, 2, 8], at: [60, 4.5, 0], to: [62, 1.5, 6], fov: FOV.normal },
        narrate: 'In the square where I met him, they raised a statue of Varro. Hammer in hand, scowling at the pigeons.',
      },
      {
        duration: 5,
        shot: () => portrait(livia, { angle: -0.4, distance: 2.4 }),
        run: () => {
          livia.setPose('cradle').setStance('pose').setMood('warm');
          baby.parent = livia.grips[1];
          baby.position.set(0.2, -0.05, 0.1);
          cassian.setPose('embrace').setMood('crying');
        },
        narrate: 'And then, a son. We named him Marcus.',
      },
      {
        duration: 5,
        shot: { from: [-2, 2, 8], at: [-1.5, 1.4, 4], fov: FOV.normal },
        run: () => {
          for (const g of guests) g.setPose('stand');
          guests[1]!.setPose('wave').setMood('happy');
        },
        narrate: 'Felix and Rufus got armies of their own. Rufus told the same terrible joke to every recruit.',
      },
      {
        duration: 6,
        music: 'monastery',
        shot: { from: [123, 1.8, 4], at: old, to: [122, 1.7, 3], fov: FOV.normal },
        run: () => {
          stage.light('dusk');
          old.setMood('warm');
          oldLivia.setMood('warm');
          marcus.setMood('happy');
        },
        narrate: 'Years passed like seasons in a window. My hair turned white. My back bent.',
      },
      {
        duration: 4,
        shot: () => portrait(old, { angle: 0.3 }),
        narrate: 'It was a good life. Better than I deserved.',
        fade: { to: 1, time: 3.5 },
      },
    ];
  },
};

/** A second castle yard far along x, for the years later. */
function castleYardAt(stage: Stage, x: number): void {
  for (const side of [-1, 1]) stage.box('#C8BCA6', [12, 7, 2], [x + side * 8, 3.5, -10]);
  stage.box('#C8BCA6', [4, 2.4, 2], [x, 5.8, -10]);
  stage.box('#7A7468', [40, 0.1, 40], [x, -0.03, 0], 0, { castShadow: false });
}

export const lastNight: Cutscene = {
  id: 'last-night',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('night');
    castleYard(stage);
    campfire(stage, 0, 2, 0.7);
    const yardGrave = grave(stage, 5, -3, 0.3);
    const old = cast(stage, 'cassianOld', 'Cassian').place(-1.2, 2.4, Math.PI / 2).setStance('sit', true).setPose('hunch', true).setMood('warm', true);
    const marcus = cast(stage, 'marcusYoung', 'Marcus').place(1.2, 2.4, -Math.PI / 2).setStance('sit', true).setPose('sit', true);
    const livia = cast(stage, 'liviaOld', 'Livia').place(-3, -6, Math.PI);
    const felix = cast(stage, 'felixOld', 'Felix').place(-1.5, -14, 0);
    const rufus = cast(stage, 'rufusOld', 'Rufus').place(1.5, -14, 0);
    const eirik = cast(stage, 'eirik', 'Eirik', { hair: '#C8C0A8', beard: 'long', beardColor: '#C8C0A8' }).place(3.5, -14, 0);
    const eirikHere = story.save.choices.eirikSpared === true;
    for (const a of [felix, rufus, eirik]) a.root.setEnabled(false);
    const dead = Array.from({ length: 9 }, (_, i) =>
      cast(stage, 'dead', `The dead ${i}`, { outfit: (['rags', 'viking', 'legion'] as const)[i % 3], color: '#5A5A50' }).place(-10 + i * 2.6, -20 - (i % 3), 0),
    );
    for (const d of dead) d.root.setEnabled(false);
    const risen = cast(stage, 'dead', 'The first').place(5, -3, Math.PI);
    risen.root.position.y = -1.9;
    const oldSword = upright(sword(stage.world.parts, old.grips[0]));
    oldSword.setEnabled(false);
    const cross = upright(woodenCross(stage.world.parts, old.grips[1], 1.3));
    cross.setEnabled(false);

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 2.5 },
        music: 'warm',
        sound: 'fire',
        shot: { from: [0, 2, 7], at: [0, 1, 2], to: [0, 1.6, 5.5], fov: FOV.normal },
        narrate: 'And that, my son...',
      },
      {
        shot: () => overShoulder(old, marcus),
        run: () => old.lookAt(marcus.headPosition()),
        say: { who: 'Cassian', text: '...is the whole story. All of it. The bells, the cross, Varro. Everything.', mood: 'warm' },
      },
      {
        shot: () => overShoulder(marcus, old, { side: -1 }),
        run: () => marcus.lookAt(old.headPosition()).setMood('sad'),
        say: { who: 'Marcus', text: 'You never wanted to talk about the war. Why tell me now, father?', mood: 'sad' },
      },
      {
        shot: () => portrait(old, { angle: 0.4, distance: 2.4 }),
        run: () => old.lookAt({ x: 0, y: 3, z: -10 }).setMood('sad'),
        say: { who: 'Cassian', text: 'Tonight I dreamed of the monks. Anselm was ringing the bell. He looked... glad to see me.', mood: 'sad' },
      },
      {
        duration: 4,
        music: 'dread',
        sound: 'thunder',
        shot: { from: [2.5, 1.2, 2], at: [5, 0.4, -3], fov: FOV.normal },
        run: () => yardGrave.scaling.set(1.2, 0.5, 1.2),
        during: (_s, p) => {
          risen.root.position.y = -1.9 + p * 1.9;
        },
      },
      {
        shot: () => portrait(marcus, { angle: 0.4 }),
        run: () => {
          risen.root.position.y = 0;
          risen.setPose('reach');
          marcus.setStance('pose').setPose('cower').setMood('afraid').lookAt(risen.headPosition());
        },
        say: { who: 'Marcus', text: 'Father... the grave...', mood: 'afraid' },
      },
      {
        duration: 6,
        shot: { from: [0, 5, 6], at: [0, 1.5, -18], fov: FOV.wide },
        run: () => {
          for (const [i, d] of dead.entries()) {
            d.root.setEnabled(true);
            d.setPose('reach').walkTo(-8 + i * 2, -11, 0.7);
          }
          old.setStance('pose').setPose('stand').setMood('angry');
        },
        narrate: 'The dead came. Vikings, Romans, farmers. Everyone the war had ever taken.',
      },
      {
        shot: () => overShoulder(livia, old),
        run: () => {
          for (const d of dead) d.finishWalk();
          livia.place(-1.4, 0.6, 0.6).setMood('crying').lookAt(old.headPosition());
          old.place(-0.4, 2.0, Math.PI + 0.6);
        },
        say: { who: 'Livia', text: 'Cassian.', mood: 'crying' },
      },
      {
        shot: () => overShoulder(old, livia, { side: -1 }),
        run: () => old.lookAt(livia.headPosition()).setMood('warm'),
        say: { who: 'Cassian', text: 'Take Marcus to the tower and bar the door. Not this time, Livia. Someone has to ring the bell.', mood: 'warm' },
      },
      {
        shot: () => portrait(marcus, { angle: -0.3 }),
        run: () => marcus.setPose('fist').setMood('crying').lookAt(old.headPosition()),
        say: { who: 'Marcus', text: 'I will fight with you!', mood: 'crying' },
      },
      {
        shot: () => portrait(old, { angle: 0.3, distance: 2.2, push: 0.3 }),
        run: () => {
          old.lookAt(marcus.headPosition()).setPose('embrace').setMood('crying');
          marcus.setPose('embrace');
        },
        say: { who: 'Cassian', text: 'No. You will live. That is how you fight tonight. Remember the story.', mood: 'crying' },
      },
      {
        duration: 4,
        sound: 'horn',
        music: 'hope',
        shot: { from: [0, 2, -4], at: [0, 1.6, -13], fov: FOV.normal },
        run: () => {
          livia.walkTo(-6, -2, 1.2);
          marcus.walkTo(-6, -3, 1.2);
          felix.root.setEnabled(true);
          rufus.root.setEnabled(true);
          eirik.root.setEnabled(eirikHere);
          for (const a of [felix, rufus, eirik]) a.walkTo(a.root.position.x, -7, 1.4);
        },
        narrate: 'Then a horn, at the gate. Old friends answer old horns.',
      },
      {
        shot: () => portrait(rufus, { angle: 0.3 }),
        run: () => {
          for (const a of [felix, rufus, eirik, livia, marcus]) a.finishWalk();
          rufus.setMood('happy');
        },
        say: { who: 'Rufus', text: 'Did you think we would let you have all the fun? Hehe... he.', mood: 'happy' },
      },
      {
        shot: () => portrait(felix, { angle: -0.3 }),
        say: { who: 'Felix', text: 'One more time, brother.', mood: 'warm' },
      },
      {
        when: () => eirikHere,
        shot: () => portrait(eirik, { angle: 0.3 }),
        say: { who: 'Eirik', text: 'I said I would not forget. I did not.', mood: 'warm' },
      },
      {
        duration: 1,
        shot: () => portrait(old, { angle: 0.2, distance: 2.6 }),
        run: () => {
          oldSword.setEnabled(true);
          cross.setEnabled(true);
          old.setPose('raiseSword').setMood('angry');
        },
        choice: {
          options: ['Hold them in the tunnel under the gate.', 'Wait for them in the courtyard.'],
          pick: (i) => story.choose({ lastStand: i === 0 ? 'tunnel' : 'courtyard' }),
        },
      },
      {
        duration: 3.5,
        shot: () => portrait(old, { angle: 0.1, distance: 2.4, rise: -0.3 }),
        run: () => old.setMood('shout'),
        say: { who: 'Cassian', text: 'For the last time! With me!', mood: 'shout' },
        fade: { to: 1, time: 3 },
      },
    ];
  },
};

export const theEnd: Cutscene = {
  id: 'the-end',
  create(stage: Stage): Beat[] {
    stage.light('night');
    castleYard(stage);
    const old = cast(stage, 'cassianOld', 'Cassian').place(0, -8.6, 0).setPose('kneel', true).setMood('sad', true);
    upright(woodenCross(stage.world.parts, old.grips[0], 1.3));
    // The white place: far away on the same stage.
    const W = 200;
    stage.box('#FFFFFF', [80, 0.1, 80], [W, -0.04, 0], 0, { castShadow: false });
    const young = cast(stage, 'cassianCommander', 'Cassian ').place(W, 2, Math.PI);
    const varro = cast(stage, 'varro', 'Varro').place(W, -6, 0);
    const anselm = cast(stage, 'anselm', 'Anselm').place(W - 2, -9, 0);
    [-4, -1, 1, 4].map((x, i) => cast(stage, 'monk', `Brother ${i}`).place(W + x, -11 - (i % 2), 0).setPose('pray', true));
    // Dawn on the walls: Marcus alone.
    const D = -200;
    castleYardAt(stage, D);
    stage.box('#C8BCA6', [16, 0.6, 3], [D, 7, -10]);
    const marcus = cast(stage, 'marcusYoung', 'Marcus').place(D, -10, Math.PI);
    marcus.root.position.y = 7.3;
    upright(sword(stage.world.parts, marcus.grips[0]));
    upright(woodenCross(stage.world.parts, marcus.grips[1], 1.3));

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 1.5 },
        music: 'silence',
        sound: 'heartbeat',
        shot: { from: [1.5, 1.0, -6], at: [0, 0.9, -8.6], fov: FOV.normal },
        run: () => {
          old.trembling = true;
        },
        narrate: 'At the gate, under the tunnel, I held them as long as I could.',
      },
      {
        duration: 4,
        shot: () => portrait(old, { angle: 0.4, distance: 2.4 }),
        run: () => {
          old.trembling = false;
          old.setPose('lie').setMood('warm');
          old.eyesClosed = true;
        },
        fade: { to: 1, color: 'white', time: 3.5 },
      },
      {
        duration: 4,
        music: 'monastery',
        sound: 'bell',
        fade: { to: 0, color: 'white', time: 3 },
        shot: { from: [W, 1.7, 6], at: [W, 1.6, -6], fov: FOV.normal },
        run: () => {
          stage.light('white');
          stage.weather('motes');
          young.lookAt(varro.headPosition());
        },
      },
      {
        shot: () => overShoulder(varro, young),
        run: () => {
          varro.place(W, -1.2, 0).setMood('warm').lookAt(young.headPosition());
        },
        say: { who: 'Varro', text: 'My son.', mood: 'warm' },
      },
      {
        shot: () => overShoulder(young, varro, { side: -1 }),
        run: () => young.setMood('crying'),
        say: { who: 'Cassian', text: 'Father.', mood: 'crying' },
      },
      {
        duration: 4,
        shot: { from: [W + 3, 1.8, 3], at: [W, 1.4, 0.4], fov: FOV.normal },
        run: () => {
          young.setPose('embrace').setMood('happy');
          varro.setPose('embrace').setMood('happy');
        },
      },
      {
        shot: () => portrait(anselm, { angle: 0.3 }),
        run: () => {
          anselm.place(W - 1.6, -2.6, 0.5).setMood('warm').lookAt(young.headPosition());
        },
        say: { who: 'Anselm', text: 'Welcome home, little brother. You kept it close.', mood: 'warm' },
      },
      {
        duration: 5,
        shot: { from: [W, 3, 8], at: [W, 1.4, -4], to: [W, 6, 14], fov: FOV.wide },
        fade: { to: 1, color: 'white', time: 4.5 },
      },
      {
        duration: 6,
        fade: { from: 1, to: 0, color: 'white', time: 3 },
        music: 'hope',
        shot: { from: [D + 4, 8.4, -6], at: marcus, to: [D + 2.5, 8.2, -7.5], fov: FOV.normal },
        run: () => {
          stage.light('goldenMorning');
          stage.weather('none');
          marcus.setPose('clutch').setMood('sad');
        },
        narrate: 'Dawn.',
      },
      {
        shot: () => portrait(marcus, { angle: 0.3, distance: 2.4 }),
        run: () => marcus.setMood('warm'),
        say: { who: 'Marcus', text: 'Crooked. And perfect.', mood: 'warm' },
      },
      {
        duration: 7,
        fade: { to: 1, time: 3 },
        title: { text: 'Tumblehorde', sub: 'Thank you for playing' },
      },
    ];
  },
};

