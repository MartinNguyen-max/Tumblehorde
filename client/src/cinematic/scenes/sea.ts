import { CAPITAL, fortifiedDecor, RUFUS_STATUE } from '../../campaign/districts.ts';
import type { TransformNode } from '../../render/babylon.ts';
import { buildLongship, buildSea, LONGSHIP_LOOK } from '../../render/longship.ts';
import { addAxe } from '../../render/viking.ts';
import type { Actor } from '../actor.ts';
import { cast } from '../cast.ts';
import { sword, upright } from '../props.ts';
import type { Beat, Cutscene, StoryContext } from '../script.ts';
import { FOV, overShoulder, portrait } from '../shot.ts';
import type { Stage } from '../stage.ts';
import { castSon, greekCityFar, ringCrowd, sonOf } from './greece.ts';

/**
 * The end of the last road: the flight to the sea with the dead behind, the council on the deck,
 * the wizard's fall (and Rufus's), and the homecoming to a frightened city that builds its walls.
 */

const SAND = '#D8C49A';
/** In the beach scene the sea stands this high over the sand, so men wade in it to the knee. */
const WATER = 0.5;
/** The ship's deck over the sand when it floats at the beach. */
const DECK = WATER - LONGSHIP_LOOK.seaLevel;
/** Where the ship lies off the beach, and how far it pulls away. */
const MOORING = { z: 34, away: 10 } as const;
/** How far out of the water a swimmer's body sits (only the head shows). */
const SWIM_DEPTH = -1.2;
/** The council on the deck: a ring of five, aft of the mast. */
const COUNCIL = { x: -5, z: 0, radius: 3.4 } as const;
/** The last of the fight with the wizard, forward of the mast, where nothing stands in the way. */
const FALL_X = 8;
/** Looking down at Rufus on the deck, the son kneeling over him. */
const FALLEN_SHOT = { from: [FALL_X - 4, 2.6, 3.2], at: [FALL_X - 1.5, 0.3, 0.2], fov: FOV.normal } as const;
const RUFUS_CLOSE = { from: [FALL_X - 3.3, 1.3, 0.9], at: [FALL_X - 1.4, 0.3, 0.2], fov: FOV.close } as const;

/** The East: Toghan for Lucius, Lucius himself for Marcus. */
function castEast(stage: Stage, story: StoryContext, x: number, z: number, yaw: number, y = 0): Actor {
  return sonOf(story) === 'marcus' ? cast(stage, 'luciusBare', 'Lucius').place(x, z, yaw, y) : cast(stage, 'khan', 'Toghan', { helmet: false }).place(x, z, yaw, y);
}

function armed(stage: Stage, actor: Actor): Actor {
  upright(sword(stage.world.parts, actor.grips[0]));
  return actor;
}

/** A staff with a green stone, in the wizard's hand. */
function giveStaff(stage: Stage, wizard: Actor): TransformNode {
  const staff = stage.group('staff');
  stage.world.parts.part('box', '#3A2A1E', staff, [0.08, 2.2, 0.08], [0, 0.4, 0]);
  stage.world.parts.part('sphere', '#7AF0C8', staff, [0.32, 0.32, 0.32], [0, 1.55, 0], { glow: true });
  staff.parent = wizard.grips[0];
  return staff;
}

/** Far hills across the water, so the sea never ends in a plain sky. */
function farCoast(stage: Stage, z: number): void {
  for (let i = 0; i < 14; i++) {
    const h = 6 + ((i * 37) % 9);
    stage.box(i % 3 === 0 ? '#6A6A5A' : '#5A6A4E', [36, h, 20], [-240 + i * 36, h / 2 - 2, z + ((i * 13) % 20)], 0, { castShadow: false });
  }
}

/** The ship at sea for the scenes on deck: the deck at y = 0, the sea all round, a coast far off. */
function shipAtSea(stage: Stage): void {
  const g = stage.group('ship');
  buildLongship(stage.world.parts, g);
  buildSea(stage.world.parts, g);
  farCoast(stage, -160);
  farCoast(stage, 170);
}

