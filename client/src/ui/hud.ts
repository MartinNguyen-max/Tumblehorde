import { Matrix, type Scene, Vector3 } from '../render/babylon.ts';
import {
  distanceXZ,
  type Formation,
  HALVES,
  wrapAngle,
  HORSE,
  MATCH,
  type MatchView,
  type Order,
  type SimEvent,
  type UnitKind,
  type UnitView,
} from '@tumblehorde/shared';
import { FORMATION_LABEL, type FormationWheel, WHEEL_OPTIONS } from '../input/formationWheel.ts';
import { paletteForArmy } from '../palettes.ts';
import { EFFECTS, FORMATION_WHEEL, HUD } from '../visualConfig.ts';
import { byId, escapeHtml, formatTime } from './dom.ts';

const ORDER_LABEL: Record<Order, string> = { follow: 'Follow', hold: 'Hold', attack: 'Attack' };
const KIND_LABEL: Record<UnitKind, string> = {
  commander: 'commander',
  swordsman: 'swordsman',
  archer: 'archer',
  rider: 'rider',
  horse: 'horse',
};
const COMMANDER_SHOUTS = ['FOR ROME!', 'ROMA VICTRIX!', 'HOLD THE LINE!', 'NO RETREAT!', 'WITH ME, BROTHERS!', 'GLORY AWAITS!'];
const SOLDIER_CHEERS = ['ROMA!', 'HUZZAH!', 'AVE!', 'RAAAH!', 'HOO-RAH!', '!!!', 'FOR ROME!'];
const CHEER_POPUPS = 6;
const SHOUT_HEIGHT = 2.6;
const HIC_CHANCE = 0.5;
const GROUP_LABELS = ['A', 'B'] as const;
const BANNER_SECONDS = 1.2;
const ALLY_BANNER_SECONDS = 3.5;
const HP_LABEL_HEIGHT = 2.75;
const FOE_LABEL_HEIGHT = 3.4;
const POPUP_RISE = 40;

interface Popup {
  el: HTMLElement;
  /** Negative while waiting to appear. */
  x: number;
  y: number;
  z: number;
  age: number;
}

export interface HudContext {
  view: MatchView;
  myArmyId: number;
  wheel: Pick<FormationWheel, 'isOpen' | 'x' | 'y' | 'choice'>;
  /** After a split: the half that hears orders, or null for the whole army. */
  selectedGroup: number | null;
  scene: Scene;
  dt: number;
}

/** The DOM overlay during a battle. Reads views; never decides anything about the game. */
export class Hud {
  private readonly root = byId('hud');
  private readonly army = byId('hud-army');
  private readonly time = byId('hud-time');
  private readonly notice = byId('hud-notice');
  private readonly mapName = byId('hud-map');
  private readonly prepare = byId('prepare');
  private readonly crosshair = byId('crosshair');
  private readonly kit = byId('hud-kit');
  private readonly hpLabel = byId('hp-label');
  private readonly hpFill = byId('hp-fill');
  private readonly hpText = byId('hp-text');
  private readonly foeLabel = byId('foe-label');
  private readonly toast = byId('toast');
  private readonly banner = byId('banner');
  private readonly centerMsg = byId('center-msg');
  private readonly flash = byId('damage-flash');
  private readonly cmds = byId('hud-cmds');
  private readonly splitLabel = byId('hud-split-label');
  private readonly advanceCmd = byId('hud-advance');
  private readonly volleyCmd = byId('hud-volley');
  private readonly volleyLabel = byId('hud-volley-label');
  private readonly banquetCmd = byId('hud-banquet');
  private readonly banquetLabel = byId('hud-banquet-label');
  private readonly rallyCmd = byId('hud-rally');
  private readonly holdLabel = byId('hud-hold-label');
  private readonly wheel = byId('formation-wheel');
  private wheelDot: HTMLElement = this.wheel;
  private readonly kitShield = byId('kit-shield');
  private readonly kitWeapon = byId('kit-weapon');
  private readonly kitHorse = byId('kit-horse');
  private readonly feed = byId('kill-feed');
  private readonly popupLayer = byId('popups');
  private toastTimer = 0;
  private bannerTimer = 0;
  private flashTimer = 0;
  private popups: Popup[] = [];
  private lastView: MatchView | null = null;
  private myArmyId = 0;

