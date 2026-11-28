import { holdForHint, type MatchState, type TutorialStep, tutorialStepDone } from '@tumblehorde/shared';

/** How the battle hints come and go. */
export const TUTORIAL_HINT = {
  /** Seconds before the first hint, so the battle can be seen first. */
  firstDelay: 1.2,
  /** Seconds between one hint being done and the next. */
  gap: 1.5,
  /** Seconds a "well done" tick stays on a finished hint. */
  doneShown: 1.1,
} as const;

function targetOf(step: TutorialStep): HTMLElement | null {
  if (step.points === null) return null;
  if (step.points === 'rally') return document.getElementById('hud-rally');
  return document.querySelector<HTMLElement>(`.cmd[data-order="${step.points}"]`);
}

/**
 * The battle's hints: a line under the objective and a bouncing yellow arrow over the command it
 * names, one after another, each until the player has done what it says.
 */
export class TutorialHint {
  private readonly steps: readonly TutorialStep[];
  private readonly box: HTMLDivElement;
  private readonly arrow: HTMLDivElement;
  private index = 0;
  private shownFor = 0;
  private wait: number = TUTORIAL_HINT.firstDelay;
  private finishing = 0;
  private target: HTMLElement | null = null;
  private readonly formationTip: HTMLElement | null;

  constructor(steps: readonly TutorialStep[]) {
    this.steps = steps;
    this.box = document.createElement('div');
    this.box.className = 'tutorial-hint';
    this.box.hidden = true;
    this.arrow = document.createElement('div');
    this.arrow.className = 'tutorial-arrow';
    this.arrow.textContent = '▼';
    this.arrow.hidden = true;
    document.body.append(this.box, this.arrow);
    // "Keep down: formations" is only spelled out in the battle that teaches it.
    this.formationTip = document.querySelector<HTMLElement>('.cmd[data-order="hold"] .sub');
    if (this.formationTip) this.formationTip.hidden = !steps.some((step) => 'formation' in step.done);
  }

  update(dt: number, state: MatchState): void {
    const step = this.steps[this.index];
    if (!step) return;
    // A hint that must be learned holds the enemy back until it is done.
    if (this.finishing <= 0) holdForHint(state, step);
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) this.show(step);
      return;
    }
    if (this.finishing > 0) {
      this.finishing -= dt;
      if (this.finishing <= 0) this.next();
      return;
    }
    this.shownFor += dt;
    if (tutorialStepDone(step, state, this.shownFor)) {
      this.box.classList.add('done');
      this.hideArrow();
      this.finishing = TUTORIAL_HINT.doneShown;
      return;
    }
    this.placeArrow();
  }

  private show(step: TutorialStep): void {
    this.shownFor = 0;
    this.box.textContent = step.text;
    this.box.classList.remove('done');
    this.box.hidden = false;
    this.target = targetOf(step);
    this.target?.classList.add('tutorial-target');
    this.arrow.hidden = this.target === null;
    this.placeArrow();
  }

  private next(): void {
    this.box.hidden = true;
    this.index++;
    this.wait = TUTORIAL_HINT.gap;
  }

  private placeArrow(): void {
    if (!this.target) return;
    const r = this.target.getBoundingClientRect();
    this.arrow.style.left = `${r.left + r.width / 2}px`;
    this.arrow.style.top = `${r.top}px`;
  }

  private hideArrow(): void {
    this.target?.classList.remove('tutorial-target');
    this.target = null;
    this.arrow.hidden = true;
  }

  dispose(): void {
    if (this.formationTip) this.formationTip.hidden = false;
    this.hideArrow();
    this.box.remove();
    this.arrow.remove();
  }
}