/** The men who hold the ends of the ship, swinging; and the dead who come at them over the rails. */
function shipFight(stage: Stage, story: StoryContext): { ours: Actor[]; dead: Actor[]; climbers: Actor[] } {
  const ours: Actor[] = [];
  const dead: Actor[] = [];
  const climbers: Actor[] = [];
  const east = sonOf(story) === 'marcus' ? 'legionary' : 'mongol';
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const role = i % 2 === 0 ? 'viking' : east;
      const a = cast(stage, role, `Fighter ${dir} ${i}`).place(dir * (17 + (i % 2) * 1.4), -3.4 + Math.floor(i / 2) * 3.4, dir * (Math.PI / 2));
      if (role === 'viking') addAxe(stage.world.parts, a.grips[0], true).rotation.x = Math.PI;
      else armed(stage, a);
      ours.push(a.setMood('shout', true));
    }
    for (let i = 0; i < 5; i++) {
      const d = cast(stage, 'risen', `Dead ${dir} ${i}`).place(dir * (20.5 + (i % 2)), -3.6 + i * 1.8, -dir * (Math.PI / 2));
      dead.push(d.setPose('reach', true).setMood('angry', true));
    }
    for (let i = 0; i < 3; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const c = cast(stage, 'risen', `Climber ${dir} ${i}`).place(dir * (12 + i * 3), side * (LONGSHIP_LOOK.halfWidth + 0.5), side > 0 ? Math.PI : 0, -1);
      climbers.push(c.setPose('reach', true).setMood('angry', true));
    }
  }
  stage.animate((_dt, t) => {
    ours.forEach((a, i) => a.setPose(Math.sin(t * 3 + i * 1.3) > 0 ? 'punch' : 'raiseSword'));
    dead.forEach((d, i) => d.setPose(Math.sin(t * 2.4 + i) > 0.2 ? 'punch' : 'reach'));
    climbers.forEach((c, i) => c.root.position.y = -1.6 + Math.abs(Math.sin(t * 1.2 + i)) * 1.8);
  });
  return { ours, dead, climbers };
}

