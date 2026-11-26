import { Matrix, type Scene, Vector3 } from '../render/babylon.ts';
import {
  distanceXZ,
  wrapAngle,
  HORSE,
  MATCH,
  type MatchView,
  type Order,
  type SimEvent,
  type UnitKind,
  type UnitView,
} from '@tumblehorde/shared';
import { paletteForArmy } from '../palettes.ts';
import { EFFECTS, HUD } from '../visualConfig.ts';
import { byId, escapeHtml, formatTime } from './dom.ts';

const ORDER_LABEL: Record<Order, string> = { follow: 'Follow', hold: 'Hold', attack: 'Attack' };
const KIND_LABEL: Record<UnitKind, string> = {
  commander: 'commander',
  swordsman: 'swordsman',
  archer: 'archer',
  rider: 'rider',
  horse: 'horse',
};
const HP_LABEL_HEIGHT = 2.75;
const FOE_LABEL_HEIGHT = 3.4;
const POPUP_RISE = 40;

export const GROUP_NAMES = ['Swordsmen', 'Archers', 'Cavalry'] as const;

interface Popup {
  el: HTMLElement;
  x: number;
  y: number;
  z: number;
  age: number;
}

export interface HudContext {
  view: MatchView;
  myArmyId: number;
  /** The group that listens to 1/2/3 (null = whole army). */
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
  private readonly groupTip = byId('hud-group-tip');
  private readonly hpLabel = byId('hp-label');
  private readonly hpFill = byId('hp-fill');
  private readonly hpText = byId('hp-text');
  private readonly foeLabel = byId('foe-label');
  private readonly toast = byId('toast');
  private readonly banner = byId('banner');
  private readonly centerMsg = byId('center-msg');
  private readonly flash = byId('damage-flash');
  private readonly groups = byId('hud-groups');
  private readonly cmds = byId('hud-cmds');
  private readonly kitShield = byId('kit-shield');
  private readonly kitHorse = byId('kit-horse');
  private readonly feed = byId('kill-feed');
  private readonly popupLayer = byId('popups');
  private toastTimer = 0;
  private bannerTimer = 0;
  private flashTimer = 0;
  private popups: Popup[] = [];
  private lastView: MatchView | null = null;
  private myArmyId = 0;

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

  private showBanner(text: string): void {
    this.banner.textContent = text;
    this.banner.classList.add('on');
    this.bannerTimer = 1.2;
  }

  private addPopup(unit: UnitView, text: string, className: string): void {
    const el = document.createElement('div');
    el.className = `popup ${className}`;
    el.textContent = text;
    this.popupLayer.append(el);
    this.popups.push({ el, x: unit.x + (Math.random() - 0.5) * 0.6, y: unit.y + 2.2, z: unit.z, age: 0 });
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
            const who = event.group === null ? 'All' : (GROUP_NAMES[event.group] ?? 'Group');
            this.showBanner(`${who}: ${ORDER_LABEL[event.order]}!`);
          }
          break;
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
    const me = view.units[army.commanderId];

    this.army.textContent = `Your army: ${army.soldiersAlive}/${army.startingSoldiers}`;
    this.time.textContent = formatTime(view.duration);
    this.updateDisconnectNotice(view);
    this.updatePrepare(view);

    this.updateOrders(view, ctx.selectedGroup, me);
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

  private updateOrders(view: MatchView, selected: number | null, me: UnitView | undefined): void {
    const army = view.armies[this.myArmyId];
    if (!army) return;
    const canOrder = me?.alive === true && army.soldiersAlive > 0 && view.phase === 'playing';
    const counts = [0, 0, 0];
    for (const u of view.units) {
      if (u.alive && u.armyId === this.myArmyId && u.kind !== 'commander' && u.kind !== 'horse') counts[u.group] = (counts[u.group] ?? 0) + 1;
    }
    const chips = [`<span class="group ${selected === null ? 'on' : ''}"><b>6</b>Whole army</span>`];
    GROUP_NAMES.forEach((name, i) => {
      const order = ORDER_LABEL[army.orders[i] ?? 'hold'];
      chips.push(`<span class="group ${selected === i ? 'on' : ''}"><b>${i + 7}</b>${name} ${counts[i] ?? 0} · ${order}</span>`);
    });
    const html = chips.join('');
    if (this.groups.dataset.html !== html) {
      this.groups.innerHTML = html;
      this.groups.dataset.html = html;
    }
    const active = selected === null ? (army.orders.every((o) => o === army.orders[0]) ? army.orders[0] : null) : army.orders[selected];
    for (const cmd of this.cmds.querySelectorAll<HTMLElement>('.cmd[data-order]')) {
      cmd.classList.toggle('off', !canOrder);
      cmd.classList.toggle('active', canOrder && cmd.dataset.order === active);
    }
    this.groupTip.textContent = selected === null ? 'Orders go to the whole army' : `Orders go to: ${GROUP_NAMES[selected] ?? ''}`;
  }

  private updateKit(view: MatchView, me: UnitView | undefined): void {
    const mounted = me?.mountId !== null && me?.mountId !== undefined;
    for (const slot of this.kit.querySelectorAll<HTMLElement>('.slot.weapon')) {
      slot.classList.toggle('on', me?.weapon === slot.dataset.weapon);
      slot.classList.toggle('off', me?.alive !== true);
    }
    this.kitShield.classList.toggle('off', me?.weapon === 'bow' || me?.alive !== true);
    this.kitShield.textContent = me?.weapon === 'bow' ? 'Shield · not with the bow' : 'Shield · right click';
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
    const myTeam = view.armies[this.myArmyId]?.team;
    if (!camera) return;
    // Compare headings only: the camera looks down at the commander, so pitch would hide far armies.
    const forward = camera.getDirection(Vector3.Forward());
    const heading = Math.atan2(forward.x, forward.z);
    const origin = camera.position;
    let best: { angle: number; x: number; y: number; z: number; count: number; armyId: number } | null = null;
    for (const army of view.armies) {
      if (army.team === myTeam || army.eliminated) continue;
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
      const life = p.age / EFFECTS.popupLifetime;
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
