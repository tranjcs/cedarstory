import { EventBus } from './core/EventBus.js';
import { GameLoop } from './core/GameLoop.js';
import { Input } from './core/Input.js';
import { Camera } from './core/Camera.js';
import { DayCycle } from './core/DayCycle.js';
import { AudioManager } from './core/AudioManager.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { EffectsSystem } from './systems/EffectsSystem.js';
import { Reputation } from './systems/Reputation.js';
import { World } from './world/World.js';
import { MapManager } from './maps/MapManager.js';
import { Net } from './net/Net.js';
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
const reputation = new Reputation(bus);
const world = new World();
const maps = new MapManager();
const daycycle = new DayCycle();
const net = new Net();
const camera = new Camera();
const input = new Input(canvas, bus);
const renderer = new Renderer(canvas);
const hud = new Hud(bus);

/** Shared per-frame context handed to every update — poor man's DI. */
const ctx = {
  bus, world, combat, effects, camera, input, maps, daycycle, net, reputation,
  aim: { x: 0, y: 0 },
  activeClass: null,
};

// place the party on the starting stage (spawns its dummies and enemies)
maps.init(ctx);

// ---- class selection (Mage 5/5, Alchemist 4/5)
const CLASSES = {
  mage: () => new MageClass(bus),
  alchemist: () => new AlchemistClass(bus),
};

function chooseClass(id) {
  if (!CLASSES[id]) return;
  ctx.activeClass = CLASSES[id]();
  world.player.name = document.getElementById('charname')?.value.trim() || 'Wanderer';
  world.player.cls = id;
  classSelect.classList.add('hidden');
  // the controls bar only shows the current class's commands
  for (const el of helpPanel.querySelectorAll('[data-for]')) {
    el.style.display = el.dataset.for === id ? '' : 'none';
  }
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

// ---- co-op panel (O key) — manual WebRTC signaling, no server needed
const coopPanel = document.getElementById('coop');
const coopCode = document.getElementById('coop-code');
const coopStatus = document.getElementById('coop-status');
net.onStatus = (text) => { coopStatus.textContent = text; };
bus.on('input:coop', () => coopPanel.classList.toggle('hidden'));
document.getElementById('coop-host').addEventListener('click', async () => {
  coopStatus.textContent = 'Creating code…';
  coopCode.value = await net.host(ctx);
});
document.getElementById('coop-join').addEventListener('click', () => {
  coopStatus.textContent = 'Paste the host’s code below, then hit Accept.';
  coopCode.value = '';
  coopCode.focus();
});
document.getElementById('coop-copy').addEventListener('click', () => {
  navigator.clipboard?.writeText(coopCode.value);
  coopStatus.textContent = 'Copied. Send it to the other player.';
});
document.getElementById('coop-accept').addEventListener('click', async () => {
  const code = coopCode.value.trim();
  if (!code) return;
  try {
    if (net.role === 'host') await net.acceptAnswer(code);
    else coopCode.value = await net.join(code, ctx);
  } catch {
    coopStatus.textContent = 'That code didn’t take. Paste the whole thing and try again.';
  }
});

// ---- side-effect consumers
bus.on('sfx', ({ id, ...data }) => audio.play(id, data));

// ---- the loop
const loop = new GameLoop({
  update(dt) {
    const worldPos = camera.screenToWorld(input.pointer.x, input.pointer.y);
    ctx.aim.x = worldPos.x;
    ctx.aim.y = worldPos.y;

    const prevPhase = daycycle.phase;
    daycycle.update(dt);
    if (daycycle.phase !== prevPhase) {
      const notices = {
        sunrise: 'Dawn breaks over CedarStory',
        sunset: 'Dusk settles — monsters stir',
        night: 'Nightfall',
      };
      if (notices[daycycle.phase]) bus.emit('announce', { text: notices[daycycle.phase] });
    }
    world.update(dt, ctx);
    maps.update(dt, ctx);
    reputation.update(dt, ctx);
    net.update(dt, ctx);
    ctx.activeClass?.update(dt, ctx);
    effects.update(dt, ctx);
    // inside shops and other small buildings the camera stays put
    const map = maps.current;
    if (map.fixedCamera) camera.update(dt, { x: map.w / 2, y: map.h / 2 });
    else camera.update(dt, world.player);
    hud.update(dt);
  },
  render() {
    renderer.render(ctx);
    hud.render(renderer.g, ctx, renderer.width, renderer.height);
  },
});

loop.start();

// Debug/testing hook — lets devtools (and automated tests) poke the game.
ctx.chooseClass = chooseClass;
window.__cedarstory = ctx;
window.__spellchain = ctx; // legacy alias