export const theFlight: Cutscene = {
  id: 'the-flight',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('dusk');
    stage.ground(SAND, 220, 'none');
    stage.box(LONGSHIP_LOOK.sea, [600, 0.1, 300], [0, WATER - 0.05, 20 + 150], 0, { castShadow: false });
    stage.box(LONGSHIP_LOOK.foam, [600, 0.06, 1.2], [0, WATER, 20.4], 0, { castShadow: false });
    farCoast(stage, 210);
    greekCityFar(stage);
    // Dunes and grass between the city and the sea.
    for (let i = 0; i < 16; i++) stage.box(i % 2 === 0 ? '#C8B488' : '#B8A878', [8, 1 + (i % 3) * 0.6, 4], [-70 + i * 9, 0.4, -18 - (i % 4) * 2], i * 0.3, { castShadow: false });
    const ship = stage.group('ship', 0, DECK, MOORING.z);
    buildLongship(stage.world.parts, ship);
    const meName = sonOf(story) === 'marcus' ? 'Marcus' : 'Lucius';
    const eastName = sonOf(story) === 'marcus' ? 'Lucius' : 'Toghan';
    const me = armed(stage, castSon(stage, story, -2, -12, 0));
    const sigurd = cast(stage, 'sigurd', 'Sigurd').place(3, 14, Math.PI);
    addAxe(stage.world.parts, sigurd.grips[0], true).rotation.x = Math.PI;
    const east = castEast(stage, story, 1, -14, 0);
    const rufus = cast(stage, 'rufusOld', 'Rufus').place(-4, -16, 0);
    const felix = cast(stage, 'felixOld', 'Felix').place(-1.6, MOORING.z - 3.6, Math.PI, DECK);
    const eastRole = sonOf(story) === 'marcus' ? 'legionary' : 'mongol';
    const runners = Array.from({ length: 14 }, (_, i) => cast(stage, i % 2 === 0 ? 'viking' : eastRole, `Runner ${i}`).place(-12 + (i % 7) * 3.6, -10 - Math.floor(i / 7) * 4, 0));
    const dead = Array.from({ length: 10 }, (_, i) => cast(stage, 'risen', `Dead ${i}`).place(-10 + i * 2.2, -30 - (i % 3) * 2, 0).setPose('reach', true).setMood('angry', true));
    const wizard = cast(stage, 'wizard', 'The Wizard').place(LONGSHIP_LOOK.halfLength + 5, MOORING.z + MOORING.away, -Math.PI / 2, DECK + 3.2);
    giveStaff(stage, wizard);
    wizard.root.setEnabled(false);
    const fleeing = [me, east, rufus, ...runners];
    const aboard = [me, east, rufus, felix, sigurd, ...runners];
    /** Everyone on the ship gets a spot on the deck, along the side facing the beach. */
    const deckSpot = (i: number): { x: number; z: number } => ({ x: -14 + (i % 10) * 3, z: MOORING.z - 3.8 + Math.floor(i / 10) * 2 });
    const sail = (p: number): void => {
      const z = MOORING.z + p * MOORING.away;
      ship.position.z = z;
      aboard.forEach((a, i) => {
        const spot = deckSpot(i);
        a.place(spot.x, spot.z + p * MOORING.away, Math.PI, DECK);
      });
    };

    return [
      {
        duration: 6,
        fade: { from: 1, to: 0, time: 2.4 },
        music: 'dread',
        shot: { from: [16, 4, 26], at: [0, 1, -8], to: [12, 3.4, 22], fov: FOV.wide },
        run: () => {
          for (const r of fleeing) r.setMood('afraid').walkTo(r.root.position.x * 0.6, 16 + (r.root.position.x % 3), 5);
          for (const d of dead) d.walkTo(d.root.position.x, -6, 2.2);
        },
        narrate: 'They did not bleed. They did not tire. We cut them down and they stood up again, and the ones who stood up a second time were worse.',
      },
      {
        shot: () => portrait(sigurd, { angle: 0.3, distance: 2.6 }),
        run: () => sigurd.setPose('point').setMood('shout'),
        say: { who: 'Sigurd', text: 'The ship! Everyone to the ship! The dead are slow in water, I swear it on my father\'s axes!', mood: 'shout' },
      },
      {
        duration: 5,
        sound: 'screams',
        shot: { from: [-26, 3, 6], at: [0, 1, 2], to: [-24, 2.6, 9], fov: FOV.wide },
        run: () => {
          for (const r of fleeing) r.finishWalk();
          for (const d of dead) d.walkTo(d.root.position.x * 0.8, 12, 2.4);
        },
        narrate: 'We had marched south with three armies. We ran for the sea with what would fit on one ship.',
      },
      {
        duration: 4,
        shot: () => portrait(rufus, { angle: 1.2, distance: 2.6 }),
        run: () => {
          rufus.place(-1.5, 27.2, 0).setMood('afraid');
          for (const [i, r] of [me, east, ...runners].entries()) r.place(-12 + (i % 8) * 3, 23 + Math.floor(i / 8) * 1.6, 0).walkTo(-12 + (i % 8) * 3, 26, 2);
        },
        say: { who: 'Rufus', text: 'Wet feet! At my age! Felix, if I die of a cold, you tell them it was a sword.', mood: 'afraid' },
      },
      {
        duration: 2.6,
        shot: () => portrait(felix, { angle: -0.3, distance: 2.4, rise: -0.3 }),
        run: () => felix.setPose('reach').setMood('afraid'),
        say: { who: 'Felix', text: 'Climb, Rufus.', mood: 'afraid' },
      },
      {
        duration: 6,
        sound: 'wind',
        shot: { from: [-4, 3.4, 8], at: [0, 1.6, 30], to: [-2, 3, 10], fov: FOV.wide },
        run: () => {
          dead.forEach((d, i) => d.place(-9 + i * 2, 16 + (i % 3), 0).walkTo(-9 + i * 2, 27, 2.2));
        },
        during: (_s, p) => {
          sail(p);
          // Into the sea they go, deeper and deeper, until only the heads show.
          for (const d of dead) d.root.position.y = d.root.position.z > 20 ? Math.max(SWIM_DEPTH, -(d.root.position.z - 20) * 0.25) : 0;
        },
        narrate: 'The ship pulled away. And on the beach the dead did not stop at the water. They walked into it.',
      },
      {
        shot: () => portrait(rufus, { angle: 0.5, distance: 2.6 }),
        run: () => {
          sail(1);
          rufus.setPose('point').setMood('afraid');
        },
        say: { who: 'Rufus', text: 'Can they swim? Tell me they cannot swim.', mood: 'afraid' },
      },
      {
        shot: () => portrait(east, { angle: -0.4, distance: 2.6 }),
        run: () => east.setMood('afraid'),
        say: { who: eastName, text: 'They do not swim. They walk. Along the bottom of the sea.', mood: 'afraid' },
      },
      {
        duration: 5,
        sound: 'clash',
        shot: { from: [6, 1.4, MOORING.z + MOORING.away - 13], at: [-2, DECK, MOORING.z + MOORING.away - 4], fov: FOV.wide, shake: 0.05 },
        run: () => {
          dead.forEach((d, i) => d.place(-12 + i * 2.6, MOORING.z + MOORING.away - LONGSHIP_LOOK.halfWidth - 1, 0, SWIM_DEPTH));
          for (const r of runners) r.setPose('raiseSword').setMood('shout');
        },
        during: (_s, p) => dead.forEach((d, i) => {
          // Up the hull, over the rail, onto the deck.
          const k = Math.min(1, Math.max(0, p * 1.6 - i * 0.06));
          d.root.position.y = SWIM_DEPTH + k * (DECK - SWIM_DEPTH);
          d.root.position.z = MOORING.z + MOORING.away - LONGSHIP_LOOK.halfWidth - 1 + k * 2.6;
        }),
        narrate: 'They came up the oars. Up the anchor rope. Up the shields on the rail. Grey hands on every side of the ship.',
      },
      {
        duration: 4.5,
        music: 'dread',
        sound: 'thunder',
        shot: { from: [19, DECK + 4, MOORING.z + MOORING.away + 7], at: wizard, fov: FOV.normal, shake: 0.08 },
        run: () => {
          stage.light('deadLight');
          stage.weather('motes');
          wizard.root.setEnabled(true);
          wizard.setPose('cheer').setMood('happy');
          for (const a of aboard) a.lookAt(wizard.headPosition()).setMood('afraid');
        },
        narrate: 'And there on the dragon\'s head, with the green light burning in his hand, stood the one who had woken them.',
      },
      {
        shot: () => portrait(wizard, { angle: -0.3, distance: 3, rise: -0.3 }),
        say: { who: 'The Wizard', text: `Run, ${meName}. Run across the whole sea. Every sailor who ever drowned in it is mine.`, mood: 'happy' },
      },
      { duration: 2.4, fade: { to: 1, time: 2.2 } },
    ];
  },
};

