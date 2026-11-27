import { HAIR, SKIN } from '../config.ts';
import { sword, upright } from '../props.ts';
import type { Beat, Cutscene } from '../script.ts';
import { SET_COLORS } from '../sets.ts';
import { FOV, portrait } from '../shot.ts';
import type { Stage } from '../stage.ts';
import type { ActorLook } from '../actor.ts';

/** The arena: the walk through the dark tunnel before the first fight, and what Varro says after it. */

const TUNNEL = {
  length: 22,
  width: 3.2,
  height: 3.4,
  stone: '#5A5248',
  stoneLight: '#6E6458',
  daylight: '#FFF6E0',
  bars: '#3A3A3E',
} as const;

const CASSIAN: ActorLook = { outfit: 'rags', hair: HAIR.brown, hairStyle: 'long', beard: 'long', beardColor: HAIR.brown };
const VARRO: ActorLook = { outfit: 'smith', skin: SKIN.tan, hair: HAIR.grey, hairStyle: 'short', beard: 'short', beardColor: HAIR.grey, scar: true };

function buildTunnel(stage: Stage): { gate: ReturnType<Stage['group']> } {
  const { length, width, height } = TUNNEL;
  stage.box(TUNNEL.stone, [width + 2, 0.1, length + 6], [0, -0.05, -length / 2], 0, { castShadow: false });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const z = -i * (length / 8) - 1;
      stage.box(i % 2 === 0 ? TUNNEL.stone : TUNNEL.stoneLight, [0.8, height, length / 8 + 0.02], [side * (width / 2 + 0.4), height / 2, z - length / 16]);
    }
    for (const z of [-4, -12]) stage.fire(side * (width / 2 - 0.1), z, 0.25, 2.0);
  }
  stage.box(TUNNEL.stone, [width + 2, 0.6, length + 2], [0, height + 0.3, -length / 2]);
  // Sunlight at the end of the tunnel: a glowing wall the gate rises in front of.
  stage.box(TUNNEL.daylight, [width, height, 0.2], [0, height / 2, -length - 0.4], 0, { castShadow: false, glow: true });
  const gate = stage.group('gate', 0, 0, -length);
  for (let i = 0; i < 7; i++) stage.world.parts.part('box', TUNNEL.bars, gate, [0.1, height, 0.1], [-width / 2 + 0.25 + i * 0.45, height / 2, 0], { metal: true });
  for (const y of [0.6, 2.2]) stage.world.parts.part('box', TUNNEL.bars, gate, [width, 0.12, 0.12], [0, y, 0], { metal: true });
  return { gate };
}

export const arenaTunnel: Cutscene = {
  id: 'arena-tunnel',
  create(stage: Stage): Beat[] {
    stage.light('interior');
    const { gate } = buildTunnel(stage);
    stage.weather('ash');
    const cassian = stage.actor('Cassian', CASSIAN);
    cassian.voice = { pitch: 175, rate: 0.12 };
    cassian.place(0.5, 0, Math.PI);
    upright(sword(stage.world.parts, cassian.grips[0])).rotation.x = Math.PI * 0.6;
    const varro = stage.actor('Varro', VARRO);
    varro.voice = { pitch: 118, rate: 0.14 };
    varro.place(-0.6, 0.4, Math.PI);
    cassian.settle();
    varro.settle();

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2.5 },
        music: 'dread',
        sound: 'crowd',
        shot: { from: [0.2, 1.6, 3.5], at: [0, 1.4, -TUNNEL.length], to: [0.2, 1.5, 1.5], fov: FOV.normal },
        run: () => {
          cassian.walkTo(0.5, -7, 1.1);
          varro.walkTo(-0.6, -6.6, 1.1);
        },
        narrate: 'They gave me a sword that had already killed its last owner.',
      },
      {
        shot: () => portrait(varro, { angle: 0.5, distance: 2.4 }),
        run: () => {
          varro.place(-0.6, -6.6, Math.PI);
          cassian.place(0.5, -7, Math.PI);
          varro.lookAt(cassian.headPosition());
        },
        say: { who: 'Varro', text: 'Keep your feet under you. Let them come to you. Most of them will run at you like bulls.', mood: 'warm' },
      },
      {
        shot: () => portrait(cassian, { angle: -0.4, distance: 2.4 }),
        run: () => cassian.setPose('fist').setMood('afraid'),
        narrate: 'I had prayed every day for years. That morning, I did not know who to pray to.',
      },
      {
        duration: 2.6,
        sound: 'heartbeat',
        shot: () => portrait(cassian, { angle: -0.2, distance: 1.9, fov: FOV.extreme, push: 0.3 }),
        run: () => {
          cassian.trembling = true;
          cassian.setMood('angry');
        },
      },
      {
        duration: 5,
        sound: 'horn',
        shot: { from: [0, 1.0, -TUNNEL.length + 4], at: [0.3, 1.5, -7], fov: FOV.normal },
        run: () => {
          cassian.trembling = false;
          cassian.setPose('stand');
          cassian.walkTo(0.4, -TUNNEL.length + 2, 1.4);
        },
        during: (_stage, progress) => {
          gate.position.y = Math.min(1, progress * 1.4) * TUNNEL.height;
        },
        fade: { to: 1, color: 'white', time: 4.5 },
      },
    ];
  },
};

