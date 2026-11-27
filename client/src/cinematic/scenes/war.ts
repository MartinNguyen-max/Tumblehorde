import { cast } from '../cast.ts';
import { hammer, sword, upright, woodenCross } from '../props.ts';
import type { Beat, Cutscene, StoryContext } from '../script.ts';
import { FOV, overShoulder, portrait, type Shot } from '../shot.ts';
import type { Actor } from '../actor.ts';
import type { Stage } from '../stage.ts';
import { campfire, forestRing, grave, STORY_COLORS, tents } from '../storySets.ts';

/** The war in the north: Varro's last words, Livia's letters, the speech, and Hrolf. */

export const varroDeath: Cutscene = {
  id: 'varro-death',
  create(stage: Stage): Beat[] {
    stage.light('night');
    stage.ground('#24301E', 140, 'forest');
    forestRing(stage, 9, 40);
    campfire(stage, 3, -2, 0.5);
    stage.weather('ash');
    const varro = cast(stage, 'varroArmored', 'Varro').place(-0.2, 0.2, Math.PI / 2).setPose('lie', true).setMood('sad', true);
    varro.setWounded(true);
    const cassian = cast(stage, 'cassianHelmet', 'Cassian').place(-0.1, 1.15, Math.PI).setPose('cradle', true).setMood('afraid', true);
    const felix = cast(stage, 'felix', 'Felix', { outfit: 'legion', color: '#4E7A9A' }).place(2, 2.4, -2.2);
    const rufus = cast(stage, 'rufus', 'Rufus', { outfit: 'legion', color: '#9A6A3A' }).place(-2.2, 2.6, 2.4);
    const hammerProp = upright(hammer(stage.world.parts, stage.root));
    hammerProp.setEnabled(false);

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 2 },
        music: 'sorrow',
        shot: { from: [-1.5, 3.2, -4.5], at: [0, 0.6, 0.6], to: [-1.1, 2.4, -3.4], fov: FOV.normal },
        narrate: 'We had won. Then I heard Felix shouting my name.',
      },
      {
        shot: { from: [1.6, 0.9, -1.2], at: { actor: cassian, offset: [0, -0.05, 0] }, fov: FOV.close },
        run: () => cassian.setMood('crying').lookAt(varro.headPosition()),
        say: { who: 'Cassian', text: 'Varro. Varro, look at me. Rufus! Get a healer! Now!', mood: 'crying' },
      },
      {
        shot: () => lyingFace(varro, 2.2, FOV.normal),
        run: () => varro.lookAt(cassian.headPosition()),
        say: { who: 'Varro', text: 'No healer for this one, son. Stay. Just... stay a moment.', mood: 'sad' },
      },
      {
        shot: () => lyingFace(varro, 2.0, FOV.normal),
        run: () => varro.setMood('crying'),
        say: { who: 'Varro', text: 'I had a boy once. Lucius. A fight in the street, over nothing at all. He was nineteen.', mood: 'crying' },
      },
      {
        shot: () => lyingFace(varro, 1.8, FOV.close),
        run: () => varro.setMood('warm'),
        say: { who: 'Varro', text: 'I never thought I would get another. And then you walked into my square in rags.', mood: 'warm' },
      },
      {
        shot: () => lyingFace(varro, 1.6, FOV.close),
        say: { who: 'Varro', text: 'You were the gift, Cassian. You were the gift.', mood: 'warm' },
      },
      {
        duration: 4,
        sound: 'heartbeat',
        shot: () => portrait(cassian, { angle: 0.2, distance: 1.9, fov: FOV.extreme, push: 0.2 }),
        run: () => {
          varro.eyesClosed = true;
          varro.setMood('neutral');
          cassian.trembling = true;
        },
        say: { who: 'Cassian', text: 'Father...', mood: 'crying' },
      },
      {
        duration: 4,
        fade: { to: 1, time: 1.5 },
        shot: { from: [0, 9, 4], at: [0, 0.5, 0.6], to: [0, 14, 6], fov: FOV.normal },
        narrate: 'He died before the fire went out.',
      },
      {
        duration: 6,
        fade: { to: 0, time: 2 },
        music: 'monastery',
        shot: { from: [0, 1.6, 5], at: [0, 0.4, -1], to: [0, 1.4, 3.6], fov: FOV.normal },
        run: () => {
          stage.light('dusk');
          stage.weather('none');
          cassian.trembling = false;
          varro.root.setEnabled(false);
          grave(stage, 0, -1, 0, true);
          hammerProp.setEnabled(true);
          hammerProp.position.set(0, 0.32, -0.8);
          hammerProp.rotation.set(Math.PI / 2, 0.3, 0);
          cassian.place(0, 1.2, Math.PI).setPose('kneel').setMood('sad');
          felix.place(-1.4, 1.8, Math.PI).setPose('pray').setMood('sad');
          rufus.place(1.4, 1.8, Math.PI).setPose('slump').setMood('crying');
        },
        narrate: 'We buried him in the morning, with his hammer.',
      },
      {
        shot: () => portrait(rufus, { angle: 0.3 }),
        say: { who: 'Rufus', text: 'He laughed at all my jokes. Even the bad ones. Especially the bad ones.', mood: 'crying' },
      },
      {
        shot: () => portrait(cassian, { angle: -0.3, distance: 2.2 }),
        run: () => cassian.setPose('fist').setMood('angry'),
        say: { who: 'Cassian', text: 'Hrolf. Wherever you are. I am coming for you.', mood: 'angry' },
      },
      {
        duration: 4,
        shot: { from: [4, 2.5, 6], at: [0, 1, 0], to: [6, 4, 9], fov: FOV.normal },
        fade: { to: 1, time: 3.5 },
      },
    ];
  },
};