export const shipCouncil: Cutscene = {
  id: 'ship-council',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('dusk');
    stage.weather('motes');
    shipAtSea(stage);
    shipFight(stage, story);
    const meName = sonOf(story) === 'marcus' ? 'Marcus' : 'Lucius';
    const eastName = sonOf(story) === 'marcus' ? 'Lucius' : 'Toghan';
    // In a wide ring behind the mast, so no one stands in front of anyone's face.
    const seat = (k: number): [number, number, number] => {
      const a = Math.PI / 2 + (k * Math.PI * 2) / 5;
      return [COUNCIL.x + Math.sin(a) * COUNCIL.radius, COUNCIL.z + Math.cos(a) * COUNCIL.radius, a + Math.PI];
    };
    const me = armed(stage, castSon(stage, story, ...seat(0)));
    const east = castEast(stage, story, ...seat(1));
    const sigurd = cast(stage, 'sigurd', 'Sigurd').place(...seat(2));
    addAxe(stage.world.parts, sigurd.grips[0], true).rotation.x = Math.PI;
    const felix = armed(stage, cast(stage, 'felixOld', 'Felix').place(...seat(3)));
    const rufus = armed(stage, cast(stage, 'rufusOld', 'Rufus').place(...seat(4)));
    const wizard = cast(stage, 'wizard', 'The Wizard').place(LONGSHIP_LOOK.halfLength + 5, 0, -Math.PI / 2, 3.2);
    giveStaff(stage, wizard);
    const council = [me, sigurd, east, rufus, felix];
    for (const a of council) a.setMood('afraid', true);

    return [
      {
        duration: 5.5,
        fade: { from: 1, to: 0, time: 1.6 },
        music: 'dread',
        sound: 'clash',
        shot: { from: [-14, 6, 12], at: [COUNCIL.x, 1, COUNCIL.z], to: [-12, 5, 10], fov: FOV.wide },
        narrate: 'There was no time for a council. We had one anyway, shouting, with our backs against the mast.',
      },
      {
        shot: () => portrait(east, { angle: 0.4, distance: 2.4 }),
        run: () => east.setPose('point').setMood('afraid'),
        say: sonOf(story) === 'marcus'
          ? { who: eastName, text: 'Brother, there are too many! You cannot kill what is already dead!', mood: 'afraid' }
          : { who: eastName, text: 'There are too many, Caesar! My riders cannot fight on a boat, and you cannot kill what is already dead!', mood: 'afraid' },
      },
      {
        shot: () => portrait(sigurd, { angle: -0.3, distance: 2.4 }),
        run: () => sigurd.setPose('point').setMood('angry').lookAt(wizard.headPosition()),
        say: { who: 'Sigurd', text: 'Then do not kill the dead. Kill the one who woke them.', mood: 'angry' },
      },
      {
        duration: 3.4,
        shot: { from: [10, 4, 6], at: wizard, fov: FOV.normal },
        run: () => wizard.setPose('cheer').setMood('happy'),
      },
      {
        shot: () => portrait(me, { angle: 0.3, distance: 2.2 }),
        run: () => me.setPose('raiseSword').setMood('angry'),
        say: { who: meName, text: 'Hold them at both ends, bow and stern. Give me a road down the middle of the ship, and I will go to him.', mood: 'angry' },
      },
      {
        shot: () => portrait(sigurd, { angle: -0.4, distance: 2.4 }),
        run: () => sigurd.setMood('happy'),
        say: { who: 'Sigurd', text: 'A road of shields. Ha! My father would have liked you.', mood: 'happy' },
      },
      {
        shot: () => portrait(rufus, { angle: 0.4, distance: 2.4 }),
        run: () => rufus.setPose('fist').setMood('neutral'),
        say: { who: 'Rufus', text: 'Two. Two go. You, and me.', mood: 'neutral' },
      },
      {
        shot: () => overShoulder(me, rufus),
        run: () => me.setMood('surprised'),
        say: { who: meName, text: 'Rufus, you are seventy years old.', mood: 'surprised' },
      },
      {
        shot: () => portrait(rufus, { angle: 0.3, distance: 2.2 }),
        run: () => rufus.setMood('happy'),
        say: { who: 'Rufus', text: 'Seventy-one. He will look at the old man first, and then you stick him. That is the plan. It is a good plan. Felix, tell him it is a good plan.', mood: 'happy' },
      },
      {
        duration: 2.6,
        shot: () => portrait(felix, { angle: -0.3, distance: 2.2 }),
        run: () => felix.lookAt(rufus.headPosition()).setMood('sad'),
      },
      {
        shot: () => portrait(felix, { angle: -0.3, distance: 2.0 }),
        say: { who: 'Felix', text: 'It is a terrible plan. ... Go. I will hold the stern.', mood: 'sad' },
      },
      {
        duration: 5,
        sound: 'horn',
        shot: { from: [-11, 2.6, 0], at: [14, 1.6, 0], fov: FOV.normal },
        run: () => {
          sigurd.setPose('raiseSword').setMood('shout').walkTo(15, 2.6, 4);
          east.setPose('raiseSword').setMood('shout').walkTo(15, -2.6, 4);
          felix.setPose('raiseSword').setMood('shout').walkTo(-15, 2, 4);
          me.lookAt(null).turnTo(Math.PI / 2);
          rufus.lookAt(null).turnTo(Math.PI / 2);
        },
        say: { who: 'Sigurd', text: 'Shields! Bow and stern! Make them a road!', mood: 'shout' },
      },
      {
        duration: 4,
        sound: 'thunder',
        shot: { from: [4, 1.8, -3], at: [12, 1.6, 0], fov: FOV.normal },
        run: () => {
          for (const a of [sigurd, east, felix]) a.finishWalk();
          wizard.place(12, 0, -Math.PI / 2).setPose('stand').setMood('happy');
        },
        during: (_s, p) => wizard.root.position.y = Math.max(0, 3.2 * (1 - p * 2)),
      },
      {
        shot: () => portrait(wizard, { angle: -0.3, distance: 2.6, rise: -0.2 }),
        say: { who: 'The Wizard', text: 'Two? An emperor and an old fool. Come, then. I have all the time in the world. You have none.', mood: 'happy' },
      },
      { duration: 2.4, fade: { to: 1, time: 2.2 } },
    ];
  },
};

