import { cast } from '../cast.ts';
import type { Beat, Cutscene } from '../script.ts';
import { FOV, overShoulder, portrait } from '../shot.ts';
import type { Stage } from '../stage.ts';
import { STORY_COLORS } from '../storySets.ts';

/** The night before the legion marches north: Cassian finds an excuse to see Livia again. */

const INFIRMARY = {
  wall: '#D8C8A8',
  floor: '#8A7458',
  shelf: '#6A4A2A',
  jars: ['#6AA84F', '#C8423A', '#E3B52B', '#3C7BD0', '#E8E0CC'],
  herbs: '#5E8E3A',
  blanket: '#B86A5A',
  ribbon: '#4A7AC8',
  night: '#1E2A4A',
} as const;

function infirmary(stage: Stage): void {
  stage.box(INFIRMARY.floor, [10, 0.1, 8], [0, -0.05, 0], 0, { castShadow: false });
  stage.box(INFIRMARY.wall, [10, 4, 0.3], [0, 2, -3.5]);
  for (const side of [-1, 1]) stage.box(INFIRMARY.wall, [0.3, 4, 8], [side * 5, 2, 0.5]);
  // A window onto the night city, and the door.
  stage.box(INFIRMARY.night, [1.6, 1.2, 0.05], [2.2, 2.2, -3.32], 0, { castShadow: false });
  stage.box(STORY_COLORS.log, [1.8, 0.12, 0.2], [2.2, 1.55, -3.3]);
  stage.box(STORY_COLORS.log, [1.3, 2.3, 0.1], [-4.82, 1.15, 1.5], Math.PI / 2);
  // Shelves of jars and bundles of herbs hanging from the beam.
  for (let row = 0; row < 3; row++) {
    stage.box(INFIRMARY.shelf, [3.4, 0.1, 0.4], [-2.4, 1.2 + row * 0.7, -3.2]);
    for (let i = 0; i < 6; i++) stage.shape('cylinder', INFIRMARY.jars[(i + row) % INFIRMARY.jars.length] ?? STORY_COLORS.tent, [0.12, 0.3, 0.12], [-3.8 + i * 0.55, 1.42 + row * 0.7, -3.2]);
  }
  stage.box(STORY_COLORS.log, [8, 0.2, 0.2], [0, 3.6, -1], 0, { castShadow: false });
  for (let i = 0; i < 7; i++) stage.box(INFIRMARY.herbs, [0.2, 0.5, 0.2], [-3 + i, 3.25, -1], 0, { castShadow: false });
  // The table with a lamp, a bowl and bandages; a cot with a blanket.
  stage.box(STORY_COLORS.log, [2.2, 0.1, 1.2], [0, 0.85, 0]);
  for (const [x, z] of [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]] as const) stage.box(STORY_COLORS.log, [0.1, 0.85, 0.1], [x, 0.42, z]);
  stage.shape('cylinder', '#8A7A6A', [0.2, 0.12, 0.2], [0.5, 0.96, 0.1]);
  stage.box('#F4F0E6', [0.3, 0.08, 0.2], [-0.4, 0.94, 0.2]);
  stage.box('#B8903A', [0.14, 0.3, 0.14], [-0.8, 1.05, -0.3]);
  stage.fire(-0.8, -0.3, 0.12, 1.25);
  stage.box(STORY_COLORS.log, [1, 0.4, 2.2], [3.6, 0.2, -1.6]);
  stage.box(INFIRMARY.blanket, [1, 0.1, 1.6], [3.6, 0.45, -1.3]);
}

