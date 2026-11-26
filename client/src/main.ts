import { defaultSettings, type MatchSettings, type MatchView } from '@tumblehorde/shared';
import { GameController } from './game/controller.ts';
import { LocalSession, type Session } from './game/session.ts';
import { InputState } from './input/input.ts';
import { BattleRenderer } from './render/battle.ts';
import { FollowCamera } from './render/camera.ts';
import { createWorld, setShadowArea } from './render/world.ts';
import { byId } from './ui/dom.ts';
import { Hud } from './ui/hud.ts';
import { Landing } from './ui/landing.ts';
import { Results } from './ui/results.ts';
import { Vector3 } from '@babylonjs/core';

const DEMO_ARMY_SIZE = 20;
const DEMO_CAMERA = { distance: 34, pitch: 0.42, height: 1 } as const;
const MAX_FRAME_TIME = 0.1;

async function boot(): Promise<void> {
  const canvas = byId('scene', HTMLCanvasElement);
  const world = await createWorld(canvas);
  const renderer = new BattleRenderer(world);
  const camera = new FollowCamera(world.scene);
  const input = new InputState();
  input.attach(canvas);
  const hud = new Hud();
  const clickToPlay = byId('click-to-play');

  let controller: GameController | null = null;
  let demo: Session | null = null;
  let rematch: (() => void) | null = null;

  const startDemo = (): void => {
    renderer.clear();
    demo = new LocalSession(
      defaultSettings({
        armySize: DEMO_ARMY_SIZE,
        seed: Date.now() | 0,
        armies: [
          { name: 'Blue', team: 0, isBot: true },
          { name: 'Red', team: 1, isBot: true },
        ],
      }),
      null,
    );
    camera.distance = DEMO_CAMERA.distance;
    camera.pitch = DEMO_CAMERA.pitch;
  };

  const showLanding = (): void => {
    controller?.dispose();
    controller = null;
    input.exitLock();
    hud.setVisible(false);
    results.hide();
    clickToPlay.hidden = true;
    landing.setVisible(true);
    startDemo();
  };

  const startSession = (session: Session, again: () => void): void => {
    demo = null;
    renderer.clear();
    hud.reset();
    results.hide();
    landing.setVisible(false);
    hud.setVisible(true);
    rematch = again;
    camera.distance = 9;
    camera.pitch = 0.32;
    controller = new GameController(session, { world, renderer, camera, input, hud }, {
      onFinished: (view: MatchView) => {
        clickToPlay.hidden = true;
        results.show(view, session.myArmyId);
      },
      onPauseChange: (paused) => {
        clickToPlay.hidden = !paused;
        byId('ctp-title').textContent = 'Paused';
      },
    });
    byId('ctp-title').textContent = 'Ready?';
    clickToPlay.hidden = false;
  };

  const startLocal = (settings: MatchSettings): void => {
    startSession(new LocalSession(settings, 0), () => startLocal({ ...settings, seed: (settings.seed + 1) | 0 }));
  };

  const landing = new Landing({
    onStartLocal: (settings) => {
      startLocal(settings);
      input.requestLock();
    },
    onCreateRoom: () => {
      landing.onlineHint.textContent = 'Online play is coming soon.';
    },
    onJoinRoom: () => {
      landing.onlineHint.textContent = 'Online play is coming soon.';
    },
  });

  const results = new Results({
    onRematch: () => {
      rematch?.();
      input.requestLock();
    },
    onMenu: showLanding,
  });

  byId('ctp-play').addEventListener('click', () => input.requestLock());
  byId('ctp-quit').addEventListener('click', showLanding);
  canvas.addEventListener('click', () => {
    if (controller?.isPaused && results.isHidden()) input.requestLock();
  });

  world.engine.runRenderLoop(() => {
    const dt = Math.min(world.engine.getDeltaTime() / 1000, MAX_FRAME_TIME);
    const now = performance.now() / 1000;
    if (controller) {
      controller.frame(dt, now);
    } else if (demo) {
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
    world.scene.render();
  });
  window.addEventListener('resize', () => world.engine.resize());

  byId('loading').hidden = true;
  showLanding();

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
        fps: () => world.engine.getFps(),
      },
    });
  }
}

boot().catch((error: unknown) => {
  console.error(error);
  const text = document.querySelector('.loading-text');
  if (text) text.textContent = 'Something went wrong while loading. Try reloading the page.';
});
