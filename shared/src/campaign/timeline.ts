import { CUTSCENE } from './config.ts';

/**
 * A cutscene is a list of beats (one shot or one line each) played in order. Holding Space fills
 * a meter; when it is full the current beat ends at once and the meter empties, so a steady hold
 * skips beat by beat and never a whole scene. A beat that waits (a choice) only ends when resumed.
 */

export interface BeatTiming {
  /** Seconds the beat lasts. */
  duration: number;
  /** Stops the timeline until `resumeTimeline` (a choice the player must make). */
  waits?: boolean;
}

export interface Timeline {
  beat: number;
  /** Seconds into the current beat. */
  elapsed: number;
  /** Seconds Space has been held towards the next skip. */
  hold: number;
  /** A waiting beat has been resumed. */
  resumed: boolean;
}

export interface TimelineStep {
  /** Beats that ended this step, with whether they were skipped. */
  ended: { beat: number; skipped: boolean }[];
  /** Beats that started this step, in order. */
  started: number[];
}

export function createTimeline(): Timeline {
  return { beat: 0, elapsed: 0, hold: 0, resumed: false };
}

export function isTimelineDone(timeline: Timeline, beats: readonly BeatTiming[]): boolean {
  return timeline.beat >= beats.length;
}

/** How long a spoken or narrated line stays on screen. */
export function lineDuration(text: string): number {
  return Math.max(CUTSCENE.minLineTime, text.length / CUTSCENE.readingSpeed + CUTSCENE.minLineTime / 2);
}

/** 0..1: how full the skip meter is, for the HUD. */
export function skipProgress(timeline: Timeline): number {
  return Math.min(1, timeline.hold / CUTSCENE.skipHoldTime);
}

function endBeat(timeline: Timeline, step: TimelineStep, skipped: boolean, total: number): void {
  step.ended.push({ beat: timeline.beat, skipped });
  timeline.beat++;
  timeline.elapsed = 0;
  timeline.resumed = false;
  if (timeline.beat < total) step.started.push(timeline.beat);
}

/** The first step of a timeline: beat 0 starts. */
export function startTimeline(timeline: Timeline, beats: readonly BeatTiming[]): TimelineStep {
  return { ended: [], started: beats.length > 0 && timeline.beat === 0 && timeline.elapsed === 0 ? [0] : [] };
}

/** Advances the timeline by `dt` seconds while Space is (or is not) held. */
export function stepTimeline(timeline: Timeline, beats: readonly BeatTiming[], dt: number, skipHeld: boolean): TimelineStep {
  const step: TimelineStep = { ended: [], started: [] };
  const beat = beats[timeline.beat];
  if (!beat) return step;

  if (!skipHeld || beat.waits) {
    timeline.hold = 0;
  } else {
    timeline.hold += dt;
    if (timeline.hold >= CUTSCENE.skipHoldTime) {
      timeline.hold = 0;
      endBeat(timeline, step, true, beats.length);
      return step;
    }
  }

  let left = dt;
  for (let current = beats[timeline.beat]; current; current = beats[timeline.beat]) {
    if (current.waits && !timeline.resumed) {
      timeline.elapsed = Math.min(current.duration, timeline.elapsed + left);
      break;
    }
    const remaining = current.duration - timeline.elapsed;
    if (left < remaining) {
      timeline.elapsed += left;
      break;
    }
    left -= Math.max(0, remaining);
    endBeat(timeline, step, false, beats.length);
  }
  return step;
}

/** Lets a waiting beat (a choice) finish. */
export function resumeTimeline(timeline: Timeline): void {
  timeline.resumed = true;
}
