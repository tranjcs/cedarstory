import { EventBus } from './core/EventBus.js';
import { GameLoop } from './core/GameLoop.js';
import { Input } from './core/Input.js';
import { Camera } from './core/Camera.js';
import { AudioManager } from './core/AudioManager.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { EffectsSystem } from './systems/EffectsSystem.js';
import { World } from './world/World.js';
import { ChunkManager } from './biomes/ChunkManager.js';
import { MageClass } from './classes/MageClass.js';
import { AlchemistClass } from './classes/AlchemistClass.js';
import { Renderer } from './render/Renderer.js';
import { Hud } from './render/Hud.js';

/**
 * Composition root: builds every subsystem, wires them together through
 * the event bus and a shared frame context, and starts the loop. This is
 * the only place that knows about all the parts.
 */
const canvas = document.getElementById('game');
const helpPanel = document.getElementById('help');
const classSelect = document.getElementById('class-select');

const bus = new EventBus();
const audio = new AudioManager();
const effects = new EffectsSystem();
const combat = new CombatSystem(bus, effects);
const world = new World();
const chunks = new ChunkManager();
const camera = new Camera();
const input = new Input(canvas, bus);
const renderer = new Renderer(canvas);
const hud = new Hud(bus);

// a couple of training dummies near spawn to warm up on
world.spawnDummy(240, -60);
world.spawnDummy(330, 60);

/** Shared per-frame context handed to every update — poor man's DI. */
const ctx = {
  bus, world, combat, effects, camera, input, chunks,
  aim: { x: 0, y: 0 },
  activeClass: null,
};

// ---- class selection (Mage 5/5, Alchemist 4/5)
const CLASSES = {
  mage: () => new MageClass(bus),
  alchemist: () => new AlchemistClass(bus),
};

function chooseClass(id) {
  if (!CLASSES[id]) return;
  ctx.activeClass = CLASSES[id]();
  classSelect.classList.add('hidden');
  bus.emit('announce', { text: ctx.activeClass.name + ' — good hunting' });
}

for (const button of classSelect.querySelectorAll('[data-class]')) {
  button.addEventListener('click', () => chooseClass(button.dataset.class));
}

// ---- wire input intents to game actions (Observer pattern)
bus.on('input:element', ({ element }) => ctx.activeClass?.onElementKey(element, ctx));
bus.on('input:cast', ({ mode }) => ctx.activeClass?.onCast(mode, ctx));
bus.on('input:dash', () => { if (ctx.activeClass) world.player.dash(ctx); });
bus.on('input:undo', () => ctx.activeClass?.cast?.undo());
bus.on('input:clear', () => ctx.activeClass?.cast?.clear());
bus.on('input:spawn-dummy', () => {
  if (!ctx.activeClass) return;
  world.spawnDummy(ctx.aim.x, ctx.aim.y);
  bus.emit('sfx', { id: 'spawn' });
});
bus.on('input:mute', () => {
  bus.emit('announce', { text: audio.toggleMute() ? 'Muted' : 'Sound on' });
});
bus.on('input:toggle-help', () => helpPanel.classList.toggle('hidden'));
bus.on('input:choose', ({ index }) => {
  if (!classSelect.classList.contains('hidden')) {
    chooseClass(['mage', 'alchemist'][index]);
  }
});
bus.on('input:class-select', () => classSelect.classList.toggle('hidden'));

// ---- side-effect consumers
bus.on('sfx', ({ id, ...data }) => audio.play(id, data));

// ---- the loop
const loop = new GameLoop({
  update(dt) {
    const worldPos = camera.screenToWorld(input.pointer.x, input.pointer.y);
    ctx.aim.x = worldPos.x;
    ctx.aim.y = worldPos.y;

    chunks.update(ctx);
    world.update(dt, ctx);
    ctx.activeClass?.update(dt, ctx);
    effects.update(dt, ctx);
    camera.update(dt, world.player);
    hud.update(dt);
  },
  render() {
    renderer.render(ctx);
    hud.render(renderer.g, ctx, renderer.width, renderer.height);
  },
});

loop.start();

// Debug/testing hook — lets devtools (and automated tests) poke the game.
window.__spellchain = ctx;
window.__spellchain.chooseClass = chooseClass;