  constructor() {
    this.buildWheel();
  }

  private buildWheel(): void {
    const options = WHEEL_OPTIONS.map((o) => {
      const x = o.dirX * FORMATION_WHEEL.optionDistance;
      const y = o.dirY * FORMATION_WHEEL.optionDistance;
      return `<div class="wheel-opt" data-formation="${o.formation}" style="transform:translate(-50%,-50%) translate(${x}px,${y}px)">${formationIcon(o.formation)}<span>${o.label}</span></div>`;
    });
    this.wheel.innerHTML = `${options.join('')}<div class="wheel-dot" id="wheel-dot"></div><div class="wheel-hint">Release <b>2</b> to form up</div>`;
    this.wheelDot = byId('wheel-dot');
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  setMapName(name: string): void {
    this.mapName.textContent = name;
  }

  reset(): void {
    this.feed.replaceChildren();
    this.popupLayer.replaceChildren();
    this.popups = [];
    this.toast.classList.remove('on');
    this.banner.classList.remove('on');
    this.lastView = null;
  }

  private armyName(view: MatchView, armyId: number): string {
    const army = view.armies[armyId];
    if (!army) return '?';
    if (armyId === this.myArmyId) return 'You';
    const color = paletteForArmy(view.armies, armyId, view.mode);
    return `<span style="color:${color.body};filter:brightness(1.4)">${escapeHtml(army.name)}</span>`;
  }

  private pushFeed(html: string): void {
    const line = document.createElement('div');
    line.innerHTML = html;
    this.feed.prepend(line);
    while (this.feed.children.length > HUD.killFeedMax) this.feed.lastElementChild?.remove();
    setTimeout(() => line.remove(), HUD.killFeedSeconds * 1000);
  }

  private showBanner(text: string, seconds = BANNER_SECONDS): void {
    this.banner.textContent = text;
    this.banner.classList.add('on');
    this.bannerTimer = seconds;
  }

  private plainName(view: MatchView, armyId: number): string {
    return armyId === this.myArmyId ? 'You' : (view.armies[armyId]?.name ?? '?');
  }

  private addPopup(unit: UnitView, text: string, className: string, delay = 0, height = 2.2): void {
    const el = document.createElement('div');
    el.className = `popup ${className}`;
    el.textContent = text;
    el.style.opacity = '0';
    this.popupLayer.append(el);
    this.popups.push({ el, x: unit.x + (Math.random() - 0.5) * 0.6, y: unit.y + height, z: unit.z, age: -delay });
  }

  /** Words fly from the commander's mouth and the soldiers shout back. */
  private showRally(view: MatchView, armyId: number, commanderId: number): void {
    const commander = view.units[commanderId];
    if (!commander) return;
    const lines = [...COMMANDER_SHOUTS].sort(() => Math.random() - 0.5).slice(0, 2);
    lines.forEach((line, i) => this.addPopup(commander, line, 'shout', i * 0.7, SHOUT_HEIGHT + (commander.mountId !== null ? 1 : 0)));
    const soldiers = view.units.filter((u) => u.alive && u.armyId === armyId && u.kind === 'swordsman');
    for (let i = 0; i < Math.min(CHEER_POPUPS, soldiers.length); i++) {
      const soldier = soldiers[Math.floor(Math.random() * soldiers.length)];
      const cheer = SOLDIER_CHEERS[Math.floor(Math.random() * SOLDIER_CHEERS.length)] ?? 'ROMA!';
      if (soldier) this.addPopup(soldier, cheer, 'cheer', 0.4 + Math.random() * 1.2);
    }
  }

  handleEvents(events: readonly SimEvent[], myArmyId: number): void {
    const view = this.lastView;
    if (!view) return;
    this.myArmyId = myArmyId;
    const myCommander = view.armies[myArmyId]?.commanderId ?? -1;
    for (const event of events) {
      switch (event.type) {
        case 'edgePush':
          if (event.unitId === myCommander) {
            this.toast.classList.add('on');
            this.toastTimer = HUD.edgeToastSeconds;
          }
          break;
        case 'hit': {
          const target = view.units[event.targetId];
          if (!target) break;
          if (event.attackerId === myCommander) {
            this.addPopup(target, event.blocked ? 'Blocked!' : `-${Math.round(event.damage)}`, event.blocked ? 'blocked' : '');
          }
          if (event.targetId === myCommander && event.damage > 0) {
            this.flash.classList.add('on');
            this.flashTimer = 0.12;
          }
          break;
        }
        case 'death': {
          const unit = view.units[event.unitId];
          if (!unit || unit.kind === 'horse') break;
          if (unit.kind === 'commander') {
            const killer = event.killerArmyId === null ? '' : event.killerArmyId === myArmyId ? ' by your army' : ` by ${this.armyName(view, event.killerArmyId)}`;
            this.pushFeed(`${this.armyName(view, unit.armyId)} commander knocked out${killer}`);
          } else if (event.killerArmyId === myArmyId && unit.armyId !== myArmyId) {
            this.pushFeed(`Your army felled a ${KIND_LABEL[unit.kind]}`);
          }
          break;
        }
        case 'armyEliminated':
          this.pushFeed(`💀 ${this.armyName(view, event.armyId)} ${event.armyId === myArmyId ? 'are' : 'is'} out!`);
          break;
        case 'respawn':
          if (event.unitId === myCommander) this.showBanner('Back on your feet!');
          break;
        case 'order':
          if (event.armyId === myArmyId) {
            const who = event.group === null ? '' : `Group ${GROUP_LABELS[event.group] ?? ''} · `;
            this.showBanner(`${who}${event.order === 'hold' ? `Hold: ${FORMATION_LABEL[event.formation]}!` : `${ORDER_LABEL[event.order]}!`}`);
          }
          break;
        case 'rally':
          this.showRally(view, event.armyId, event.commanderId);
          break;
        case 'allyOffer':
          if (event.to === myArmyId) this.showBanner(`${this.plainName(view, event.from)} wants to be allies! Look at them and crouch (Ctrl) 4×`, ALLY_BANNER_SECONDS);
          else if (event.from === myArmyId) this.showBanner(`Alliance offered to ${this.plainName(view, event.to)}…`, ALLY_BANNER_SECONDS);
          break;
        case 'alliance': {
          const other = event.a === myArmyId ? event.b : event.b === myArmyId ? event.a : null;
          if (other !== null) this.showBanner(`You and ${this.plainName(view, other)} are allies now!`, ALLY_BANNER_SECONDS);
          this.pushFeed(`🤝 ${this.armyName(view, event.a)} and ${this.armyName(view, event.b)} made an alliance`);
          break;
        }
        case 'volley':
          if (event.armyId === myArmyId) this.showBanner('Spears away!');
          break;
        case 'advance':
          if (event.armyId === myArmyId) this.showBanner(event.group === null ? 'Advance!' : `Group ${GROUP_LABELS[event.group] ?? ''} · Advance!`);
          break;
        case 'split':
          if (event.armyId === myArmyId) this.showBanner(event.groupCount === HALVES ? 'Split in two! Press 4 to pick a half' : 'Together again!');
          break;
        case 'banquet':
          if (event.armyId === myArmyId) this.showBanner('Banquet! Wine for everyone! 🍷');
          break;
        case 'drunk':
          if (event.armyId === myArmyId) this.showBanner('Your legion is VERY drunk!');
          break;
        case 'stumble': {
          const unit = view.units[event.unitId];
          if (unit && Math.random() < HIC_CHANCE) this.addPopup(unit, '*hic*', 'hic', 0, 1.6);
          break;
        }
        case 'mount':
          if (event.riderId === myCommander) this.showBanner('Giddy up!');
          break;
        case 'dismount':
          if (event.riderId === myCommander && event.thrown) this.showBanner('Your horse went down!');
          break;
        default:
          break;
      }
    }
  }

  update(ctx: HudContext): void {
    const { view, myArmyId, dt } = ctx;
    this.lastView = view;
    this.myArmyId = myArmyId;
    const army = view.armies[myArmyId];
    if (!army) return;
    const me = army.commanderId === null ? undefined : view.units[army.commanderId];

    this.army.textContent = `Your army: ${army.soldiersAlive}/${army.startingSoldiers}`;
    this.time.textContent = formatTime(view.duration);
    this.updateDisconnectNotice(view);
    this.updatePrepare(view);

    this.updateOrders(view, me, ctx.selectedGroup);
    this.updateWheel(ctx);
    this.updateKit(view, me);
    this.updateCenterMessage(army.eliminated, me);
    this.updateHpLabel(ctx, me);
    this.updateFoeLabel(ctx);
    this.updatePopups(ctx);

    this.tickTimers(dt);
  }

  /** Online: a disconnected player's army falls when their timer runs out. */
  private updateDisconnectNotice(view: MatchView): void {
    const waiting = view.armies.filter((a) => a.disconnectTimer !== null && !a.eliminated);
    const text = waiting.map((a) => `${a.name} disconnected · army falls in ${Math.ceil(a.disconnectTimer ?? 0)} s`).join(' · ');
    this.notice.hidden = text === '';
    if (this.notice.textContent !== text) this.notice.textContent = text;
  }

  private tickTimers(dt: number): void {
    if (this.toastTimer > 0 && (this.toastTimer -= dt) <= 0) this.toast.classList.remove('on');
    if (this.bannerTimer > 0 && (this.bannerTimer -= dt) <= 0) this.banner.classList.remove('on');
    if (this.flashTimer > 0 && (this.flashTimer -= dt) <= 0) this.flash.classList.remove('on');
  }

  private updateOrders(view: MatchView, me: UnitView | undefined, selected: number | null): void {
    const army = view.armies[this.myArmyId];
    if (!army) return;
    const canOrder = me?.alive === true && army.soldiersAlive > 0 && view.phase === 'playing';
    const split = army.groupCount === HALVES;
    const active = army.orders[selected ?? 0];
    const splitText = !split
      ? 'Split in two'
      : `${GROUP_LABELS.map((name, i) => `${selected === i ? '▸' : ''}${name}: ${ORDER_LABEL[army.orders[i] ?? 'hold']}`).join(' · ')}${selected === null ? ' · ▸Whole army' : ''}`;
    if (this.splitLabel.textContent !== splitText) this.splitLabel.textContent = splitText;
    for (const cmd of this.cmds.querySelectorAll<HTMLElement>('.cmd[data-order]')) {
      cmd.classList.toggle('off', !canOrder);
      cmd.classList.toggle('active', canOrder && cmd.dataset.order === active);
    }
    this.banquetCmd.classList.toggle('off', !canOrder || army.banquet === 'drunk');
    this.banquetCmd.classList.toggle('active', army.banquet === 'feasting');
    const banquetText = army.banquet === 'drunk' ? 'Drunk! 🍷' : 'Banquet 🍷';
    if (this.banquetLabel.textContent !== banquetText) this.banquetLabel.textContent = banquetText;
    this.rallyCmd.classList.toggle('off', !canOrder);
    const holding = selected === null ? army.orders.includes('hold') : army.orders[selected] === 'hold';
    this.advanceCmd.classList.toggle('off', !canOrder || !holding);
    this.volleyCmd.classList.toggle('off', !canOrder || army.spearsThrown);
    const volleyText = army.spearsThrown ? 'Spears thrown' : 'Throw spears';
    if (this.volleyLabel.textContent !== volleyText) this.volleyLabel.textContent = volleyText;
    const label = `Hold · ${FORMATION_LABEL[army.formation]}`;
    if (this.holdLabel.textContent !== label) this.holdLabel.textContent = label;
  }

  /** The formation wheel: a see-through ring, the option the mouse points at lights up. */
  private updateWheel(ctx: HudContext): void {
    const { wheel } = ctx;
    this.wheel.hidden = !wheel.isOpen;
    if (!wheel.isOpen) return;
    const choice = wheel.choice;
    for (const el of this.wheel.querySelectorAll<HTMLElement>('[data-formation]')) {
      el.classList.toggle('on', el.dataset.formation === choice);
    }
    this.wheelDot.style.transform = `translate(${wheel.x}px, ${wheel.y}px)`;
  }

  private updateKit(view: MatchView, me: UnitView | undefined): void {
    const mounted = me?.mountId !== null && me?.mountId !== undefined;
    for (const weapon of this.kit.querySelectorAll<HTMLElement>('.weapon')) {
      weapon.classList.toggle('on', me?.weapon === weapon.dataset.weapon);
    }
    this.kitWeapon.classList.toggle('off', me?.alive !== true);
    this.kitShield.classList.toggle('off', me?.alive !== true);
    this.crosshair.hidden = !(me?.alive && me.weapon === 'bow');
    let horseText = 'Horse · none nearby';
    let ready = false;
    if (mounted) {
      horseText = 'Horse · E to dismount';
      ready = true;
    } else if (me?.alive) {
      const free = view.units.some((u) => u.kind === 'horse' && u.alive && u.riderId === null && distanceXZ(u, me) <= HORSE.mountRange);
      if (free) {
        horseText = 'Horse · E to mount';
        ready = true;
      }
    }
    this.kitHorse.textContent = horseText;
    this.kitHorse.classList.toggle('off', !ready);
    this.kitHorse.classList.toggle('ready', ready && !mounted);
  }

  /** The form-up phase: bots plan and hold, giving the player time to set up. */
  private updatePrepare(view: MatchView): void {
    const left = MATCH.prepareTime - view.time;
    const hasBots = view.armies.some((a) => a.isBot);
    const html = left > 0 && hasBots && view.phase === 'playing' ? `Form up! ${Math.ceil(left)}<small>The enemy marches when the timer runs out</small>` : '';
    if (this.prepare.innerHTML !== html) this.prepare.innerHTML = html;
  }

  private updateCenterMessage(eliminated: boolean, me: UnitView | undefined): void {
    let html = '';
    if (eliminated) html = 'Your army is out!<small>Watching the rest of the battle…</small>';
    else if (me && !me.alive) html = `Knocked out!<small>Patching yourself up… ${Math.ceil(me.respawnTimer)} · your army fights on by itself</small>`;
    if (this.centerMsg.innerHTML !== html) this.centerMsg.innerHTML = html;
  }

  private project(scene: Scene, x: number, y: number, z: number): { x: number; y: number; visible: boolean } {
    const engine = scene.getEngine();
    const camera = scene.activeCamera;
    if (!camera) return { x: 0, y: 0, visible: false };
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    const p = Vector3.Project(new Vector3(x, y, z), Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(width, height));
    const scale = window.innerWidth / width;
    return { x: p.x * scale, y: p.y * scale, visible: p.z > 0 && p.z < 1 };
  }

  private place(el: HTMLElement, ctx: HudContext, x: number, y: number, z: number): boolean {
    const p = this.project(ctx.scene, x, y, z);
    el.style.opacity = p.visible ? '1' : '0';
    if (p.visible) el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
    return p.visible;
  }

  private updateHpLabel(ctx: HudContext, me: UnitView | undefined): void {
    if (!me?.alive) {
      this.hpLabel.style.opacity = '0';
      return;
    }
    const fraction = Math.max(0, me.hp / me.maxHp);
    this.hpFill.style.width = `${fraction * 100}%`;
    this.hpFill.style.background = fraction > 0.5 ? '#5FC24A' : fraction > 0.25 ? '#F0B83A' : '#E0533F';
    this.hpText.textContent = `You · ${Math.ceil(me.hp)} HP`;
    this.place(this.hpLabel, ctx, me.x, me.y + HP_LABEL_HEIGHT, me.z);
  }

  /** Shows the number of enemies in the army you are looking at. */
  private updateFoeLabel(ctx: HudContext): void {
    const { view, scene } = ctx;
    const camera = scene.activeCamera;
    const me = view.armies[this.myArmyId];
    const myTeam = me?.team;
    if (!camera) return;
    // Compare headings only: the camera looks down at the commander, so pitch would hide far armies.
    const forward = camera.getDirection(Vector3.Forward());
    const heading = Math.atan2(forward.x, forward.z);
    const origin = camera.position;
    let best: { angle: number; x: number; y: number; z: number; count: number; armyId: number } | null = null;
    for (const army of view.armies) {
      if (army.team === myTeam || army.eliminated || me?.allies.includes(army.id)) continue;
      let x = 0;
      let y = 0;
      let z = 0;
      let count = 0;
      for (const u of view.units) {
        if (!u.alive || u.armyId !== army.id || u.kind === 'horse') continue;
        x += u.x;
        y += u.y;
        z += u.z;
        count++;
      }
      if (count === 0) continue;
      x /= count;
      y /= count;
      z /= count;
      const distance = Math.hypot(x - origin.x, z - origin.z);
      if (distance > HUD.enemyLookMaxDistance) continue;
      const angle = Math.abs(wrapAngle(Math.atan2(x - origin.x, z - origin.z) - heading));
      if (angle < HUD.enemyLookAngle && (!best || angle < best.angle)) best = { angle, x, y, z, count, armyId: army.id };
    }
    if (!best) {
      this.foeLabel.style.opacity = '0';
      return;
    }
    const palette = paletteForArmy(view.armies, best.armyId, view.mode);
    this.foeLabel.textContent = `× ${best.count}`;
    this.foeLabel.style.background = `${palette.body}D9`;
    this.place(this.foeLabel, ctx, best.x, best.y + FOE_LABEL_HEIGHT, best.z);
  }

  private updatePopups(ctx: HudContext): void {
    this.popups = this.popups.filter((p) => {
      p.age += ctx.dt;
      if (p.age < 0) return true;
      const life = p.age / (p.el.classList.contains('shout') ? EFFECTS.shoutPopupLifetime : EFFECTS.popupLifetime);
      if (life >= 1) {
        p.el.remove();
        return false;
      }
      const pos = this.project(ctx.scene, p.x, p.y, p.z);
      p.el.style.opacity = pos.visible ? String(1 - life * life) : '0';
      p.el.style.transform = `translate(${pos.x}px, ${pos.y - life * POPUP_RISE}px) translate(-50%, -100%)`;
      return true;
    });
  }
}

/** A little top-down sketch of the formation: dots for soldiers, a ring for the commander. */
function formationIcon(formation: Formation): string {
  const dots: [number, number][] = [];
  const rows = (sizes: number[], top: number): void =>
    sizes.forEach((n, r) => {
      for (let i = 0; i < n; i++) dots.push([24 + (i - (n - 1) / 2) * 6, top + r * 5.5]);
    });
  switch (formation) {
    case 'line':
      rows([7], 18);
      break;
    case 'double':
      rows([6, 6], 14);
      break;
    case 'wedge':
      rows([1, 3, 5], 8);
      break;
    case 'pincer':
      // A line in the middle, two wings curling forward round the enemy.
      rows([5, 5], 22);
      for (const side of [-1, 1]) for (const [x, y] of [[17, 18], [19, 12], [19, 6], [15, 3]] as const) dots.push([24 + side * x, y]);
      break;
    case 'square':
      rows([4, 4, 4, 4], 3);
      break;
    case 'circle':
      for (let i = 0; i < 10; i++) dots.push([24 + Math.sin((i / 10) * Math.PI * 2) * 12, 22 - Math.cos((i / 10) * Math.PI * 2) * 12]);
      break;
  }
  const commander = formation === 'circle' ? [24, 22] : [24, 32];
  const circles = dots.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4"/>`).join('');
  return `<svg viewBox="0 0 48 40" aria-hidden="true"><g fill="currentColor">${circles}</g><circle cx="${commander[0]}" cy="${commander[1]}" r="3" fill="none" stroke="#f08a24" stroke-width="2"/></svg>`;
}
