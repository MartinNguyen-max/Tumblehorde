import { cast } from '../cast.ts';
import { woodenCross } from '../props.ts';
import type { Beat, Cutscene, StoryContext } from '../script.ts';
import { house } from '../sets.ts';
import { FOV, overShoulder, portrait } from '../shot.ts';
import type { Stage } from '../stage.ts';
import { burningHouse, ruinedMonastery, throneRoom } from '../storySets.ts';

/** How Cassian joins the legion: the boy at the burning village, the Emperor, and the ruins on the road north. */

export const villageAfter: Cutscene = {
  id: 'village-after',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('dusk');
    stage.ground('#4A5A34', 120);
    burningHouse(stage, -8, -8, 7, 5, 3.6, 0.2);
    burningHouse(stage, 9, -6, 6, 5, 3.4, -0.3);
    house(stage, 2, -14, 8, 5, 3.6, 0, '#6A5A48');
    stage.weather('ash');
    const cassian = cast(stage, 'cassianTraveller', 'Cassian').place(0, 1.5, Math.PI);
    const varro = cast(stage, 'varroArmored', 'Varro').place(-1.6, 2.4, Math.PI - 0.3);
    const felix = cast(stage, 'felix', 'Felix').place(1.8, -0.8, -0.4);
    const rufus = cast(stage, 'rufus', 'Rufus').place(0.6, -1.4, 0);
    const galba = cast(stage, 'galba', 'Galba').place(-4, -3, 0.8);
    const eirik = cast(stage, 'eirik', 'Eirik').place(0.3, -0.6, 0).setPose('kneel', true).setMood('afraid', true);
    for (let i = 0; i < 3; i++) cast(stage, 'legionary', `Legionary ${i}`).place(-6 + i * 1.2, -1 + i * 0.4, 0.9);
    for (let i = 0; i < 4; i++) cast(stage, 'viking', `Fallen raider ${i}`).place(4 + i * 1.6, 3 - i, i).setPose('lie', true).eyesClosed = true;
    const spared = (): boolean => story.save.choices.eirikSpared === true;

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 2 },
        music: 'sorrow',
        sound: 'fire',
        shot: { from: [6, 4, 10], at: [0, 1.5, -4], to: [4, 3, 8], fov: FOV.wide },
        narrate: 'We were too late to save the village. We were in time to save its people.',
      },
      {
        shot: () => overShoulder(galba, cassian),
        run: () => {
          galba.place(-1.4, -0.6, Math.atan2(1.4, 2.1));
          galba.lookAt(cassian.headPosition());
          cassian.lookAt(galba.headPosition());
        },
        say: { who: 'Galba', text: 'You fight like a legionary and lead like a centurion. Who are you?', mood: 'neutral' },
      },
      {
        shot: () => overShoulder(cassian, galba, { side: -1 }),
        say: { who: 'Cassian', text: 'A monk, once. A smith\'s apprentice now. My name is Cassian.', mood: 'neutral' },
      },
      {
        shot: () => portrait(felix, { angle: 0.4 }),
        run: () => cassian.lookAt(eirik.headPosition()),
        say: { who: 'Felix', text: 'This one threw down his axe and begged. Look at him. He is barely more than a boy.', mood: 'sad' },
      },
      {
        shot: () => portrait(eirik, { angle: 0.2, rise: 0.4, distance: 2.4 }),
        run: () => eirik.lookAt(cassian.headPosition()),
        say: { who: 'Eirik', text: 'Please. My name is Eirik. They made us come. I never wanted any of this.', mood: 'crying' },
      },
      {
        shot: () => portrait(eirik, { angle: 0.1, rise: 0.4, distance: 2.1, push: 0.2 }),
        say: { who: 'Eirik', text: 'Hrolf the Red leads us. He gathers every clan in the north. He will burn your whole empire.', mood: 'afraid' },
      },
      {
        duration: 3,
        sound: 'heartbeat',
        shot: () => portrait(cassian, { angle: -0.3, distance: 2.0, fov: FOV.extreme }),
        run: () => cassian.setMood('angry').setPose('fist'),
        narrate: 'The red-haired man. He had a name.',
      },
      {
        shot: () => portrait(varro, { angle: 0.4 }),
        run: () => varro.lookAt(cassian.headPosition()),
        say: { who: 'Varro', text: 'Your call, son. Whatever you choose, I am with you.', mood: 'warm' },
      },
      {
        duration: 1,
        shot: () => portrait(eirik, { angle: 0.3, rise: 0.5, distance: 2.6 }),
        choice: {
          options: ['Spare him. He comes with us.', 'End it. They burned my home.'],
          pick: (i) => story.choose({ eirikSpared: i === 0 }),
        },
      },
      {
        when: spared,
        shot: () => overShoulder(cassian, eirik),
        run: () => cassian.setPose('reach').setMood('warm'),
        say: { who: 'Cassian', text: 'Get up, Eirik. You will show us the way north.', mood: 'warm' },
      },
      {
        when: spared,
        shot: () => portrait(eirik, { angle: 0.3 }),
        run: () => eirik.setPose('stand').setMood('crying'),
        say: { who: 'Eirik', text: 'I will. I swear it on my mother\'s name. I will not forget this.', mood: 'crying' },
      },
      {
        when: spared,
        duration: 3,
        shot: () => portrait(varro, { angle: 0.4 }),
        run: () => varro.setMood('happy'),
        say: { who: 'Varro', text: 'Good lad.', mood: 'warm' },
      },
      {
        when: () => !spared(),
        duration: 4,
        sound: 'heartbeat',
        shot: { from: [3, 1.2, 3], at: [0.3, 0.6, -0.6], fov: FOV.normal },
        run: () => {
          cassian.setPose('raiseSword').setMood('angry');
          eirik.setPose('cower');
        },
        fade: { to: 1, time: 0.4 },
      },
      {
        when: () => !spared(),
        duration: 4,
        fade: { to: 0, time: 1.5 },
        shot: () => portrait(varro, { angle: 0.3, distance: 2.4 }),
        run: () => {
          eirik.root.setEnabled(false);
          cassian.setPose('slump').setMood('sad');
          varro.setMood('sad').lookAt(null);
        },
        narrate: 'Varro said nothing. He did not look at me for the rest of the day.',
      },
      {
        shot: () => overShoulder(galba, cassian),
        run: () => galba.setMood('warm').lookAt(cassian.headPosition()),
        say: { who: 'Galba', text: 'The Emperor needs men like you. Come to the capital with me. All of you.', mood: 'warm' },
      },
      {
        duration: 4,
        shot: { from: [0, 6, 12], at: [0, 1.4, 0], to: [0, 9, 16], fov: FOV.normal },
        fade: { to: 1, time: 3.5 },
      },
    ];
  },
};

