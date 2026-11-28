import { CityBuilder, houseRow, temple } from '../../campaign/cityKit.ts';
import { CAPITAL } from '../../campaign/districts.ts';
import { Crowd, type Seat } from '../../render/crowd.ts';
import { childNode } from '../../render/parts.ts';
import type { Actor } from '../actor.ts';
import { cast } from '../cast.ts';
import { torch, upright, sword } from '../props.ts';
import type { Beat, Cutscene, StoryContext } from '../script.ts';
import { FOV, overShoulder, portrait } from '../shot.ts';
import type { Stage } from '../stage.ts';

/**
 * The last road: the Greek spy's confession, the three peoples' march into Greece, the sewers
 * under a city of marble, and the homecoming with the Greeks in chains.
 */

const TORCH_HEAD = 0.5;
const GREEK = {
  plaster: '#F2EEE4',
  shutter: '#2E6AB0',
  roof: '#C8643A',
  marble: '#F4F2EA',
  wall: '#D8D2C2',
  brick: '#5A4A3E',
  brickDark: '#3E322A',
  sewage: '#3A4A3A',
  wine: '#7A1A2A',
  table: '#6A4A2A',
} as const;

function sonOf(story: StoryContext): 'marcus' | 'lucius' {
  return story.save.choices.son === 'marcus' ? 'marcus' : 'lucius';
}

/** The son the player follows, as the scenes show him. */
function castSon(stage: Stage, story: StoryContext, x: number, z: number, yaw: number): Actor {
  return sonOf(story) === 'marcus' ? cast(stage, 'marcusMongol', 'Marcus').place(x, z, yaw) : cast(stage, 'lucius', 'Lucius').place(x, z, yaw);
}