const LETTER_ONE = `Cassian,

The city is quiet without your army in it. Today I bandaged a baker who swore he had fought beside you. I let him keep the lie.

Eat. Sleep. Come back.

Livia`;

const LETTER_TWO = `Cassian,

They say the horde is bigger than any army the North has ever raised. I do not care how big it is.

I have started a garden behind the infirmary. It needs a fence, and I am told you are good with your hands.

Come home and build my fence.

L.`;

/** A snowy camp with a brazier, for reading letters. */
function northCamp(stage: Stage): void {
  stage.ground(STORY_COLORS.snow, 160, 'snow');
  forestRing(stage, 16, 30, '#2A4A34');
  tents(stage, -9, -6, 5, 0.1);
  tents(stage, -8, 7, 4, -0.1);
  campfire(stage, 0, 0, 0.7);
  stage.weather('snow');
}

export const letterOne: Cutscene = {
  id: 'letter-one',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('snow');
    northCamp(stage);
    const cassian = cast(stage, 'cassianCommander', 'Cassian').place(-1.4, 0.8, Math.PI / 2 + 0.4).setStance('sit', true).setPose('offer', true);
    const eirik = cast(stage, 'eirik', 'Eirik', { outfit: 'viking', color: '#7A3A2A' }).place(1.6, 1.4, -Math.PI / 2 - 0.4);
    const spared = story.save.choices.eirikSpared === true;
    if (!spared) eirik.root.setEnabled(false);
    const beats: Beat[] = [
      {
        duration: 4,
        fade: { from: 1, to: 0, time: 2 },
        music: 'warm',
        sound: 'wind',
        shot: { from: [2, 2, 4], at: cassian, to: [1.2, 1.6, 3], fov: FOV.normal },
        narrate: 'In the white north, a rider brought a letter.',
      },
      {
        shot: { from: [-1.0, 1.6, 1.6], at: [-1.2, 0.9, 0.4], fov: FOV.close },
        letter: LETTER_ONE,
      },
      {
        duration: 3,
        shot: () => portrait(cassian, { angle: 0.4 }),
        run: () => cassian.setMood('warm'),
      },
    ];
    if (spared) {
      beats.push(
        {
          shot: () => overShoulder(eirik, cassian),
          run: () => {
            cassian.setStance('pose').setPose('stand');
            eirik.lookAt(cassian.headPosition());
          },
          say: { who: 'Eirik', text: 'The outpost stands on the frozen lake. They watch the shore, never the ice. I know the way across.', mood: 'neutral' },
        },
        {
          shot: () => overShoulder(cassian, eirik, { side: -1 }),
          say: { who: 'Cassian', text: 'Then show us, Eirik.', mood: 'warm' },
        },
      );
    } else {
      beats.push({
        shot: () => portrait(cassian, { angle: 0.3 }),
        narrate: 'Nobody knew the way across the ice. We would have to find it ourselves.',
      });
    }
    beats.push({ duration: 3, shot: { from: [0, 8, 8], at: [0, 0, 0], fov: FOV.normal }, fade: { to: 1, time: 2.5 } });
    return beats;
  },
};