export const wizardFalls: Cutscene = {
  id: 'wizard-falls',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('deadLight');
    stage.weather('motes');
    shipAtSea(stage);
    const fight = shipFight(stage, story);
    const meName = sonOf(story) === 'marcus' ? 'Marcus' : 'Lucius';
    const F = FALL_X;
    const me = armed(stage, castSon(stage, story, F - 3.6, -0.6, Math.PI / 2));
    const rufus = armed(stage, cast(stage, 'rufusOld', 'Rufus').place(F - 3.4, 1.6, Math.PI * 0.6));
    const felix = cast(stage, 'felixOld', 'Felix').place(-15, 0, Math.PI / 2);
    const wizard = cast(stage, 'wizard', 'The Wizard').place(F, 0, -Math.PI / 2).setStance('kneel', true).setMood('angry', true);
    giveStaff(stage, wizard);
    const allDead = [...fight.dead, ...fight.climbers];
    // The dead in the sea round the ship, swimming for it.
    const swimmers = Array.from({ length: 10 }, (_, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      return cast(stage, 'risen', `Swimmer ${i}`).place(-18 + i * 4, side * (LONGSHIP_LOOK.halfWidth + 4 + (i % 3) * 2), side > 0 ? Math.PI : 0, LONGSHIP_LOOK.seaLevel + SWIM_DEPTH).setPose('reach', true);
    });

    return [
      {
        duration: 5,
        fade: { from: 1, to: 0, time: 1.4 },
        music: 'dread',
        shot: { from: [F - 8, 2.2, 5], at: [F - 1, 1, 0], to: [F - 7, 1.8, 4], fov: FOV.normal },
        narrate: 'He was strong. Stronger than any man. But he could bleed. And he bled.',
      },
      {
        duration: 2.6,
        sound: 'thunder',
        shot: { from: [F + 3, 1.6, 3.4], at: [F - 3, 0.6, 0], fov: FOV.normal, shake: 0.14 },
        run: () => {
          wizard.setStance('pose').setPose('raiseSword').setMood('shout');
          me.place(F - 5.4, -0.4, Math.PI / 2).setPose('lie').setMood('afraid');
        },
      },
      {
        shot: () => portrait(wizard, { angle: 0.4, distance: 2.6, rise: -0.3 }),
        say: { who: 'The Wizard', text: 'Your father died on a road, in the mud. You will die on the water. It is all the same to the dead.', mood: 'angry' },
      },
      {
        duration: 3,
        music: 'silence',
        sound: 'heartbeat',
        shot: { from: [F - 3, 1.6, 4.4], at: [F - 2.4, 1.2, 0], fov: FOV.close },
        run: () => {
          rufus.place(F - 1.4, 0, Math.PI / 2).setPose('clutch').setMood('afraid');
          wizard.setPose('punch');
          rufus.setWounded(true);
        },
      },
      {
        shot: { from: [F - 1.2, 1.6, -4.2], at: [F - 1.2, 1.2, 0], fov: FOV.normal },
        run: () => rufus.setPose('embrace').setMood('shout'),
        say: { who: 'Rufus', text: 'Got you. Got you, you old crow. Now, boy! NOW!', mood: 'shout' },
      },
      {
        duration: 2.4,
        sound: 'clash',
        shot: { from: [F - 2, 1.4, -4], at: [F - 1.6, 1.2, 0], fov: FOV.normal, shake: 0.16 },
        run: () => {
          me.place(F - 2.6, -1.2, Math.PI / 2.4).setPose('punch').setMood('shout');
        },
      },
      {
        duration: 4,
        sound: 'thunder',
        shot: () => portrait(wizard, { angle: 0.6, distance: 2.8, rise: -0.4 }),
        run: () => {
          wizard.setPose('slump').setMood('surprised');
        },
        say: { who: 'The Wizard', text: 'The dead... remember...', mood: 'surprised' },
      },
      {
        duration: 6,
        music: 'sorrow',
        shot: { from: [F - 24, 10, 16], at: [F, 0, 0], to: [F - 18, 12, 20], fov: FOV.wide },
        run: () => {
          stage.light('dusk');
          stage.weather('none');
          wizard.setPose('lie').setMood('sad');
          wizard.eyesClosed = true;
          for (const d of allDead) d.setPose('lie').setMood('sad');
          for (const d of [...allDead, ...swimmers]) d.eyesClosed = true;
          for (const a of fight.ours) a.setPose('stand').setMood('surprised');
        },
        during: (_s, p) => {
          for (const s of swimmers) s.root.position.y = LONGSHIP_LOOK.seaLevel + SWIM_DEPTH - p * 3;
          for (const c of fight.climbers) c.root.position.y = -1.6 - p * 3;
        },
        narrate: 'And every dead man on that ship, and in all that sea, lay down at once, as if someone had cut the strings.',
      },
      {
        duration: 3.4,
        shot: FALLEN_SHOT,
        run: () => {
          rufus.place(F - 1.4, 0.2, Math.PI / 2).setPose('lie').setMood('sad');
          me.place(F - 1.6, -1.2, 0).setStance('kneel').setPose('cradle').setMood('crying');
          felix.walkTo(F + 0.2, 1.5, 6);
        },
      },
      {
        shot: RUFUS_CLOSE,
        run: () => felix.finishWalk(),
        say: { who: 'Rufus', text: 'Why did the Mongol bring a ladder to the feast?', mood: 'happy' },
      },
      {
        shot: () => portrait(me, { angle: 0.3, distance: 2.0 }),
        say: { who: meName, text: 'Why, Rufus?', mood: 'crying' },
      },
      {
        duration: 7,
        shot: RUFUS_CLOSE,
        run: () => rufus.setMood('happy'),
        say: { who: 'Rufus', text: 'I never knew. Forty years, and I never knew the end. Hehe. Make one up. A good one.', mood: 'happy' },
      },
      {
        duration: 4,
        music: 'silence',
        shot: { from: [F - 4.6, 1.6, 3.6], at: [F - 1.6, 0.4, 0.6], fov: FOV.normal },
        run: () => {
          rufus.eyesClosed = true;
          rufus.setMood('neutral');
          felix.setStance('kneel').setPose('cradle').setMood('crying');
        },
      },
      {
        duration: 4,
        shot: () => portrait(felix, { angle: 0.4, distance: 2.0 }),
        say: { who: 'Felix', text: 'It was a terrible joke, Rufus. ... It was the best one I ever heard.', mood: 'crying' },
      },
      {
        duration: 7,
        music: 'sorrow',
        shot: { from: [-40, 6, -18], at: [0, 2, 0], to: [-60, 10, -30], fov: FOV.wide },
        narrate: 'We sailed home with the sun coming up behind us. Nobody rowed, for a long time. Nobody said anything at all.',
      },
      { duration: 2.6, fade: { to: 1, time: 2.4 } },
    ];
  },
};