function ringCrowd(stage: Stage, cx: number, cz: number, inner: number, rows: number, excitement: number): Crowd {
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

export const theSpy: Cutscene = {
  id: 'the-spy',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('day');
    CAPITAL.build(stage);
    const crowd = ringCrowd(stage, 0, 9, 7, 3, 0.3);
    const son = sonOf(story);
    const me = castSon(stage, story, 0, 5.6, 0);
    const spy = cast(stage, 'spy', 'Stranger').place(0, 8.4, Math.PI).setPose('kneel', true).setMood('afraid', true);
    const felix = cast(stage, 'felixOld', 'Felix').place(-2.4, 6.2, 0.4);
    const rufus = cast(stage, 'rufusOld', 'Rufus').place(2.4, 6.2, -0.4);
    const sigurd = cast(stage, 'sigurd', 'Sigurd').place(-2.6, 10.6, Math.PI * 0.8);
    const east = son === 'marcus' ? cast(stage, 'luciusBare', 'Lucius').place(2.6, 10.6, -Math.PI * 0.8) : cast(stage, 'khan', 'Toghan', { helmet: false }).place(2.6, 10.6, -Math.PI * 0.8);
    const livia = cast(stage, 'liviaOld', 'Livia').place(-4.2, 4.4, 0.6);
    for (const a of [me, felix, rufus, sigurd, east, livia]) a.lookAt(spy.headPosition());
    const meName = son === 'marcus' ? 'Marcus' : 'Lucius';

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 2 },
        music: 'dread',
        sound: 'crowd',
        shot: { from: [0, 9, 22], at: [0, 1, 8], to: [0, 7, 18], fov: FOV.wide },
        narrate: 'They dragged him into the square. Half the city came to watch: Romans, Vikings, Mongols, all in one crowd.',
      },
      {
        shot: () => overShoulder(me, spy),
        say: { who: meName, text: 'Where do you come from?', mood: 'angry' },
      },
      {
        duration: 2.4,
        shot: () => portrait(spy, { angle: 0.2, distance: 2.0, rise: 0.4 }),
        narrate: 'He said nothing.',
      },
      {
        shot: () => portrait(sigurd, { angle: 0.3, distance: 2.4 }),
        run: () => sigurd.setPose('point').setMood('shout'),
        say: { who: 'Sigurd', text: 'WHERE. DO. YOU. COME. FROM.', mood: 'shout' },
      },
      {
        duration: 2.2,
        shot: () => portrait(spy, { angle: -0.3, distance: 2.0, rise: 0.4 }),
        narrate: 'Nothing.',
      },
      {
        shot: () => portrait(east, { angle: -0.3, distance: 2.4 }),
        run: () => east.setMood('happy'),
        say: son === 'marcus'
          ? { who: 'Lucius', text: 'Brother, perhaps we ask nicely. Or perhaps we ask Rufus.', mood: 'neutral' }
          : { who: 'Toghan', text: 'In the east we have ways to make a man talk. Slow ways.', mood: 'happy' },
      },
      {
        shot: () => portrait(rufus, { angle: -0.4, distance: 2.4 }),
        run: () => rufus.setMood('happy').setPose('offer'),
        say: { who: 'Rufus', text: 'Let me try! I will tell him my joke. All of it. Slowly.', mood: 'happy' },
      },
      {
        duration: 2.6,
        shot: () => portrait(felix, { angle: 0.4, distance: 2.4 }),
        run: () => felix.setMood('afraid'),
        say: { who: 'Felix', text: 'No, Rufus. Even he does not deserve that.', mood: 'afraid' },
      },
      {
        duration: 4,
        sound: 'thunder',
        shot: { from: [6, 3, 2], at: [8, 2.4, -12], fov: FOV.normal },
        run: () => {
          crowd.excitement = 0.9;
          spy.setMood('crying');
        },
        narrate: 'So they did it the old way. It did not take long.',
      },
      {
        shot: () => portrait(spy, { angle: 0.2, distance: 1.9, rise: 0.4 }),
        run: () => {
          crowd.excitement = 0;
          spy.setMood('crying').setPose('pray');
        },
        say: { who: 'Stranger', as: 'The spy', text: 'Greek! I am Greek! The bandits on the forest road, the ones who killed your old emperor... they were no bandits. They were us. In rags and masks. Paid in Greek gold.', mood: 'crying' },
      },
      {
        shot: () => portrait(spy, { angle: 0.1, distance: 1.8, rise: 0.4, push: 0.2 }),
        say: { who: 'Stranger', as: 'The spy', text: 'And long before that, in the dark forest... the Vikings who killed the smith? Our gold showed them the path. Our king wanted Rome weak. He still does.', mood: 'afraid' },
      },
      {
        duration: 4,
        sound: 'heartbeat',
        shot: () => portrait(rufus, { angle: -0.3, distance: 2.0 }),
        run: () => {
          rufus.setMood('crying').setPose('slump');
          felix.setMood('angry');
          livia.setMood('crying');
        },
        narrate: 'Varro. Cassian. Twenty years of graves, and all the time someone across the sea had been laughing at us.',
      },
      {
        shot: () => portrait(me, { angle: 0.3, distance: 2.4, rise: -0.2 }),
        run: () => me.setPose('raiseSword').setMood('shout'),
        say: { who: meName, text: 'Rome. The North. The East. They killed our fathers and laughed while we buried them. We march. All of us. Together.', mood: 'shout' },
      },
      {
        duration: 2.6,
        shot: () => portrait(sigurd, { angle: 0.3, distance: 2.4 }),
        run: () => sigurd.setPose('raiseSword').setMood('shout'),
        say: { who: 'Sigurd', text: 'The North marches!', mood: 'shout' },
      },
      {
        duration: 2.6,
        shot: () => portrait(east, { angle: -0.3, distance: 2.4 }),
        run: () => east.setPose('raiseSword').setMood('shout'),
        say: son === 'marcus' ? { who: 'Lucius', text: 'And Rome with it!', mood: 'shout' } : { who: 'Toghan', text: 'The East rides!', mood: 'shout' },
      },
      {
        duration: 4,
        sound: 'crowd',
        shot: { from: [0, 9, 22], at: [0, 1, 8], to: [0, 12, 28], fov: FOV.wide },
        run: () => {
          crowd.excitement = 1;
          for (const a of [felix, rufus]) a.setPose('raiseSword').setMood('shout');
        },
        fade: { to: 1, time: 3.5 },
      },
    ];
  },
};