const CROWD_COLORS = ['#C8423A', '#3C7BD0', '#E3B52B', '#6AA84F', '#E8E0CC', '#8E5BD0'] as const;

export const emperor: Cutscene = {
  id: 'emperor-street',
  create(stage: Stage, story: StoryContext): Beat[] {
    // The street: both sides full of cheering people.
    stage.light('city');
    stage.ground('#8E8474', 200);
    for (let i = 0; i < 8; i++) {
      for (const side of [-1, 1]) house(stage, side * 9, 18 - i * 9, 6, 8, 6 + (i % 3) * 2, side * Math.PI / 2, ['#E6D3B0', '#E8C49A', '#E3B4A0'][i % 3]);
    }
    const crowd = Array.from({ length: 22 }, (_, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const person = cast(stage, 'villager', `Townsperson ${i}`, { color: CROWD_COLORS[i % CROWD_COLORS.length], age: i % 5 === 0 ? 'child' : 'adult' });
      return person.place(side * (4.2 + (i % 3) * 0.6), 16 - Math.floor(i / 2) * 3, -side * Math.PI / 2).setPose('cheer', true).setMood('happy', true);
    });
    stage.animate((_dt, t) => crowd.forEach((p, i) => p.setPose(Math.sin(t * 4 + i) > 0 ? 'cheer' : 'wave')));
    stage.weather('motes');
    const cassian = cast(stage, 'cassianTraveller', 'Cassian').place(0, 20, Math.PI);
    const varro = cast(stage, 'varroArmored', 'Varro').place(-1.2, 21.4, Math.PI);
    const felix = cast(stage, 'felix', 'Felix').place(1.2, 21.4, Math.PI);
    const rufus = cast(stage, 'rufus', 'Rufus').place(0.4, 22.6, Math.PI);
    const eirik = cast(stage, 'eirik', 'Eirik').place(-0.6, 23.4, Math.PI);
    if (story.save.choices.eirikSpared !== true) eirik.root.setEnabled(false);
    const livia = cast(stage, 'livia', 'Livia').place(3.2, -6, -Math.PI / 2);

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'hope',
        sound: 'crowd',
        shot: { from: [0, 2.4, 6], at: cassian, to: [0, 2.0, 9], fov: FOV.normal },
        run: () => {
          for (const [i, a] of [cassian, varro, felix, rufus, eirik].entries()) a.walkTo(a.root.position.x, 4 + Math.floor(i / 2) * 1.4, 1.3);
        },
        narrate: 'The city that had once thrown me a borrowed sword now threw flowers.',
      },
      {
        shot: () => portrait(rufus, { angle: 0.5 }),
        run: () => {
          for (const [i, a] of [cassian, varro, felix, rufus, eirik].entries()) a.place(a.root.position.x, 4 + Math.floor(i / 2) * 1.4, Math.PI);
          rufus.setMood('happy').setPose('wave');
        },
        say: { who: 'Rufus', text: 'They love us! Felix, they love us! Hehehe!', mood: 'happy' },
      },
      {
        duration: 3,
        shot: { from: [4.5, 1.6, -3], at: [0.5, 1.4, 0], fov: FOV.normal },
        run: () => {
          for (const a of [cassian, varro, felix, rufus, eirik]) a.root.setEnabled(a !== eirik || story.save.choices.eirikSpared === true);
          cassian.place(1.2, -5.6, Math.PI / 2).setPose('stand');
          livia.place(2.6, -5.6, -Math.PI / 2);
          livia.lookAt(cassian.headPosition());
          for (const a of [varro, felix, rufus, eirik]) a.root.setEnabled(false);
        },
        narrate: 'In the crowd, a healer pulled me aside.',
      },
      {
        shot: () => overShoulder(livia, cassian),
        run: () => livia.setPose('carve').setMood('warm'),
        say: { who: 'Livia', text: 'Hold still, hero. You are bleeding all over my clean street.', mood: 'happy' },
      },
      {
        shot: () => overShoulder(cassian, livia, { side: -1 }),
        run: () => cassian.setMood('surprised').lookAt(livia.headPosition()),
        say: { who: 'Cassian', text: 'I did not even notice.', mood: 'surprised' },
      },
      {
        shot: () => overShoulder(livia, cassian, { push: 0.3 }),
        say: { who: 'Livia', text: 'Men never do. I am Livia. Try to come back from the north in one piece, will you?', mood: 'warm' },
      },
      {
        duration: 4,
        shot: () => portrait(cassian, { angle: 0.3, distance: 2.2 }),
        run: () => cassian.setMood('warm'),
        narrate: 'I would think about that smile for the rest of the war.',
        fade: { to: 1, time: 3 },
      },
    ];
  },
};