/** The capital, frightened and quiet: few come home, Rufus on a shield, and then everyone builds. */
export const homecoming: Cutscene = {
  id: 'homecoming',
  create(stage: Stage, story: StoryContext): Beat[] {
    stage.light('grey');
    CAPITAL.build(stage);
    fortifiedDecor(stage);
    const crowd = ringCrowd(stage, 0, 8, 9, 3, 0.05);
    const son = sonOf(story);
    const meName = son === 'marcus' ? 'Marcus' : 'Lucius';
    const me = castSon(stage, story, 0, 30, Math.PI);
    const sigurd = cast(stage, 'sigurd', 'Sigurd').place(-1.6, 31.4, Math.PI);
    const east = castEast(stage, story, 1.6, 31.4, Math.PI);
    const felix = cast(stage, 'felixOld', 'Felix').place(0, 33, Math.PI).setMood('sad', true);
    // Rufus on a shield, carried by four of his old legion.
    const bearers = Array.from({ length: 4 }, (_, i) => cast(stage, 'legionary', `Bearer ${i}`).place(i % 2 === 0 ? -0.7 : 0.7, 35 + Math.floor(i / 2) * 1.8, Math.PI).setPose('offer', true).setMood('sad', true));
    const bier = stage.keepMoving(stage.box('#9A6A3A', [1.4, 0.12, 2.6], [0, 1.25, 35.9]));
    const rufus = cast(stage, 'rufusOld', 'Rufus').place(0, 36.6, Math.PI, 1.0).setPose('lie', true);
    rufus.eyesClosed = true;
    const rest = Array.from({ length: 8 }, (_, i) => cast(stage, i % 2 === 0 ? 'viking' : son === 'marcus' ? 'legionary' : 'mongol', `Survivor ${i}`).place(-1.4 + (i % 4) * 0.9, 39 + Math.floor(i / 4) * 1.6, Math.PI).setPose('slump', true).setMood('sad', true));
    const livia = cast(stage, 'liviaOld', 'Livia').place(-3, 6, 0);
    const woman = cast(stage, 'liviaMother', 'A woman').place(4, 8, -Math.PI * 0.7);
    const marchers = [me, sigurd, east, felix, ...bearers, ...rest];
    // Carrying stones up the north street to the gate.
    const workers = Array.from({ length: 6 }, (_, i) => cast(stage, i % 3 === 0 ? 'viking' : 'villager', `Worker ${i}`).place(i % 2 === 0 ? -1.2 : 1.2, 30 + i * 1.6, 0).setPose('offer', true));

    return [
      {
        duration: 7,
        fade: { from: 1, to: 0, time: 2.4 },
        music: 'sorrow',
        shot: { from: [0, 16, -8], at: [0, 1, 26], to: [0, 12, -2], fov: FOV.wide },
        run: () => {
          for (const a of marchers) a.walkTo(a.root.position.x, a.root.position.z - 18, 1.2);
        },
        during: (_s, p) => {
          // The bier moves with the men carrying it.
          bier.position.z = 35.9 - p * 18;
          rufus.root.position.z = 36.6 - p * 18;
        },
        narrate: 'We came home in the spring. Three armies had marched south. You could count the ones who came back without running out of fingers twice.',
      },
      {
        duration: 4,
        shot: () => portrait(livia, { angle: 0.3, distance: 2.6 }),
        run: () => {
          for (const a of marchers) a.finishWalk();
          bier.position.z = 17.9;
          rufus.root.position.z = 18.6;
          livia.lookAt(rufus.headPosition()).setMood('sad');
        },
      },
      {
        duration: 3.4,
        shot: () => portrait(livia, { angle: 0.3, distance: 2.2 }),
        run: () => felix.lookAt(livia.headPosition()),
        say: { who: 'Livia', text: 'Rufus?', mood: 'sad' },
      },
      {
        duration: 3.6,
        music: 'silence',
        shot: () => portrait(felix, { angle: -0.3, distance: 2.2 }),
        run: () => felix.setMood('crying'),
      },
      {
        duration: 3,
        shot: () => portrait(livia, { angle: 0.3, distance: 2.0 }),
        run: () => livia.setMood('crying').setPose('clutch'),
      },
      {
        shot: () => portrait(me, { angle: 0.2, distance: 2.6, rise: -0.2 }),
        music: 'sorrow',
        run: () => {
          me.place(0, 10.4, Math.PI).setMood('sad');
          crowd.excitement = 0.05;
        },
        say: { who: meName, text: 'People of Rome. We took their fort. We took their city. And then their dead got up and walked.', mood: 'sad' },
      },
      {
        duration: 3.6,
        sound: 'crowd',
        shot: { from: [2, 3, 14], at: [0, 1.4, 4], fov: FOV.wide },
        run: () => {
          crowd.excitement = 0.4;
        },
        narrate: 'Nobody cheered. A mother pulled her children closer. An old man made the sign against evil, twice.',
      },
      {
        shot: () => portrait(me, { angle: 0.3, distance: 2.4 }),
        say: { who: meName, text: 'A wizard raised them. He is dead. Rufus held him with his last breath, so that I could finish it.', mood: 'sad' },
      },
      {
        shot: () => portrait(woman, { angle: 0.4, distance: 2.4 }),
        run: () => woman.setMood('afraid').setPose('clutch'),
        say: { who: 'A woman', text: 'And if there are more of them? If the dead come here?', mood: 'afraid' },
      },
      {
        shot: () => portrait(me, { angle: 0.2, distance: 2.2 }),
        run: () => me.setPose('raiseSword').setMood('angry'),
        say: { who: meName, text: 'Then they will find walls. Higher than any walls in the world. And every one of us standing on them.', mood: 'angry' },
      },
      {
        duration: 6,
        music: 'hope',
        sound: 'chisel',
        shot: { from: [0, 2.4, 24], at: [0, 9, 56], to: [0, 3.4, 28], fov: FOV.wide },
        run: () => {
          stage.light('city');
          for (const w of workers) w.walkTo(w.root.position.x, 44, 1.2);
        },
        narrate: 'So we built. Everyone built. Old men carried stones and children carried water. Every stone has a name scratched on it.',
      },
      {
        shot: () => portrait(sigurd, { angle: 0.3, distance: 2.4 }),
        run: () => {
          for (const w of workers) w.finishWalk();
          sigurd.place(1.2, 40, Math.PI).setPose('point').setMood('happy');
          east.place(-1.2, 39, Math.PI * 0.8);
        },
        say: { who: 'Sigurd', text: 'This wall is straight. Look. Is it not straight?', mood: 'happy' },
      },
      {
        shot: () => portrait(east, { angle: -0.3, distance: 2.4 }),
        run: () => east.setMood('warm'),
        say: { who: son === 'marcus' ? 'Lucius' : 'Toghan', text: 'It is leaning, Sigurd. Like you, after the wine.', mood: 'warm' },
      },
      {
        shot: { from: [RUFUS_STATUE.x + 4, 2.2, RUFUS_STATUE.z - 13], at: [RUFUS_STATUE.x, 5.4, RUFUS_STATUE.z], fov: FOV.wide },
        duration: 5,
        run: () => {
          felix.place(RUFUS_STATUE.x - 1.6, RUFUS_STATUE.z - 3.2, 0.2).setMood('warm');
          livia.place(RUFUS_STATUE.x + 1.4, RUFUS_STATUE.z - 3.4, -0.3).setMood('warm').setPose('stand');
          felix.lookAt(null);
          livia.lookAt(null);
        },
        narrate: 'In the summer they raised a statue of him in the square. Laughing, with a cup in his hand.',
      },
      {
        shot: () => portrait(felix, { angle: 0.4, distance: 2.4 }),
        say: { who: 'Felix', text: 'He would have hated it. Far too serious.', mood: 'warm' },
      },
      {
        shot: () => portrait(livia, { angle: -0.4, distance: 2.4 }),
        say: { who: 'Livia', text: 'Then we tell his joke under it. Every spring. Badly. Without the end.', mood: 'warm' },
      },
      {
        duration: 7,
        music: 'monastery',
        shot: { from: [-14, 3, 2], at: [-12, 7, 10], to: [-15, 2.2, 4], fov: FOV.normal },
        narrate: 'Monk. Prisoner. Smith. Legate. Emperor. Father. It started with a crooked little cross, and a bell, and a man who walked towards the fire with nothing in his hands. It does not end. Not while there is someone left to tell it.',
      },
      {
        duration: 7,
        shot: { from: [0, 8, 26], at: [0, 6, 50], to: [0, 20, 30], fov: FOV.wide },
        title: { text: 'Tumblehorde', sub: 'The End. Thank you for playing. The city is yours: walk it as long as you like.' },
        fade: { to: 1, time: 6.5 },
      },
    ];
  },
};