export const letterTwo: Cutscene = {
  id: 'letter-two',
  create(stage: Stage): Beat[] {
    stage.light('goldenMorning');
    northCamp(stage);
    const cassian = cast(stage, 'cassianCommander', 'Cassian').place(0, 2, Math.PI);
    const galba = cast(stage, 'galba', 'Galba').place(0, -16, 0);
    const riders = Array.from({ length: 6 }, (_, i) => cast(stage, 'legionary', `Rider ${i}`).place(-5 + i * 2, -20, 0));
    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 2 },
        sound: 'horn',
        music: 'hope',
        shot: { from: [3, 2, 6], at: [0, 1.5, -14], fov: FOV.normal },
        run: () => {
          galba.walkTo(0, -1, 2);
          for (const r of riders) r.walkTo(r.root.position.x, -6, 2);
        },
        narrate: 'Dawn came. And with the dawn, Galba.',
      },
      {
        shot: () => overShoulder(galba, cassian),
        run: () => {
          galba.place(0, -0.4, 0).lookAt(cassian.headPosition());
          for (const r of riders) r.finishWalk();
        },
        say: { who: 'Galba', text: 'You held the fortress all night with half a legion. Legate Quintus is a day behind me. Now we finish this.', mood: 'warm' },
      },
      {
        duration: 3,
        shot: () => overShoulder(cassian, galba, { side: -1 }),
        run: () => galba.setPose('offer'),
        say: { who: 'Galba', text: 'And this came for you.', mood: 'happy' },
      },
      {
        shot: { from: [0.3, 2.2, 3.2], at: [0, 1.2, 1.8], fov: FOV.close },
        run: () => cassian.setPose('offer'),
        letter: LETTER_TWO,
      },
      {
        duration: 3.5,
        shot: () => portrait(cassian, { angle: 0.3 }),
        run: () => cassian.setMood('happy'),
        narrate: 'I laughed out loud. The first time since Varro.',
        fade: { to: 1, time: 3 },
      },
    ];
  },
};

/** The battlefield before the last battle: snow, the legion in the middle, the horde across. */
function lastField(stage: Stage): { legion: ReturnType<typeof cast>[]; horde: ReturnType<typeof cast>[] } {
  stage.ground(STORY_COLORS.snow, 200, 'snow');
  forestRing(stage, 40, 40, '#2A4A34');
  stage.weather('snow');
  const legion = Array.from({ length: 12 }, (_, i) => cast(stage, 'legionary', `Legionary ${i}`).place(-5.5 + (i % 6) * 2.2, 4 + Math.floor(i / 6) * 1.6, Math.PI));
  const horde = Array.from({ length: 16 }, (_, i) => cast(stage, 'viking', `Viking ${i}`, { color: i % 2 === 0 ? '#3E5A7A' : '#6A3A2A' }).place(-15 + i * 2, -24 - (i % 3), 0));
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) cast(stage, 'legionary', `Wing ${side} ${i}`, { color: side < 0 ? '#3C7BD0' : '#E3B52B' }).place(side * (12 + i * 1.6), 2 + (i % 2), Math.PI);
  }
  return { legion, horde };
}