export const emperorHall: Cutscene = {
  id: 'emperor-hall',
  create(stage: Stage): Beat[] {
    stage.light('interior');
    throneRoom(stage);
    const emperorActor = cast(stage, 'emperor', 'Emperor Severus').place(0, -14.3, 0).setStance('sit', true);
    const galba = cast(stage, 'galba', 'Galba').place(-2.2, -9, 0.4);
    const cassian = cast(stage, 'cassianTraveller', 'Cassian').place(0, -10, Math.PI).setPose('kneel', true);
    const commander = cast(stage, 'cassianCommander', 'Cassian ').place(0, -10, Math.PI);
    commander.root.setEnabled(false);
    for (const x of [-3, 3]) cast(stage, 'legionary', `Guard ${x}`).place(x, -12, x > 0 ? -Math.PI / 2 : Math.PI / 2);
    for (let i = 0; i < 8; i++) cast(stage, 'legionary', `Legionary ${i}`).place(-3 + (i % 4) * 2, -3 - Math.floor(i / 4) * 2, Math.PI);

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 1.5 },
        music: 'hope',
        shot: { from: [0, 2.4, 2], at: [0, 1.6, -14], to: [0, 2, -4], fov: FOV.normal },
        run: () => emperorActor.lookAt(cassian.headPosition()),
      },
      {
        shot: () => portrait(emperorActor, { angle: 0.2, rise: -0.2, distance: 3 }),
        say: { who: 'Emperor Severus', text: 'Hrolf the Red gathers a horde in the north. Every clan, every ship. When the ice breaks, he comes for us.', mood: 'neutral' },
      },
      {
        shot: () => portrait(emperorActor, { angle: 0.1, rise: -0.2, distance: 2.6, push: 0.3 }),
        say: { who: 'Emperor Severus', text: 'Galba says you fight like ten men. I give you twenty-five. A horse, a cape and a helmet. Ride to the northern fortress and stop him.', mood: 'neutral' },
      },
      {
        shot: () => portrait(commander, { angle: 0.4, distance: 2.6 }),
        run: () => {
          cassian.root.setEnabled(false);
          commander.root.setEnabled(true);
          commander.setPose('fist').setMood('angry').lookAt(emperorActor.headPosition());
        },
        say: { who: 'Cassian ', as: 'Cassian', text: 'I will, Caesar.', mood: 'angry' },
      },
      {
        duration: 4,
        sound: 'horn',
        shot: { from: [4, 3, -2], at: [0, 1.4, -10], fov: FOV.normal },
        run: () => {
          galba.setPose('cheer');
          commander.setPose('raiseSword');
        },
        fade: { to: 1, time: 3.5 },
      },
    ];
  },
};