export const liviaEvening: Cutscene = {
  id: 'livia-evening',
  create(stage: Stage): Beat[] {
    stage.light('interior');
    infirmary(stage);
    const livia = cast(stage, 'livia', 'Livia').place(0.6, -1.2, 0);
    const cassian = cast(stage, 'cassianCommander', 'Cassian').place(-4, 1.5, Math.PI / 2);
    const rufus = cast(stage, 'rufusLegion', 'Rufus').place(-6, 1.5, Math.PI / 2);
    const felix = cast(stage, 'felixLegion', 'Felix').place(-6.5, 2.4, Math.PI / 2);
    for (const a of [rufus, felix]) a.root.setEnabled(false);
    const ribbon = stage.group('ribbon', 0.4, 0.92, 0.3);
    stage.world.parts.part('box', INFIRMARY.ribbon, ribbon, [0.5, 0.03, 0.06], [0, 0, 0], { castShadow: false });

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 2 },
        music: 'warm',
        shot: { from: [2.6, 2.2, 3.4], at: [-1, 1.2, 0.5], fov: FOV.normal },
        run: () => cassian.walkTo(-0.8, 1.0, 1.0),
        narrate: 'The night before we marched north, I found an excuse to bleed again.',
      },
      {
        shot: () => overShoulder(livia, cassian),
        run: () => {
          cassian.place(-0.8, 1.0, Math.atan2(1.4, -2.2));
          livia.lookAt(cassian.headPosition()).setMood('happy');
        },
        say: { who: 'Livia', text: 'You again. Where is it this time, hero?', mood: 'happy' },
      },
      {
        shot: () => portrait(cassian, { angle: 0.4, distance: 2.0 }),
        run: () => cassian.setPose('offer').setMood('warm').lookAt(livia.headPosition()),
        say: { who: 'Cassian', text: 'Here. On my thumb. It is... quite deep.', mood: 'warm' },
      },
      {
        shot: () => overShoulder(livia, cassian, { push: 0.3 }),
        run: () => livia.setPose('carve'),
        say: { who: 'Livia', text: 'That is not a wound. A cat would be ashamed of that.', mood: 'happy' },
      },
      {
        shot: () => overShoulder(cassian, livia, { side: -1 }),
        say: { who: 'Cassian', text: 'It was a very big cat.', mood: 'happy' },
      },
      {
        duration: 3,
        shot: () => portrait(livia, { angle: -0.3, distance: 1.9 }),
        run: () => livia.setMood('happy').setPose('clutch'),
        narrate: 'She laughed. I had walked through fire and ice, and that laugh undid me.',
      },
      {
        shot: () => portrait(livia, { angle: -0.2, distance: 1.8, push: 0.2 }),
        run: () => livia.setPose('stand').setMood('sad'),
        say: { who: 'Livia', text: 'My father marched north too, with the Ninth. He promised he would come back.', mood: 'sad' },
      },
      {
        shot: () => portrait(cassian, { angle: 0.3, distance: 1.8 }),
        run: () => cassian.setPose('stand').setMood('neutral'),
        say: { who: 'Cassian', text: 'The men who raised me used to say every road leads home, if you walk it long enough.', mood: 'warm' },
      },
      {
        shot: () => overShoulder(livia, cassian),
        say: { who: 'Livia', text: 'Then walk it back to me.', mood: 'warm' },
      },
      {
        duration: 4,
        shot: { from: [1.2, 1.7, 2.8], at: [-0.1, 1.1, 0], fov: FOV.normal },
        run: () => {
          ribbon.parent = cassian.grips[0];
          ribbon.position.set(0, 0.15, 0);
          livia.setPose('reach').setMood('warm');
          cassian.setMood('warm');
        },
        narrate: 'She tied a blue ribbon round my wrist. So I would remember what I was coming back for.',
      },
      {
        duration: 2.6,
        sound: 'door',
        shot: { from: [1.5, 1.8, 2.6], at: [-3.6, 1.3, 1.6], fov: FOV.normal },
        run: () => {
          for (const a of [rufus, felix]) a.root.setEnabled(true);
          rufus.place(-3.6, 1.5, Math.PI / 2).setPose('offer').setMood('crying');
          felix.place(-4.4, 2.3, Math.PI / 2);
          livia.setPose('stand').setMood('surprised').lookAt(rufus.headPosition());
          cassian.setMood('surprised').lookAt(rufus.headPosition());
        },
        say: { who: 'Rufus', text: 'HEALER! I am dying! Look! A SPLINTER!', mood: 'crying' },
      },
      {
        duration: 2.6,
        shot: () => portrait(felix, { angle: 0.4, distance: 2.2 }),
        run: () => felix.setMood('neutral').lookAt(livia.headPosition()),
        say: { who: 'Felix', text: 'He is not dying. Sorry. He saw the light on.', mood: 'neutral' },
      },
      {
        duration: 5,
        shot: { from: [2.6, 2.4, 3.6], at: [-1.6, 1.2, 1], to: [3, 2.8, 4.4], fov: FOV.normal },
        run: () => {
          livia.setPose('cheer').setMood('happy');
          cassian.setMood('happy');
          rufus.setMood('happy');
        },
        narrate: 'I carried a ribbon to war after that. Rufus carried a bandage the size of a loaf.',
        fade: { to: 1, time: 4.5 },
      },
    ];
  },
};
