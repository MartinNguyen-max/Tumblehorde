import { Vector3 } from './render/babylon.ts';
import { defaultSettings, MATCH, type MapId, mapFromRandom, type MatchSettings, type MatchView } from '@tumblehorde/shared';
import { GameController } from './game/controller.ts';
import { LocalSession, type Session } from './game/session.ts';
import { InputState } from './input/input.ts';
import { OnlineLobby, roomCodeFromUrl } from './online/lobby.ts';
import { OnlineSession } from './online/onlineSession.ts';
import { BattleRenderer } from './render/battle.ts';
import { FollowCamera } from './render/camera.ts';
import { createWorld, loadMap, setShadowArea, updateWeather } from './render/world.ts';
import { byId } from './ui/dom.ts';
import { Hud } from './ui/hud.ts';
import { Landing, readStoredName } from './ui/landing.ts';
import { Results } from './ui/results.ts';
import { CAMERA, MAP_NAMES } from './visualConfig.ts';
import { AudioEngine } from './audio/engine.ts';
import { BattleAudio } from './audio/battleAudio.ts';
import { setupSoundToggle } from './ui/soundToggle.ts';
import { Campaign } from './campaign/campaign.ts';
import { CampaignMenu } from './campaign/menu.ts';
import { CinematicAudio } from './audio/cinematicAudio.ts';

const DEMO_CAMERA = { distance: 62, pitch: 0.55, height: 1 } as const;
const PLAY_CAMERA = { distance: CAMERA.distance, pitch: CAMERA.startPitch } as const;
const MAX_FRAME_TIME = 0.1;