export const ruins: Cutscene = {
  id: 'ruins',
  create(stage: Stage): Beat[] {
    stage.light('dusk');
    ruinedMonastery(stage);
    stage.weather('ash');
    const cassian = cast(stage, 'cassianCommander', 'Cassian').place(-2, 12, Math.PI);
    const cross = woodenCross(stage.world.parts, stage.root, 1.3);
    cross.position.set(0.5, 0.04, 0.6);
    cross.rotation.set(Math.PI / 2, 0.4, 0);
    Array.from({ length: 6 }, (_, i) => cast(stage, 'legionary', `Legionary ${i}`).place(-6 + i * 1.4, 20, Math.PI));

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2.5 },
        music: 'silence',
        sound: 'wind',
        shot: { from: [8, 5, 14], at: [0, 1.5, -4], to: [6, 4, 11], fov: FOV.wide },
        narrate: 'On the road north I asked the legion to wait. There was a place I had to see.',
      },
      {
        duration: 6,
        shot: { from: [2, 1.6, 5], at: cassian, fov: FOV.normal },
        run: () => cassian.setMood('sad').walkTo(0.6, 1.8, 0.8),
      },
      {
        duration: 4,
        shot: { from: [4.6, 0.8, -6], at: [3.6, 0.35, -7.5], fov: FOV.close },
        narrate: 'No bells.',
      },
      {
        duration: 4,
        music: 'monastery',
        shot: () => portrait(cassian, { angle: 0.6, distance: 2.4 }),
        run: () => {
          cassian.place(0.6, 1.8, Math.PI).setPose('kneel').lookAt({ x: 0.5, y: 0, z: 0.6 });
        },
        narrate: 'And then, in the ashes, where the bench had been...',
      },
      {
        duration: 4,
        shot: { from: [1.3, 0.7, 1.6], at: [0.5, 0.1, 0.6], fov: FOV.extreme },
      },
      {
        shot: () => portrait(cassian, { angle: 0.3, distance: 2.0, push: 0.3 }),
        run: () => {
          cross.parent = cassian.grips[0];
          cross.position.set(0, 0, 0);
          cross.rotation.set(Math.PI, 0, 0);
          cassian.setPose('clutch').setMood('crying').lookAt(null);
        },
        say: { who: 'Cassian', text: 'You waited for me. You knew the way home.', mood: 'crying' },
      },
      {
        duration: 6,
        shot: { from: [0, 4, 9], at: [0.6, 1, 1.8], to: [0, 9, 16], fov: FOV.normal },
        narrate: 'Crooked. Perfect. I carried it to war from that day on.',
        fade: { to: 1, time: 5 },
      },
    ];
  },
};

