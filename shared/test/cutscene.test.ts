import { describe, expect, it } from 'vitest';
import {
  advanceDialogue,
  type BeatTiming,
  chooseOption,
  createTimeline,
  CUTSCENE,
  type Dialogue,
  isTimelineDone,
  lineDuration,
  openDialogue,
  resumeTimeline,
  skipProgress,
  startTimeline,
  stepTimeline,
  viewDialogue,
} from '../src/campaign/index.ts';

const DT = 1 / 60;
const BEATS: BeatTiming[] = [{ duration: 2 }, { duration: 3 }, { duration: 1 }];

function run(seconds: number, beats: readonly BeatTiming[], held: boolean, timeline = createTimeline()) {
  const ended: { beat: number; skipped: boolean }[] = [];
  const started: number[] = [...startTimeline(timeline, beats).started];
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    const step = stepTimeline(timeline, beats, DT, held);
    ended.push(...step.ended);
    started.push(...step.started);
  }
  return { timeline, ended, started };
}

describe('cutscene timeline', () => {
  it('plays beats in order and finishes', () => {
    const { timeline, ended, started } = run(6.1, BEATS, false);
    expect(started).toEqual([0, 1, 2]);
    expect(ended.map((e) => e.beat)).toEqual([0, 1, 2]);
    expect(ended.every((e) => !e.skipped)).toBe(true);
    expect(isTimelineDone(timeline, BEATS)).toBe(true);
  });

  it('a short tap of Space skips nothing', () => {
    const timeline = createTimeline();
    for (let t = 0; t < CUTSCENE.skipHoldTime / 2; t += DT) stepTimeline(timeline, BEATS, DT, true);
    stepTimeline(timeline, BEATS, DT, false);
    expect(timeline.beat).toBe(0);
    expect(skipProgress(timeline)).toBe(0);
  });

  it('holding Space skips the first beat after a moment, then races through the rest', () => {
    const { ended } = run(CUTSCENE.skipHoldTime + 2 * DT, BEATS, true);
    expect(ended).toEqual([{ beat: 0, skipped: true }]);
    const longer = run(CUTSCENE.skipHoldTime + CUTSCENE.skipRepeatTime * 2 + 4 * DT, BEATS, true);
    expect(longer.ended).toEqual([
      { beat: 0, skipped: true },
      { beat: 1, skipped: true },
      { beat: 2, skipped: true },
    ]);
    expect(CUTSCENE.skipRepeatTime).toBeLessThan(CUTSCENE.skipHoldTime);
  });

  it('letting go of Space starts the next skip from a full hold again', () => {
    const timeline = createTimeline();
    run(CUTSCENE.skipHoldTime + 2 * DT, BEATS, true, timeline);
    stepTimeline(timeline, BEATS, DT, false);
    run(CUTSCENE.skipRepeatTime * 2, BEATS, true, timeline);
    expect(timeline.beat).toBe(1);
  });

  it('waits at a choice until resumed, and Space cannot skip it', () => {
    const beats: BeatTiming[] = [{ duration: 1 }, { duration: 0.5, waits: true }, { duration: 1 }];
    const { timeline } = run(5, beats, true);
    expect(timeline.beat).toBe(1);
    resumeTimeline(timeline);
    const step = stepTimeline(timeline, beats, DT, false);
    expect(step.ended).toEqual([{ beat: 1, skipped: false }]);
    expect(step.started).toEqual([2]);
  });

  it('gives long lines more time', () => {
    expect(lineDuration('Run!')).toBe(CUTSCENE.minLineTime);
    expect(lineDuration('x'.repeat(120))).toBeGreaterThan(lineDuration('x'.repeat(40)));
  });
});

const TALK: Dialogue = {
  start: 'hello',
  nodes: {
    hello: {
      lines: [
        { speaker: 'Varro', text: 'You look like you can take a punch.' },
        { speaker: 'Varro', text: 'The arena pays.' },
      ],
      options: [
        { text: 'I will fight.', next: 'yes', effect: 'acceptJob' },
        { text: 'Not today.', next: null },
      ],
    },
    yes: { lines: [{ speaker: 'Varro', text: 'Good.' }] },
  },
};

describe('dialogue', () => {
  it('walks through lines to a choice and follows the picked option', () => {
    let cursor = openDialogue(TALK);
    expect(viewDialogue(TALK, cursor)).toMatchObject({ kind: 'line', line: { text: 'You look like you can take a punch.' } });
    cursor = advanceDialogue(TALK, advanceDialogue(TALK, cursor));
    const view = viewDialogue(TALK, cursor);
    expect(view.kind).toBe('choice');
    expect(advanceDialogue(TALK, cursor)).toEqual(cursor);
    const picked = chooseOption(TALK, cursor, 0);
    expect(picked.effect).toBe('acceptJob');
    expect(viewDialogue(TALK, picked.cursor)).toMatchObject({ kind: 'line', line: { text: 'Good.' } });
    expect(viewDialogue(TALK, advanceDialogue(TALK, picked.cursor)).kind).toBe('done');
  });

  it('ends on an option without a next node', () => {
    const atChoice = { node: 'hello', line: 2 };
    const picked = chooseOption(TALK, atChoice, 1);
    expect(picked.effect).toBeNull();
    expect(viewDialogue(TALK, picked.cursor).kind).toBe('done');
    expect(chooseOption(TALK, atChoice, 9).cursor).toEqual(atChoice);
  });
});