/** A city of marble on a hill: white walls, towers, houses with blue shutters, a temple on top. */
function greekCityFar(stage: Stage): void {
  const b = new CityBuilder(stage);
  const g = b.group(0, -70);
  // The wall and its towers, in a great ring.
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const piece = b.box(g, GREEK.wall, [10, 8, 2.4], [Math.sin(a) * 42, 4, Math.cos(a) * 42], { castShadow: false });
    piece.rotation.y = a;
    if (i % 4 === 0) b.box(g, GREEK.wall, [4, 13, 4], [Math.sin(a) * 42, 6.5, Math.cos(a) * 42], { castShadow: false });
  }
  // Houses climbing the hill, terraces of white.
  for (let ring = 0; ring < 4; ring++) {
    const r = 34 - ring * 8;
    const count = 18 - ring * 3;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ring * 0.4;
      const h = 5 + ring * 3 + (i % 3) * 2;
      const house = b.box(g, i % 4 === 0 ? '#E8E0D0' : GREEK.plaster, [6, h, 6], [Math.sin(a) * r, h / 2, Math.cos(a) * r], { castShadow: false });
      house.rotation.y = a;
      b.box(g, GREEK.roof, [6.4, 0.5, 6.4], [Math.sin(a) * r, h + 0.25, Math.cos(a) * r], { castShadow: false }).rotation.y = a;
    }
  }
  // The temple on the top of the hill.
  b.box(g, GREEK.marble, [20, 14, 14], [0, 7, 0], { castShadow: false });
  temple(b, 0, -62, 0, 22);
  b.freeze();
}

/** The sewer: a brick tunnel with a channel of black water, arches, and a ladder up. */
function sewer(stage: Stage): void {
  stage.box(GREEK.brickDark, [6, 0.2, 60], [0, -0.1, 0], 0, { castShadow: false });
  stage.box(GREEK.sewage, [2, 0.05, 60], [0, 0.02, 0], 0, { castShadow: false });
  for (const side of [-1, 1]) stage.box(GREEK.brick, [0.6, 4, 60], [side * 3, 2, 0]);
  for (let i = 0; i < 12; i++) {
    stage.box(GREEK.brickDark, [6.6, 0.6, 0.8], [0, 3.8, -28 + i * 5]);
    for (const side of [-1, 1]) stage.box(GREEK.brickDark, [0.8, 3.8, 0.8], [side * 2.7, 1.9, -28 + i * 5]);
  }
  stage.box(GREEK.brick, [6.6, 0.6, 60], [0, 4.2, 0]);
  // The shaft and its ladder at the far end.
  for (let i = 0; i < 10; i++) stage.box('#6A4A2A', [1, 0.08, 0.08], [1.8, 0.4 + i * 0.5, -26]);
  for (const x of [1.3, 2.3]) stage.box('#6A4A2A', [0.1, 5.2, 0.1], [x, 2.6, -26]);
  // Rats.
  for (let i = 0; i < 4; i++) stage.box('#5E5A56', [0.14, 0.1, 0.26], [-2 + (i % 2) * 0.4, 0.06, -4 - i * 3], i);
}

