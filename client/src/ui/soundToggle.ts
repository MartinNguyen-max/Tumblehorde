import type { AudioEngine } from '../audio/engine.ts';
import { byId } from './dom.ts';

const HINT_KEY = 'tumblehorde.soundHint';

function hintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === 'seen';
  } catch {
    return true;
  }
}

function markHintSeen(): void {
  try {
    localStorage.setItem(HINT_KEY, 'seen');
  } catch {
    // Private mode: the hint may show again next time.
  }
}

/**
 * The speaker button in the top right corner (and `M`). Sound starts off; the first time the
 * game opens, a small bubble points at the button.
 */
export function setupSoundToggle(audio: AudioEngine): void {
  const button = byId('sound-toggle', HTMLButtonElement);
  const hint = byId('sound-hint');
  const render = (): void => {
    button.textContent = audio.enabled ? '🔊' : '🔇';
    button.classList.toggle('on', audio.enabled);
    button.title = audio.enabled ? 'Sound on (M)' : 'Sound off (M)';
  };
  const dismissHint = (): void => {
    hint.hidden = true;
    markHintSeen();
  };
  const toggle = (): void => {
    audio.setEnabled(!audio.enabled);
    dismissHint();
    render();
  };
  button.addEventListener('click', toggle);
  hint.addEventListener('click', dismissHint);
  window.addEventListener('keydown', (e) => {
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    if (e.code === 'KeyM' && !typing && !e.repeat) toggle();
  });
  // A stored "on" still needs a click or key press before the browser lets audio play.
  if (audio.enabled) {
    const resume = (): void => {
      audio.setEnabled(true);
      window.removeEventListener('pointerdown', resume);
    };
    window.addEventListener('pointerdown', resume);
  }
  hint.hidden = hintSeen() || audio.enabled;
  render();
}
