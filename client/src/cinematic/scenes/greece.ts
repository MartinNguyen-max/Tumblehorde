import { CityBuilder, houseRow, temple } from '../../campaign/cityKit.ts';
import { CAPITAL } from '../../campaign/districts.ts';
import { Crowd, type Seat } from '../../render/crowd.ts';
import { childNode } from '../../render/parts.ts';
import type { TransformNode } from '../../render/babylon.ts';
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
export const GREEK = {
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

export function sonOf(story: StoryContext): 'marcus' | 'lucius' {
  return story.save.choices.son === 'marcus' ? 'marcus' : 'lucius';
}

/** The son the player follows, as the scenes show him. */
export function castSon(stage: Stage, story: StoryContext, x: number, z: number, yaw: number): Actor {
  return sonOf(story) === 'marcus' ? cast(stage, 'marcusMongol', 'Marcus').place(x, z, yaw) : cast(stage, 'lucius', 'Lucius').place(x, z, yaw);
}

export function ringCrowd(stage: Stage, cx: number, cz: number, inner: number, rows: number, excitement: number): Crowd {
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
export function greekCityFar(stage: Stage): void {
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
        sound: 'horn',
        shot: { from: [-1.4, 1.6, -14], at: [0, 1.6, -24], fov: FOV.normal },
        run: () => me.setMood('afraid'),
        narrate: 'Then torches ahead, coming round the bend. The Greek watch, walking the tunnels.',
      },
      {
        duration: 3,
        shot: () => portrait(me, { angle: 0.3, distance: 2.2, rise: -0.2 }),
        run: () => me.setPose('raiseSword').setMood('angry'),
        say: { who: meName, text: 'No room for shields down here. Fast and close. Nobody gets away to warn them.', mood: 'angry' },
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

/** The Greek border fort: a stone wall with towers, a gate, a ditch; Greek bowmen on top. */
const FORT = { wallX: -12, height: 7, gateHalf: 2.6, stone: '#B8B2A4', stoneDark: '#8E887A', ditch: '#3A4A3A' } as const;

function borderFortSet(stage: Stage): { doors: TransformNode[] } {
  stage.ground('#7A8A4A', 160, 'hills');
  stage.box(FORT.ditch, [4, 0.06, 60], [FORT.wallX - 4, 0.01, 0], 0, { castShadow: false });
  stage.box('#6A4A2A', [5, 0.3, 5.4], [FORT.wallX - 4, 0.2, 0]);
  for (const side of [-1, 1]) {
    const len = 26;
    stage.box(FORT.stone, [2.4, FORT.height, len], [FORT.wallX, FORT.height / 2, side * (FORT.gateHalf + len / 2)]);
    for (let i = 0; i < 9; i++) stage.box(FORT.stoneDark, [2.6, 0.8, 1.2], [FORT.wallX, FORT.height + 0.4, side * (FORT.gateHalf + 1 + i * 3)]);
    stage.box(FORT.stone, [4.4, FORT.height + 4, 4.4], [FORT.wallX, (FORT.height + 4) / 2, side * (FORT.gateHalf + 2.2)]);
    stage.box(FORT.stone, [4.4, FORT.height + 4, 4.4], [FORT.wallX, (FORT.height + 4) / 2, side * 22]);
  }
  stage.box(FORT.stone, [2.6, 2.4, FORT.gateHalf * 2], [FORT.wallX, FORT.height - 1.2, 0]);
  // The Greeks' banner over the gate.
  stage.box('#2E5AA8', [0.1, 3, 2], [FORT.wallX - 1.4, FORT.height + 2.4, 0]);
  const doors = [-1, 1].map((side) => {
    const hinge = stage.group('fort-door', FORT.wallX - 1.2, 0, side * FORT.gateHalf);
    stage.world.parts.part('box', '#5E3E22', hinge, [0.3, FORT.height - 2.4, FORT.gateHalf], [0, (FORT.height - 2.4) / 2, -side * FORT.gateHalf / 2]);
    return hinge;
  });
  return { doors };
}

export const fortSiege: Cutscene = {
  id: 'fort-siege',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('day');
    const { doors } = borderFortSet(stage);
    const son = sonOf(story);
    const me = castSon(stage, story, -36, 3, Math.PI / 2);
    const sigurd = cast(stage, 'sigurd', 'Sigurd').place(-37, 6, Math.PI / 2);
    const rufus = cast(stage, 'rufusOld', 'Rufus').place(-38, 0, Math.PI / 2);
    const archers = Array.from({ length: 10 }, (_, i) => cast(stage, 'hoplite', `Greek ${i}`).place(FORT.wallX + 0.4, -18 + i * 4 + (i >= 5 ? 1 : -1) * 2, -Math.PI / 2).setPose('raiseSword', true));
    for (const a of archers) a.root.position.y = FORT.height;
    // The ram under its roof, and the men pushing it.
    const ram = stage.group('ram', -30, 0, 0);
    stage.world.parts.part('box', '#6A4A2A', ram, [4.6, 0.3, 2.2], [0, 0.7, 0]);
    stage.world.parts.part('cylinder', '#5E3E22', ram, [0.32, 5.6, 0.32], [1, 1.4, 0]).rotation.z = Math.PI / 2;
    stage.world.parts.part('box', '#3A3A3E', ram, [0.5, 0.7, 0.7], [3.8, 1.4, 0], { metal: true });
    for (const side of [-1, 1]) stage.world.parts.part('box', '#8A6A48', ram, [4.8, 0.12, 1.5], [0, 3.1, side * 0.6]).rotation.x = side * 0.5;
    const pushers = Array.from({ length: 6 }, (_, i) => cast(stage, 'legionary', `Pusher ${i}`).place(-32 + (i % 3) * 1.4, i < 3 ? -1.4 : 1.4, Math.PI / 2).setPose('reach', true));
    // Ladders lying on the grass, ready to go up.
    const ladders = [-14, -8, 8, 14].map((z) => {
      const g = stage.group('ladder', FORT.wallX - 3.4, 0, z);
      for (const side of [-0.4, 0.4]) stage.world.parts.part('box', '#8A5A32', g, [0.14, FORT.height + 1.6, 0.14], [0, (FORT.height + 1.6) / 2, side]);
      for (let i = 0; i < 8; i++) stage.world.parts.part('box', '#8A5A32', g, [0.1, 0.1, 0.8], [0, 0.6 + i * 1.05, 0], { castShadow: false });
      g.rotation.z = -1.5;
      return g;
    });
    const climbers = [-14, -8, 8, 14].map((z, i) => cast(stage, i % 2 === 0 ? 'viking' : 'legionary', `Climber ${i}`).place(FORT.wallX - 3.6, z, Math.PI / 2));
    const army = Array.from({ length: 18 }, (_, i) => cast(stage, i % 3 === 0 ? 'viking' : i % 3 === 1 ? 'legionary' : 'mongol', `Soldier ${i}`).place(-42 - (i % 6) * 1.6, -8 + Math.floor(i / 6) * 4, Math.PI / 2));
    const meName = son === 'marcus' ? 'Marcus' : 'Lucius';

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'dread',
        sound: 'wind',
        shot: { from: [-48, 9, 18], at: [FORT.wallX, 4, 0], to: [-44, 7, 14], fov: FOV.wide },
        narrate: 'On the road into Greece, a fort barred the way. A gate that had never fallen, they said.',
      },
      {
        shot: () => portrait(rufus, { angle: 0.4, distance: 2.4 }),
        run: () => rufus.setMood('neutral').lookAt({ x: FORT.wallX, y: 6, z: 0 }),
        say: { who: 'Rufus', text: 'Never fallen? Wonderful. I love being the first at things.', mood: 'neutral' },
      },
      {
        shot: () => portrait(me, { angle: 0.3, distance: 2.2 }),
        run: () => me.setPose('point').setMood('angry'),
        say: { who: meName, text: 'The ram to the gate! Ladders on the walls! When the gate goes, everyone through it!', mood: 'shout' },
      },
      {
        duration: 5,
        sound: 'crowd',
        shot: { from: [-26, 3, 12], at: [-20, 1.6, 0], fov: FOV.wide },
        during: (_s, p) => {
          ram.position.x = -30 + p * 12.6;
          pushers.forEach((m, i) => m.place(-32 + (i % 3) * 1.4 + p * 12.6, i < 3 ? -1.4 : 1.4, Math.PI / 2));
        },
        narrate: 'Under a roof of hides, they rolled the ram up to the gate while arrows rained on it.',
      },
      {
        duration: 5,
        shot: { from: [-26, 5, -22], at: [FORT.wallX, 3.5, -11], fov: FOV.wide },
        during: (_s, p) => {
          for (const l of ladders) l.rotation.z = -1.5 + Math.min(1, p * 1.6) * 1.18;
          climbers.forEach((c, i) => {
            const up = Math.max(0, p * 1.6 - 0.7) * (FORT.height - 0.5);
            c.root.position.y = up;
            c.root.position.x = FORT.wallX - 3.6 + up * 0.28;
            if (p > 0.85 && i % 2 === 0) archers[i]?.setPose('lie');
          });
        },
        narrate: 'Up went the ladders. Up went the Vikings, first of all, axes in their teeth.',
      },
      {
        duration: 4,
        sound: 'thunder',
        shot: { from: [FORT.wallX - 9, 3, 6], at: [FORT.wallX - 1, 2.4, 0], fov: FOV.normal },
        during: (_s, p) => {
          const blow = Math.max(0, Math.sin(p * Math.PI * 6));
          ram.position.x = -17.4 - blow * 1.2;
          doors.forEach((d, i) => (d.rotation.y = (i === 0 ? 1 : -1) * blow * 0.08));
        },
        narrate: 'Boom. Boom. BOOM.',
      },
      {
        duration: 4,
        sound: 'horn',
        shot: { from: [FORT.wallX - 14, 4, 8], at: [FORT.wallX, 2, 0], fov: FOV.wide },
        run: () => {
          doors.forEach((d, i) => (d.rotation.y = (i === 0 ? 1 : -1) * 1.7));
          for (const s of [...army, me, sigurd]) s.setPose('raiseSword').setMood('shout');
          for (const s of army) s.walkTo(FORT.wallX - 6, s.root.position.z * 0.3, 5);
        },
        say: { who: meName, text: 'The gate is down! THROUGH! THROUGH!', mood: 'shout' },
        fade: { to: 1, time: 3.4 },
      },
    ];
  },
};