/** The Greeks' feast in a square of their own city: tables, fires, wine, columns, white houses all round. */
function greekFeastSquare(stage: Stage): void {
  stage.ground('#B8AE9C', 120, 'none');
  const b = new CityBuilder(stage);
  const palette = { plaster: GREEK.plaster, shutter: GREEK.shutter, roof: GREEK.roof };
  houseRow(b, -20, -16, 20, -16, 0, 8, 301, { palette, minHeight: 7, shops: 0.2 });
  houseRow(b, 20, 16, -20, 16, Math.PI, 8, 302, { palette, minHeight: 7, shops: 0.2 });
  houseRow(b, -20, 16, -20, -16, Math.PI / 2, 8, 303, { palette, minHeight: 7 });
  houseRow(b, 20, -16, 20, 16, -Math.PI / 2, 8, 304, { palette, minHeight: 7 });
  temple(b, 0, -26, 0, 18);
  for (let i = 0; i < 8; i++) b.shape(b.root, 'cylinder', GREEK.marble, [0.4, 5, 0.4], [-14 + i * 4, 2.5, -13]);
  b.freeze();
  // Long tables full of wine, and fires to drink by.
  for (const z of [-3, 3]) {
    stage.box(GREEK.table, [12, 0.12, 1.4], [0, 0.85, z]);
    for (let i = 0; i < 12; i++) stage.shape('cylinder', i % 2 === 0 ? GREEK.wine : '#C8A040', [0.14, 0.3, 0.14], [-5.5 + i, 1.05, z]);
  }
  for (const [x, z] of [[-9, 0], [9, 0], [0, 9], [0, -9]] as const) stage.fire(x, z, 0.9, 0.2);
}

export const intoGreece: Cutscene = {
  id: 'into-greece',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('dusk');
    stage.ground('#7A8A4A', 220, 'hills');
    greekCityFar(stage);
    const son = sonOf(story);
    const me = castSon(stage, story, 0, 30, Math.PI);
    const sigurd = cast(stage, 'sigurd', 'Sigurd').place(-3, 31.5, Math.PI);
    const east = son === 'marcus' ? cast(stage, 'lucius', 'Lucius').place(3, 31.5, Math.PI) : cast(stage, 'khan', 'Toghan').place(3, 31.5, Math.PI);
    const rufus = cast(stage, 'rufusOld', 'Rufus').place(1.4, 33, Math.PI);
    const legion = Array.from({ length: 12 }, (_, i) => cast(stage, 'legionary', `Legionary ${i}`).place(-1.2 + (i % 3) * 1.2, 36 + Math.floor(i / 3) * 1.4, Math.PI));
    const vikings = Array.from({ length: 8 }, (_, i) => cast(stage, 'viking', `Viking ${i}`).place(-7 + (i % 2) * 1.3, 34 + Math.floor(i / 2) * 1.5, Math.PI));
    const riders = Array.from({ length: 6 }, (_, i) => {
      const horse = stage.horse();
      horse.place(7 + (i % 2) * 1.8, 34 + Math.floor(i / 2) * 2.6, Math.PI);
      const r = cast(stage, 'mongol', `Rider ${i}`);
      stage.mount(r, horse);
      return { r, horse };
    });
    const marchers = [me, sigurd, east, rufus, ...legion, ...vikings];
    const meName = son === 'marcus' ? 'Marcus' : 'Lucius';

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'hope',
        sound: 'horn',
        shot: { from: [16, 6, 20], at: [0, 1.4, 36], to: [14, 5, 14], fov: FOV.wide },
        run: () => {
          for (const a of marchers) a.walkTo(a.root.position.x, a.root.position.z - 14, 1.6);
          for (const { horse } of riders) horse.runTo(horse.root.position.x, horse.root.position.z - 14, 1.6);
        },
        narrate: 'Rome, the North and the East, marching under one sky. Nobody alive had ever seen it. Nobody would again.',
      },
      {
        duration: 5,
        shot: { from: [0, 24, 12], at: [0, 6, -70], to: [0, 20, 6], fov: FOV.normal },
        run: () => {
          for (const a of marchers) a.finishWalk();
          for (const { horse } of riders) horse.finishRun();
        },
        narrate: 'Thirty days later, at dusk, we saw it: the Greek city. White walls, white towers, marble climbing a hill to the sky. Bigger than Rome.',
      },
      {
        shot: () => portrait(rufus, { angle: 0.4, distance: 2.4 }),
        run: () => rufus.setMood('afraid').lookAt({ x: 0, y: 8, z: -70 }),
        say: { who: 'Rufus', text: 'That is a very big city. We are a very small army. I am just saying it out loud so nobody else has to.', mood: 'afraid' },
      },
      {
        shot: () => portrait(east, { angle: -0.3, distance: 2.4 }),
        say: son === 'marcus'
          ? { who: 'Lucius', text: 'The spy talked about the sewers. Tonight is their feast of wine. Half the city will be drunk by midnight.', mood: 'neutral' }
          : { who: 'Toghan', text: 'Their spy told us of the sewers. Tonight they drink to their gods. By midnight, half of them will be on the floor.', mood: 'happy' },
      },
      {
        shot: () => portrait(me, { angle: 0.3, distance: 2.2 }),
        run: () => me.setMood('angry'),
        say: { who: meName, text: 'Then we go in under their walls, while they drink.', mood: 'angry' },
        fade: { to: 1, time: 2.5 },
      },
    ];
  },
};