export const rallySpeech: Cutscene = {
  id: 'rally-speech',
  create(stage: Stage): Beat[] {
    stage.light('snow');
    const { legion, horde } = lastField(stage);
    const hrolf = cast(stage, 'hrolf', 'Hrolf').place(0, -21, 0).setPose('raiseSword', true);
    upright(sword(stage.world.parts, hrolf.grips[0]));
    const horse = stage.horse();
    horse.place(0, 0, Math.PI);
    const cassian = cast(stage, 'cassianHelmet', 'Cassian');
    stage.mount(cassian, horse);
    upright(woodenCross(stage.world.parts, cassian.grips[0], 1.3));

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2.5 },
        music: 'dread',
        sound: 'wind',
        shot: { from: [0, 6, 14], at: [0, 1.5, -20], to: [0, 4, 10], fov: FOV.wide },
        narrate: 'The last field. Galba on the left, Quintus on the right, my legion in the middle. Across the snow, the horde.',
      },
      {
        duration: 4,
        sound: 'horn',
        shot: () => portrait(hrolf, { angle: 0.1, distance: 4, rise: -0.3, fov: FOV.close }),
        run: () => {
          hrolf.setMood('shout');
          for (const v of horde) v.setPose('cheer').setMood('shout');
        },
        say: { who: 'Hrolf', text: 'ROOOOME! Come and die in the snow!', mood: 'shout', as: 'Hrolf the Red' },
      },
      {
        shot: () => portrait(cassian, { angle: 0.3, distance: 3, rise: -0.4 }),
        run: () => {
          for (const v of horde) v.setPose('stand');
          horse.place(0, 2.2, 0);
          cassian.setPose('clutch').setMood('neutral');
        },
        say: { who: 'Cassian', text: 'Brothers! I was raised by monks. They taught me that every life is a gift.', mood: 'warm' },
      },
      {
        shot: { from: [-3, 2.4, 6.5], at: [0, 2.0, 2.2], fov: FOV.normal },
        run: () => {
          horse.place(0, 2.2, 0);
          cassian.setPose('point').setMood('angry');
        },
        say: { who: 'Cassian', text: 'The men across that field want to take everything we were ever given.', mood: 'angry' },
      },
      {
        shot: () => portrait(cassian, { angle: -0.2, distance: 2.8, rise: -0.3, push: 0.4 }),
        run: () => cassian.setPose('raiseSword').setMood('shout'),
        say: { who: 'Cassian', text: 'Look at the man beside you. That is why we stand. For Varro! For home!', mood: 'shout' },
      },
      {
        duration: 4,
        sound: 'crowd',
        music: 'hope',
        shot: { from: [5, 2, 9], at: [0, 1.5, 4], to: [8, 3, 12], fov: FOV.wide },
        run: () => {
          for (const l of legion) l.setPose('cheer').setMood('shout');
        },
        fade: { to: 1, time: 3.5 },
      },
    ];
  },
};