/** After the feast: the wizard on the temple steps, and the Greek dead getting up again. */
export const wizardReturns: Cutscene = {
  id: 'wizard-returns',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('night');
    greekFeastSquare(stage);
    const son = sonOf(story);
    const me = castSon(stage, story, 0, 8, Math.PI);
    const sigurd = cast(stage, 'sigurd', 'Sigurd').place(-2, 9, Math.PI);
    const rufus = cast(stage, 'rufusOld', 'Rufus').place(2, 9.2, Math.PI);
    const wizard = cast(stage, 'wizard', 'The Wizard').place(0, -18, 0);
    const staff = stage.group('staff', 0, 0, 0);
    stage.world.parts.part('box', '#3A2A1E', staff, [0.08, 2.2, 0.08], [0, 0.4, 0]);
    stage.world.parts.part('sphere', '#7AF0C8', staff, [0.3, 0.3, 0.3], [0, 1.55, 0], { glow: true });
    staff.parent = wizard.grips[0];
    const dead = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      const d = cast(stage, 'risen', `Risen ${i}`).place(Math.sin(a) * (3 + (i % 3)), -2 + Math.cos(a) * (3 + (i % 3)), a + Math.PI).setPose('lie', true);
      d.eyesClosed = true;
      return d;
    });
    const meName = son === 'marcus' ? 'Marcus' : 'Lucius';
    const east = son === 'marcus' ? cast(stage, 'luciusBare', 'Lucius').place(3.6, 8.4, Math.PI) : cast(stage, 'khan', 'Toghan', { helmet: false }).place(3.6, 8.4, Math.PI);
    // A ring of green fire on the temple steps, unlit until he comes.
    const ring = stage.group('witch-ring', 0, 0.05, -18);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      stage.world.parts.part('box', '#7AF0C8', ring, [0.3, 0.6, 0.3], [Math.sin(a) * 2.4, 0.3, Math.cos(a) * 2.4], { glow: true, castShadow: false });
    }
    ring.setEnabled(false);
    // Hands breaking out of the ground between the tables, before the bodies follow.
    const hands = Array.from({ length: 10 }, (_, i) => {
      const hand = stage.keepMoving(stage.box('#7A847A', [0.16, 0.5, 0.16], [-6 + (i * 1.37) % 12, -0.4, -6 + (i * 2.3) % 10]));
      hand.rotation.z = (i % 3) * 0.2 - 0.2;
      return hand;
    });

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2 },
        music: 'warm',
        shot: { from: [8, 4, 14], at: [0, 0.6, -2], to: [6, 3, 11], fov: FOV.wide },
        narrate: 'When it was over, the square was full of Greeks who would never drink again. We had won.',
      },
      {
        duration: 3.4,
        shot: () => portrait(sigurd, { angle: 0.4, distance: 2.4 }),
        run: () => sigurd.setMood('happy').setPose('cheer'),
        say: { who: 'Sigurd', text: 'A feast with no one left to eat it. A shame. A great shame. I will try.', mood: 'happy' },
      },
      {
        duration: 3,
        shot: () => portrait(rufus, { angle: -0.4, distance: 2.4 }),
        run: () => rufus.setMood('happy'),
        say: { who: 'Rufus', text: 'Is there any of their wine left? Asking for a friend. The friend is me.', mood: 'happy' },
      },
      {
        duration: 4,
        music: 'dread',
        sound: 'thunder',
        shot: { from: [0, 2.2, -8], at: wizard, fov: FOV.normal },
        run: () => {
          stage.light('deadLight');
          stage.weather('motes');
          ring.setEnabled(true);
          wizard.setPose('cheer').setMood('happy');
          for (const a of [me, sigurd, rufus, east]) a.lookAt(wizard.headPosition()).setMood('afraid');
        },
        narrate: 'Then a green light on the temple steps. The fires went cold, all at once. And a voice we had all hoped never to hear again.',
      },
      {
        shot: () => portrait(east, { angle: -0.3, distance: 2.4 }),
        say: son === 'marcus'
          ? { who: 'Lucius', text: 'Brother. That is your wizard. The one from the hills.', mood: 'afraid' }
          : { who: 'Toghan', text: 'I know him. He rode with Marcus once. Nobody who rode with him slept well again.', mood: 'afraid' },
      },
      {
        shot: () => portrait(wizard, { angle: 0.2, distance: 2.8, rise: -0.2 }),
        say: son === 'marcus'
          ? { who: 'The Wizard', text: 'Marcus. You broke our bargain. You took back what you gave me. Did you think I would forget?', mood: 'happy' }
          : { who: 'The Wizard', text: 'Your brother was my friend, little emperor. The Greeks paid me to be theirs. Gold is gold. The dead are the dead.', mood: 'happy' },
      },
      {
        duration: 6,
        sound: 'thunder',
        shot: { from: [7, 3, 7], at: [0, 0.6, -2], to: [5, 4, 9], fov: FOV.wide },
        run: () => {
          for (const d of dead) {
            d.eyesClosed = false;
            d.setPose('reach').setMood('angry');
          }
        },
        during: (_s, p) => {
          hands.forEach((h, i) => h.position.y = -0.4 + Math.min(1, p * 3 - i * 0.1) * 0.6);
          dead.forEach((d, i) => d.root.position.y = -0.4 + Math.min(1, Math.max(0, p * 2 - 0.4 - i * 0.04)) * 0.4);
        },
        narrate: 'First the hands, out of the stones of the square. Then the rest of them. Every Greek we had killed got up again.',
      },
      {
        shot: () => portrait(wizard, { angle: -0.2, distance: 2.6, rise: -0.2 }),
        say: { who: 'The Wizard', text: 'Only a few. I only need a few. They do not tire, they do not bleed, and they do not stay down. Run, if you like.', mood: 'happy' },
      },
      {
        duration: 3,
        shot: () => portrait(rufus, { angle: -0.4, distance: 2.2 }),
        run: () => rufus.setMood('afraid').setPose('cower'),
        say: { who: 'Rufus', text: 'I take it back about the wine.', mood: 'afraid' },
      },
      {
        shot: () => portrait(me, { angle: 0.3, distance: 2.2, rise: -0.2 }),
        run: () => me.setPose('raiseSword').setMood('shout'),
        say: { who: meName, text: 'Shields! Together, all of you! Hold them!', mood: 'shout' },
        fade: { to: 1, time: 2.4 },
      },
    ];
  },
};