export const theSewers: Cutscene = {
  id: 'the-sewers',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('night');
    sewer(stage);
    const son = sonOf(story);
    const me = castSon(stage, story, 0.6, 20, Math.PI);
    const rufus = cast(stage, 'rufusOld', 'Rufus').place(-0.8, 22, Math.PI);
    const sigurd = cast(stage, 'sigurd', 'Sigurd').place(0.9, 23, Math.PI);
    const followers = Array.from({ length: 8 }, (_, i) => cast(stage, i % 3 === 0 ? 'viking' : i % 3 === 1 ? 'legionary' : 'mongol', `Follower ${i}`).place((i % 2 === 0 ? -1 : 1) * 1.2, 25 + i * 1.3, Math.PI));
    for (const [i, a] of [me, sigurd, ...followers].entries()) {
      if (i % 3 !== 0) continue;
      const t = torch(stage.world.parts, a.grips[0]);
      t.rotation.x = Math.PI;
      stage.flame(childNode('torch-head', t, 0, TORCH_HEAD, 0));
    }
    const everyone = [me, rufus, sigurd, ...followers];
    const meName = son === 'marcus' ? 'Marcus' : 'Lucius';

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'dread',
        shot: { from: [1.8, 2.4, 8], at: [0, 1.4, 20], to: [1.6, 2.2, 4], fov: FOV.normal },
        run: () => {
          for (const a of everyone) a.walkTo(a.root.position.x, a.root.position.z - 16, 1.2);
        },
        narrate: 'Midnight. In through a grate by the river, into the dark under the city. Up to our knees in it.',
      },
      {
        shot: () => portrait(rufus, { angle: 0.4, distance: 2.2 }),
        run: () => {
          for (const a of everyone) a.finishWalk();
          rufus.setMood('sad');
        },
        say: { who: 'Rufus', text: 'Forty years a soldier. Snow, fire, the dead walking. And THIS is the worst smell of my life.', mood: 'sad' },
      },
      {
        duration: 2.6,
        shot: () => portrait(sigurd, { angle: -0.3, distance: 2.2 }),
        run: () => sigurd.setMood('happy'),
        say: { who: 'Sigurd', text: 'Smells like my uncle\'s boat. Hah!', mood: 'happy' },
      },
      {
        duration: 4,
        shot: { from: [-1.4, 1.6, -20], at: [1.8, 3.4, -26], fov: FOV.normal },
        run: () => me.place(1.8, -25.4, Math.PI).setPose('reach'),
        narrate: 'At the end of the tunnel, a ladder, and above it a grate. Music. Singing. Laughing.',
      },
      {
        duration: 3,
        shot: () => portrait(me, { angle: 0.3, distance: 2.2, rise: -0.2 }),
        run: () => me.setMood('angry'),
        say: { who: meName, text: 'Quiet now. Up, one by one. Nobody makes a sound until I say.', mood: 'neutral' },
        fade: { to: 1, time: 2.6 },
      },
    ];
  },
};

