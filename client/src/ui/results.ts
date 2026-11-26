import type { MatchView } from '@tumblehorde/shared';
import { paletteForArmy } from '../palettes.ts';
import { byId, escapeHtml, formatTime } from './dom.ts';

export interface ResultsHooks {
  onRematch(): void;
  onMenu(): void;
}

export function resultTitle(view: MatchView, myArmyId: number | null): string {
  if (view.winnerTeam === null) return 'Draw!';
  if (myArmyId === null) return 'Battle over';
  return view.armies[myArmyId]?.team === view.winnerTeam ? 'Victory!' : 'Defeat';
}

/** The after-battle screen: status for every army, duration, kills and deaths. */
export class Results {
  private readonly root = byId('results');
  private readonly title = byId('results-title');
  private readonly sub = byId('results-sub');
  private readonly body = byId('results-body');
  private readonly rematch = byId('results-rematch', HTMLButtonElement);

  constructor(hooks: ResultsHooks) {
    this.rematch.addEventListener('click', () => hooks.onRematch());
    byId('results-menu').addEventListener('click', () => hooks.onMenu());
  }

  show(view: MatchView, myArmyId: number | null, rematchLabel = 'Rematch'): void {
    this.title.textContent = resultTitle(view, myArmyId);
    const winners = view.armies.filter((a) => a.team === view.winnerTeam).map((a) => a.name);
    const winnerText = winners.length > 0 ? ` · Winner: ${winners.join(' & ')}` : '';
    this.sub.textContent = `The battle lasted ${formatTime(view.duration)}${winnerText}`;
    this.body.innerHTML = view.armies
      .map((army) => {
        const color = paletteForArmy(view.armies, army.id, view.mode).body;
        const classes = [army.id === myArmyId ? 'me' : '', army.eliminated ? 'out' : ''].join(' ');
        const status = army.eliminated ? 'wiped out' : `${army.soldiersAlive}/${army.startingSoldiers}`;
        const team = view.mode === 'teams' ? ` <small>(Team ${army.team + 1})</small>` : '';
        return `<tr class="${classes}"><td><span class="dot" style="background:${color}"></span>${escapeHtml(army.name)}${team}</td><td>${status}</td><td>${army.kills}</td><td>${army.deaths}</td><td>${army.commanderDeaths}×</td></tr>`;
      })
      .join('');
    this.rematch.textContent = rematchLabel;
    this.root.hidden = false;
  }

  setRematchEnabled(enabled: boolean, label?: string): void {
    this.rematch.disabled = !enabled;
    if (label) this.rematch.textContent = label;
  }

  hide(): void {
    this.root.hidden = true;
  }

  isHidden(): boolean {
    return this.root.hidden === true;
  }
}