async function boot(): Promise<void> {
  const canvas = byId('scene', HTMLCanvasElement);
  const world = await createWorld(canvas);
  const renderer = new BattleRenderer(world);
  const camera = new FollowCamera(world.scene);
  const input = new InputState();
  input.attach(canvas);
  const hud = new Hud();
  const audio = new AudioEngine();
  const battleAudio = new BattleAudio(audio);
  setupSoundToggle(audio);
  const campaign = new Campaign({
    world,
    input,
    canvas,
    sound: new CinematicAudio(audio),
    onExit: () => showLanding(),
    startBattle: (settings, onEnd, objective) => {
      const session = new LocalSession(settings, 0);
      startSession(session, () => undefined, (view) => {
        endStoryBattle();
        onEnd(view);
      });
      hud.setStory(objective ? { objective } : null, settings.prepareTime ?? MATCH.prepareTime);
      input.requestLock();
      return session;
    },
    stopBattle: () => endStoryBattle(),
  });
  const campaignMenu = new CampaignMenu({
    onNew: () => {
      enterCampaign();
      campaign.startNew();
    },
    onContinue: () => {
      enterCampaign();
      campaign.continueSaved();
    },
  });
  const clickToPlay = byId('click-to-play');
  const ctpTitle = byId('ctp-title');
  const ctpText = byId('ctp-text');

  let controller: GameController | null = null;
  // Ctrl is crouch, and Ctrl+W closes the tab: ask before a running battle is lost.
  window.addEventListener('beforeunload', (e) => {
    if (controller) e.preventDefault();
  });
  let demo: Session | null = null;
  let rematch: (() => void) | null = null;

  const useMap = (map: MapId): void => {
    renderer.clear();
    loadMap(world, map);
    renderer.setMap(map);
    camera.map = map;
    hud.setMapName(MAP_NAMES[map]);
    hud.setMap(map);
  };

  const startDemo = (settings?: MatchSettings): void => {
    const preview = settings ?? landing.previewSettings();
    useMap(preview.map);
    demo = new LocalSession(preview, null);
    camera.distance = DEMO_CAMERA.distance;
    camera.pitch = DEMO_CAMERA.pitch;
  };

  const stopBattle = (): void => {
    controller?.dispose();
    controller = null;
    input.exitLock();
    hud.setVisible(false);
    results.hide();
    clickToPlay.hidden = true;
    world.edgeMaterial.alpha = 0;
  };

  /** A story battle is over: its soldiers, bodies and stuck spears must not linger into the next scene. */
  const endStoryBattle = (): void => {
    stopBattle();
    renderer.setFirstPerson(null);
    renderer.clear();
  };

  /** The campaign takes over the screen: no battle, no menu, no demo behind it. */
  const enterCampaign = (): void => {
    stopBattle();
    demo = null;
    renderer.clear();
    landing.setVisible(false);
    onlineLobby.hide();
  };

  const showLanding = (message?: string): void => {
    campaign.stop();
    stopBattle();
    onlineLobby.hide();
    landing.setVisible(true);
    if (message) landing.onlineHint.textContent = message;
    startDemo();
    campaignMenu.refresh();
  };

  const showPausePrompt = (paused: boolean, online: boolean, first: boolean): void => {
    clickToPlay.hidden = !paused;
    ctpTitle.textContent = first ? 'Ready?' : 'Paused';
    ctpText.innerHTML = online
      ? 'Click to take command. <b>The battle keeps going</b> while you are here!'
      : 'Click to take command. Press <kbd>Esc</kbd> to pause.';
  };

  const startSession = (session: Session, again: () => void, finished?: (view: MatchView) => void): void => {
    demo = null;
    stopBattle();
    useMap(session.map);
    hud.reset();
    landing.setVisible(false);
    hud.setVisible(true);
    rematch = again;
    camera.distance = PLAY_CAMERA.distance;
    camera.pitch = PLAY_CAMERA.pitch;
    controller = new GameController(session, { world, renderer, camera, input, hud, audio: battleAudio, listener: audio }, {
      onFinished: (view: MatchView) => {
        clickToPlay.hidden = true;
        if (finished) finished(view);
        else results.show(view, session.myArmyId, session.online ? 'Back to lobby' : 'Rematch');
      },
      onPauseChange: (paused) => showPausePrompt(paused, session.online, false),
    });
    showPausePrompt(true, session.online, true);
  };

  const startLocal = (settings: MatchSettings): void => {
    startSession(new LocalSession(settings, 0), () => startLocal({ ...settings, seed: (settings.seed + 1) | 0, map: landing.pickMap() }));
  };

  const onlineLobby = new OnlineLobby({
    onStart: (room, start) => {
      landing.setVisible(false);
      startSession(new OnlineSession(room, start), () => {
        stopBattle();
        onlineLobby.show();
        startDemo();
      });
    },
    onClosed: (reason) => showLanding(reason),
  });

  const enterOnline = async (action: () => Promise<void>): Promise<void> => {
    landing.onlineHint.textContent = 'Connecting…';
    try {
      await action();
      landing.setVisible(false);
      landing.onlineHint.textContent = 'Battle 1–3 friends. Share the room code or link.';
      onlineLobby.show();
    } catch (error) {
      landing.onlineHint.textContent = error instanceof Error ? error.message : 'Could not connect.';
    }
  };

  const landing = new Landing({
    onStartLocal: (settings) => {
      startLocal(settings);
      input.requestLock();
    },
    onCreateRoom: (name) => void enterOnline(() => onlineLobby.create(name)),
    onJoinRoom: (name, code) => void enterOnline(() => onlineLobby.join(name, code)),
    onPreview: (settings) => {
      if (!controller) startDemo(settings);
    },
  });

  const results = new Results({
    onRematch: () => {
      const online = controller?.session.online ?? false;
      rematch?.();
      if (!online) input.requestLock();
    },
    onMenu: () => {
      if (onlineLobby.inRoom) void onlineLobby.leave();
      else showLanding();
    },
  });

  byId('ctp-play').addEventListener('click', () => input.requestLock());
  byId('ctp-quit').addEventListener('click', () => {
    if (controller?.session.online) void onlineLobby.leave();
    else showLanding();
  });
  canvas.addEventListener('click', () => {
    if (controller?.isPaused && results.isHidden()) input.requestLock();
  });

  world.engine.runRenderLoop(() => {
    const dt = Math.min(world.engine.getDeltaTime() / 1000, MAX_FRAME_TIME);
    const now = performance.now() / 1000;
    if (controller) controller.frame(dt, now);
    if (campaign.active) {
      campaign.frame(dt);
    } else if (!controller && demo) {
      demo.update(dt);
      renderer.handleEvents(demo.takeEvents(), now);
      const view = demo.view();
      if (view) {
        renderer.sync(view, dt, now);
        if (view.phase === 'over') startDemo();
      }
      camera.orbit(dt);
      camera.update(dt, { x: 0, y: 0, z: 0 }, DEMO_CAMERA.height);
      setShadowArea(world.sun, Vector3.Zero());
    }
    updateWeather(world, dt);
    world.scene.render();
  });
  window.addEventListener('resize', () => world.engine.resize());

  byId('loading').hidden = true;
  showLanding();

  const linkedCode = roomCodeFromUrl();
  if (await onlineLobby.tryReconnect()) {
    landing.setVisible(false);
    onlineLobby.show();
  } else if (linkedCode) {
    byId('room-code', HTMLInputElement).value = linkedCode;
    if (readStoredName()) void enterOnline(() => onlineLobby.join(landing.playerName(), linkedCode));
    else landing.onlineHint.textContent = `Enter your name and press Join to enter room ${linkedCode}.`;
  }

  // Automated smoke tests drive the game without pointer lock through this hook.
  if (new URLSearchParams(location.search).has('debug')) {
    Object.assign(window, {
      tumblehorde: {
        startLocal: (settings: MatchSettings) => {
          startLocal(settings);
          controller?.setPaused(false);
        },
        unpause: () => controller?.setPaused(false),
        command: (command: Parameters<Session['command']>[0]) => controller?.session.command(command),
        look: (dx: number, dy: number) => camera.look(dx, dy),
        view: () => controller?.session.view() ?? null,
        fastForward: (seconds: number) => {
          for (let t = 0; t < seconds; t += 1 / 60) controller?.session.update(1 / 60);
        },
        cutscene: (id: string) => {
          enterCampaign();
          return campaign.playById(id);
        },
        campaign,
        chapter: (id: Parameters<Campaign['startAt']>[0]) => {
          enterCampaign();
          // Jumping chapters mid-scene: whatever was playing stops first.
          campaign.stop();
          campaign.startAt(id);
        },
        fps: () => world.engine.getFps(),
        scene: world.scene,
        camera,
        session: () => controller?.session ?? null,
        shadows: world.shadows,
        createRoom: (name: string) => enterOnline(() => onlineLobby.create(name)),
        joinRoom: (name: string, code: string) => enterOnline(() => onlineLobby.join(name, code)),
        lobby: () => onlineLobby.current,
      },
    });
  }
}

boot().catch((error: unknown) => {
  console.error(error);
  const text = document.querySelector('.loading-text');
  if (text) text.textContent = 'Something went wrong while loading. Try reloading the page.';
});