export const greekFeastScene: Cutscene = {
  id: 'greek-feast-surround',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('night');
    greekFeastSquare(stage);
    const son = sonOf(story);
    const strategos = cast(stage, 'strategos', 'The Strategos').place(0, 0, 0).setPose('offer', true).setMood('happy', true);
    // The Greeks at their wine: some in armor, some in their tunics, all of them drunk.
    const greeks = Array.from({ length: 22 }, (_, i) => {
      const armored = i % 3 !== 0;
      const a = (i / 22) * Math.PI * 2;
      const r = 3 + (i % 3) * 1.4;
      const g = armored
        ? cast(stage, 'hoplite', `Greek ${i}`, { helmet: i % 2 === 0 })
        : cast(stage, 'villager', `Greek ${i}`, { color: GREEK.shutter, hair: '#2A1E18', skin: '#C98E66', beard: 'short', beardColor: '#2A1E18' });
      return g.place(Math.sin(a) * r, Math.cos(a) * r, a + Math.PI).setPose(i % 2 === 0 ? 'cheer' : 'offer', true).setMood('happy', true);
    });
    stage.animate((_dt, t) => greeks.forEach((g, i) => g.setPose(Math.sin(t * 2.5 + i) > 0.2 ? 'cheer' : 'offer')));
    const me = castSon(stage, story, -14, 12, Math.PI * 0.75);
    const sigurd = cast(stage, 'sigurd', 'Sigurd').place(14, 12, -Math.PI * 0.75);
    const east = son === 'marcus' ? cast(stage, 'lucius', 'Lucius').place(-14, -10, Math.PI * 0.25) : cast(stage, 'khan', 'Toghan').place(-14, -10, Math.PI * 0.25);
    const shadows = Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2;
      return cast(stage, i % 3 === 0 ? 'viking' : i % 3 === 1 ? 'legionary' : 'mongol', `Shadow ${i}`).place(Math.sin(a) * 15, Math.cos(a) * 12, a + Math.PI).setPose('raiseSword', true);
    });
    for (const s of [...shadows, sigurd, east]) s.root.setEnabled(false);
    const meName = son === 'marcus' ? 'Marcus' : 'Lucius';
    const drunk = greeks[0]!;

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'warm',
        sound: 'crowd',
        shot: { from: [-12, 2.2, 13], at: [0, 1.4, 0], to: [-11, 2.6, 11], fov: FOV.normal },
        narrate: 'The grate came up in an alley off their great square. And there they were. Hundreds of them, singing, spilling wine, half out of their armor.',
      },
      {
        shot: () => portrait(strategos, { angle: 0.3, distance: 2.6 }),
        run: () => strategos.setPose('cheer'),
        say: { who: 'The Strategos', text: 'To the gods! To Greece! And to Rome, may it fall on its fat face! Ha!', mood: 'happy' },
      },
      {
        duration: 5,
        shot: { from: [0, 18, 20], at: [0, 0, 0], to: [0, 20, 16], fov: FOV.wide },
        run: () => {
          for (const s of [...shadows, sigurd, east]) s.root.setEnabled(true);
        },
        narrate: 'We came out of every alley at once, in the dark, all the way round them. Rome. The North. The East.',
      },
      {
        duration: 3,
        shot: () => portrait(drunk, { angle: 0.3, distance: 2.0 }),
        run: () => {
          drunk.setPose('point').setMood('surprised');
          drunk.lookAt(me.headPosition());
        },
        say: { who: 'Greek 0', as: 'A drunk Greek', text: 'Is that... why is there a Viking in our... ROMANS! TO ARMS!', mood: 'afraid' },
      },
      {
        duration: 4,
        sound: 'horn',
        shot: { from: [8, 3, 9], at: [0, 1.2, 0], fov: FOV.wide },
        run: () => {
          for (const [i, g] of greeks.entries()) {
            const a = (i / 22) * Math.PI * 2;
            g.place(Math.sin(a) * 2.6, Math.cos(a) * 2.6, a).setPose('raiseSword').setMood('afraid');
          }
        },
        narrate: 'They were drunk, and they were frightened, and they were Greeks: in a heartbeat they had their shields and stood in a ring, shoulder to shoulder.',
      },
      {
        shot: () => portrait(me, { angle: 0.3, distance: 2.4, rise: -0.2 }),
        run: () => {
          me.setPose('raiseSword').setMood('shout');
          upright(sword(stage.world.parts, me.grips[0]));
        },
        say: { who: meName, text: 'For Cassian! For Varro! NOW!', mood: 'shout' },
        fade: { to: 1, time: 2 },
      },
    ];
  },
};

