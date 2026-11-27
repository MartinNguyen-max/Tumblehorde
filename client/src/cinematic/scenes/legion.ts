import { overlapsFootprint } from '@tumblehorde/shared';
import { CAPITAL, CAPITAL_SQUARE } from '../../campaign/districts.ts';
import { Crowd, type Seat } from '../../render/crowd.ts';
import type { Actor } from '../actor.ts';
import { cast } from '../cast.ts';
import { woodenCross } from '../props.ts';
import type { Beat, Cutscene, StoryContext } from '../script.ts';
import { house } from '../sets.ts';
import { FOV, overShoulder, portrait } from '../shot.ts';
import type { Stage } from '../stage.ts';
import { burningHouse, dragonBoat, RUIN_BELL, ruinedMonastery, STORY_COLORS, throneRoom } from '../storySets.ts';

/** How Cassian joins the legion: the boy at the burning village, the Emperor, and the ruins on the road north. */

const VILLAGE = {
  clothes: ['#8A7A5A', '#6A8A9A', '#9A6A5A', '#7A8A5A', '#A88A6A'],
  charred: '#3A2E28',
  hay: '#D8B860',
  fence: '#6A4A2A',
  stone: '#8A8478',
} as const;

/** The village after the raid: houses burning or burnt out, smoke, broken fences, a well, a beached dragon boat. */
function burningVillage(stage: Stage): void {
  stage.ground('#4A5A34', 120);
  stage.weather('ash');
  const burning = [[-8, -8, 7, 5, 3.6, 0.2], [9, -6, 6, 5, 3.4, -0.3], [-14, 2, 5, 6, 3.2, 1.3], [15, 4, 6, 5, 3.6, -1.2], [-3, -16, 7, 5, 4, 0.1]] as const;
  for (const [x, z, w, d, h, yaw] of burning) {
    burningHouse(stage, x, z, w, d, h, yaw);
    stage.fire(x + 1, z + 1.5, 1.4, 0.4);
  }
  // Burnt out: black walls without roofs.
  for (const [x, z, yaw] of [[6, -15, 0.3], [-17, -9, 0.9], [18, -10, -0.6]] as const) {
    house(stage, x, z, 6, 5, 2.4, yaw, VILLAGE.charred);
    stage.fire(x, z, 0.8, 2.6);
  }
  house(stage, 2, -24, 8, 5, 3.6, 0, '#6A5A48');
  // The well, the fences, the hay, a cart on its side.
  stage.shape('cylinder', VILLAGE.stone, [1.0, 0.9, 1.0], [-6, 0.45, 7]);
  for (const x of [-6.8, -5.2]) stage.box(VILLAGE.fence, [0.15, 2, 0.15], [x, 1, 7]);
  stage.box(VILLAGE.fence, [2, 0.15, 0.15], [-6, 2, 7]);
  for (let i = 0; i < 12; i++) {
    const broken = i % 3 === 1;
    const post = stage.box(VILLAGE.fence, [0.14, 1, 0.14], [-12 + i * 2, 0.5, 11], 0);
    if (broken) post.rotation.z = 0.8;
    if (!broken) stage.box(VILLAGE.fence, [2, 0.1, 0.1], [-11 + i * 2, 0.8, 11]);
  }
  for (const [x, z] of [[10, 9], [12, 8], [-16, 10]] as const) stage.shape('cylinder', VILLAGE.hay, [0.9, 1.1, 0.9], [x, 0.55, z]);
  stage.fire(12, 8, 0.9, 0.9);
  const cart = stage.group('cart', 7, 0, 8);
  cart.rotation.z = 1.2;
  stage.world.parts.part('box', VILLAGE.fence, cart, [2.4, 0.2, 1.4], [0, 0.8, 0]);
  stage.world.parts.part('disc', '#4A3424', cart, [1.0, 0.12, 1.0], [0.8, 0.5, 0.8]).rotation.x = Math.PI / 2;
  dragonBoat(stage, 26, -2, 0.4);
  stage.box(STORY_COLORS.water, [10, 0.06, 120], [28, 0.01, 0], 0, { castShadow: false });
}