export const hrolfMirror: Cutscene = {
  id: 'hrolf-mirror',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('dusk');
    stage.ground(STORY_COLORS.snow, 160, 'snow');
    forestRing(stage, 24, 30, '#2A4A34');
    stage.weather('snow');
    for (let i = 0; i < 10; i++) cast(stage, 'viking', `Fallen ${i}`).place(-8 + (i % 5) * 4, -6 + Math.floor(i / 5) * 8, i).setPose('lie', true).eyesClosed = true;
    const hrolf = cast(stage, 'hrolf', 'Hrolf').place(0, -0.8, 0).setPose('kneel', true).setMood('sad', true);
    hrolf.setWounded(true);
    const cassian = cast(stage, 'cassianHelmet', 'Cassian').place(0, 1.0, Math.PI).setPose('point', true).setMood('angry', true);
    upright(sword(stage.world.parts, cassian.grips[0]));
    const legion = Array.from({ length: 8 }, (_, i) => cast(stage, 'legionary', `Legionary ${i}`).place(-5 + (i % 4) * 3.2, 4 + Math.floor(i / 4) * 1.5, Math.PI));
    const friends = [cast(stage, 'felix', 'Felix', { outfit: 'legion', color: '#4E7A9A' }).place(-2.4, 2.6, Math.PI), cast(stage, 'rufus', 'Rufus', { outfit: 'legion', color: '#9A6A3A' }).place(2.4, 2.6, Math.PI)];
    const eirik = cast(stage, 'eirik', 'Eirik').place(3.6, 3.4, Math.PI);
    if (story.save.choices.eirikSpared !== true) eirik.root.setEnabled(false);
    const spared = (): boolean => story.save.choices.hrolfSpared === true;

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 2 },
        music: 'silence',
        sound: 'wind',
        shot: { from: [5, 3, 6], at: [0, 1, 0], to: [4, 2.2, 4.5], fov: FOV.normal },
        narrate: 'The horde broke. And the red-haired man was on his knees in the snow, in front of me.',
      },
      {
        shot: () => overShoulder(hrolf, cassian),
        run: () => hrolf.lookAt(cassian.headPosition()),
        say: { who: 'Hrolf', text: 'So. The little monk from the river. Yes... I remember the bells.', mood: 'neutral' },
      },
      {
        shot: () => overShoulder(cassian, hrolf, { side: -1 }),
        say: { who: 'Cassian', text: 'You burned my home. You killed my father. I have seen your face every night for twenty years.', mood: 'angry' },
      },
      {
        music: 'sorrow',
        shot: () => portrait(hrolf, { angle: 0.4, rise: 0.4, distance: 2.4 }),
        run: () => hrolf.setMood('crying'),
        say: { who: 'Hrolf', text: 'When I was seven, Romans came to my village with fire. They killed my father in front of me. I swore I would burn them all.', mood: 'crying' },
      },
      {
        shot: () => portrait(hrolf, { angle: 0.2, rise: 0.4, distance: 2.1, push: 0.2 }),
        say: { who: 'Hrolf', text: 'Look at us, monk. The same story. Only the colors changed.', mood: 'sad' },
      },
      {
        duration: 4,
        sound: 'heartbeat',
        shot: () => portrait(cassian, { angle: -0.2, distance: 1.9, fov: FOV.extreme }),
        run: () => cassian.setMood('sad'),
        narrate: 'I had hated him my whole life. And he had hated me for his.',
      },
      {
        duration: 1,
        shot: () => overShoulder(hrolf, cassian),
        choice: {
          options: ['Spare him. Let it end with us.', 'End it. For Anselm. For Varro.'],
          pick: (i) => story.choose({ hrolfSpared: i === 0 }),
        },
      },
      {
        when: spared,
        shot: () => overShoulder(cassian, hrolf, { side: -1 }),
        run: () => cassian.setPose('stand').setMood('warm'),
        say: { who: 'Cassian', text: 'Then let it end with us. Go home, Hrolf. Tell your sons a different story.', mood: 'warm' },
      },
      {
        when: spared,
        shot: () => portrait(hrolf, { angle: 0.3, rise: 0.4, distance: 2.4 }),
        run: () => hrolf.setMood('crying').setPose('pray'),
        say: { who: 'Hrolf', text: 'Nobody ever... Thank you. Thank you, monk.', mood: 'crying' },
      },
      {
        when: () => !spared(),
        duration: 3,
        sound: 'heartbeat',
        shot: { from: [3.5, 1.5, 2.5], at: [0, 1, 0], fov: FOV.normal },
        run: () => cassian.setPose('raiseSword').setMood('angry'),
        fade: { to: 1, time: 0.3 },
      },
      {
        when: () => !spared(),
        duration: 4.5,
        fade: { to: 0, time: 1.5 },
        shot: () => portrait(cassian, { angle: 0.4, distance: 2.4 }),
        run: () => {
          hrolf.root.setEnabled(false);
          cassian.setPose('slump').setMood('sad');
        },
        narrate: 'It did not feel the way I had dreamed it would.',
      },
      {
        duration: 5,
        music: 'hope',
        sound: 'crowd',
        shot: { from: [0, 2.5, 9], at: [0, 1.3, 2], to: [0, 4, 12], fov: FOV.wide },
        run: () => {
          for (const l of legion) l.setPose('cheer').setMood('happy');
          for (const f of [...friends, eirik]) f.walkTo(f.root.position.x * 0.4, 1.8, 1.6);
          cassian.setPose('cheer').setMood('happy');
        },
        narrate: 'It was over. We had won.',
      },
      {
        duration: 4,
        shot: () => portrait(friends[1]!, { angle: 0.3 }),
        run: () => {
          for (const f of [...friends, eirik]) f.finishWalk();
          friends[1]!.setPose('embrace').setMood('crying');
        },
        say: { who: 'Rufus', text: 'We are alive! Felix! We are ALIVE! Hehehe!', mood: 'happy' },
        fade: { to: 1, time: 3.5 },
      },
    ];
  },
};


/** Looking down into the face of someone lying on their back, from just beside their head. */
function lyingFace(actor: Actor, height: number, fov: number): Shot {
  const h = actor.settle().headPosition();
  return { from: [h.x - height * 0.25, h.y + height, h.z + height * 0.45], at: { actor, offset: [0, 0, 0] }, fov };
}