/** Home: the capital cheering, the Greeks in chains, Livia waiting by the statue. */
export const homeInChains: Cutscene = {
  id: 'home-in-chains',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('goldenMorning');
    CAPITAL.build(stage);
    stage.weather('petals');
    const crowd = ringCrowd(stage, 0, 8, 9, 3, 1);
    const son = sonOf(story);
    const me = castSon(stage, story, 0, 26, Math.PI);
    const sigurd = cast(stage, 'sigurd', 'Sigurd').place(-1.6, 27.4, Math.PI);
    const east = son === 'marcus' ? cast(stage, 'luciusBare', 'Lucius').place(1.6, 27.4, Math.PI) : cast(stage, 'khan', 'Toghan', { helmet: false }).place(1.6, 27.4, Math.PI);
    const rufus = cast(stage, 'rufusOld', 'Rufus').place(-0.8, 28.8, Math.PI);
    const felix = cast(stage, 'felixOld', 'Felix').place(0.8, 28.8, Math.PI);
    const prisoners = Array.from({ length: 10 }, (_, i) => cast(stage, 'hoplite', `Prisoner ${i}`, { helmet: false }).place((i % 2 === 0 ? -0.7 : 0.7), 31 + Math.floor(i / 2) * 1.5, Math.PI).setPose('slump', true).setMood('sad', true));
    const chain = stage.box('#3A3A3E', [0.06, 0.06, 8], [0, 1.0, 34], 0, { metal: true, castShadow: false });
    const livia = cast(stage, 'liviaOld', 'Livia').place(-3, 4, 0);
    const marchers = [me, sigurd, east, rufus, felix, ...prisoners];

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'hope',
        sound: 'crowd',
        shot: { from: [0, 18, -6], at: [0, 1, 22], to: [0, 14, -2], fov: FOV.wide },
        run: () => {
          for (const a of marchers) a.walkTo(a.root.position.x, a.root.position.z - 18, 1.4);
          chain.position.z = 16;
        },
        narrate: 'We came home in the spring. The whole city was in the streets, and behind us walked the Greeks, in chains.',
      },
      {
        shot: () => portrait(rufus, { angle: 0.4, distance: 2.4 }),
        run: () => {
          for (const a of marchers) a.finishWalk();
          rufus.setPose('cheer').setMood('happy');
        },
        say: { who: 'Rufus', text: 'Felix! They love us! Again! Forty years later, they still love us! Hehehe!', mood: 'happy' },
      },
      {
        duration: 3,
        shot: () => portrait(felix, { angle: -0.4, distance: 2.4 }),
        run: () => felix.setMood('happy'),
        say: { who: 'Felix', text: 'Mind the cabbage, Rufus.', mood: 'happy' },
      },
      {
        shot: () => overShoulder(livia, me),
        run: () => {
          me.place(-1.6, 5.6, Math.atan2(-1.4, -1.6));
          livia.lookAt(me.headPosition()).setMood('crying');
          me.lookAt(livia.headPosition()).setMood('warm');
        },
        say: { who: 'Livia', text: 'Your father would have been proud. And he would have pretended not to be, and then cried behind the stable.', mood: 'warm' },
      },
      {
        duration: 5,
        music: 'monastery',
        shot: { from: [-14, 3, 2], at: [-12, 7, 10], to: [-15, 2.2, 4], fov: FOV.normal },
        narrate: 'Monk. Prisoner. Smith. Legate. Emperor. Father. It started with a crooked little cross, and a bell, and a man who walked towards the fire with nothing in his hands.',
      },
      {
        duration: 7,
        shot: { from: [0, 6, 22], at: [0, 2, 4], to: [0, 18, 34], fov: FOV.wide },
        run: () => {
          crowd.excitement = 1;
          for (const a of [me, sigurd, east, rufus, felix, livia]) a.setPose('cheer').setMood('happy');
        },
        title: { text: 'Tumblehorde', sub: 'The End. Thank you for playing.' },
        fade: { to: 1, time: 6.5 },
      },
    ];
  },
};

