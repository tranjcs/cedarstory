import { rnd, dist2 } from '../core/math.js';
import { StatusEffects } from './StatusEffects.js';

const SPEEDS = {
  villager: 45, elder: 28, guard: 30, kid: 90,
  dog: 110, cat: 120, chicken: 55, cow: 22, ox: 18,
};
const HP = {
  villager: 45, elder: 40, guard: 140, kid: 35,
  dog: 35, cat: 30, chicken: 20, cow: 60, ox: 80,
};
export const ANIMAL_BODIES = new Set(['dog', 'cat', 'chicken', 'cow', 'ox']);

const FEAR_LINES = [
  'Stay away from me!',
  'M-murderer!',
  'Someone call the guards!',
  'Please — I have a family!',
  '*backs away slowly*',
];
const LOVE_LINES = [
  'It’s the hero! Welcome, welcome!',
  'Drinks are on me next time you’re in the tavern!',
  'The town sleeps easier with you around.',
];

/** Fallback small talk for NPC-to-NPC run-ins. */
const GENERIC_CHATTER = [
  'Lovely weather for it.',
  'Did you hear about the wizard?',
  'The Crossing was rough this morning.',
  'Same as always, same as always.',
  'You look well!',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * A townsperson (or town animal). Wanders around a home anchor, speaks to
 * players who walk up, stops for a quick word when bumping into another
 * NPC, and — unless they're a guard or a night-owl — walks home and sleeps
 * after nightfall. `follow` makes them trail the player or a named NPC
 * instead of wandering (the boy's dog, the friendly cat).
 *
 * Special behaviors:
 *   mystery      renderer shows a persistent "?" over their head
 *   cat + follow 'player': dogs terrify it — it bolts and stops following
 *                until the player comes back for it (away from the dog)
 */
export class Npc {
  kind = 'npc';

  constructor(def) {
    this.name = def.name;
    this.body = def.body ?? 'villager';
    this.x = def.x;
    this.y = def.y;
    this.home = { x: def.x, y: def.y };
    this.wander = def.wander ?? 90;
    this.palette = def.palette ?? { robe: '#7c5a3a', hair: '#3f2f1e' };
    this.lines = def.lines ?? [];
    this.chatter = def.chatter ?? null;
    this.follow = def.follow ?? null;
    this.mystery = def.mystery ?? false;
    this.sleeps = def.sleeps ?? (this.body !== 'guard' && !ANIMAL_BODIES.has(this.body));
    this.scale = this.body === 'kid' ? 0.72 : 1;
    this.speed = SPEEDS[this.body] ?? 45;
    this.royal = def.royal ?? false;

    // townsfolk are flesh and blood — spells hurt them, and killing them
    // is very much noticed (see systems/Reputation.js)
    this.hp = def.hp ?? HP[this.body] ?? 45;
    this.maxHp = this.hp;
    this.status = new StatusEffects();
    this.flash = 0;
    this.wobble = 0;
    this.kx = 0;
    this.ky = 0;
    this.dead = false;

    this.state = 'idle';
    this.timer = rnd(0.5, 2.5);
    this.target = null;
    this.walk = 0;
    this.facing = 1; // 1 = right, -1 = left
    this.asleep = false;
    this.scared = false;
    this.fleeTo = null;

    this.talkT = 0;
    this.talkDur = 0;
    this.talkCd = rnd(0, 2);
    this.lineIdx = Math.floor(Math.random() * Math.max(1, this.lines.length));
    this.currentLine = '';
    this.faceX = null;       // look here while talking (chat partner)
    this.socialCd = rnd(6, 18);
    this.pendingReply = 0;   // countdown to answering a chat partner
    this.pendingLine = null;
  }

  /** Blurt a line right now (barks, hisses, chat replies). */
  say(line, dur) {
    this.currentLine = line;
    this.talkDur = dur ?? 1.6 + line.length * 0.04;
    this.talkT = this.talkDur;
  }

  update(dt, ctx) {
    const world = ctx.world;
    const p = world.player;
    this.talkCd = Math.max(0, this.talkCd - dt);
    this.talkT = Math.max(0, this.talkT - dt);
    this.socialCd = Math.max(0, this.socialCd - dt);
    this.status.update(dt);
    this.flash = Math.max(0, this.flash - dt);
    this.wobble = Math.max(0, this.wobble - dt * 2);
    // spell knockback
    this.x += this.kx * dt;
    this.y += this.ky * dt;
    this.kx *= Math.pow(0.01, dt);
    this.ky *= Math.pow(0.01, dt);
    if (this.status.frozen > 0) return; // frozen solid mid-errand

    // ---------------------------------------------------------- sleeping
    const night = ctx.daycycle?.isNight ?? false;
    if (this.asleep) {
      if (!night) this.asleep = false; // morning: everyone's up and out
      return;
    }
    if (night && this.sleeps) {
      const home = this.#homeSpot(world);
      if (dist2(this.x, this.y, home.x, home.y) < 14 ** 2) {
        this.asleep = true;
        this.talkT = 0;
        return;
      }
      this.#stepToward(home.x, home.y, this.speed * 1.2, dt);
      return;
    }

    // --------------------------------------------------- chat replies due
    if (this.pendingReply > 0) {
      this.pendingReply -= dt;
      if (this.pendingReply <= 0 && this.pendingLine) {
        this.say(this.pendingLine);
        this.pendingLine = null;
      }
    }

    // ------------------------------------------- the cat and the dog saga
    // (checked before dialogue — a cat mid-purr still bolts from a dog)
    if (this.body === 'cat' && this.follow === 'player') {
      const dog = world.npcs.find((n) => n.body === 'dog' && !n.asleep);
      const dogD2 = dog ? dist2(this.x, this.y, dog.x, dog.y) : Infinity;
      if (!this.scared && dogD2 < 95 ** 2) {
        this.scared = true;
        const a = Math.atan2(this.y - dog.y, this.x - dog.x);
        this.fleeTo = { x: this.x + Math.cos(a) * 260, y: this.y + Math.sin(a) * 260 };
        this.say('HISSS!', 1.2);
        if (dog.talkT <= 0) dog.say('WOOF! WOOF!', 1.4);
        return;
      }
      if (this.scared) {
        if (this.fleeTo) {
          this.#stepToward(this.fleeTo.x, this.fleeTo.y, this.speed * 1.8, dt);
          if (dist2(this.x, this.y, this.fleeTo.x, this.fleeTo.y) < 12 ** 2) this.fleeTo = null;
        } else if (dist2(this.x, this.y, p.x, p.y) < 70 ** 2 && dogD2 > 180 ** 2) {
          // coaxed back once its person returns (and that beast is gone)
          this.scared = false;
          this.say('Mrrp!', 1.2);
        }
        return; // sulks in place until forgiven
      }
    }

    // ------------------------------------- a murderer walks among them
    const rep = ctx.reputation?.value ?? 0;
    if (rep < 0 && this.body !== 'guard' && !ANIMAL_BODIES.has(this.body)
        && dist2(this.x, this.y, p.x, p.y) < 150 ** 2) {
      if (this.talkCd === 0) {
        this.say(FEAR_LINES[Math.floor(Math.random() * FEAR_LINES.length)]);
        this.talkCd = 6 + rnd(0, 4);
      }
      const a = Math.atan2(this.y - p.y, this.x - p.x);
      this.#stepToward(this.x + Math.cos(a) * 80, this.y + Math.sin(a) * 80, this.speed * 1.4, dt);
      return;
    }

    // mid-sentence: stand still, face the listener
    if (this.talkT > 0) {
      const fx = this.faceX ?? p.x;
      this.facing = fx >= this.x ? 1 : -1;
      return;
    }
    this.faceX = null;

    // ------------------------------------------------------ following
    if (this.follow) {
      const t = this.follow === 'player' ? p : world.npcs.find((n) => n.name === this.follow);
      if (t && !t.asleep) {
        const d = Math.hypot(t.x - this.x, t.y - this.y);
        if (d > 46) {
          this.#stepToward(t.x, t.y, this.speed * (d > 170 ? 1.7 : 1), dt);
        } else {
          this.facing = t.x >= this.x ? 1 : -1;
        }
      }
      this.#tryPlayerDialogue(p, rep);
      return;
    }

    // --------------------------------------------- talk to a passing player
    if (this.#tryPlayerDialogue(p, rep)) return;

    // ----------------------------------------- stop and chat with a neighbor
    if (this.lines.length && this.socialCd === 0 && this.pendingReply <= 0) {
      for (const other of world.npcs) {
        if (other === this || other.asleep || other.follow) continue;
        if (!other.lines.length || other.talkT > 0 || other.socialCd > 0) continue;
        if (dist2(this.x, this.y, other.x, other.y) > 52 ** 2) continue;
        this.faceX = other.x;
        this.say(pick(this.chatter ?? GENERIC_CHATTER));
        other.faceX = this.x;
        other.pendingReply = this.talkDur + 0.3;
        other.pendingLine = pick(other.chatter ?? GENERIC_CHATTER);
        this.socialCd = rnd(25, 45);
        other.socialCd = rnd(25, 45);
        // both linger a moment after the exchange
        this.state = 'idle'; this.timer = this.talkDur + rnd(2, 4);
        other.state = 'idle'; other.timer = this.talkDur + rnd(2, 4);
        return;
      }
    }

    // ------------------------------------------------------------ wander
    if (this.state === 'idle') {
      this.timer -= dt;
      if (this.timer <= 0) {
        const a = rnd(0, Math.PI * 2);
        const r = Math.sqrt(Math.random()) * this.wander;
        this.target = { x: this.home.x + Math.cos(a) * r, y: this.home.y + Math.sin(a) * r };
        this.state = 'walk';
        this.timer = 5; // give up on targets a building is sitting on
      }
    } else {
      this.timer -= dt;
      const d = Math.hypot(this.target.x - this.x, this.target.y - this.y);
      if (d < 6 || this.timer <= 0) {
        this.state = 'idle';
        this.timer = rnd(1.5, 4);
      } else {
        this.#stepToward(this.target.x, this.target.y, this.speed, dt);
      }
    }
  }

  #tryPlayerDialogue(p, rep = 0) {
    if (this.talkCd === 0 && this.lines.length && dist2(this.x, this.y, p.x, p.y) < 70 ** 2) {
      // local heroes get a warmer greeting now and then
      if (rep >= 30 && !ANIMAL_BODIES.has(this.body) && Math.random() < 0.4) {
        this.currentLine = LOVE_LINES[Math.floor(Math.random() * LOVE_LINES.length)];
      } else {
        this.currentLine = this.lines[this.lineIdx % this.lines.length];
        this.lineIdx++;
      }
      this.talkDur = 2.2 + this.currentLine.length * 0.045;
      this.talkT = this.talkDur;
      this.talkCd = this.talkDur + rnd(5, 9);
      this.state = 'idle';
      this.timer = rnd(1, 2);
      return true;
    }
    return false;
  }

  #stepToward(tx, ty, speed, dt) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.x += (dx / d) * speed * dt;
    this.y += (dy / d) * speed * dt;
    this.facing = dx >= 0 ? 1 : -1;
    this.walk += dt * speed * 0.28;
    this.state = 'walk';
  }

  /** Where to sleep: pets curl up at their owner's place. */
  #homeSpot(world) {
    if (this.follow && this.follow !== 'player') {
      const owner = world.npcs.find((n) => n.name === this.follow);
      if (owner) return owner.home;
    }
    return this.home;
  }
}