export const arenaWon: Cutscene = {
  id: 'arena-won',
  create(stage: Stage): Beat[] {
    stage.light('city');
    stage.ground('#A88A5A', 60);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const wall = stage.box('#C8BCA6', [6, 3.4, 1.4], [Math.sin(a) * 12, 1.7, Math.cos(a) * 12]);
      wall.rotation.y = a;
      for (let k = 0; k < 4; k++) {
        stage.box(['#C8423A', '#3C7BD0', '#E3B52B', '#E8E0CC'][k] ?? '#E8E0CC', [0.5, 0.6, 0.4], [Math.sin(a) * 13.2 + Math.cos(a) * (k - 1.5) * 1.2, 3.7, Math.cos(a) * 13.2 - Math.sin(a) * (k - 1.5) * 1.2]);
      }
    }
    stage.box(SET_COLORS.dirt, [1.2, 0.3, 0.6], [2.2, 0.15, -1.4]);
    const cassian = stage.actor('Cassian', CASSIAN);
    cassian.voice = { pitch: 175, rate: 0.12 };
    cassian.place(0, 0, 0).setPose('raiseSword', true).setMood('shout', true);
    upright(sword(stage.world.parts, cassian.grips[0]));
    const varro = stage.actor('Varro', VARRO);
    varro.voice = { pitch: 118, rate: 0.14 };
    varro.place(-1.6, 9, Math.PI);
    cassian.settle();

    return [
      {
        duration: 4,
        fade: { from: 1, to: 0, color: 'white', time: 1.5 },
        music: 'hope',
        sound: 'crowd',
        shot: { from: [1.5, 0.6, 4.5], at: cassian, to: [0.8, 0.5, 3.2], fov: FOV.normal },
      },
      {
        duration: 5,
        shot: { from: [4, 1.6, 2], at: [-0.8, 1.4, 4], fov: FOV.normal },
        run: () => {
          cassian.setPose('slump').setMood('neutral');
          varro.walkTo(-0.6, 1.4, 1.3);
          cassian.faceTowards(-0.6, 1.4);
        },
      },
      {
        shot: () => portrait(varro, { angle: 0.4 }),
        run: () => {
          varro.place(-0.6, 1.4, Math.PI);
          varro.lookAt(cassian.headPosition()).setMood('happy');
        },
        say: { who: 'Varro', text: 'Not bad. Not bad at all, for a monk.', mood: 'happy' },
      },
      {
        shot: () => portrait(cassian, { angle: -0.4 }),
        run: () => cassian.setPose('stand').lookAt(varro.headPosition()),
        say: { who: 'Cassian', text: 'How did you know?', mood: 'surprised' },
      },
      {
        shot: () => portrait(varro, { angle: 0.4, push: 0.3 }),
        say: { who: 'Varro', text: 'You prayed before every swing. Under your breath. I have good ears.', mood: 'warm' },
      },
      {
        shot: () => portrait(varro, { angle: 0.2, distance: 2.2 }),
        run: () => varro.setPose('offer'),
        say: { who: 'Varro', text: 'Come and work at my forge. I need strong arms, and you need a roof over your head.', mood: 'warm' },
      },
      {
        duration: 3,
        shot: () => portrait(cassian, { angle: -0.3, distance: 2.2 }),
        run: () => cassian.setPose('offer').setMood('warm'),
      },
      {
        duration: 4.5,
        shot: { from: [3.5, 2.5, 5], at: [-0.3, 1.2, 0.7], to: [6, 6, 10], fov: FOV.normal },
        narrate: 'He did not know it yet, and neither did I. But that day I found a father.',
        fade: { to: 1, time: 4 },
      },
    ];
  },
};