export const villageAfter: Cutscene = {
  id: 'village-after',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('dusk');
    burningVillage(stage);
    const cassian = cast(stage, 'cassianTraveller', 'Cassian').place(0, 1.5, Math.PI);
    const varro = cast(stage, 'varroArmored', 'Varro').place(-1.6, 2.4, Math.PI - 0.3);
    const felix = cast(stage, 'felix', 'Felix').place(1.8, -0.8, -0.4);
    const rufus = cast(stage, 'rufus', 'Rufus').place(0.6, -1.4, 0);
    const galba = cast(stage, 'galba', 'Galba').place(-4, -3, 0.8);
    const eirik = cast(stage, 'eirik', 'Eirik').place(0.3, -0.6, 0).setPose('kneel', true).setMood('afraid', true);
    for (let i = 0; i < 3; i++) cast(stage, 'legionary', `Legionary ${i}`).place(-6 + i * 1.2, -1 + i * 0.4, 0.9);
    for (let i = 0; i < 9; i++) cast(stage, 'viking', `Fallen raider ${i}`).place(4 + (i % 5) * 1.6, 3 - (i % 4) - Math.floor(i / 5) * 3, i).setPose('lie', true).eyesClosed = true;
    // The people of the village, saved, wrapped in blankets by the well.
    for (let i = 0; i < 8; i++) {
      const child = i % 3 === 2;
      cast(stage, 'villager', `Villager ${i}`, { color: VILLAGE.clothes[i % VILLAGE.clothes.length], age: child ? 'child' : i === 0 ? 'old' : 'adult', hairStyle: i % 2 === 0 ? 'long' : 'short' })
        .place(-7.5 + (i % 4) * 1.1, 5.5 + Math.floor(i / 4) * 1.2, Math.PI * 0.8 + i * 0.2)
        .setPose(i % 2 === 0 ? 'hunch' : 'stand', true)
        .setStance(i % 2 === 0 ? 'sit' : 'pose', true)
        .setMood('sad', true);
    }
    const chicken = stage.group('chicken', 3, 0, 4);
    stage.world.parts.part('box', '#F4F0E6', chicken, [0.3, 0.26, 0.4], [0, 0.25, 0]);
    stage.world.parts.part('box', '#F4F0E6', chicken, [0.16, 0.2, 0.16], [0, 0.46, 0.18]);
    stage.world.parts.part('box', '#D83A2A', chicken, [0.05, 0.1, 0.12], [0, 0.6, 0.18]);
    stage.world.parts.part('box', '#E8A030', chicken, [0.06, 0.05, 0.1], [0, 0.44, 0.3]);
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
        duration: 3,
        shot: () => portrait(rufus, { angle: -0.7, distance: 2.4 }),
        run: () => {
          chicken.parent = rufus.grips[0];
          chicken.position.set(0, -0.1, 0.25);
          rufus.setPose('offer').setMood('happy');
        },
        say: { who: 'Rufus', text: 'Look! The chicken made it!', mood: 'happy' },
      },
      {
        duration: 2.5,
        shot: () => portrait(felix, { angle: -0.5 }),
        run: () => felix.lookAt(rufus.headPosition()),
        say: { who: 'Felix', text: 'Put the chicken down, Rufus.', mood: 'sad' },
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

/** The triumph: the heroes walk up an aisle of legionaries through the packed capital square. */
const TRIUMPH = {
  /** Half the width of the aisle the procession walks. */
  aisle: 4.2,
  /** Meters between people in the crowd, and how much bigger than the arena's little figures they are. */
  spacing: 1.25,
  scale: 1.55,
  /** Where the procession starts (in the south street) and stops (before the fountain). */
  startZ: 24,
  stopZ: 5.5,
  legionStep: 2.2,
} as const;

function crowdSeats(): Seat[] {
  const { halfX, halfZ, footprints, yard, fountainRadius } = CAPITAL_SQUARE;
  const seats: Seat[] = [];
  for (let x = -halfX + 1; x <= halfX - 1; x += TRIUMPH.spacing) {
    for (let z = -halfZ + 1; z <= halfZ - 1; z += TRIUMPH.spacing) {
      if (Math.abs(x) < TRIUMPH.aisle + 0.6) continue;
      if (Math.hypot(x, z) < fountainRadius + 2) continue;
      if (x > yard.x0 - 0.5 && x < yard.x1 + 0.5 && z > yard.z0 - 0.5 && z < yard.z1 + 0.5) continue;
      if (footprints.some((f) => overlapsFootprint(f, x, z, 0.6))) continue;
      const jx = Math.sin(x * 7.1 + z * 3.3) * 0.25;
      const jz = Math.cos(x * 2.7 - z * 5.1) * 0.25;
      seats.push({ x: (x + jx) / TRIUMPH.scale, y: 0, z: (z + jz) / TRIUMPH.scale, yaw: x < 0 ? Math.PI / 2 : -Math.PI / 2 });
    }
  }
  return seats;
}

/** An eagle standard: a pole, a gold eagle, a red flag. */
function standard(stage: Stage, x: number, z: number): void {
  stage.box('#5E3E22', [0.14, 4.2, 0.14], [x, 2.1, z]);
  stage.box(STORY_COLORS.gold, [0.7, 0.3, 0.25], [x, 4.35, z], 0, { metal: true });
  stage.box(STORY_COLORS.gold, [0.22, 0.4, 0.22], [x, 4.6, z + 0.1], 0, { metal: true });
  stage.box('#A8282A', [0.9, 1.2, 0.05], [x, 3.4, z + 0.12]);
}

export const emperor: Cutscene = {
  id: 'emperor-street',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('city');
    CAPITAL.build(stage);
    const crowdRoot = stage.group('triumph-crowd');
    crowdRoot.scaling.setAll(TRIUMPH.scale);
    const crowd = new Crowd(stage.world.parts, crowdRoot, crowdSeats());
    crowd.excitement = 1;
    stage.animate((_dt, t) => crowd.update(t));
    stage.weather('petals');
    const lining: Actor[] = [];
    for (let z = CAPITAL_SQUARE.halfZ - 1; z > TRIUMPH.stopZ - 3; z -= TRIUMPH.legionStep) {
      for (const side of [-1, 1]) {
        lining.push(cast(stage, 'legionary', `Legionary ${lining.length}`).place(side * (TRIUMPH.aisle - 0.4), z, -side * Math.PI / 2));
      }
      standard(stage, -TRIUMPH.aisle - 0.2, z - 1.1);
      standard(stage, TRIUMPH.aisle + 0.2, z - 1.1);
    }
    const galba = cast(stage, 'galba', 'Galba').place(0, TRIUMPH.startZ - 2.5, Math.PI);
    const cassian = cast(stage, 'cassianTraveller', 'Cassian').place(0, TRIUMPH.startZ, Math.PI);
    const varro = cast(stage, 'varroArmored', 'Varro').place(-1.2, TRIUMPH.startZ + 1.4, Math.PI);
    const felix = cast(stage, 'felix', 'Felix').place(1.2, TRIUMPH.startZ + 1.4, Math.PI);
    const rufus = cast(stage, 'rufus', 'Rufus').place(0.4, TRIUMPH.startZ + 2.6, Math.PI);
    const eirik = cast(stage, 'eirik', 'Eirik').place(-0.6, TRIUMPH.startZ + 3.4, Math.PI);
    if (story.save.choices.eirikSpared !== true) eirik.root.setEnabled(false);
    const livia = cast(stage, 'livia', 'Livia').place(-TRIUMPH.aisle - 1.2, TRIUMPH.stopZ + 1, Math.PI / 2);
    const heroes = [cassian, varro, felix, rufus, eirik];
    const cabbage = stage.group('cabbage', 6, 3, 8);
    stage.world.parts.part('bush', '#7AB04A', cabbage, [0.32, 0.3, 0.32], [0, 0, 0]);

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'hope',
        sound: 'crowd',
        shot: { from: [0, 24, 34], at: [0, 1, 0], to: [0, 17, 24], fov: FOV.wide },
        run: () => {
          galba.walkTo(0, TRIUMPH.stopZ - 2.5, 1.3);
          for (const [i, a] of heroes.entries()) a.walkTo(a.root.position.x, TRIUMPH.stopZ + Math.floor(i / 2) * 1.4, 1.3);
        },
        narrate: 'The whole city came out. Every street, every roof, every window. They had heard about the village.',
      },
      {
        duration: 5,
        shot: { from: [0, 2.2, TRIUMPH.stopZ - 6], at: cassian, to: [0, 2.0, TRIUMPH.stopZ - 4], fov: FOV.normal },
        narrate: 'The city that had once thrown me a borrowed sword now threw flowers.',
      },
      {
        shot: () => portrait(rufus, { angle: 0.5 }),
        run: () => {
          galba.place(0, TRIUMPH.stopZ - 2.5, Math.PI);
          for (const [i, a] of heroes.entries()) a.place(a.root.position.x, TRIUMPH.stopZ + Math.floor(i / 2) * 1.4, Math.PI);
          rufus.setMood('happy').setPose('wave');
        },
        say: { who: 'Rufus', text: 'They love us! Felix, they love us! Hehehe!', mood: 'happy' },
      },
      {
        duration: 2.4,
        shot: () => portrait(felix, { angle: -0.4 }),
        during: (_s, p) => {
          // A cabbage from the cheap seats, right on Rufus.
          const head = rufus.headPosition();
          cabbage.position.set(6 + (head.x - 6) * p, 3 + (head.y + 0.3 - 3) * p + Math.sin(p * Math.PI) * 2, 8 + (head.z - 8) * p);
        },
        say: { who: 'Felix', text: 'That one threw a cabbage.', mood: 'neutral' },
      },
      {
        duration: 2.6,
        shot: () => portrait(rufus, { angle: 0.3, distance: 2.0 }),
        run: () => {
          cabbage.parent = rufus.grips[0];
          cabbage.position.set(0, 0.1, 0.1);
          rufus.setPose('cheer').setMood('happy');
        },
        say: { who: 'Rufus', text: 'A LOVING cabbage!', mood: 'happy' },
      },
      {
        duration: 5,
        sound: 'horn',
        shot: { from: [-2.4, 2.4, TRIUMPH.stopZ + 1], at: [2.5, 1.6, CAPITAL_SQUARE.halfZ - 4], to: [-2.4, 3.2, TRIUMPH.stopZ + 4], fov: FOV.wide },
        run: () => {
          for (const man of lining) man.setPose('raiseSword').setMood('shout');
          galba.setPose('raiseSword');
        },
        say: { who: 'Galba', text: 'Legion! Hail the heroes of the north road!', mood: 'shout' },
      },
      {
        duration: 4,
        shot: { from: [0, 14, -14], at: [0, 0, 10], to: [0, 18, -18], fov: FOV.wide },
        narrate: 'Thousands of shields, thousands of spears. I had never seen the Empire so strong. Neither had anyone else.',
      },
      {
        duration: 3,
        shot: { from: [-TRIUMPH.aisle + 1.5, 1.7, TRIUMPH.stopZ - 1.5], at: [-TRIUMPH.aisle - 0.4, 1.4, TRIUMPH.stopZ + 0.6], fov: FOV.normal },
        run: () => {
          for (const man of lining) man.setPose('stand').setMood('neutral');
          for (const a of [varro, felix, rufus, eirik, galba]) a.root.setEnabled(false);
          cassian.place(-TRIUMPH.aisle + 0.4, TRIUMPH.stopZ + 1, -Math.PI / 2).setPose('stand');
          livia.place(-TRIUMPH.aisle - 0.9, TRIUMPH.stopZ + 1, Math.PI / 2);
          livia.lookAt(cassian.headPosition());
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
    Array.from({ length: 8 }, (_, i) => cast(stage, 'legionary', `Legionary ${i}`).place(-9 + i * 1.4, 21, Math.PI));
    const felix = cast(stage, 'felixLegion', 'Felix').place(-5.6, 19.6, Math.PI);
    const rufus = cast(stage, 'rufusLegion', 'Rufus').place(-4.4, 19.8, Math.PI);

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
        shot: { from: [RUIN_BELL.x + 1.2, 0.9, RUIN_BELL.z + 1.6], at: [RUIN_BELL.x, 0.35, RUIN_BELL.z], fov: FOV.close },
        narrate: 'No bells.',
      },
      {
        duration: 6,
        shot: { from: [-9.6, 1.6, 11.2], at: [-6.6, 0.5, 6], fov: FOV.normal },
        run: () => {
          cassian.place(-7, 9.4, Math.PI).setPose('kneel').setMood('sad').lookAt({ x: -7, y: 0.3, z: 6 });
        },
        narrate: 'Someone from the village had buried them. Six mounds. I said their names, one by one. Paul. Tomas. Ivo. Benet. Odo. Simon.',
      },
      {
        duration: 4,
        shot: { from: [-3, 1.8, 16], at: [-5, 1.4, 20], fov: FOV.normal },
        run: () => {
          felix.setPose('pray').setMood('sad');
          rufus.setPose('pray').setMood('sad');
        },
        narrate: 'The legion waited on the road. Even Rufus was quiet.',
      },
      {
        duration: 4,
        music: 'monastery',
        shot: () => portrait(cassian, { angle: 0.6, distance: 2.4 }),
        run: () => {
          cassian.place(0.6, 1.8, Math.PI).setPose('kneel').setMood('sad').lookAt({ x: 0.5, y: 0, z: 0.6 });
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

