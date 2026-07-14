import { EventBus } from './core/EventBus.js';
import { GameLoop } from './core/GameLoop.js';
import { Input } from './core/Input.js';
import { Camera } from './core/Camera.js';
import { AudioManager } from './core/AudioManager.js';
import { CastSystem } from './spells/CastSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { EffectsSystem } from './systems/EffectsSystem.js';
import { World } from './world/World.js';
import { Renderer } from './render/Renderer.js';
import { Hud } from './render/Hud.js';

/**
 * Composition root: builds every subsystem, wires them together through
 * the event bus and a shared frame context, and starts the loop. This is
 * the only place that knows about all the parts.
 */
const canvas = document.getElementById('game');
const helpPanel = document.getElementById('help');

const bus = new EventBus();
const audio = new AudioManager();
const effects = new EffectsSystem();
const combat = new CombatSystem(bus, effects);
const world = new World();
const camera = new Camera();
const input = new Input(canvas, bus);
const cast = new CastSystem(bus);
const renderer = new Renderer(canvas);
const hud = new Hud(bus);

// a few training dummies to sling spells at
world.spawnDummy(240, -60);
world.spawnDummy(320, 80);
world.spawnDummy(420, -10);

/** Shared per-frame context handed to every update — poor man's DI. */
const ctx = { bus, world, combat, effects, camera, input, cast, aim: { x: 0, y: 0 } };

// ---- wire input intents to game actions (Observer pattern)
bus.on('input:element', ({ element }) => cast.queueElement(element, ctx));
bus.on('input:cast', ({ mode }) => cast.cast(mode, ctx));
bus.on('input:dash', () => world.player.dash(ctx));
bus.on('input:undo', () => cast.undo());
bus.on('input:clear', () => cast.clear());
bus.on('input:spawn-dummy', () => {
  world.spawnDummy(ctx.aim.x, ctx.aim.y);
  bus.emit('sfx', { id: 'spawn' });
});
bus.on('input:mute', () => {
  bus.emit('announce', { text: audio.toggleMute() ? 'Muted' : 'Sound on' });
});
bus.on('input:toggle-help', () => helpPanel.classList.toggle('hidden'));

// ---- side-effect consumers
bus.on('sfx', ({ id, ...data }) => audio.play(id, data));

// ---- the loop
const loop = new GameLoop({
  update(dt) {
    const worldPos = camera.screenToWorld(input.pointer.x, input.pointer.y);
    ctx.aim.x = worldPos.x;
    ctx.aim.y = worldPos.y;

    world.update(dt, ctx);
    cast.update(dt, ctx);
    effects.update(dt, ctx);
    camera.update(dt, world.player);
    hud.update(dt);
  },
  render() {
    renderer.render(ctx);
    hud.render(renderer.g, {
      cast,
      player: world.player,
      width: renderer.width,
      height: renderer.height,
    });
  },
});

loop.start();

// Debug/testing hook — lets devtools (and automated tests) poke the game.
window.__spellchain = ctx;
